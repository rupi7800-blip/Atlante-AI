import { api, html, toast, on, formData, fmtDate, fmtRel, LEVELS } from '../lib.js';

// ---------- Verifiche ----------
export async function quizzes() {
  const [list, attempts] = await Promise.all([api('/quizzes'), api('/quiz-attempts')]);
  const ready = list.filter((q) => q.available && q.status !== 'completato');
  return {
    title: 'Verifiche',
    html: html`
    <div class="page-head"><div><h1>Verifiche</h1><p>Ogni modulo si chiude con una verifica. Con almeno il 70% il modulo è completato e si sblocca il successivo; altrimenti ricevi una lezione di rinforzo mirata sugli errori.</p></div></div>
    <div class="grid c2">
      <div class="card"><h2>Da svolgere</h2>
        ${ready.length ? html`<ul class="list">${ready.map((q) => html`<li class="row between"><div><strong>${q.title}</strong><div class="faint">${q.pathTitle}${q.attempts ? ` · ${q.attempts} tentativi` : ''}</div></div><a class="btn primary sm" href="#/verifica/${q.id}">Svolgi</a></li>`)}</ul>`
    : html`<div class="empty">Nessuna verifica pronta. Completa le lezioni dei moduli in corso.</div>`}
        <h3 class="mt">In preparazione</h3>
        <ul class="list small">${list.filter((q) => !q.available && q.status !== 'completato').map((q) => html`<li><strong>${q.title}</strong> <span class="faint">— ${q.reason}</span></li>`)}</ul>
      </div>
      <div class="card"><h2>Risultati</h2>
        ${attempts.length ? html`<div class="table-wrap"><table><thead><tr><th>Modulo</th><th>Data</th><th>Punteggio</th></tr></thead><tbody>
        ${attempts.map((a) => html`<tr><td>${a.title}</td><td class="nowrap">${fmtDate(a.created_at)}</td><td><span class="badge ${a.passed ? 'ok' : 'warn'}">${Math.round(a.score)}%</span></td></tr>`)}</tbody></table></div>`
    : html`<div class="empty">Nessun tentativo ancora.</div>`}
      </div>
    </div>`,
  };
}

export async function quiz({ params: [pmId] }) {
  const q = await api(`/quiz/${pmId}`);
  return {
    title: `Verifica: ${q.title}`,
    html: html`
    <div class="page-head"><div><p><a href="#/percorsi/${q.pathId}">← Percorso</a></p><h1>Verifica: ${q.title}</h1>
      <p>${q.questions.length} domande · soglia di superamento ${q.threshold}%${q.attempts ? ` · tentativi precedenti: ${q.attempts}, migliore ${Math.round(q.bestScore)}%` : ''}</p></div></div>
    ${!q.available ? html`<div class="notice warn">${q.reason}</div>` : html`
    <form class="card" id="quiz">
      ${q.questions.map((x, i) => html`<div class="q"><p><strong>${i + 1}. ${x.prompt}</strong></p>
        ${x.kind === 'aperta' ? html`<textarea name="${x.id}" required placeholder="Scrivi la tua risposta"></textarea>`
    : x.options.map((o, k) => html`<label class="opt"><input type="radio" name="${x.id}" value="${k}" required> <span>${o}</span></label>`)}</div>`)}
      <div class="row mt"><span class="muted small">Rispondi a tutte le domande.</span><span class="spacer"></span><button class="btn primary">Consegna</button></div>
    </form>`}
    <div id="result"></div>`,
    mount(el) {
      const f = el.querySelector('#quiz');
      if (!f) return;
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const answers = formData(f);
        if (Object.keys(answers).length < q.questions.length) return toast('Rispondi a tutte le domande', true);
        f.querySelector('button').disabled = true;
        const r = await api(`/quiz/${pmId}`, { method: 'POST', body: { answers } });
        f.classList.add('hidden');
        el.querySelector('#result').innerHTML = html`
        <div class="card"><div class="row"><div class="score-big">${r.score}%</div><div><h2 class="mb0">${r.passed ? 'Verifica superata' : 'Competenza da rinforzare'}</h2>
          <p class="muted mb0">${r.passed ? (r.pathCompleted ? 'Hai completato l’intero percorso!' : r.nextUnlocked ? 'Il modulo successivo è stato sbloccato.' : 'Modulo completato.') : `Soglia ${r.threshold}%. È stata aggiunta una lezione di rinforzo con le spiegazioni delle risposte sbagliate.`}</p></div></div>
          <div class="row mt">${!r.passed && r.reinforcementLessonId ? html`<a class="btn primary" href="#/percorsi/${q.pathId}">Vai alla lezione di rinforzo</a>` : html`<a class="btn primary" href="#/percorsi/${q.pathId}">Torna al percorso</a>`}</div></div>
        <div class="card"><h2>Correzione</h2>${r.results.map((x, i) => html`<div class="q"><p><strong>${i + 1}. ${x.prompt}</strong> ${x.correct ? html`<span class="badge ok">corretta</span>` : html`<span class="badge danger">errata</span>`}</p>
          ${x.kind === 'aperta' ? html`<p class="small">La tua risposta: ${x.given}</p>${x.missing?.length ? html`<p class="small muted">Concetti mancanti: ${x.missing.join(', ')}</p>` : ''}`
    : x.options.map((o, k) => html`<div class="opt ${k === x.correctIndex ? 'right' : Number(x.given) === k ? 'wrong' : ''}">${o}</div>`)}
          <p class="small muted mt">${x.explanation}</p></div>`)}</div>`.s;
        window.scrollTo(0, 0);
      });
    },
  };
}

// ---------- Laboratorio pratico ----------
export async function lab() {
  const [list, subs] = await Promise.all([api('/exercises'), api('/submissions')]);
  return {
    title: 'Laboratorio pratico',
    html: html`
    <div class="page-head"><div><h1>Laboratorio pratico</h1><p>Compiti realistici: scrivi il prompt, eseguilo sull’AI che preferisci, incolla il risultato e ricevi una valutazione con correzioni e suggerimenti.</p></div></div>
    <div class="grid auto">${list.map((e) => html`<div class="card tool-card"><div class="row between"><span class="badge">${LEVELS[e.level]}</span>${e.bestScore != null ? html`<span class="badge ${e.bestScore >= 70 ? 'ok' : 'warn'}">migliore ${Math.round(e.bestScore)}/100</span>` : ''}</div>
      <a href="#/laboratorio/${e.id}"><strong>${e.title}</strong></a><p>${e.brief.slice(0, 160)}${e.brief.length > 160 ? '…' : ''}</p>${e.moduleTitle ? html`<div class="faint">Modulo: ${e.moduleTitle}</div>` : ''}</div>`)}</div>
    <div class="card mt"><h2>Archivio dei tuoi elaborati</h2>
      ${subs.length ? html`<div class="table-wrap"><table><thead><tr><th>Esercizio</th><th>Data</th><th>Valutazione</th><th>Punteggio</th></tr></thead><tbody>
      ${subs.map((s) => html`<tr><td><a href="#/elaborato/${s.id}">${s.title}</a></td><td class="nowrap">${fmtDate(s.created_at)}</td><td class="small">${s.evaluator === 'regole' ? 'a regole' : s.evaluator}</td><td><span class="badge ${s.score >= 70 ? 'ok' : 'warn'}">${Math.round(s.score)}/100</span></td></tr>`)}</tbody></table></div>`
    : html`<div class="empty">Non hai ancora consegnato esercizi.</div>`}</div>`,
  };
}

function evaluationView(ev) {
  return html`
  <div class="row"><div class="score-big">${Math.round(ev.score)}</div><div><strong>/100</strong><div class="faint">${ev.evaluator === 'regole' ? 'Valutazione a regole' : `Valutazione AI (${ev.evaluator.replace('ai:', '')})`}</div></div></div>
  <p class="small muted">${ev.method}</p>
  <h3>Criteri</h3>
  ${ev.criteria.map((c) => html`<div class="crit"><div><strong>${c.label}</strong>${c.comment ? html`<div class="small muted">${c.comment}</div>` : ''}</div><progress max="10" value="${c.score}"></progress><span class="small">${c.score}/10</span></div>`)}
  ${ev.strengths?.length ? html`<h3 class="mt">Punti di forza</h3><ul>${ev.strengths.map((s) => html`<li>${s}</li>`)}</ul>` : ''}
  ${ev.suggestions?.length ? html`<h3 class="mt">Correzioni e suggerimenti</h3><ul>${ev.suggestions.map((s) => html`<li>${s}</li>`)}</ul>` : ''}
  ${ev.resultErrors?.length ? html`<h3 class="mt">Possibili errori nel risultato</h3><ul>${ev.resultErrors.map((s) => html`<li>${s}</li>`)}</ul>` : ''}
  ${ev.improvedPrompt ? html`<h3 class="mt">Versione migliorata proposta</h3><pre>${ev.improvedPrompt}</pre>` : ''}`;
}

export async function exercise({ params: [id] }) {
  const e = await api(`/exercises/${id}`);
  return {
    title: e.title,
    html: html`
    <div class="page-head"><div><p><a href="#/laboratorio">← Laboratorio</a></p><h1>${e.title}</h1><p>${LEVELS[e.level]}</p></div></div>
    <div class="grid c2">
      <div class="stack">
        <div class="card"><h2>Il compito</h2><p>${e.brief}</p>
          <h3>Come verrai valutato</h3><ul>${e.rubric.map((r) => html`<li>${r.label} <span class="faint">(peso ${r.weight})</span></li>`)}</ul>
          <h3>Dove svolgerlo</h3><p class="small muted">Usa l’AI che preferisci direttamente sul servizio ufficiale. La piattaforma non accede ai tuoi account.</p>
          <div class="chips">${e.tools.map((t) => html`<a class="chip" href="${t.website}" target="_blank" rel="noopener">${t.name} ↗</a>`)}</div></div>
        ${e.history.length ? html`<div class="card"><h3>Tentativi precedenti</h3><ul class="list small">${e.history.map((h) => html`<li class="row between"><a href="#/elaborato/${h.id}">${fmtRel(h.created_at)}</a><span class="badge ${h.score >= 70 ? 'ok' : 'warn'}">${Math.round(h.score)}/100</span></li>`)}</ul></div>` : ''}
      </div>
      <div class="stack">
        <form class="card" id="sub">
          <div class="field"><label for="prompt">Il tuo prompt</label><textarea class="code" id="prompt" name="prompt" required rows="9" placeholder="Scrivi qui il prompt che useresti…"></textarea></div>
          <div class="field"><label for="result">Risultato ottenuto <span class="muted">(facoltativo, consigliato)</span></label><textarea id="result" name="result" rows="6" placeholder="Incolla la risposta dell’AI"></textarea></div>
          <div class="field"><label for="reflection">Riflessione <span class="muted">(errori individuati, miglioramenti fatti)</span></label><textarea id="reflection" name="reflection" rows="3"></textarea></div>
          ${e.aiProviders.length ? html`<label class="check"><input type="checkbox" name="useAi"> Valutazione approfondita con AI interna (${e.aiProviders[0].name})</label>`
    : html`<p class="faint">La valutazione è a regole. La valutazione con AI sarà disponibile quando l’amministratore configurerà un provider AI interno.</p>`}
          <div class="row mt"><span class="spacer"></span><button class="btn primary">Valuta</button></div>
        </form>
        <div class="card hidden" id="ev"></div>
      </div>
    </div>`,
    mount(el) {
      el.querySelector('#sub').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const b = ev.target.querySelector('button'); b.disabled = true; b.textContent = 'Valutazione in corso…';
        try {
          const r = await api(`/exercises/${id}/submit`, { method: 'POST', body: formData(ev.target) });
          const box = el.querySelector('#ev'); box.innerHTML = evaluationView(r).s; box.classList.remove('hidden'); box.scrollIntoView({ behavior: 'smooth' });
        } catch (err) { toast(err.message, true); } finally { b.disabled = false; b.textContent = 'Valuta di nuovo'; }
      });
    },
  };
}

export async function submission({ params: [id] }) {
  const s = await api(`/submissions/${id}`);
  return {
    title: s.title,
    html: html`<div class="page-head"><div><p><a href="#/laboratorio/${s.exercise_id}">← Esercizio</a></p><h1>${s.title}</h1><p>${fmtDate(s.created_at)}</p></div></div>
    <div class="grid c2"><div class="card"><h3>Prompt</h3><pre>${s.prompt_text}</pre>${s.result_text ? html`<h3>Risultato e riflessione</h3><pre>${s.result_text}</pre>` : ''}</div>
    <div class="card">${evaluationView(s.evaluation)}</div></div>`,
  };
}

// ---------- Laboratorio prompt ----------
const TEMPLATES = [
  { cat: 'Produzione di contenuti', title: 'Articolo divulgativo', text: 'CONTESTO: Scrivo per il blog di {organizzazione}, lettori {pubblico}.\nCOMPITO: Scrivi un articolo su {argomento}.\nFORMATO: titolo, introduzione di 2 frasi, 3 sezioni con sottotitolo, conclusione con invito all’azione. Massimo {n} parole.\nVINCOLI: tono {tono}; spiega i termini tecnici tra parentesi; se citi dati indica la fonte, altrimenti scrivi "da verificare".' },
  { cat: 'Analisi dei dati', title: 'Estrazione in tabella', text: 'Dal testo tra <documento> estrai una tabella con colonne: {colonna1} | {colonna2} | {colonna3}.\nSe un dato non è presente scrivi "N/D": non dedurre valori non scritti.\nUsa la virgola come separatore decimale.\n<documento>\n{testo}\n</documento>' },
  { cat: 'Economia e finanza', title: 'Sintesi di un bilancio', text: 'Sono {ruolo} e devo presentare al consiglio i risultati di {azienda}.\nAnalizza il documento allegato e produci:\n1) tabella con ricavi, EBITDA, utile netto, indebitamento degli ultimi 2 esercizi (con numero di pagina della fonte);\n2) 5 punti chiave;\n3) 3 rischi.\nSe un valore manca scrivi "N/D". Massimo una pagina.' },
  { cat: 'Programmazione', title: 'Funzione con test', text: 'Linguaggio: {linguaggio e versione}. Librerie ammesse: {librerie}.\nScrivi la funzione {nome}({parametri}) che {comportamento}.\nEsempi: {input} → {output atteso}.\nGestisci i casi limite: {casi}.\nIncludi test automatici e spiega brevemente le scelte.' },
  { cat: 'Formazione', title: 'Tutor che interroga', text: 'Sto studiando {argomento} per {scopo}. Il mio livello è {livello}.\nFammi 5 domande, una alla volta, di difficoltà crescente. Aspetta la mia risposta prima della successiva, correggimi spiegando l’errore e alla fine indica i punti da ripassare.' },
  { cat: 'Marketing', title: 'Varianti di un annuncio', text: 'Prodotto: {prodotto}. Pubblico: {pubblico}. Obiettivo: {obiettivo}.\nScrivi 5 varianti di annuncio per {canale}: titolo (max 40 caratteri) e testo (max 125 caratteri).\nPresentale in tabella con una colonna che indica la leva usata (beneficio, urgenza, prova sociale…). Evita promesse non verificabili.' },
  { cat: 'Ricerca scientifica', title: 'Rassegna con fonti', text: 'Cerca studi pubblicati negli ultimi {n} anni su {tema}. Includi solo articoli peer-reviewed o preprint con DOI/link.\nPer ciascuno: autori, anno, metodo, risultato principale, limiti, link.\nSegnala esplicitamente quando un’informazione è incerta. Formato: tabella.' },
  { cat: 'Grafica e video', title: 'Brief per un’immagine', text: 'Soggetto: {soggetto} in {ambientazione}, {momento della giornata}, luce {tipo di luce}.\nStile: {fotografia/illustrazione/vettoriale}, palette {colori}.\nComposizione: {inquadratura}, soggetto {posizione}. Formato {proporzioni}.\nTesto nell’immagine: "{testo esatto}".' },
];

export async function promptLab() {
  const avail = await api('/ai/available');
  const canImprove = avail.generazione.length > 0;
  const checksView = (r) => html`<div class="row"><div class="score-big">${r.score}</div><div><strong>/100</strong><div class="faint">${r.words} parole</div></div></div>
    <ul class="list">${r.checks.map((c) => html`<li class="row"><span class="badge ${c.ok ? 'ok' : 'warn'}">${c.ok ? '✓' : '—'}</span> ${c.label}</li>`)}</ul>
    ${r.suggestions.length ? html`<h3 class="mt">Suggerimenti</h3><ul>${r.suggestions.map((s) => html`<li>${s}</li>`)}</ul>` : ''}<p class="faint">${r.method}</p>`;
  return {
    title: 'Laboratorio prompt',
    html: html`
    <div class="page-head"><div><h1>Laboratorio prompt</h1><p>Analizza la qualità dei tuoi prompt, confronta due versioni e parti da modelli modificabili per categoria professionale.</p></div></div>
    <div class="tabs" role="tablist"><a href="#" data-tab="an" class="active">Analizza</a><a href="#" data-tab="cmp">Confronta versioni</a><a href="#" data-tab="tpl">Modelli</a></div>
    <section data-pane="an"><div class="grid c2">
      <form class="card" id="an"><div class="field"><label for="p">Prompt</label><textarea class="code" id="p" name="prompt" rows="12" required placeholder="Incolla o scrivi un prompt…"></textarea></div>
        <div class="row"><button class="btn primary">Analizza</button>${canImprove ? html`<button type="button" class="btn" data-improve>Ottimizza con AI</button>` : html`<span class="faint">Ottimizzazione con AI non configurata.</span>`}</div></form>
      <div class="card" id="anr"><div class="empty">Il risultato dell’analisi apparirà qui.</div></div></div></section>
    <section data-pane="cmp" class="hidden"><form class="card" id="cmp"><div class="grid c2"><div class="field"><label>Versione A</label><textarea class="code" name="a" rows="10" required></textarea></div>
      <div class="field"><label>Versione B</label><textarea class="code" name="b" rows="10" required></textarea></div></div><button class="btn primary">Confronta</button></form><div id="cmpr" class="mt"></div></section>
    <section data-pane="tpl" class="hidden"><div class="grid auto">${TEMPLATES.map((t, i) => html`<div class="card"><span class="badge info">${t.cat}</span><h3 class="mt">${t.title}</h3><pre>${t.text}</pre><button class="btn sm" data-use="${i}">Usa e analizza</button></div>`)}</div>
      <p class="faint mt">I modelli usano segnaposto tra parentesi graffe: sostituiscili con i tuoi dati. Sono adatti ad assistenti conversazionali (ChatGPT, Claude, Gemini, Copilot, Le Chat); il modello “Brief per un’immagine” è per i generatori di immagini.</p></section>`,
    mount(el) {
      on(el, 'click', '[data-tab]', (e, a) => {
        e.preventDefault();
        el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === a));
        el.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== a.dataset.tab));
      });
      el.querySelector('#an').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await api('/prompt/analyze', { method: 'POST', body: formData(e.target) });
        el.querySelector('#anr').innerHTML = checksView(r).s;
      });
      el.querySelector('[data-improve]')?.addEventListener('click', async (e) => {
        const prompt = el.querySelector('#p').value;
        if (!prompt.trim()) return toast('Scrivi prima un prompt', true);
        e.target.disabled = true; e.target.textContent = 'Ottimizzazione…';
        try {
          const r = await api('/prompt/improve', { method: 'POST', body: { prompt } });
          el.querySelector('#anr').innerHTML = html`<span class="badge info">Generato da AI (${r.generatedBy})</span><h3 class="mt">Versione ottimizzata</h3><pre>${r.prompt_migliorato}</pre>
            <h3>Modifiche</h3><ul>${r.modifiche.map((m) => html`<li>${m}</li>`)}</ul><button class="btn sm" data-adopt>Usa questa versione</button><hr>${checksView(r.analysis)}`.s;
          el.querySelector('[data-adopt]').addEventListener('click', () => { el.querySelector('#p').value = r.prompt_migliorato; });
        } catch (err) { toast(err.message, true); } finally { e.target.disabled = false; e.target.textContent = 'Ottimizza con AI'; }
      });
      el.querySelector('#cmp').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await api('/prompt/compare', { method: 'POST', body: formData(e.target) });
        el.querySelector('#cmpr').innerHTML = html`<div class="card"><div class="table-wrap"><table><thead><tr><th>Elemento</th><th>A (${r.a.score}/100)</th><th>B (${r.b.score}/100)</th></tr></thead><tbody>
          ${r.diff.map((d) => html`<tr><td>${d.label}</td><td>${d.a ? '✓' : '—'}</td><td>${d.b ? '✓' : '—'}</td></tr>`)}</tbody></table></div>
          <p class="mt">${r.a.score === r.b.score ? 'Le due versioni hanno lo stesso punteggio strutturale.' : `La versione ${r.a.score > r.b.score ? 'A' : 'B'} è strutturalmente più completa.`} Il punteggio misura la presenza degli elementi, non la correttezza del contenuto.</p></div>`.s;
      });
      on(el, 'click', '[data-use]', (_e, b) => {
        el.querySelector('#p').value = TEMPLATES[Number(b.dataset.use)].text;
        el.querySelector('[data-tab=an]').click();
        el.querySelector('#an').requestSubmit();
      });
    },
  };
}
