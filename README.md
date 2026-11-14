# Atlante AI

Piattaforma web di formazione, studio e aggiornamento continuo sulle intelligenze artificiali:
catalogo delle AI con dati verificabili, percorsi di studio personalizzati e adattivi, calendario e
promemoria, verifiche, laboratorio pratico e laboratorio prompt, ricerca di risorse gratuite da fonti
autorizzate, monitoraggio quotidiano delle novità e gestione amministrativa con approvazione delle modifiche.

L’analisi di progetto (analisi funzionale, architettura, database, mappa delle schermate, flussi,
integrazioni, stima di complessità e costi) è in [`docs/ANALISI.md`](docs/ANALISI.md).

## Avvio

Requisiti: Node.js ≥ 22.13 (usa il modulo SQLite integrato `node:sqlite`, nessun database esterno).

```bash
npm install
cp .env.example .env      # imposta almeno APP_SECRET in produzione
npm start                 # http://localhost:3000
```

Al primo avvio il database viene creato e popolato con catalogo, curriculum, esercizi e fonti.
**Il primo utente che si registra diventa amministratore.**

```bash
npm test                  # test unitari e di integrazione delle API (database in memoria)
npm run dev               # riavvio automatico durante lo sviluppo
```

Per le variabili d’ambiente vedi `.env.example` (SMTP per le email, chiavi YouTube/GitHub, ecc.).
Le notifiche push richiedono HTTPS in produzione (su `localhost` funzionano anche in HTTP).

## Atlante AI Studio – l’app semplice (`studio/`)

Versione leggera della piattaforma: una web app installabile (PWA) senza server né account, pensata per
imparare a usare le piattaforme AI. I progressi restano sul dispositivo.

| Funzione | Dove |
|---|---|
| Scelta tra 20 AI (ChatGPT, Claude, Gemini, Copilot, Perplexity, DeepSeek, Grok, Le Chat, NotebookLM, Midjourney…), anche più di una insieme, e confronto affiancato | Studia |
| Scelta dei contenuti (10 argomenti) e del livello; corsi, lezioni e corso introduttivo per ogni AI | Studia |
| Visualizzazione dei risultati: KPI, andamento delle verifiche, competenze, avanzamento per AI, argomenti da rinforzare | Home |
| Verifiche (per corso e miste), esercizi con griglia di valutazione, prompt di prova con analisi e invio diretto all’AI | Pratica |
| Consigli su quale AI usare per un tipo di lavoro (anche descritto a parole) | Consigli |
| Ricerca automatica di materiale gratuito: web (Wikipedia, YouTube con chiave), database (GitHub, OpenAlex), social e community (Hacker News, Reddit, Mastodon, DEV); biblioteca aggiornata ogni giorno | Risorse |
| Promemoria: giorni, numero di sessioni al giorno, orari, durata; notifiche, recupero delle sessioni saltate, esportazione nel calendario (.ics) | ⚙︎ Impostazioni |
| Aggiornamenti giornalieri: novità sulle AI scelte (feed ufficiali, release degli SDK, community) e corsi nuovi o aggiornati | Novità |

I contenuti (`studio/contenuti.json`) sono generati dai dati della piattaforma: dopo aver modificato catalogo,
curriculum o esercizi in `server/seed/` esegui

```bash
npm run studio:contenuti   # rigenera contenuti.json; i corsi cambiati salgono di versione
```

e pubblica: le app installate rilevano i corsi nuovi o aggiornati al controllo giornaliero e lo segnalano.
Per provarla in locale basta un server statico, ad esempio `npx serve studio` oppure `python3 -m http.server -d studio`.
La cartella si può pubblicare così com’è su GitHub Pages o su qualunque hosting statico (serve HTTPS per notifiche e installazione).

Limiti da sapere: le notifiche arrivano con l’app aperta o installata (in background solo dove il browser supporta la
sincronizzazione periodica, es. Chrome su Android); per promemoria sempre puntuali, anche su iPhone, si usa il file .ics
nel calendario. Alcuni blog ufficiali non consentono la lettura diretta da una web app: in quel caso l’app mostra il link.

## Struttura

```
server/
  index.js            server Express, header di sicurezza, log, gestione errori
  schema.sql          schema del database
  db.js auth.js security.js
  routes/             API REST: auth, tools, paths, assessments, resources, me, admin
  services/           planner (percorsi e calendario), adaptive (verifiche e rinforzo),
                      promptAnalyzer, indexer (catalogazione risorse), monitor (novità e report),
                      notifier (in-app, push, email), scheduler (processi pianificati), toolModules
  connectors/         GitHub, arXiv, Hacker News, YouTube, RSS/Atom (solo API e feed autorizzati)
  ai/                 provider AI interni: Anthropic (SDK ufficiale), OpenAI, Gemini + registro consumi
  seed/               catalogo AI, curriculum, esercizi, fonti iniziali
public/               SPA in JavaScript nativo (nessuna build), service worker per le push
test/                 test con node:test
docs/ANALISI.md       documento di analisi
```

## Cosa è implementato (stato al 14/11/2026)

### Fase 1 – MVP: completa
| Funzione | Stato |
|---|---|
| Registrazione, accesso, profilo, ruoli (utente, docente, amministratore) | ✅ |
| Catalogo dinamico di 20 AI con scheda completa; dati variabili con stato di verifica, fonte e data | ✅ |
| Selezione delle AI da studiare (“Le mie AI”) | ✅ |
| Percorsi personalizzati (AI, livello, argomenti, obiettivi, giorni, orari, sessioni, durata), anche comparativi | ✅ |
| Moduli → lezioni → materiali → verifiche; adattamento: < 70% genera lezione di rinforzo mirata, ≥ 70% sblocca il modulo successivo | ✅ |
| Calendario delle sessioni con fuso orario, ripianificazione delle sessioni saltate, esportazione `.ics` | ✅ |
| Ricerca risorse con filtri, deduplica, punteggio di qualità trasparente, gratuità motivata, controllo link, esclusione dei contenuti obsoleti | ✅ |
| Dashboard con KPI, grafici delle competenze, prossime sessioni, suggerimenti, novità | ✅ |
| Notifiche in-app, web push (VAPID), email (SMTP); preferenze per giorni, orari, numero, tipi, pausa | ✅ |
| Verifiche (scelta multipla; domande aperte supportate dal motore) ed esercizi pratici con griglia di valutazione | ✅ |
| Amministrazione: utenti, catalogo e verifica dei dati, fonti, provider AI con chiavi cifrate e costi, processi pianificati, registro | ✅ |
| Log strutturati, registro dei job, backup giornaliero con rotazione | ✅ |

### Fasi successive: già presenti in parte
- **Fase 2**: confronto affiancato delle AI su attributi documentati; laboratorio prompt (analisi a regole, confronto versioni, modelli per categoria professionale, ottimizzazione con AI interna); valutazione degli esercizi con AI interna (se configurata).
- **Fase 3**: monitoraggio quotidiano delle fonti, distinzione nuove/già pubblicate, report giornaliero con segnalazione dei possibili impatti sui corsi, flusso di proposta/approvazione delle modifiche didattiche con versione precedente e nuova.

### Non ancora implementato
- Motore di raccomandazione “quale AI per questo lavoro” (Fase 2).
- Generazione automatica di nuove domande ed esercizi con AI (Fase 2).
- Proposte automatiche di modifica delle lezioni a partire dalle novità (Fase 3): oggi il report le segnala e un docente le propone.
- Connettore Reddit: richiede la registrazione di un’app OAuth e l’accettazione dei termini API da parte del titolare.
- Fase 4 (certificazioni, strumenti docenti avanzati).

### Cose da sapere
- **Dati del catalogo da verificare.** Piani, prezzi e versioni sono stati inseriti come “da verificare”: un amministratore deve confermarli sulle pagine ufficiali (Admin → Catalogo AI). Finché non lo fa, l’interfaccia li mostra con un’etichetta di avviso.
- **Contenuti didattici.** Il curriculum di base (11 moduli, 27 lezioni, 41 domande, 8 esercizi) è stato redatto per la piattaforma; i moduli specifici per ogni AI sono generati dai dati della scheda. Va previsto un responsabile didattico che li rilegga.
- **Collaudo dei connettori.** GitHub è stato provato con dati reali. arXiv, Hacker News, YouTube, i feed RSS e le chiamate ai provider AI non erano raggiungibili dall’ambiente di sviluppo: il parsing è coperto da test con dati di esempio, ma vanno verificati al primo avvio in produzione (Admin → Fonti → “Esegui ora”).
