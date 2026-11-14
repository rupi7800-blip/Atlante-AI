// Verifiche di modulo e adattamento del percorso.
import { all, get, run, pj, j, tx, logActivity } from '../db.js';
import { scheduleRemaining } from './planner.js';
import { notify } from './notifier.js';

export const PASS_THRESHOLD = 70;

export class QuizError extends Error {}

function loadPathModule(pmId, userId) {
  const pm = get(`SELECT pm.*, m.title, m.topic_slug, p.user_id, p.id AS path_id FROM path_modules pm
    JOIN modules m ON m.id = pm.module_id JOIN study_paths p ON p.id = pm.path_id WHERE pm.id = ?`, pmId);
  if (!pm || pm.user_id !== userId) throw new QuizError('Verifica non trovata');
  return pm;
}

export function quizStatus(pm) {
  const pending = get(`SELECT COUNT(*) AS n FROM path_lessons WHERE path_module_id = ? AND status = 'da_fare'`, pm.id).n;
  if (pm.status === 'bloccato') return { available: false, reason: 'Completa prima il modulo precedente.' };
  if (pending > 0) return { available: false, reason: `Completa prima le lezioni del modulo (${pending} rimanenti).` };
  return { available: true };
}

/** Domande senza soluzioni, da mostrare all'utente. */
export function getQuiz(pmId, userId) {
  const pm = loadPathModule(pmId, userId);
  const st = quizStatus(pm);
  const qs = all('SELECT id, kind, prompt, options FROM questions WHERE module_id = ? ORDER BY id', pm.module_id)
    .map((q) => ({ id: q.id, kind: q.kind, prompt: q.prompt, options: pj(q.options, []) }));
  return { pathModuleId: pm.id, pathId: pm.path_id, title: pm.title, status: pm.status, bestScore: pm.best_score, attempts: pm.attempts, ...st, questions: qs, threshold: PASS_THRESHOLD };
}

/** Valuta una risposta aperta confrontandola con i concetti attesi della griglia. */
export function gradeOpen(answer, rubric) {
  const text = String(answer || '').toLowerCase();
  const groups = rubric?.concepts || [];
  if (!groups.length) return { score: 0, found: [], missing: [] };
  const found = []; const missing = [];
  for (const g of groups) (g.some((w) => text.includes(w.toLowerCase())) ? found : missing).push(g[0]);
  return { score: Math.round((found.length / groups.length) * 100), found, missing };
}

export function submitQuiz(pmId, user, answers) {
  const pm = loadPathModule(pmId, user.id);
  const st = quizStatus(pm);
  if (!st.available) throw new QuizError(st.reason);
  const qs = all('SELECT * FROM questions WHERE module_id = ? ORDER BY id', pm.module_id);
  if (!qs.length) throw new QuizError('Nessuna domanda disponibile per questo modulo');

  const results = qs.map((q) => {
    const given = answers?.[q.id];
    if (q.kind === 'aperta') {
      const g = gradeOpen(given, pj(q.rubric, {}));
      return { questionId: q.id, prompt: q.prompt, kind: q.kind, given: String(given ?? ''), correct: g.score >= 60, score: g.score, missing: g.missing, explanation: q.explanation, skill: q.skill };
    }
    const ok = Number(given) === q.answer_index;
    return { questionId: q.id, prompt: q.prompt, kind: q.kind, given: given ?? null, correctIndex: q.answer_index, options: pj(q.options, []), correct: ok, score: ok ? 100 : 0, explanation: q.explanation, skill: q.skill };
  });
  const score = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
  const passed = score >= PASS_THRESHOLD;

  const outcome = tx(() => {
    run('INSERT INTO quiz_attempts(user_id, path_module_id, module_id, score, passed, answers) VALUES (?,?,?,?,?,?)', user.id, pm.id, pm.module_id, score, passed ? 1 : 0, j(results));
    run('UPDATE path_modules SET attempts = attempts + 1, best_score = MAX(COALESCE(best_score, 0), ?) WHERE id = ?', score, pm.id);
    // competenze: media per skill
    const bySkill = {};
    for (const r of results) { const k = r.skill || pm.topic_slug; (bySkill[k] ||= []).push(r.score); }
    for (const [skill, arr] of Object.entries(bySkill)) {
      run('INSERT INTO user_skill_events(user_id, skill, score, source) VALUES (?,?,?,?)', user.id, skill, arr.reduce((a, b) => a + b, 0) / arr.length, 'quiz');
    }
    run(`UPDATE study_paths SET last_activity_at = datetime('now') WHERE id = ?`, pm.path_id);
    logActivity(user.id, 'verifica', `${pm.title}: ${score}%`, 10);

    if (passed) {
      run(`UPDATE path_modules SET status = 'completato' WHERE id = ?`, pm.id);
      const next = get(`SELECT id FROM path_modules WHERE path_id = ? AND order_index > ? AND status = 'bloccato' ORDER BY order_index LIMIT 1`, pm.path_id, pm.order_index);
      if (next) run(`UPDATE path_modules SET status = 'attivo' WHERE id = ?`, next.id);
      const open = get(`SELECT COUNT(*) AS n FROM path_modules WHERE path_id = ? AND status != 'completato'`, pm.path_id).n;
      if (!open) run(`UPDATE study_paths SET status = 'completato' WHERE id = ?`, pm.path_id);
      return { passed, nextUnlocked: !!next, pathCompleted: !open };
    }
    // non superata: lezione di rinforzo mirata sulle risposte sbagliate
    const wrong = results.filter((r) => !r.correct);
    const lessonId = createReinforcementLesson(pm, wrong, score);
    run(`UPDATE path_modules SET status = 'rinforzo' WHERE id = ?`, pm.id);
    const maxOrder = get('SELECT COALESCE(MAX(order_index), 0) AS m FROM path_lessons WHERE path_module_id = ?', pm.id).m;
    run('INSERT INTO path_lessons(path_id, path_module_id, lesson_id, order_index, added_reason) VALUES (?,?,?,?,?)', pm.path_id, pm.id, lessonId, maxOrder + 1, `Rinforzo dopo verifica (${score}%)`);
    return { passed, reinforcementLessonId: lessonId };
  });

  scheduleRemaining(pm.path_id, user.timezone);
  if (outcome.passed) {
    notify(user.id, { kind: 'verifica', title: `Verifica superata: ${pm.title}`, body: `Punteggio ${score}%. ${outcome.nextUnlocked ? 'Il modulo successivo è sbloccato.' : outcome.pathCompleted ? 'Percorso completato!' : ''}`, link: `#/percorsi/${pm.path_id}` }).catch(() => {});
  } else {
    notify(user.id, { kind: 'verifica', title: `Da rinforzare: ${pm.title}`, body: `Punteggio ${score}% (soglia ${PASS_THRESHOLD}%). È stata aggiunta una lezione di rinforzo.`, link: `#/percorsi/${pm.path_id}` }).catch(() => {});
  }
  return { score, passed, threshold: PASS_THRESHOLD, results, ...outcome };
}

function createReinforcementLesson(pm, wrong, score) {
  const original = all(`SELECT l.title FROM path_lessons pl JOIN lessons l ON l.id = pl.lesson_id WHERE pl.path_module_id = ? AND l.kind != 'rinforzo' ORDER BY pl.order_index`, pm.id);
  const exercises = all(`SELECT e.title, e.id FROM exercises e WHERE e.module_id = ?`, pm.module_id);
  const parts = wrong.map((r, i) => {
    const correct = r.kind === 'aperta' ? `Concetti attesi non trovati: ${r.missing.join(', ')}` : r.options[r.correctIndex];
    return `### ${i + 1}. ${r.prompt}\n**Risposta corretta:** ${correct}\n\n${r.explanation}`;
  }).join('\n\n');
  const content = `
Nella verifica hai ottenuto **${score}%** (soglia ${PASS_THRESHOLD}%). Ripassiamo i punti in cui hai sbagliato.

${parts}

### Cosa fare ora
1. Rileggi le lezioni del modulo: ${original.map((o) => `*${o.title}*`).join(', ')}.
2. Per ogni domanda sopra, prova a spiegare con parole tue **perché** la risposta corretta è quella.
${exercises.length ? `3. Svolgi l’esercizio pratico: ${exercises.map((e) => `**${e.title}** (#/laboratorio/${e.id})`).join(', ')}.\n4.` : '3.'} Quando ti senti pronto, ripeti la verifica.
`.trim();
  const attempt = get('SELECT attempts FROM path_modules WHERE id = ?', pm.id).attempts;
  const r = run(`INSERT INTO lessons(module_id, slug, title, content, kind, est_minutes, order_index, origin) VALUES (?,?,?,?, 'rinforzo', 15, 99, 'generato_da_risultati')`,
    pm.module_id, `rinforzo-${pm.id}-${attempt}-${Date.now()}`, `Rinforzo: ${pm.title}`, content);
  return Number(r.lastInsertRowid);
}

export function completeLesson(pathLessonId, user, minutes) {
  const pl = get(`SELECT pl.*, p.user_id, pm.status AS module_status, l.title, l.est_minutes FROM path_lessons pl
    JOIN study_paths p ON p.id = pl.path_id JOIN path_modules pm ON pm.id = pl.path_module_id JOIN lessons l ON l.id = pl.lesson_id WHERE pl.id = ?`, pathLessonId);
  if (!pl || pl.user_id !== user.id) throw new QuizError('Lezione non trovata');
  if (pl.module_status === 'bloccato') throw new QuizError('Questo modulo non è ancora sbloccato.');
  if (pl.status === 'completata') return { alreadyDone: true };
  const mins = Math.max(1, Math.min(240, Number(minutes) || pl.est_minutes));
  run(`UPDATE path_lessons SET status = 'completata', completed_at = datetime('now'), minutes_spent = ? WHERE id = ?`, mins, pl.id);
  run(`UPDATE study_paths SET last_activity_at = datetime('now') WHERE id = ?`, pl.path_id);
  // segna come svolte le sessioni passate che contenevano questa lezione
  run(`UPDATE study_sessions SET status = 'svolta' WHERE path_id = ? AND status = 'pianificata' AND starts_at <= ? AND lesson_ids LIKE ?`,
    pl.path_id, new Date().toISOString(), `%"id":${pl.id}}%`);
  logActivity(user.id, 'lezione', pl.title, mins);
  const pending = get(`SELECT COUNT(*) AS n FROM path_lessons WHERE path_module_id = ? AND status = 'da_fare'`, pl.path_module_id).n;
  if (!pending) {
    notify(user.id, { kind: 'verifica', title: 'Verifica disponibile', body: 'Hai completato le lezioni del modulo: ora puoi svolgere la verifica.', link: `#/verifica/${pl.path_module_id}`, dedupe: `quiz-ready-${pl.path_module_id}-${Date.now()}` }).catch(() => {});
  }
  return { ok: true, quizReady: !pending, pathModuleId: pl.path_module_id };
}
