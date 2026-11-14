// Genera i moduli specifici per ciascuna AI a partire dai dati del catalogo.
// Il contenuto è derivato solo da campi della scheda (e quindi dalle stesse fonti),
// ed è rigenerato quando la scheda cambia (con incremento di versione).
import { all, get, run, pj, j, tx } from '../db.js';

const CATEGORY_LABEL = {
  assistente: 'assistente conversazionale', ricerca: 'motore di ricerca con AI', codice: 'strumento per la programmazione',
  immagini: 'generatore di immagini', video: 'strumento video', audio: 'strumento audio e voce', studio: 'strumento di studio', piattaforma: 'piattaforma per modelli AI',
};

const FIRST_STEPS = {
  assistente: [
    'Crea un account sul sito ufficiale e prova la versione gratuita.',
    'Scrivi un primo prompt con contesto, compito e formato (vedi il modulo "Scrivere prompt efficaci").',
    'Carica un documento non riservato e chiedi una sintesi con riferimenti alle sezioni.',
    'Esplora le impostazioni: istruzioni personalizzate, memoria, uso dei dati per l’addestramento.',
    'Prova a chiedere la stessa cosa due volte e confronta le risposte.',
  ],
  ricerca: [
    'Formula una domanda specificando periodo e ambito.',
    'Apri almeno tre fonti citate e verifica che riportino ciò che dice la risposta.',
    'Prova la modalità di ricerca approfondita su un tema che conosci bene, per valutarne l’accuratezza.',
  ],
  codice: [
    'Installa lo strumento seguendo la documentazione ufficiale.',
    'Apri un piccolo progetto di prova (non un progetto di lavoro con dati sensibili).',
    'Chiedi la spiegazione di un file esistente, poi una piccola modifica con test.',
    'Rivedi ogni modifica proposta prima di accettarla.',
  ],
  immagini: [
    'Genera un’immagine con un prompt che specifichi soggetto, stile, composizione e formato.',
    'Crea varianti e cambia una sola variabile per volta.',
    'Leggi i termini d’uso del tuo piano riguardo ai diritti commerciali.',
  ],
  video: [
    'Parti da un’immagine o da una descrizione breve con il movimento della camera.',
    'Genera clip brevi e assemblale in sequenza.',
    'Controlla il consumo di crediti di ogni generazione.',
  ],
  audio: [
    'Prova la generazione con un testo breve curando punteggiatura e pause.',
    'Confronta più voci o stili sullo stesso testo.',
    'Verifica le condizioni di licenza e le regole sul consenso per le voci.',
  ],
  studio: [
    'Crea un taccuino e carica 2–3 fonti su un argomento che stai studiando.',
    'Fai domande e controlla le citazioni ai passaggi delle fonti.',
    'Genera una guida di studio o un quiz e usali per ripassare.',
  ],
  piattaforma: [
    'Crea un account e sfoglia i modelli più scaricati per un compito che ti interessa.',
    'Prova una demo interattiva (Space).',
    'Segui la prima unità di uno dei corsi gratuiti.',
  ],
};

const bullet = (arr) => arr.map((x) => `- ${x}`).join('\n');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('it-IT') : 'non verificata');

export function toolOverviewContent(tool, facts) {
  const factRows = facts.length
    ? facts.map((f) => `| ${labelField(f.field)} | ${f.value} | ${f.status === 'verificato' ? `✅ verificato il ${fmtDate(f.verified_at)}` : '⚠️ da verificare'} |`).join('\n')
    : '| – | Nessun dato registrato | – |';
  return `
**${tool.name}** è un ${CATEGORY_LABEL[tool.category] || 'strumento AI'} sviluppato da **${tool.developer}**.

${tool.description}

### Funzionalità principali
${bullet(pj(tool.features, []))}

### Ambiti di utilizzo
${bullet(pj(tool.use_cases, []))}

### Punti di forza
${bullet(pj(tool.strengths, []))}

### Limitazioni da conoscere
${bullet(pj(tool.limitations, []))}

### Piani e versioni
| Dato | Valore | Stato |
|---|---|---|
${factRows}

> Piani, prezzi e versioni cambiano spesso. Prima di decidere controlla sempre la pagina ufficiale${tool.pricing_url ? `: ${tool.pricing_url}` : ` (${tool.website})`}.

### Fonti ufficiali
- Sito: ${tool.website}
${tool.docs_url ? `- Documentazione / guida: ${tool.docs_url}\n` : ''}${tool.pricing_url ? `- Prezzi: ${tool.pricing_url}\n` : ''}
*Scheda aggiornata il ${fmtDate(tool.last_verified_at || tool.updated_at)}.*
`.trim();
}

function labelField(f) {
  return { piano_gratuito: 'Piano gratuito', piani_pagamento: 'Piani a pagamento', versioni: 'Versioni', prezzo: 'Prezzo' }[f] || f;
}

export function firstStepsContent(tool) {
  const steps = FIRST_STEPS[tool.category] || FIRST_STEPS.assistente;
  return `
In questa lezione pratica usi **${tool.name}** direttamente sul servizio ufficiale (${tool.website}).
La piattaforma non accede al tuo account: svolgi le attività sul servizio e poi annota cosa hai osservato.

### Attività
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### Annota
- Che cosa ha funzionato bene al primo tentativo?
- Dove hai dovuto correggere o riformulare?
- Quali limiti del piano che usi hai incontrato?

${tool.docs_url ? `Per approfondire consulta la documentazione ufficiale: ${tool.docs_url}` : ''}

Quando hai finito, prova un esercizio del **Laboratorio pratico** adatto a questo strumento.
`.trim();
}

function shuffle(arr, seed) {
  // shuffle deterministico (le domande non cambiano a ogni rigenerazione)
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const k = Math.floor((s / 233280) * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}

export function buildQuestions(tool, others) {
  const qs = [];
  const seed = tool.id * 7 + 3;
  // 1. Sviluppatore (fatto)
  const devs = [...new Set(others.map((o) => o.developer).filter((d) => d !== tool.developer))];
  if (devs.length >= 3) {
    const opts = shuffle([tool.developer, ...shuffle(devs, seed).slice(0, 3)], seed + 1);
    qs.push({ prompt: `Chi sviluppa ${tool.name}?`, options: opts, answer_index: opts.indexOf(tool.developer), explanation: `${tool.name} è sviluppato da ${tool.developer}.`, skill: 'fondamenti' });
  }
  // 2. Ambito d'uso secondo la scheda
  const uc = pj(tool.use_cases, []);
  const foreignUc = [...new Set(others.filter((o) => o.category !== tool.category).flatMap((o) => pj(o.use_cases, [])))].filter((x) => !uc.includes(x));
  if (uc.length && foreignUc.length >= 3) {
    const correct = uc[0];
    const opts = shuffle([correct, ...shuffle(foreignUc, seed + 2).slice(0, 3)], seed + 3);
    qs.push({ prompt: `Secondo la scheda studiata, quale di questi è un ambito d’uso tipico di ${tool.name}?`, options: opts, answer_index: opts.indexOf(correct), explanation: `Ambiti indicati nella scheda: ${uc.join('; ')}.`, skill: 'confronto' });
  }
  // 3. Limitazione secondo la scheda
  const lim = pj(tool.limitations, []);
  if (lim.length) {
    const opts = shuffle([lim[0], 'Non ha alcuna limitazione d’uso', 'Funziona solo senza connessione a Internet', 'Garantisce risposte sempre corrette'], seed + 4);
    qs.push({ prompt: `Quale limitazione di ${tool.name} è indicata nella scheda?`, options: opts, answer_index: opts.indexOf(lim[0]), explanation: `Limitazioni indicate: ${lim.join('; ')}.`, skill: 'verifica' });
  }
  // 4. Dove verificare prezzi (metodo)
  const opts4 = ['Sulla pagina ufficiale dei prezzi o del servizio', 'Chiedendolo allo stesso assistente AI', 'In un post sui social di un anno fa', 'Non serve verificarli'];
  qs.push({ prompt: `Dove conviene verificare piani e prezzi aggiornati di ${tool.name}?`, options: opts4, answer_index: 0, explanation: 'Piani e prezzi cambiano spesso: la fonte affidabile è la pagina ufficiale, con la data di consultazione.', skill: 'verifica' });
  return qs;
}

/** Crea o aggiorna il modulo "Introduzione a X" per uno strumento. */
export function syncToolModule(toolId) {
  const tool = get('SELECT * FROM ai_tools WHERE id = ?', toolId);
  if (!tool) return null;
  const facts = all('SELECT * FROM ai_tool_facts WHERE tool_id = ? ORDER BY field', toolId);
  const others = all('SELECT id, name, developer, category, use_cases FROM ai_tools WHERE id != ?', toolId);
  const slug = `intro-${tool.slug}`;
  const description = `Panoramica e primi passi con ${tool.name}: funzionalità, ambiti, limiti, piani e uso pratico.`;
  const lessons = [
    { slug: `${slug}-panoramica`, title: `Panoramica di ${tool.name}`, kind: 'teoria', est_minutes: 12, content: toolOverviewContent(tool, facts) },
    { slug: `${slug}-primi-passi`, title: `Primi passi pratici con ${tool.name}`, kind: 'pratica', est_minutes: 20, content: firstStepsContent(tool) },
  ];
  const topic = { codice: 'codice', immagini: 'creativita', video: 'creativita', audio: 'creativita', ricerca: 'ricerca', studio: 'ricerca' }[tool.category] || 'fondamenti';

  return tx(() => {
    let mod = get('SELECT * FROM modules WHERE slug = ?', slug);
    if (!mod) {
      const r = run(`INSERT INTO modules(slug, title, description, level, topic_slug, tool_id, order_index, origin) VALUES (?,?,?,?,?,?,?, 'generato_da_scheda')`,
        slug, `Introduzione a ${tool.name}`, description, 'principiante', topic, toolId, 0);
      mod = get('SELECT * FROM modules WHERE id = ?', r.lastInsertRowid);
    } else {
      run(`UPDATE modules SET title = ?, description = ?, topic_slug = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?`,
        `Introduzione a ${tool.name}`, description, topic, mod.id);
    }
    lessons.forEach((l, i) => {
      const ex = get('SELECT id, content FROM lessons WHERE slug = ?', l.slug);
      if (!ex) run('INSERT INTO lessons(module_id, slug, title, content, kind, est_minutes, order_index, origin) VALUES (?,?,?,?,?,?,?,?)', mod.id, l.slug, l.title, l.content, l.kind, l.est_minutes, i, 'generato_da_scheda');
      else if (ex.content !== l.content) run(`UPDATE lessons SET title = ?, content = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?`, l.title, l.content, ex.id);
    });
    run('DELETE FROM questions WHERE module_id = ?', mod.id);
    for (const q of buildQuestions(tool, others)) {
      run('INSERT INTO questions(module_id, kind, prompt, options, answer_index, explanation, skill) VALUES (?,?,?,?,?,?,?)', mod.id, 'scelta_multipla', q.prompt, j(q.options), q.answer_index, q.explanation, q.skill);
    }
    return mod.id;
  });
}

/** Modulo comparativo per un insieme di strumenti (percorsi comparativi). */
export function ensureComparativeModule(toolSlugs) {
  const slugs = [...toolSlugs].sort();
  const slug = `confronto-${slugs.join('-')}`;
  const tools = all(`SELECT * FROM ai_tools WHERE slug IN (${slugs.map(() => '?').join(',')})`, ...slugs);
  if (tools.length < 2) return null;
  const names = tools.map((t) => t.name).join(', ');
  const header = `| Caratteristica | ${tools.map((t) => t.name).join(' | ')} |\n|---|${tools.map(() => '---').join('|')}|`;
  const row = (label, fn) => `| ${label} | ${tools.map((t) => fn(t).replace(/\|/g, '/')).join(' | ')} |`;
  const factsOf = (t) => Object.fromEntries(all('SELECT field, value, status FROM ai_tool_facts WHERE tool_id = ?', t.id).map((f) => [f.field, `${f.value}${f.status !== 'verificato' ? ' ⚠️' : ''}`]));
  const content = `
In questo modulo metti a confronto **${names}** usando le informazioni documentate nelle schede del catalogo.

${header}
${row('Sviluppatore', (t) => t.developer)}
${row('Categoria', (t) => CATEGORY_LABEL[t.category] || t.category)}
${row('Funzionalità', (t) => pj(t.features, []).join('; '))}
${row('Ambiti', (t) => pj(t.use_cases, []).join('; '))}
${row('Punti di forza', (t) => pj(t.strengths, []).join('; '))}
${row('Limitazioni', (t) => pj(t.limitations, []).join('; '))}
${row('Piano gratuito', (t) => factsOf(t).piano_gratuito || 'n.d.')}
${row('Piani a pagamento', (t) => factsOf(t).piani_pagamento || 'n.d.')}

⚠️ = dato da verificare sulla pagina ufficiale.

> Questa tabella riporta caratteristiche dichiarate, **non** un punteggio di qualità. Per capire quale strumento funziona meglio per te, svolgi il test comparativo della lezione successiva.
`.trim();
  const testContent = `
### Test comparativo guidato su ${names}
1. Scegli **tre compiti** reali e rappresentativi del tuo lavoro o studio.
2. Scrivi per ciascuno **un solo prompt** e usalo identico in tutti gli strumenti.
3. Definisci **prima** i criteri: correttezza, completezza, chiarezza, tempo impiegato.
4. Valuta ogni risultato da 1 a 5 per criterio e annota esempi concreti.
5. Registra **data e piano** usato per ogni strumento.

Al termine svolgi l’esercizio **"Test comparativo tra due o più AI"** nel Laboratorio pratico per ricevere una valutazione del tuo protocollo.
`.trim();

  return tx(() => {
    let mod = get('SELECT * FROM modules WHERE slug = ?', slug);
    if (!mod) {
      const r = run(`INSERT INTO modules(slug, title, description, level, topic_slug, order_index, origin) VALUES (?,?,?,?,?,?, 'generato_da_scheda')`,
        slug, `Confronto: ${names}`, `Differenze documentate e test comparativo tra ${names}.`, 'intermedio', 'confronto', 50);
      mod = get('SELECT * FROM modules WHERE id = ?', r.lastInsertRowid);
      run('INSERT INTO lessons(module_id, slug, title, content, kind, est_minutes, order_index, origin) VALUES (?,?,?,?,?,?,?,?)', mod.id, `${slug}-tabella`, `Differenze documentate tra ${names}`, content, 'teoria', 15, 0, 'generato_da_scheda');
      run('INSERT INTO lessons(module_id, slug, title, content, kind, est_minutes, order_index, origin) VALUES (?,?,?,?,?,?,?,?)', mod.id, `${slug}-test`, 'Test comparativo guidato', testContent, 'pratica', 30, 1, 'generato_da_scheda');
      const qs = [
        { prompt: 'Qual è il modo più affidabile per scegliere tra questi strumenti per il tuo lavoro?', options: ['Scegliere il più famoso', 'Provarli sugli stessi compiti reali con criteri definiti prima', 'Leggere un solo articolo', 'Scegliere il più costoso'], a: 1, e: 'Il test sullo stesso compito con criteri prefissati è il metodo più affidabile.' },
        { prompt: 'La tabella comparativa del catalogo rappresenta…', options: ['Un punteggio oggettivo di qualità', 'Caratteristiche dichiarate e documentate, con stato di verifica', 'Opinioni degli utenti', 'Risultati di benchmark'], a: 1, e: 'Le schede riportano caratteristiche documentate, non giudizi di qualità.' },
      ];
      for (const q of qs) run('INSERT INTO questions(module_id, kind, prompt, options, answer_index, explanation, skill) VALUES (?,?,?,?,?,?,?)', mod.id, 'scelta_multipla', q.prompt, j(q.options), q.a, q.e, 'confronto');
    } else {
      run(`UPDATE lessons SET content = ?, version = version + (content != ?), updated_at = datetime('now') WHERE slug = ?`, content, content, `${slug}-tabella`);
    }
    return mod.id;
  });
}
