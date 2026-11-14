// Curriculum di base trasversale: competenze valide per tutte le AI conversazionali/generative.
// Contenuti redatti per la piattaforma (origin: 'redazione'). I moduli specifici per ciascuna AI
// sono generati dai dati del catalogo (vedi services/toolModules.js).

export const TOPICS = [
  { slug: 'fondamenti', name: 'Fondamenti', description: 'Come funzionano le AI generative, limiti e uso consapevole' },
  { slug: 'prompting', name: 'Scrittura dei prompt', description: 'Istruzioni chiare, contesto, formato, iterazione' },
  { slug: 'verifica', name: 'Verifica dei risultati', description: 'Controllo dei fatti, errori tipici, miglioramento' },
  { slug: 'documenti-dati', name: 'Documenti e dati', description: 'Sintesi, estrazione, analisi di dati' },
  { slug: 'codice', name: 'Programmazione', description: 'Scrivere, rivedere e testare codice con l’AI' },
  { slug: 'creativita', name: 'Immagini, audio e video', description: 'Generazione di contenuti multimediali' },
  { slug: 'ricerca', name: 'Ricerca e studio', description: 'Usare l’AI per cercare, studiare e apprendere' },
  { slug: 'automazione', name: 'Automazione', description: 'Flussi ripetibili, integrazioni e API' },
  { slug: 'confronto', name: 'Confronto e scelta', description: 'Valutare e scegliere lo strumento adatto' },
  { slug: 'professionale', name: 'Uso professionale', description: 'Normativa, policy, qualità' },
];

const L = (slug, title, est, content, kind = 'teoria') => ({ slug, title, est_minutes: est, content: content.trim(), kind });
const Q = (prompt, options, answer, explanation, skill) => ({ kind: 'scelta_multipla', prompt, options, answer_index: answer, explanation, skill });

export const MODULES = [
  {
    slug: 'fondamenti-ai-generativa', title: 'Come funzionano gli assistenti AI', level: 'principiante', topic: 'fondamenti', categories: [],
    description: 'Cosa sono i modelli linguistici, cosa sanno fare, perché sbagliano e come proteggere i propri dati.',
    lessons: [
      L('fond-cosa-e-llm', 'Che cos’è un modello linguistico', 12, `
Un **modello linguistico di grandi dimensioni** (LLM) è un programma addestrato su enormi quantità di testo per prevedere, parola dopo parola, la continuazione più plausibile di un testo.

Assistenti come ChatGPT, Claude, Gemini o Le Chat sono costruiti su questi modelli e aggiungono un'interfaccia di conversazione e strumenti (ricerca web, lettura di file, generazione di immagini).

### Cosa ne consegue in pratica
- Il modello **non consulta un archivio di fatti**: genera testo plausibile. Spesso è corretto, ma non sempre.
- Le conoscenze del modello si fermano a una **data di aggiornamento** (cutoff). Per eventi recenti servono strumenti di ricerca.
- La risposta dipende molto **da come chiedi**: contesto, esempi e istruzioni chiare cambiano il risultato.
- Due richieste uguali possono dare risposte diverse: la generazione ha una componente di variabilità.

### Parole chiave
- **Prompt**: il testo che invii al modello.
- **Contesto (finestra di contesto)**: quanto testo il modello può considerare insieme (conversazione + documenti).
- **Token**: unità di testo usate dal modello; una parola italiana corrisponde in media a più di un token.
`),
      L('fond-limiti', 'Allucinazioni e limiti', 12, `
Si chiama **allucinazione** una risposta che sembra sicura ma contiene informazioni false: citazioni inesistenti, numeri inventati, riferimenti normativi sbagliati.

### Quando il rischio è più alto
- Domande su **dati precisi** (date, cifre, nomi, fonti bibliografiche).
- Argomenti **di nicchia** o molto recenti.
- Richieste che **presuppongono** qualcosa di falso ("Perché la legge X del 2019 dice…?").
- Calcoli lunghi eseguiti "a mente" dal modello senza strumenti.

### Come ridurlo
1. Chiedi di **indicare le fonti** e aprile davvero.
2. Fornisci tu i documenti di riferimento e chiedi di rispondere **solo** in base a quelli.
3. Autorizza il modello a dire **"non lo so"**.
4. Per i calcoli usa strumenti di analisi dati o verifica con un foglio di calcolo.

> Regola d'oro: l'AI è un collaboratore veloce, non una fonte. La responsabilità del risultato resta tua.
`),
      L('fond-privacy', 'Privacy, dati e uso responsabile', 10, `
Prima di incollare qualcosa in un assistente AI chiediti: **posso condividere questo dato con un servizio esterno?**

### Buone pratiche
- Non inserire **dati personali di terzi**, dati sanitari, credenziali o segreti aziendali in servizi non approvati dalla tua organizzazione.
- Controlla nelle impostazioni del servizio se le conversazioni possono essere **usate per l'addestramento** e come disattivarlo.
- I piani per aziende in genere offrono garanzie contrattuali diverse da quelli personali: leggi i termini.
- Anonimizza i documenti (nomi, codici, indirizzi) quando possibile.

### Uso responsabile dei contenuti generati
- Dichiara l'uso dell'AI quando è richiesto (scuola, editoria, lavoro).
- Per immagini, voci e musica verifica le **condizioni di licenza** del piano che usi.
- Non usare voci o volti di persone reali senza consenso.
`),
    ],
    questions: [
      Q('Che cosa fa fondamentalmente un modello linguistico quando risponde?', ['Cerca la risposta in un database di fatti verificati', 'Genera il testo più plausibile in base all’addestramento e al contesto', 'Copia il testo da un sito web', 'Esegue sempre una ricerca su Internet'], 1, 'Un LLM genera testo plausibile prevedendo la continuazione: per questo può sbagliare con tono sicuro.', 'fondamenti'),
      Q('Che cos’è un’“allucinazione” di un modello AI?', ['Un errore di connessione', 'Un’immagine generata', 'Un’informazione falsa presentata come vera', 'Una risposta troppo lunga'], 2, 'Le allucinazioni sono contenuti inventati ma presentati con sicurezza.', 'fondamenti'),
      Q('Quale di queste azioni riduce maggiormente il rischio di risposte inventate?', ['Scrivere il prompt tutto in maiuscolo', 'Fornire i documenti di riferimento e chiedere di rispondere solo in base a quelli', 'Chiedere la stessa cosa più volte finché la risposta piace', 'Usare frasi molto brevi'], 1, 'Ancorare la risposta a fonti fornite è una delle tecniche più efficaci.', 'verifica'),
      Q('Perché un assistente può non conoscere un evento della settimana scorsa?', ['Perché ha una data limite di aggiornamento delle conoscenze', 'Perché censura le notizie', 'Perché l’italiano non è supportato', 'Perché gli eventi recenti sono a pagamento'], 0, 'Il modello conosce ciò che era nei dati fino al cutoff; per il resto servono strumenti di ricerca.', 'fondamenti'),
      Q('Quale comportamento è corretto con i dati personali di un cliente?', ['Incollarli in qualsiasi assistente per velocizzare', 'Usarli solo in servizi approvati e, quando possibile, anonimizzarli', 'Tradurli in inglese prima di inviarli', 'Inviarli solo di notte'], 1, 'I dati di terzi vanno trattati solo con strumenti autorizzati e minimizzati.', 'fondamenti'),
    ],
  },
  {
    slug: 'prompt-efficaci', title: 'Scrivere prompt efficaci', level: 'principiante', topic: 'prompting', categories: [],
    description: 'La struttura di un buon prompt: ruolo, contesto, compito, formato, vincoli ed esempi.',
    lessons: [
      L('prompt-anatomia', 'Anatomia di un prompt', 15, `
Un prompt efficace risponde alle domande che faresti a un collega prima di iniziare un lavoro.

| Elemento | Domanda | Esempio |
|---|---|---|
| **Contesto** | Chi sono, per cosa serve? | "Sono responsabile acquisti di una PMI…" |
| **Compito** | Cosa devi fare esattamente? | "Confronta le tre offerte allegate…" |
| **Input** | Su quali dati lavori? | Testo delimitato tra \`"""\` |
| **Formato** | Come voglio il risultato? | "Tabella con colonne: fornitore, prezzo, tempi" |
| **Vincoli** | Limiti e regole | "Massimo 200 parole, tono formale" |
| **Criteri di qualità** | Come capisco che è fatto bene? | "Segnala i dati mancanti invece di inventarli" |

### Prima e dopo
**Debole:** \`Scrivimi una mail per un fornitore.\`

**Efficace:**
\`\`\`
Sono responsabile acquisti di un'azienda di arredamento. Scrivi una mail al fornitore
Rossi Srl per chiedere di anticipare la consegna dell'ordine 4512 dal 20 al 10 marzo.
Tono cortese ma deciso, massimo 120 parole, chiudi chiedendo conferma entro venerdì.
\`\`\`
`),
      L('prompt-contesto-esempi', 'Contesto ed esempi', 12, `
Il modello non conosce la tua situazione: tutto ciò che non scrivi, lo **indovina**.

### Dare contesto utile
- **Destinatario** del risultato (cliente, studente, dirigente).
- **Scopo** (decidere, informare, convincere).
- **Livello** di competenza del lettore.

### Usare esempi (few-shot)
Se vuoi uno stile o un formato preciso, mostralo. Uno o due esempi valgono più di molte spiegazioni.

\`\`\`
Classifica i commenti dei clienti come POSITIVO, NEGATIVO o NEUTRO.
Esempio: "Consegna veloce, prodotto ottimo" → POSITIVO
Esempio: "Il pacco è arrivato" → NEUTRO
Commento: "Ho dovuto chiamare tre volte l'assistenza" →
\`\`\`

### Delimitare l'input
Quando incolli un testo, separalo dalle istruzioni con delimitatori (\`"""\`, tag come \`<documento>\`), così il modello non confonde il materiale con le istruzioni.
`),
      L('prompt-formato', 'Controllare il formato dell’output', 10, `
Chiedere esplicitamente il formato rende il risultato subito utilizzabile.

### Formati utili
- **Tabella** con colonne nominate.
- **Elenco puntato** con un numero preciso di punti.
- **JSON** con campi specificati, se il risultato va in un altro programma.
- **Struttura a sezioni**: "Sintesi – Dettagli – Rischi – Prossimi passi".

### Lunghezza e tono
Indica parole o righe massime, registro (formale, divulgativo), lingua.

### Esercizio mentale
Riscrivi questo prompt aggiungendo formato e vincoli: *"Spiegami la fotosintesi."*
Possibile versione: *"Spiega la fotosintesi a uno studente di terza media in 5 punti elenco, massimo 15 parole ciascuno, poi proponi 2 domande di verifica."*
`),
    ],
    questions: [
      Q('Quale elemento manca nel prompt "Fammi un riassunto"?', ['Il compito', 'Il testo da riassumere, lo scopo e il formato', 'La parola "per favore"', 'Nulla, è completo'], 1, 'Mancano input, scopo, lunghezza e formato desiderati.', 'prompting'),
      Q('A cosa servono i delimitatori come """ o <documento>?', ['A rendere il prompt più elegante', 'A separare il materiale da elaborare dalle istruzioni', 'A ridurre il costo', 'A tradurre il testo'], 1, 'I delimitatori evitano che il modello confonda dati e istruzioni.', 'prompting'),
      Q('Che cos’è il “few-shot prompting”?', ['Usare pochi caratteri', 'Fornire alcuni esempi del risultato desiderato', 'Inviare il prompt più volte', 'Usare solo domande sì/no'], 1, 'Mostrare esempi guida il modello verso stile e formato voluti.', 'prompting'),
      Q('Quale prompt specifica meglio il formato?', ['"Dimmi i pro e contro"', '"Elenca 3 pro e 3 contro in una tabella a due colonne, max 10 parole per cella"', '"Fai un’analisi"', '"Scrivi bene"'], 1, 'Numero di elementi, struttura e lunghezza sono espliciti.', 'prompting'),
      Q('Perché conviene indicare il destinatario del testo?', ['Per adattare lessico, livello di dettaglio e tono', 'Perché è obbligatorio', 'Per far rispondere più velocemente', 'Non serve'], 0, 'Il destinatario determina registro e livello di approfondimento.', 'prompting'),
    ],
  },
  {
    slug: 'verifica-iterazione', title: 'Verificare e migliorare le risposte', level: 'principiante', topic: 'verifica', categories: [],
    description: 'Controllare i fatti, riconoscere gli errori tipici e iterare fino al risultato voluto.',
    lessons: [
      L('verifica-fatti', 'Controllare i fatti', 12, `
### Lista di controllo rapida
1. **Numeri e date**: confrontali con la fonte originale.
2. **Citazioni e riferimenti**: apri ogni link, cerca ogni titolo citato. Le fonti inventate sono un errore frequente.
3. **Nomi e ruoli**: verifica persone, aziende, norme.
4. **Coerenza interna**: i totali tornano? Le conclusioni seguono dai dati?
5. **Data**: l'informazione è ancora valida oggi?

### Chiedere al modello di aiutarti a verificare
- "Elenca le affermazioni della tua risposta che richiedono verifica e indica come verificarle."
- "Quali parti della risposta sono più incerte?"

Questo **non sostituisce** la verifica, ma ti indica dove guardare.
`),
      L('verifica-iterare', 'Iterare: dal primo risultato a quello giusto', 12, `
Il primo risultato raramente è quello definitivo. Lavora per **iterazioni mirate**.

### Feedback efficace
- **Specifico**: "Il secondo paragrafo è troppo tecnico, semplificalo per un pubblico non esperto" invece di "migliora".
- **Uno o due cambiamenti per volta**, così capisci cosa ha funzionato.
- **Conserva ciò che va bene**: "Mantieni la struttura, cambia solo il tono".

### Quando ricominciare da capo
Se la conversazione è lunga e il modello continua a ripetere errori, apri una **nuova conversazione** con un prompt riscritto che incorpora ciò che hai imparato.

### Salva i prompt che funzionano
Un prompt riuscito è un **modello riutilizzabile**: conservalo nel Laboratorio prompt con note su quando usarlo.
`),
    ],
    questions: [
      Q('L’AI cita un articolo scientifico con autori e anno. Cosa fai?', ['Lo riporto così com’è', 'Cerco l’articolo per verificarne l’esistenza e il contenuto', 'Chiedo all’AI se è sicura e mi fido della risposta', 'Cambio l’anno'], 1, 'Le citazioni vanno sempre verificate alla fonte: possono essere inventate.', 'verifica'),
      Q('Quale feedback è più efficace per migliorare una risposta?', ['"Non va bene"', '"Riscrivi meglio"', '"Accorcia l’introduzione a 2 frasi e aggiungi un esempio concreto nel terzo punto"', '"Prova ancora"'], 2, 'Il feedback specifico produce cambiamenti prevedibili.', 'verifica'),
      Q('Quando conviene aprire una nuova conversazione?', ['Mai', 'Quando la conversazione è lunga e gli errori si ripetono', 'Dopo ogni messaggio', 'Solo il lunedì'], 1, 'Un contesto “sporco” può perpetuare errori: meglio ripartire con un prompt migliorato.', 'verifica'),
      Q('Chiedere al modello quali parti della risposta sono incerte serve a…', ['Sostituire la verifica', 'Individuare dove concentrare la verifica', 'Ottenere una risposta certificata', 'Nulla'], 1, 'È un aiuto per orientare il controllo, non una garanzia.', 'verifica'),
    ],
  },
  {
    slug: 'documenti-e-dati', title: 'Lavorare con documenti e dati', level: 'intermedio', topic: 'documenti-dati', categories: ['assistente', 'studio', 'ricerca'],
    description: 'Riassumere documenti lunghi, estrarre informazioni strutturate e analizzare dati.',
    lessons: [
      L('doc-sintesi', 'Sintetizzare documenti lunghi', 15, `
### Strategia in tre passaggi
1. **Mappa**: "Elenca le sezioni del documento con una riga di descrizione ciascuna."
2. **Estrazione**: "Per ogni sezione estrai: dati numerici, decisioni, rischi. Indica il numero di pagina."
3. **Sintesi**: "Con le informazioni estratte, scrivi un rapporto di una pagina per il direttore."

Spezzare il lavoro riduce le omissioni e rende verificabile ogni passaggio.

### Chiedi riferimenti puntuali
"Per ogni affermazione indica la pagina o la sezione." Così puoi controllare velocemente.

### Attenzione
- Documenti scansionati (immagini) possono essere letti male: controlla tabelle e numeri.
- Se il documento supera la capacità del servizio, dividilo in parti.
- Strumenti come NotebookLM sono progettati per rispondere **solo** in base alle fonti caricate.
`),
      L('doc-estrazione', 'Estrarre dati in tabelle', 12, `
Molti lavori consistono nel trasformare testo libero in **dati strutturati**.

\`\`\`
Dal testo tra <contratti> estrai una tabella con colonne:
Fornitore | Data inizio | Durata (mesi) | Importo annuo (€) | Penali
Se un dato non è presente scrivi "N/D". Non dedurre valori non scritti.
<contratti>
...
</contratti>
\`\`\`

### Punti chiave
- **Colonne definite** in anticipo.
- **Regola per i dati mancanti** ("N/D"): impedisce che il modello li inventi.
- Formato numerico esplicito (es. "importi senza simbolo, punto come separatore decimale") se poi incolli in un foglio di calcolo.
- Controlla a campione alcune righe con il documento originale.
`),
      L('doc-analisi-dati', 'Analizzare dati con l’AI', 15, `
Alcuni assistenti possono **eseguire codice** per analizzare file (CSV, Excel): in quel caso i calcoli sono fatti da un programma, non "a memoria".

### Flusso consigliato
1. Carica il file e chiedi una **descrizione dei dati**: colonne, tipi, valori mancanti.
2. Formula domande precise: "Calcola il fatturato mensile per regione nel 2025 e mostra un grafico a linee."
3. Chiedi di **mostrare il metodo** (formule o codice usato).
4. **Verifica** un paio di risultati con il tuo foglio di calcolo.

### Errori frequenti
- Interpretazione sbagliata di date e separatori decimali (virgola italiana vs punto).
- Righe di totale incluse nei calcoli.
- Conclusioni causali tratte da semplici correlazioni.
`),
    ],
    questions: [
      Q('Perché è utile dividere la sintesi di un documento lungo in più passaggi?', ['Per spendere di più', 'Per ridurre omissioni e rendere verificabile ogni passaggio', 'Perché i modelli non leggono i PDF', 'Non è utile'], 1, 'Mappa → estrazione → sintesi rende il lavoro controllabile.', 'documenti-dati'),
      Q('Nell’estrazione di dati, a cosa serve la regola “se manca scrivi N/D”?', ['A rendere la tabella più corta', 'A impedire che il modello inventi valori mancanti', 'A tradurre i dati', 'A ordinare le righe'], 1, 'Dare un’alternativa esplicita riduce le invenzioni.', 'documenti-dati'),
      Q('Quando l’assistente esegue codice per analizzare un CSV, i calcoli…', ['Sono stimati dal modello a memoria', 'Sono eseguiti da un programma, ma vanno comunque verificati a campione', 'Sono sempre sbagliati', 'Non si possono controllare'], 1, 'Il codice rende i calcoli affidabili, ma l’interpretazione dei dati può essere errata.', 'documenti-dati'),
      Q('Quale errore è tipico con dati italiani?', ['Il modello non legge i numeri', 'Confusione tra virgola e punto come separatore decimale', 'I CSV non sono supportati', 'Le date sono sempre corrette'], 1, 'I separatori decimali e i formati data vanno specificati.', 'documenti-dati'),
    ],
  },
  {
    slug: 'prompt-avanzati', title: 'Tecniche avanzate di prompting', level: 'intermedio', topic: 'prompting', categories: ['assistente', 'ricerca', 'codice', 'studio'],
    description: 'Scomposizione dei compiti, criteri di valutazione, modelli riutilizzabili.',
    lessons: [
      L('adv-scomposizione', 'Scomporre i compiti complessi', 15, `
I compiti complessi riescono meglio se divisi in **passi espliciti**.

### Due modi
1. **In un solo prompt**: "Procedi così: 1) individua i requisiti; 2) proponi tre soluzioni; 3) confrontale in tabella; 4) raccomanda la migliore motivando."
2. **In una catena di prompt**: ogni passaggio è un messaggio separato e tu controlli il risultato intermedio prima di proseguire.

La catena è più lenta ma permette di **correggere subito** gli errori di un passaggio.

### Chiedere un ragionamento verificabile
Per problemi logici o decisionali chiedi di esporre le **assunzioni** e i **passaggi** prima della conclusione. Molti modelli recenti hanno modalità di "ragionamento" dedicate per questi casi.
`),
      L('adv-criteri', 'Ruoli, vincoli e criteri di successo', 12, `
### Il ruolo
"Agisci come revisore legale" orienta lessico e attenzione, ma **non** conferisce competenze reali: il risultato va comunque verificato da un esperto.

### Criteri di successo
Dichiara come valuterai il risultato:
\`\`\`
Il testo è riuscito se:
- un cliente senza competenze tecniche lo capisce;
- contiene il prezzo e la scadenza;
- non supera 150 parole.
Prima di rispondere, controlla di rispettare tutti i criteri.
\`\`\`

### Vincoli negativi con alternativa
Invece di solo "non usare termini tecnici", scrivi "usa parole di uso comune; se un termine tecnico è indispensabile, spiegalo tra parentesi".
`),
      L('adv-template', 'Modelli di prompt riutilizzabili', 10, `
Quando un'attività si ripete, trasforma il prompt in un **modello** con segnaposto.

\`\`\`
CONTESTO: {chi sono e a cosa serve}
COMPITO: Analizza {documento} e produci {risultato}.
FORMATO: {tabella/elenco/sezioni}, massimo {n} parole.
VINCOLI: {tono}, {lingua}. Se un'informazione manca, scrivi "da verificare".
INPUT:
"""
{testo}
"""
\`\`\`

Molti assistenti permettono di salvare istruzioni permanenti (istruzioni personalizzate, progetti, Gem, GPT personalizzati): sono il luogo naturale per i modelli che usi spesso.
`),
    ],
    questions: [
      Q('Qual è il vantaggio principale di una catena di prompt rispetto a un unico prompt?', ['È più veloce', 'Permette di controllare e correggere ogni risultato intermedio', 'Costa sempre meno', 'Non ci sono vantaggi'], 1, 'Ogni passaggio può essere verificato prima di proseguire.', 'prompting'),
      Q('Assegnare un ruolo (“agisci come avvocato”) al modello…', ['Lo rende un avvocato abilitato', 'Orienta stile e attenzione, ma il risultato va verificato da un esperto', 'È vietato', 'Non ha alcun effetto'], 1, 'Il ruolo influenza la risposta, non garantisce competenza.', 'prompting'),
      Q('Come formulare meglio il vincolo “non usare termini tecnici”?', ['Ripeterlo tre volte', 'Indicare cosa fare invece: parole comuni e spiegazione tra parentesi dei termini indispensabili', 'Scriverlo in inglese', 'Toglierlo'], 1, 'Un vincolo con alternativa è più facile da rispettare.', 'prompting'),
      Q('A cosa servono i segnaposto in un modello di prompt?', ['A rendere il prompt riutilizzabile cambiando solo le parti variabili', 'A nascondere informazioni', 'A ridurre i token', 'A tradurre'], 0, 'I segnaposto separano struttura fissa e contenuto variabile.', 'prompting'),
    ],
  },
  {
    slug: 'contenuti-multimediali', title: 'Generare immagini, audio e video', level: 'intermedio', topic: 'creativita', categories: ['immagini', 'video', 'audio'],
    description: 'Descrivere efficacemente ciò che si vuole ottenere, iterare sulle varianti, rispettare diritti e licenze.',
    lessons: [
      L('media-descrivere', 'Descrivere un’immagine: soggetto, stile, composizione', 15, `
Un prompt per immagini funziona come un **brief per un illustratore**.

| Elemento | Esempio |
|---|---|
| Soggetto | "una ciclista in salita su una strada di montagna" |
| Ambiente e luce | "all'alba, nebbia leggera, luce calda laterale" |
| Stile | "fotografia documentaristica" / "illustrazione acquerello" |
| Composizione | "inquadratura dal basso, soggetto a sinistra, ampio cielo" |
| Formato | "orizzontale 16:9" |

### Consigli
- Sii **concreto**: oggetti, colori, materiali, non aggettivi vaghi ("bellissimo").
- Ogni servizio ha parametri propri (proporzioni, stile, riferimenti di immagine): consulta la documentazione ufficiale del tuo strumento.
- Per il **testo dentro l'immagine** scrivi il testo esatto tra virgolette; alcuni strumenti sono più bravi di altri (es. Ideogram è noto per questo).
`),
      L('media-iterare', 'Iterare su varianti e audio/video', 12, `
### Iterazione visiva
1. Genera più varianti con lo stesso prompt.
2. Scegli la più vicina e **modifica una variabile per volta** (luce, stile, inquadratura).
3. Usa le funzioni di modifica locale (inpainting) per correggere dettagli.

### Video
Descrivi anche il **movimento**: della camera ("carrellata lenta in avanti") e del soggetto. Le clip generate sono brevi: progetta storie come sequenze di inquadrature.

### Audio e voce
- Per la sintesi vocale cura punteggiatura e pause: influenzano il ritmo.
- Per la musica descrivi genere, strumenti, tempo, atmosfera e struttura (strofa, ritornello).
`),
      L('media-diritti', 'Diritti, licenze e uso responsabile', 10, `
- **Licenze**: i diritti d'uso commerciale dei contenuti generati dipendono dai termini del servizio e spesso dal **piano** sottoscritto. Leggili prima di usare un contenuto per un cliente.
- **Persone reali**: non generare immagini o voci realistiche di persone reali senza consenso; molti servizi lo vietano.
- **Marchi e opere protette**: evitare di imitare marchi o personaggi protetti.
- **Trasparenza**: segnala i contenuti generati con AI quando il contesto lo richiede (es. comunicazione pubblica, giornalismo).
`),
    ],
    questions: [
      Q('Quale prompt per immagini è più efficace?', ['"Una bella foto"', '"Una ciclista in salita all’alba, nebbia leggera, fotografia documentaristica, inquadratura dal basso, formato 16:9"', '"Fai qualcosa di creativo"', '"Bici"'], 1, 'Soggetto, luce, stile, composizione e formato sono espliciti.', 'creativita'),
      Q('Come conviene iterare su un’immagine quasi corretta?', ['Cambiare tutto il prompt', 'Modificare una variabile per volta o correggere localmente', 'Ricominciare con un altro strumento', 'Accettarla com’è'], 1, 'Cambiare una variabile alla volta rende l’effetto prevedibile.', 'creativita'),
      Q('Da cosa dipendono i diritti d’uso commerciale di un’immagine generata?', ['Sono sempre liberi', 'Dai termini del servizio e spesso dal piano sottoscritto', 'Dalla risoluzione', 'Dal formato del file'], 1, 'Ogni servizio stabilisce le proprie condizioni.', 'creativita'),
      Q('Nel prompt per un video cosa è importante aggiungere rispetto a un’immagine?', ['Il numero di pixel', 'La descrizione del movimento di camera e soggetto', 'Il nome del file', 'Niente'], 1, 'Il movimento è parte essenziale del brief video.', 'creativita'),
    ],
  },
  {
    slug: 'programmare-con-ai', title: 'Programmare con l’AI', level: 'intermedio', topic: 'codice', categories: ['codice', 'assistente'],
    description: 'Specificare bene il compito, revisionare il codice generato, testarlo e proteggere la sicurezza.',
    lessons: [
      L('code-specificare', 'Specificare il compito di programmazione', 15, `
### Informazioni da fornire sempre
- **Linguaggio e versione**, framework, librerie già usate.
- **Comportamento atteso** con esempi di input/output.
- **Vincoli**: prestazioni, compatibilità, stile del progetto.
- **Codice esistente** rilevante (o, negli strumenti integrati nell'editor, i file giusti nel contesto).

\`\`\`
Linguaggio: Python 3.12, solo libreria standard.
Scrivi una funzione parse_importo(s: str) -> float che converte importi italiani
("1.234,56 €", "€ 12", "0,5") in float. Solleva ValueError per input non validi.
Includi 6 test con pytest, compresi i casi limite.
\`\`\`

### Strumenti diversi, usi diversi
- **Chat** (ChatGPT, Claude, Gemini): spiegazioni, frammenti, progettazione.
- **Nell'editor** (GitHub Copilot, Cursor): completamento e modifiche nel progetto.
- **Agenti** (modalità agente, Claude Code, Replit Agent): eseguono più passaggi in autonomia; richiedono revisione attenta.
`),
      L('code-revisione', 'Rivedere e testare il codice generato', 15, `
Il codice generato **può sembrare corretto e non esserlo**.

### Lista di revisione
1. **Leggi e capisci** ogni parte prima di usarla.
2. **Esegui i test**; aggiungine per i casi limite.
3. Verifica che le **librerie esistano** e siano quelle giuste (i nomi inventati sono un errore noto, sfruttabile anche per attacchi).
4. **Sicurezza**: input non validati, query SQL concatenate, segreti scritti nel codice, permessi eccessivi.
5. **Licenze**: attenzione a frammenti copiati da progetti con licenze incompatibili.

### Chiedere una revisione
"Rivedi questo codice cercando bug, problemi di sicurezza e casi limite non gestiti. Per ogni problema indica la riga e una correzione."
`),
    ],
    questions: [
      Q('Quale informazione è essenziale in una richiesta di codice?', ['Il colore dell’editor', 'Linguaggio/versione, comportamento atteso con esempi e vincoli', 'Il nome del programmatore', 'Nessuna'], 1, 'Senza questi dati il modello deve indovinare.', 'codice'),
      Q('Il codice generato supera la compilazione. È sufficiente?', ['Sì', 'No: va compreso, testato e controllato per sicurezza e casi limite', 'Sì, se è breve', 'Sì, se l’ha scritto un agente'], 1, 'Compilare non significa funzionare correttamente o in sicurezza.', 'codice'),
      Q('Perché verificare che le librerie suggerite esistano davvero?', ['Perché i modelli possono inventare nomi di pacchetti, con rischi anche di sicurezza', 'Per risparmiare spazio', 'Non serve', 'Per la licenza del sistema operativo'], 0, 'Pacchetti inesistenti suggeriti possono essere registrati da malintenzionati.', 'codice'),
    ],
  },
  {
    slug: 'ricerca-e-studio', title: 'Usare l’AI per ricerca e studio', level: 'intermedio', topic: 'ricerca', categories: ['ricerca', 'studio', 'assistente'],
    description: 'Ricerca con fonti, studio attivo, ripasso e autovalutazione con l’AI.',
    lessons: [
      L('ric-fonti', 'Ricerca con fonti verificabili', 12, `
Gli strumenti con **ricerca web** (Perplexity, modalità di ricerca di ChatGPT, Claude, Gemini e Copilot) restituiscono risposte con link alle fonti.

### Metodo
1. Formula la domanda con **periodo e ambito**: "Novità normative 2026 in Italia sulla fatturazione elettronica, solo fonti istituzionali."
2. Apri le fonti principali e verifica che **dicano davvero** ciò che la risposta riporta.
3. Preferisci fonti **primarie** (enti, documentazione ufficiale, articoli scientifici) a quelle secondarie.
4. Annota data e link di ogni informazione usata.

Le funzioni di **ricerca approfondita** producono rapporti lunghi consultando molte fonti: utili per una panoramica, da verificare nei punti chiave.
`),
      L('ric-studio-attivo', 'Studio attivo con l’AI', 12, `
L'AI è più utile come **tutor** che come scorciatoia.

### Tecniche
- **Spiegazione a livelli**: "Spiegami X come a un principiante, poi come a un esperto."
- **Interrogazione**: "Fammi 5 domande su X, una alla volta, e correggimi."
- **Tecnica di Feynman**: spiega tu l'argomento e chiedi all'AI di individuare errori e lacune.
- **Ripasso distanziato**: rivedi gli argomenti a intervalli crescenti (1, 3, 7, 14 giorni). La piattaforma programma ripassi in base ai tuoi risultati.
- **Studio sulle tue fonti**: strumenti come NotebookLM generano quiz e guide **dai tuoi materiali**.
`),
    ],
    questions: [
      Q('Una risposta con link alle fonti è…', ['Automaticamente corretta', 'Più facile da verificare, ma le fonti vanno aperte e lette', 'Sempre inventata', 'Inutile'], 1, 'Le fonti permettono la verifica, che resta necessaria.', 'ricerca'),
      Q('Quale uso dell’AI favorisce di più l’apprendimento?', ['Copiare le risposte', 'Farsi interrogare e correggere, spiegare e farsi segnalare le lacune', 'Chiedere solo riassunti', 'Non usarla'], 1, 'Lo studio attivo produce apprendimento duraturo.', 'ricerca'),
      Q('Che cosa sono le fonti primarie?', ['Le prime trovate su un motore di ricerca', 'Documenti originali: enti, documentazione ufficiale, articoli scientifici', 'I social network', 'I riassunti dell’AI'], 1, 'Le fonti primarie sono l’origine dell’informazione.', 'ricerca'),
    ],
  },
  {
    slug: 'automazione-processi', title: 'Automatizzare processi con l’AI', level: 'avanzato', topic: 'automazione', categories: ['assistente', 'codice', 'piattaforma'],
    description: 'Dal prompt al processo ripetibile: integrazioni, API, costi e controllo qualità.',
    lessons: [
      L('auto-flussi', 'Da attività ripetuta a flusso automatico', 15, `
### Quando automatizzare
Un'attività è candidata se è **frequente**, ha **input simili**, un **formato di uscita definito** e un modo per **controllare** il risultato.

### Livelli di automazione
1. **Prompt salvato** e riusato a mano.
2. **Assistente personalizzato** (istruzioni permanenti + documenti di riferimento).
3. **Strumenti no-code** che collegano app e modelli AI (es. piattaforme di automazione con passaggi AI).
4. **Integrazione via API** in un programma proprio.

### Progettare il controllo umano
Decidi **dove** una persona verifica (es. prima dell'invio di una mail al cliente) e cosa succede se il risultato non supera i controlli.
`),
      L('auto-api', 'API, costi e limiti', 15, `
Le API permettono ai programmi di usare i modelli. Concetti chiave:

- **Chiave API**: credenziale segreta; non va mai inserita nel codice pubblico o nel browser.
- **Costo a token**: si paga per token in ingresso e in uscita; il prezzo varia per modello. Consulta sempre la pagina prezzi ufficiale del provider.
- **Limiti di frequenza** (rate limit): numero massimo di richieste per minuto.
- **Output strutturato**: molti provider permettono di ottenere JSON conforme a uno schema, utile per le integrazioni.
- **Registrazione e monitoraggio**: conserva log di richieste, costi ed errori.

> Accedere a un corso su un'AI non dà accesso alle sue API: servono un account sviluppatore e un metodo di pagamento presso il provider.
`),
    ],
    questions: [
      Q('Quale attività è più adatta all’automazione?', ['Un compito unico e mai ripetuto', 'Un’attività frequente, con input simili, output definito e controllabile', 'Una decisione strategica aziendale', 'Nessuna'], 1, 'Frequenza, regolarità e verificabilità rendono l’automazione utile.', 'automazione'),
      Q('Dove NON deve mai trovarsi una chiave API?', ['In una variabile d’ambiente del server', 'In un gestore di segreti', 'Nel codice pubblicato o eseguito nel browser', 'Cifrata nel database'], 2, 'Nel browser o nel codice pubblico la chiave è esposta a chiunque.', 'automazione'),
      Q('Come si paga tipicamente l’uso di un modello via API?', ['Canone fisso illimitato', 'A token in ingresso e in uscita, con prezzo per modello', 'Per minuto di connessione', 'È sempre gratuito'], 1, 'Il prezzo per token varia da modello a modello.', 'automazione'),
    ],
  },
  {
    slug: 'confrontare-scegliere', title: 'Confrontare e scegliere gli strumenti AI', level: 'avanzato', topic: 'confronto', categories: [],
    description: 'Criteri oggettivi, test comparativi personali, lettura critica dei benchmark.',
    lessons: [
      L('conf-criteri', 'Criteri di scelta', 12, `
| Criterio | Domande |
|---|---|
| **Capacità** | Fa ciò che serve (testo, immagini, codice, ricerca, file)? |
| **Qualità sul tuo compito** | Come va su esempi reali del tuo lavoro? |
| **Integrazioni** | Si collega agli strumenti che usi già? |
| **Dati e privacy** | Dove vengono trattati i dati? Sono usati per l'addestramento? |
| **Costo** | Piano gratuito sufficiente? Costo per utente o per uso? |
| **Affidabilità** | Disponibilità, supporto, stabilità del fornitore |
| **Licenze** | Diritti sui contenuti generati |

### Benchmark
I benchmark pubblici misurano compiti specifici (matematica, codice, comprensione). Sono utili come **indicazione**, ma:
- possono non rappresentare il tuo caso d'uso;
- cambiano rapidamente con le nuove versioni;
- vanno letti con **data e fonte**.
`),
      L('conf-test', 'Test comparativo personale', 15, `
Il modo più affidabile per scegliere è **provare sullo stesso compito**.

### Protocollo
1. Prepara **3–5 compiti reali** e rappresentativi.
2. Usa **lo stesso prompt** in ogni strumento.
3. Definisci prima i **criteri di valutazione** (correttezza, completezza, stile, tempo).
4. Valuta i risultati, se possibile **senza sapere** quale strumento li ha prodotti.
5. Registra **data e versione/piano** usati: i risultati cambiano nel tempo.

La pagina **Confronta AI** della piattaforma mostra le caratteristiche documentate degli strumenti con data di verifica; il laboratorio pratico include un esercizio di confronto guidato.
`),
    ],
    questions: [
      Q('Perché i benchmark pubblici non bastano per scegliere?', ['Sono sempre falsi', 'Misurano compiti specifici che possono non rappresentare il tuo uso e invecchiano rapidamente', 'Sono a pagamento', 'Bastano sempre'], 1, 'Vanno integrati con test sul proprio caso d’uso.', 'confronto'),
      Q('In un test comparativo corretto…', ['Si usano prompt diversi per ogni strumento', 'Si usa lo stesso prompt e criteri definiti prima', 'Si giudica in base al marchio', 'Si prova un solo compito'], 1, 'Stesse condizioni e criteri prefissati rendono il confronto equo.', 'confronto'),
      Q('Perché registrare data e versione del test?', ['Per burocrazia', 'Perché modelli e funzioni cambiano e il risultato può non valere più', 'Non serve', 'Per il copyright'], 1, 'Gli strumenti evolvono rapidamente.', 'confronto'),
    ],
  },
  {
    slug: 'uso-professionale', title: 'Uso professionale responsabile', level: 'professionale', topic: 'professionale', categories: [],
    description: 'Quadro normativo europeo, policy aziendali, qualità e misurazione dei risultati.',
    lessons: [
      L('pro-normativa', 'Quadro normativo: AI Act e GDPR', 15, `
### Regolamento europeo sull'intelligenza artificiale (AI Act)
Il **Regolamento (UE) 2024/1689** è entrato in vigore il 1° agosto 2024 con applicazione **graduale** degli obblighi negli anni successivi. Adotta un approccio **basato sul rischio**:
- pratiche **vietate** (es. punteggio sociale);
- sistemi **ad alto rischio** (es. alcuni usi in selezione del personale, istruzione, credito) con obblighi stringenti;
- obblighi di **trasparenza** (es. informare quando si interagisce con un sistema AI, segnalare contenuti sintetici in determinati casi);
- obblighi specifici per i fornitori di **modelli di AI per finalità generali**;
- obblighi di **alfabetizzazione in materia di AI** per chi fornisce e utilizza sistemi AI.

### GDPR
Se tratti dati personali con strumenti AI valgono i principi del GDPR: base giuridica, minimizzazione, informativa, sicurezza, valutazione dei fornitori.

> Le scadenze di applicazione e le linee guida attuative evolvono: verifica sempre sul sito ufficiale della Commissione europea e con il tuo consulente.
`),
      L('pro-policy-qualita', 'Policy aziendale e misurazione della qualità', 12, `
### Elementi di una policy interna
- Strumenti **approvati** e per quali dati.
- Attività **vietate** o che richiedono revisione umana.
- Regole su **riservatezza**, proprietà intellettuale, trasparenza verso i clienti.
- **Formazione** obbligatoria e referente interno.

### Misurare il valore
- Definisci **indicatori** prima di introdurre lo strumento (tempo per attività, errori, soddisfazione).
- Conserva **esempi di riferimento** per verificare nel tempo che la qualità non peggiori quando cambiano i modelli.
- Raccogli i **casi di errore** e aggiorna prompt e procedure.
`),
    ],
    questions: [
      Q('Quale approccio adotta l’AI Act europeo?', ['Divieto totale dell’AI', 'Approccio basato sul rischio', 'Nessuna regola per le aziende', 'Solo regole fiscali'], 1, 'Gli obblighi crescono con il livello di rischio del sistema.', 'professionale'),
      Q('Se un flusso AI tratta dati personali, quale normativa si applica certamente?', ['Nessuna', 'Il GDPR', 'Solo il codice della strada', 'Solo norme statunitensi'], 1, 'Il GDPR si applica a ogni trattamento di dati personali nell’UE.', 'professionale'),
      Q('Perché conservare esempi di riferimento nel tempo?', ['Per occupare spazio', 'Per verificare che la qualità non peggiori quando cambiano i modelli', 'Per obbligo di legge', 'Non serve'], 1, 'I modelli cambiano: servono test di regressione.', 'professionale'),
    ],
  },
];

// Esercizi pratici con griglia di valutazione.
// required: elementi che il prompt deve contenere per questo compito specifico (verificati dall'analizzatore a regole).
export const EXERCISES = [
  {
    slug: 'es-mail-fornitore', title: 'Mail di sollecito a un fornitore', level: 'principiante', module: 'prompt-efficaci', categories: ['assistente'],
    brief: 'Il fornitore "Rossi Srl" è in ritardo di 10 giorni sulla consegna dell’ordine n. 4512. Scrivi un prompt che faccia redigere a un assistente AI una mail di sollecito cortese ma ferma, con richiesta di una nuova data certa entro 48 ore. Poi incolla la mail ottenuta.',
    rubric: [
      { key: 'contesto', label: 'Contesto (chi scrive, a chi, situazione)', weight: 2 },
      { key: 'compito', label: 'Compito chiaro', weight: 2 },
      { key: 'formato', label: 'Formato e lunghezza', weight: 1 },
      { key: 'vincoli', label: 'Tono e vincoli', weight: 2 },
      { key: 'specifici', label: 'Dati specifici del caso (ordine, ritardo, scadenza)', weight: 3 },
    ],
    required: [['4512', 'ordine'], ['48', 'ore', 'scadenza', 'entro'], ['cortese', 'fermo', 'ferma', 'tono', 'deciso']],
  },
  {
    slug: 'es-rapporto-pdf', title: 'Rapporto sintetico da un PDF di 50 pagine', level: 'intermedio', module: 'documenti-e-dati', categories: ['assistente', 'studio'],
    brief: 'Devi analizzare un documento PDF di 50 pagine (ad esempio un bilancio o una relazione annuale) e ricavarne un rapporto sintetico con dati, tabelle e conclusioni. Scrivi il prompt (o la sequenza di prompt) da usare con un assistente che accetta file. Se lo esegui davvero, incolla anche il risultato e indica eventuali errori che hai individuato.',
    rubric: [
      { key: 'contesto', label: 'Contesto e destinatario del rapporto', weight: 2 },
      { key: 'compito', label: 'Compito e passaggi', weight: 2 },
      { key: 'formato', label: 'Struttura del rapporto e tabelle', weight: 2 },
      { key: 'verifica', label: 'Riferimenti alle pagine e gestione dati mancanti', weight: 3 },
      { key: 'specifici', label: 'Elementi richiesti (dati, tabelle, conclusioni)', weight: 2 },
    ],
    required: [['tabella', 'tabelle'], ['pagina', 'pagine', 'sezione'], ['conclusion', 'raccomandazion', 'sintesi']],
  },
  {
    slug: 'es-estrazione-contratti', title: 'Estrazione di dati da contratti', level: 'intermedio', module: 'documenti-e-dati', categories: ['assistente'],
    brief: 'Hai il testo di 5 contratti di fornitura. Scrivi un prompt che estragga una tabella con fornitore, data di inizio, durata, importo annuo e penali, gestendo correttamente i dati mancanti e un formato numerico compatibile con un foglio di calcolo italiano.',
    rubric: [
      { key: 'compito', label: 'Compito chiaro', weight: 2 },
      { key: 'formato', label: 'Colonne definite', weight: 3 },
      { key: 'verifica', label: 'Regola per dati mancanti / divieto di dedurre', weight: 3 },
      { key: 'input', label: 'Input delimitato', weight: 2 },
    ],
    required: [['colonn', '|', 'tabella'], ['n/d', 'mancant', 'non presente', 'non dedurre'], ['importo', 'durata', 'penal']],
  },
  {
    slug: 'es-spiegazione-studente', title: 'Spiegazione per uno studente', level: 'principiante', module: 'prompt-efficaci', categories: ['assistente', 'studio'],
    brief: 'Fai spiegare a un assistente AI il concetto di inflazione a uno studente di 14 anni, con un esempio quotidiano e 3 domande di verifica finali. Scrivi il prompt e incolla la risposta.',
    rubric: [
      { key: 'contesto', label: 'Destinatario e livello', weight: 3 },
      { key: 'compito', label: 'Compito', weight: 2 },
      { key: 'formato', label: 'Struttura richiesta', weight: 2 },
      { key: 'specifici', label: 'Esempio e domande di verifica', weight: 3 },
    ],
    required: [['14', 'studente', 'ragazz'], ['esempio'], ['domand', 'verifica', 'quiz']],
  },
  {
    slug: 'es-immagine-poster', title: 'Prompt per un poster', level: 'intermedio', module: 'contenuti-multimediali', categories: ['immagini'],
    brief: 'Crea il prompt per un poster di un festival del jazz all’aperto a Bologna, il 21 giugno, con la scritta "Jazz sotto le stelle". Specifica soggetto, stile, composizione, palette, formato e testo esatto.',
    rubric: [
      { key: 'soggetto', label: 'Soggetto e ambientazione', weight: 3 },
      { key: 'stile', label: 'Stile e palette', weight: 2 },
      { key: 'composizione', label: 'Composizione e formato', weight: 2 },
      { key: 'testo', label: 'Testo esatto tra virgolette', weight: 3 },
    ],
    required: [['"jazz sotto le stelle"', '“jazz sotto le stelle”', "'jazz sotto le stelle'"], ['stile', 'illustrazion', 'fotograf', 'vettorial', 'grafic'], ['vertical', 'orizzontal', 'formato', ':']],
  },
  {
    slug: 'es-funzione-python', title: 'Richiesta di codice con test', level: 'intermedio', module: 'programmare-con-ai', categories: ['codice', 'assistente'],
    brief: 'Scrivi un prompt per ottenere una funzione che valida un codice fiscale italiano (solo formato, non il carattere di controllo), con linguaggio e versione specificati, esempi di input validi e non validi e test automatici.',
    rubric: [
      { key: 'contesto', label: 'Linguaggio, versione, librerie', weight: 3 },
      { key: 'compito', label: 'Comportamento atteso', weight: 2 },
      { key: 'specifici', label: 'Esempi di input/output', weight: 2 },
      { key: 'verifica', label: 'Test richiesti', weight: 3 },
    ],
    required: [['python', 'javascript', 'typescript', 'java', 'php', 'c#', 'go'], ['test'], ['esempi', 'esempio', 'valido']],
  },
  {
    slug: 'es-confronto-ai', title: 'Test comparativo tra due o più AI', level: 'avanzato', module: 'confrontare-scegliere', categories: [],
    brief: 'Scegli un compito reale del tuo lavoro. Scrivi un unico prompt da inviare identico a due o più AI, poi riporta nel campo risultato: le AI usate (con piano), la data, i criteri di valutazione definiti prima e un giudizio motivato per ciascun criterio.',
    rubric: [
      { key: 'compito', label: 'Prompt chiaro e riutilizzabile', weight: 3 },
      { key: 'criteri', label: 'Criteri definiti prima', weight: 3 },
      { key: 'verifica', label: 'Data, versione/piano registrati', weight: 2 },
      { key: 'specifici', label: 'Giudizio motivato', weight: 2 },
    ],
    required: [['criteri', 'criterio'], ['data', '2026', '2027'], ['piano', 'versione', 'gratuit']],
  },
  {
    slug: 'es-ricerca-fonti', title: 'Ricerca con fonti primarie', level: 'intermedio', module: 'ricerca-e-studio', categories: ['ricerca', 'assistente'],
    brief: 'Usa uno strumento con ricerca web per ricostruire le principali novità di un tema del tuo settore negli ultimi 12 mesi. Il prompt deve indicare periodo, ambito, tipo di fonti ammesse e formato. Nel risultato, indica quali fonti hai aperto e verificato.',
    rubric: [
      { key: 'compito', label: 'Domanda con periodo e ambito', weight: 3 },
      { key: 'verifica', label: 'Tipo di fonti e citazioni richieste', weight: 3 },
      { key: 'formato', label: 'Formato', weight: 2 },
      { key: 'specifici', label: 'Fonti verificate nel risultato', weight: 2 },
    ],
    required: [['mesi', '2025', '2026', 'periodo', 'ultimi'], ['fonti', 'fonte', 'link'], ['ufficial', 'istituzional', 'primari']],
  },
];
