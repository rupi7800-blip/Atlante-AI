// Analizzatore di prompt a regole: deterministico, trasparente, sempre disponibile.
// Valuta la presenza degli elementi di un prompt efficace e produce suggerimenti concreti.

const has = (text, patterns) => patterns.some((p) => (p instanceof RegExp ? p.test(text) : text.includes(p)));

export const CHECKS = {
  contesto: {
    label: 'Contesto e destinatario',
    test: (t) => has(t, [/\bsono (un|una|il|la|lo|[a-zà-ù]+(ista|ore|rice|ente|ante|ario|aria|ico|ica))\b/, /\b(lavoro come|lavoro in|mi occupo di)\b/, /\b(direttore|direzione|cliente|clienti|colleghi|consiglio|team|studenti|manager|responsabile)\b/, 'lavoro', 'destinat', 'contesto', 'pubblico', 'lettore', 'la mia azienda', 'il mio ', 'la mia ', 'agisci come', 'sei un', 'ruolo', 'scopo', 'serve per', 'per un ', 'per una ', 'rivolto', 'i am ', 'audience', 'context']),
    tip: 'Aggiungi il contesto: chi sei, a chi è destinato il risultato e a cosa serve.',
  },
  compito: {
    label: 'Compito chiaro (verbo d’azione)',
    test: (t) => has(t, [/\b(scrivi|crea|analizza|riassumi|sintetizza|estrai|confronta|elenca|spiega|genera|traduci|rivedi|correggi|classifica|proponi|redigi|calcola|descrivi|valuta|individua|prepara|elabora|trasforma|ottimizza|write|create|analy[sz]e|summari[sz]e|extract|compare|list|explain|generate|review)\w*/]),
    tip: 'Esplicita il compito con un verbo d’azione (es. “Analizza…”, “Scrivi…”, “Estrai…”).',
  },
  formato: {
    label: 'Formato dell’output',
    test: (t) => has(t, ['tabella', 'elenco', 'punti', 'json', 'sezion', 'paragraf', 'formato', 'markdown', 'colonn', 'struttura', 'csv', 'titolo', 'schema', 'table', 'bullet', 'format']),
    tip: 'Specifica il formato del risultato (tabella con colonne, elenco puntato, sezioni, JSON…).',
  },
  vincoli: {
    label: 'Vincoli (lunghezza, tono, lingua)',
    test: (t) => has(t, [/\d+\s*(parole|righe|caratteri|frasi|punti|pagin|minuti|secondi|words|lines)/, 'massimo', 'non più di', 'al massimo', 'tono', 'formale', 'informale', 'cortese', 'in italiano', 'in inglese', 'evita', 'senza ', 'max ']),
    tip: 'Indica vincoli: lunghezza massima, tono, lingua, cosa evitare.',
  },
  input: {
    label: 'Input delimitato',
    test: (t) => has(t, ['"""', '```', /<[a-z_]+>/, 'testo seguente', 'di seguito', 'allegat', 'documento caricato', 'file caricato', 'il documento', 'il pdf', 'il file']),
    tip: 'Delimita il materiale da elaborare (es. tra """ … """ o <documento> … </documento>) o indica chiaramente il file allegato.',
  },
  verifica: {
    label: 'Gestione di fonti, incertezze e dati mancanti',
    test: (t) => has(t, ['fonte', 'fonti', 'cita', 'pagina', 'pagine', 'se non', 'non inventare', 'n/d', 'verific', 'controlla', 'incert', 'non lo so', 'mancant', 'test', 'riferiment', 'source']),
    tip: 'Chiedi fonti o riferimenti (es. numero di pagina) e indica cosa fare se un dato manca (“scrivi N/D, non dedurre”).',
  },
  esempi: {
    label: 'Esempi',
    test: (t) => has(t, ['esempio', 'ad es', 'es.', 'come questo', 'example', 'e.g.']),
    tip: 'Se vuoi uno stile o un formato preciso, includi un breve esempio.',
  },
  criteri: {
    label: 'Criteri di successo',
    test: (t) => has(t, ['criteri', 'criterio', 'è riuscito se', 'deve contenere', 'assicurati', 'controlla di', 'valut']),
    tip: 'Dichiara i criteri con cui valuterai il risultato e chiedi al modello di verificarli prima di rispondere.',
  },
  soggetto: {
    label: 'Soggetto e ambientazione',
    test: (t) => t.split(/\s+/).length >= 12 && has(t, [/\b(un|una|uno|il|la|lo|dei|delle)\b/]),
    tip: 'Descrivi in modo concreto il soggetto e l’ambientazione (oggetti, luogo, luce, momento).',
  },
  stile: {
    label: 'Stile e palette',
    test: (t) => has(t, ['stile', 'fotograf', 'illustr', 'acquerell', 'vettorial', 'cinematograf', 'minimal', 'retr', 'palette', 'colori', 'tonalità', 'art déco', 'flat']),
    tip: 'Indica lo stile visivo (fotografia, illustrazione, vettoriale…) e la palette di colori.',
  },
  composizione: {
    label: 'Composizione e formato',
    test: (t) => has(t, ['inquadratura', 'primo piano', 'sfondo', 'al centro', 'sinistra', 'destra', "dall'alto", 'dal basso', 'formato', '16:9', '9:16', '4:5', '2:3', '3:4', 'verticale', 'orizzontale', 'proporzion']),
    tip: 'Specifica composizione (inquadratura, posizione degli elementi) e formato/proporzioni.',
  },
  testo: {
    label: 'Testo esatto tra virgolette',
    test: (t) => /["“'«][^"”'»]{3,}["”'»]/.test(t),
    tip: 'Scrivi il testo da inserire nell’immagine esattamente, tra virgolette.',
  },
};

const GENERIC = ['contesto', 'compito', 'formato', 'vincoli', 'input', 'verifica', 'esempi', 'criteri'];

/** Analisi generica di un prompt (Laboratorio prompt). */
export function analyzePrompt(promptText) {
  const raw = String(promptText || '');
  const t = raw.toLowerCase();
  const words = raw.trim() ? raw.trim().split(/\s+/).length : 0;
  const checks = GENERIC.map((k) => ({ key: k, label: CHECKS[k].label, ok: CHECKS[k].test(t), tip: CHECKS[k].tip }));
  const weights = { contesto: 2, compito: 3, formato: 2, vincoli: 2, input: 1, verifica: 2, esempi: 1, criteri: 1 };
  const max = Object.values(weights).reduce((a, b) => a + b, 0);
  let score = checks.reduce((s, c) => s + (c.ok ? weights[c.key] : 0), 0) / max * 100;
  const notes = [];
  if (words < 12) { score *= 0.6; notes.push('Il prompt è molto breve: il modello dovrà indovinare molte informazioni.'); }
  if (words > 1200) notes.push('Il prompt è molto lungo: valuta di spostare il materiale in un file o di dividerlo in passaggi.');
  if (/\b(bello|bene|meglio|interessante|qualcosa)\b/.test(t)) notes.push('Sostituisci termini vaghi (“bello”, “meglio”, “qualcosa”) con richieste misurabili.');
  if (/\bnon\b/.test(t) && !/invece|piuttosto|al posto/.test(t)) notes.push('Per i divieti indica anche cosa fare al loro posto (vincolo con alternativa).');
  return {
    score: Math.round(score), words, checks,
    suggestions: [...checks.filter((c) => !c.ok).map((c) => c.tip), ...notes],
    method: 'Analisi a regole: verifica la presenza degli elementi di un prompt efficace. Non giudica la correttezza del contenuto.',
  };
}

/** Valutazione di un esercizio secondo la sua griglia. */
export function evaluateExercise(exercise, { prompt, result = '', reflection = '' }) {
  const t = String(prompt || '').toLowerCase();
  const rubric = exercise.rubric;
  const required = exercise.required || [];
  const reqFound = required.map((group) => group.some((w) => t.includes(w.toLowerCase())));
  const specificRatio = required.length ? reqFound.filter(Boolean).length / required.length : 1;

  const criteria = rubric.map((r) => {
    let ratio;
    if (r.key === 'specifici') ratio = specificRatio;
    else if (CHECKS[r.key]) ratio = CHECKS[r.key].test(t) ? 1 : 0;
    else ratio = 0;
    const tip = r.key === 'specifici'
      ? (ratio < 1 ? 'Inserisci nel prompt tutti i dati specifici richiesti dal compito.' : null)
      : (ratio < 1 ? CHECKS[r.key]?.tip : null);
    return { key: r.key, label: r.label, weight: r.weight, score: Math.round(ratio * 10), tip };
  });
  const tot = criteria.reduce((s, c) => s + c.weight, 0);
  const promptScore = criteria.reduce((s, c) => s + (c.score / 10) * c.weight, 0) / tot * 100;

  // risultato e riflessione: capacità di individuare errori e migliorare
  const rr = `${result} ${reflection}`.toLowerCase();
  const extra = [];
  let bonus = 0;
  if (String(result).trim().length > 40) { bonus += 10; } else extra.push('Esegui il prompt su un’AI reale e incolla il risultato: permette di valutare anche la qualità dell’output.');
  if (/(errore|errori|sbagliat|corrett|verificat|controllat|inesatt|mancava|ho modificato|ho migliorato|seconda versione)/.test(rr)) bonus += 10;
  else extra.push('Nella riflessione indica gli errori che hai individuato nel risultato e come hai migliorato il prompt.');

  const score = Math.round(Math.min(100, promptScore * 0.8 + bonus));
  return {
    score, criteria,
    suggestions: [...criteria.filter((c) => c.tip).map((c) => c.tip), ...extra],
    evaluator: 'regole',
    method: 'Valutazione a regole: 80% elementi del prompt secondo la griglia, 20% presenza del risultato e della riflessione sugli errori. Per un giudizio sul contenuto usa la valutazione con AI (se disponibile).',
  };
}

export const AI_EVAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['criteri', 'punti_di_forza', 'miglioramenti', 'errori_nel_risultato', 'prompt_migliorato'],
  properties: {
    criteri: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['key', 'punteggio', 'commento'], properties: { key: { type: 'string' }, punteggio: { type: 'integer' }, commento: { type: 'string' } } },
    },
    punti_di_forza: { type: 'array', items: { type: 'string' } },
    miglioramenti: { type: 'array', items: { type: 'string' } },
    errori_nel_risultato: { type: 'array', items: { type: 'string' } },
    prompt_migliorato: { type: 'string' },
  },
};

export function aiEvalPrompt(exercise, { prompt, result, reflection }) {
  return {
    system: 'Sei un formatore esperto nell’uso professionale delle AI generative. Valuti esercizi di scrittura di prompt in modo rigoroso, concreto e costruttivo, in italiano. Non inventare informazioni sul risultato se non è stato fornito.',
    prompt: `Esercizio: ${exercise.title}
Consegna: ${exercise.brief}

Griglia (key: descrizione, peso):
${exercise.rubric.map((r) => `- ${r.key}: ${r.label} (peso ${r.weight})`).join('\n')}

<prompt_studente>
${prompt}
</prompt_studente>

<risultato_ottenuto>
${result || '(non fornito)'}
</risultato_ottenuto>

<riflessione_studente>
${reflection || '(non fornita)'}
</riflessione_studente>

Assegna a ogni criterio della griglia un punteggio intero da 0 a 10 con un commento specifico.
Elenca punti di forza, miglioramenti concreti, eventuali errori nel risultato (solo se il risultato è fornito) e proponi una versione migliorata del prompt.`,
  };
}
