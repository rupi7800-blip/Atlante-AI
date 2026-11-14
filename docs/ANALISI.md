# Atlante AI — Analisi di progetto

Piattaforma di formazione, studio e aggiornamento continuo sulle intelligenze artificiali.
Documento redatto il 14/11/2026. Copre i sette elaborati richiesti prima dello sviluppo:
analisi funzionale, architettura tecnica, struttura del database, mappa delle schermate,
flussi di navigazione, integrazioni necessarie, stima di complessità e costi operativi.

---

## 1. Analisi funzionale

### 1.1 Attori

| Ruolo | Cosa fa |
|---|---|
| **Utente** | Si registra, sceglie le AI da studiare, genera percorsi, studia, svolge verifiche ed esercizi, riceve notifiche, consulta risorse e aggiornamenti. |
| **Docente / formatore** | Tutto ciò che fa l'utente + crea e modifica lezioni, domande, esercizi; propone modifiche ai corsi. |
| **Amministratore** | Tutto ciò che fa il docente + gestisce utenti e ruoli, catalogo AI, fonti monitorate, chiavi API dei provider interni, job pianificati, approvazione delle modifiche ai corsi. |
| **Processi automatici** | Scheduler interno: raccolta risorse, controllo link, monitoraggio novità, invio promemoria, report quotidiano. |

Il primo utente registrato diventa amministratore (bootstrap); i successivi sono utenti.

### 1.2 Tre "tipi di AI" — distinzione fondamentale

Il modello dati separa nettamente tre concetti che non devono mai essere confusi:

1. **AI oggetto di studio** (`ai_tools`): schede del catalogo (ChatGPT, Claude, Midjourney…). Studiarle **non** richiede alcuna API.
2. **AI interne della piattaforma** (`ai_providers`): modelli usati dal sistema per generare esercizi, valutare prompt, ecc. Configurati dall'amministratore con chiave API cifrata; ogni chiamata è registrata con token e costo stimato.
3. **AI esterne usate dall'utente**: l'utente le usa direttamente sui servizi ufficiali (es. per svolgere un'esercitazione). La piattaforma fornisce solo il link e il compito, non intermedia.

Ogni funzione che dipende da un provider interno funziona anche **senza**: in quel caso usa
un percorso deterministico (es. l'analizzatore di prompt a regole) e lo dichiara nell'interfaccia.

### 1.3 Requisiti funzionali per modulo (con fase)

| # | Modulo | Requisiti principali | Fase |
|---|---|---|---|
| F1 | Utenti e profili | Registrazione, login, logout, profilo (livello, preferenze, fuso orario), ruoli, preferiti | 1 |
| F2 | Catalogo AI | Lista dinamica; scheda con sviluppatore, descrizione, funzionalità, ambiti, punti di forza/limiti, versioni, piano gratuito vs a pagamento, prezzi, guide, esempi, esercitazioni, data di verifica; ogni dato con **stato di verifica** e fonte | 1 |
| F3 | Le mie AI | Selezione di una o più AI da studiare | 1 |
| F4 | Percorsi di studio | Procedura guidata (AI, livello, argomenti, obiettivi, disponibilità settimanale, orari, sessioni/giorno, durata); generazione automatica di moduli → lezioni → materiali → esercizi → verifiche; percorsi comparativi su più AI; calendario delle sessioni | 1 |
| F5 | Adattività | Verifica di modulo con soglia (70%): superata → modulo successivo sbloccato; non superata → lezione di rinforzo + esercizi aggiuntivi + nuovo tentativo | 1 |
| F6 | Ricerca risorse | Connettori a fonti autorizzate (API ufficiali, feed RSS/Atom); catalogazione con titolo, descrizione, fonte, link, data, livello, argomento, AI, lingua, gratuità, qualità; filtri; deduplica; controllo link; esclusione dei contenuti obsoleti | 1 |
| F7 | Verifiche ed esercizi | Domande a scelta multipla, domande aperte, esercizi pratici di prompt con griglia di valutazione; archivio dei tentativi | 1 |
| F8 | Notifiche e calendario | Preferenze (giorni, orari, numero/giorno, tipo, pausa); notifiche in-app, web push, email (se SMTP configurato); promemoria per sessioni, esercizi, verifiche, ripasso, percorsi sospesi | 1 |
| F9 | Dashboard | Percorsi attivi, AI selezionate, lezioni fatte/da fare, tempo di studio, avanzamento, risultati, competenze, grafico dell'evoluzione, storico attività, nuove risorse, suggerimenti | 1 |
| F10 | Amministrazione | Gestione utenti, catalogo, fonti, provider, job, log | 1 |
| F11 | Raccomandazione AI per attività | Comprensione della richiesta, AI candidate, motivazione con fonti e date | 2 |
| F12 | Confronto AI | Tabella comparativa su attributi documentati (non punteggi arbitrari) | 2 (base in fase 1) |
| F13 | Laboratorio prompt | Archivio, categorie professionali, versioni, analisi, ottimizzazione | 2 (analizzatore in fase 1) |
| F14 | Laboratorio pratico con valutazione AI | Simulazioni di lavoro valutate dal provider interno | 2 |
| F15 | Monitoraggio quotidiano e report | Fonti configurabili, raccolta novità, distinzione nuovo/già visto, report giornaliero | 3 (raccolta base in fase 1) |
| F16 | Revisione dei corsi | Proposte di modifica tracciate (data, contenuto, motivo, fonte, versione precedente/nuova) con approvazione | 3 |
| F17 | Certificazione, funzioni docente avanzate, nuovi provider | | 4 |

### 1.4 Regole di qualità dei contenuti

- **Nessun dato inventato.** Ogni informazione variabile (prezzi, versioni, piani) ha un campo
  `stato` (`verificato` / `da_verificare`), una fonte e una data di verifica. Le informazioni
  non verificate sono mostrate con un'etichetta esplicita, mai come fatti.
- **Punteggi trasparenti.** La qualità delle risorse è calcolata con una formula pubblica
  (livello di affidabilità della fonte + segnali oggettivi come recentezza e stelle GitHub) e la
  formula è visibile all'utente. Nessun "voto" alle AI senza fonte.
- **Contenuti generati dall'AI etichettati** (`origine: ai_generato`) e distinti da quelli redatti
  o revisionati da un docente.
- **Rispetto dei termini di servizio:** solo API pubbliche documentate e feed RSS/Atom pubblicati
  dagli editori. Nessuno scraping di pagine HTML. Reddit e YouTube solo tramite API ufficiali con
  credenziali dell'amministratore.

---

## 2. Architettura tecnica

### 2.1 Scelte

| Livello | Scelta MVP | Motivazione | Evoluzione |
|---|---|---|---|
| Runtime | Node.js 22 | Un solo linguaggio front/back, ottimo per I/O verso API esterne | — |
| Server HTTP | Express 4 | Maturo, semplice | — |
| Database | SQLite (`node:sqlite`) in modalità WAL | Zero infrastruttura, backup = copia di un file, adeguato fino a migliaia di utenti | PostgreSQL (lo schema usa SQL standard; migrazione tramite lo stesso file di schema) |
| Frontend | SPA in JavaScript nativo (moduli ES), senza build | Nessuna toolchain da mantenere, veloce su mobile | Framework a componenti se il team cresce |
| Autenticazione | Password con `scrypt` + sessioni in cookie HttpOnly/SameSite | Nessuna dipendenza esterna, sicura | OAuth/SSO |
| Scheduler | Pianificatore interno (tick al minuto) con registro dei job | Nessun servizio esterno | Coda dedicata (BullMQ) o cron di sistema |
| Notifiche | Web Push (VAPID), email SMTP (nodemailer), in-app | Standard aperti | Push mobile nativo |
| AI interne | Livello `providers` modulare: Anthropic (SDK ufficiale), OpenAI, Google Gemini (REST) | Aggiungere un provider = aggiungere un file | Altri provider |
| Segreti | Chiavi API cifrate AES-256-GCM con chiave master da variabile d'ambiente | Le chiavi non sono mai in chiaro nel DB né restituite al browser | KMS |

### 2.2 Componenti (separazione richiesta)

```
┌──────────────────────────── Browser (SPA responsive, Service Worker per push) ─────────────────────────┐
└───────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                                │ REST JSON /api/*
┌───────────────────────────────────────────────▼────────────────────────────────────────────────────────┐
│ server/index.js — sicurezza (header, rate limit, sessioni), log richieste, gestione errori             │
├─────────────┬──────────────┬───────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ routes/auth │ routes/tools │ routes/paths  │ routes/      │ routes/      │ routes/      │ routes/admin │
│ utenti      │ catalogo AI  │ percorsi,     │ resources    │ assessments  │ notifications│ gestione     │
│             │ confronto    │ lezioni       │ ricerca      │ verifiche,   │ dashboard    │              │
│             │              │               │              │ laboratorio  │ updates      │              │
├─────────────┴──────────────┴───────────────┴──────────────┴──────────────┴──────────────┴──────────────┤
│ services/: planner (generazione percorsi + calendario), adaptive (sblocco/rinforzo),                    │
│ promptAnalyzer (valutazione a regole), resourceIndexer (deduplica, qualità, controllo link),           │
│ notifier (in-app/push/email), monitor (novità), scheduler (job pianificati)                            │
├──────────────────────────────┬──────────────────────────────┬──────────────────────────────────────────┤
│ connectors/: github, arxiv,  │ ai/: provider anthropic,     │ db.js + schema.sql (SQLite)              │
│ hackernews, youtube, rss     │ openai, gemini + registro    │ backup programmati                        │
│ (solo API/feed autorizzati)  │ consumi e costi              │                                           │
└──────────────────────────────┴──────────────────────────────┴──────────────────────────────────────────┘
```

### 2.3 Sicurezza, log, backup

- Password: `scrypt` (N=16384) con salt casuale; confronto a tempo costante.
- Sessioni: token casuale 256 bit, salvato nel DB come hash SHA-256, cookie `HttpOnly`, `SameSite=Lax`, `Secure` in produzione; scadenza 30 giorni.
- Protezione CSRF: le richieste che modificano dati richiedono l'header `X-Requested-With` (non inviabile cross-site senza CORS) oltre a SameSite.
- Rate limit su login/registrazione (in memoria, per IP).
- Header di sicurezza (CSP restrittiva, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`).
- Autorizzazione per ruolo su ogni rotta amministrativa.
- Log strutturati JSON su stdout; tabella `job_runs` per ogni esecuzione pianificata; tabella `audit_log` per azioni amministrative; tabella `ai_usage` per consumi AI.
- Backup: job giornaliero `VACUUM INTO` in `data/backups/` con rotazione (ultimi 14).

---

## 3. Struttura del database

Lo schema completo è in `server/schema.sql`. Tabelle principali:

| Area | Tabella | Campi chiave |
|---|---|---|
| Utenti | `users` | id, email, password_hash, name, role (user/teacher/admin), level, timezone, created_at |
| | `sessions` | token_hash, user_id, expires_at |
| | `user_preferences` | user_id, notify_days, notify_times, max_per_day, channels, paused_until, email_enabled |
| | `push_subscriptions` | user_id, endpoint, p256dh, auth |
| Catalogo | `ai_tools` | slug, name, developer, category, website, description, features[], use_cases[], strengths[], limitations[], versions[], free_tier, paid_plans, pricing_url, docs_url, status, last_verified_at |
| | `ai_tool_facts` | tool_id, field, value, source_url, status (verificato/da_verificare), verified_at — ogni dato variabile con la sua fonte |
| | `user_tools` | user_id, tool_id (le mie AI) |
| | `favorites` | user_id, kind, item_id |
| Didattica | `topics` | slug, name, category |
| | `modules` | slug, title, description, level, topic_slug, tool_id (NULL = trasversale), order_index, origin, version |
| | `lessons` | module_id, title, content (markdown), est_minutes, kind (teoria/pratica/rinforzo), order_index, origin, version |
| | `questions` | module_id, kind (scelta_multipla/aperta), prompt, options[], answer_index, explanation, rubric |
| | `exercises` | module_id, tool_id, title, brief, kind (prompt/pratico), rubric[], level |
| Percorsi | `study_paths` | user_id, title, level, goals, topics[], tools[], weekly_minutes, schedule (giorni, orari, sessioni, durata), status |
| | `path_modules` | path_id, module_id, order_index, status (bloccato/attivo/rinforzo/completato), best_score |
| | `path_lessons` | path_id, lesson_id, path_module_id, status, completed_at, minutes_spent |
| | `study_sessions` | path_id, user_id, starts_at, duration_min, lesson_ids[], status, notified_at |
| Valutazione | `quiz_attempts` | user_id, path_module_id, module_id, score, answers, passed, created_at |
| | `exercise_submissions` | user_id, exercise_id, prompt_text, result_text, evaluation (json), score, evaluator (regole/ai:modello) |
| | `skills` / `user_skill_events` | competenza, punteggio, data → grafico dell'evoluzione |
| Risorse | `sources` | name, kind (github/arxiv/hackernews/youtube/rss), config, trust_tier (ufficiale/istituzionale/comunità), enabled, purpose (risorse/novità), last_run_at |
| | `resources` | url_normalized (UNIQUE), url, title, description, source_id, published_at, level, topic, tool_slugs[], language, is_free, free_basis, quality_score, quality_breakdown, link_status, last_checked_at, content_type, first_seen_at |
| Novità | `news_items` | source_id, url (UNIQUE), title, summary, published_at, tool_slugs[], first_seen_at, is_new |
| | `daily_reports` | date, content (json) |
| | `course_change_requests` | target (module/lesson), target_id, previous_version, proposed_version, reason, source_url, status (proposta/approvata/respinta), reviewer_id, decided_at |
| Sistema | `notifications` | user_id, kind, title, body, link, read_at, created_at |
| | `ai_providers` | name, kind (anthropic/openai/gemini), model, api_key_enc, enabled, purposes[], input_price, output_price |
| | `ai_usage` | provider_id, user_id, purpose, input_tokens, output_tokens, cost_estimate |
| | `job_runs` | job, started_at, finished_at, status, detail |
| | `activity_log` / `audit_log` | storico attività utente / azioni amministrative |

Gli array sono memorizzati come JSON (in PostgreSQL diventeranno `jsonb`).

---

## 4. Mappa delle schermate

| Voce di menu | Schermata | Contenuto |
|---|---|---|
| — | Accesso / Registrazione | Form, messaggi d'errore chiari |
| Dashboard | `#/` | KPI (avanzamento, tempo, lezioni), prossime sessioni, grafico competenze, risultati recenti, nuove risorse, suggerimenti |
| Le mie AI | `#/mie-ai` | AI selezionate, accesso rapido a scheda e risorse |
| Catalogo AI | `#/catalogo`, `#/catalogo/:slug` | Ricerca e filtri per categoria; scheda completa con badge di verifica |
| Percorsi di studio | `#/percorsi`, `#/percorsi/nuovo`, `#/percorsi/:id` | Elenco; procedura guidata in 4 passaggi; dettaglio con moduli, stato, calendario |
| — | `#/lezione/:pathId/:lessonId` | Testo della lezione, materiali collegati, "segna come completata" |
| Verifiche | `#/verifiche`, `#/verifica/:pathModuleId` | Elenco verifiche disponibili; quiz con correzione e spiegazioni |
| Laboratorio pratico | `#/laboratorio`, `#/laboratorio/:id` | Esercizi; invio prompt e risultato; valutazione con griglia e suggerimenti; archivio |
| Laboratorio prompt | `#/prompt` | Analizzatore di prompt (fase 1), archivio (fase 2) |
| Ricerca risorse | `#/risorse` | Ricerca testuale + filtri (AI, livello, tipo, lingua, gratuito, data) |
| Confronta AI | `#/confronta` | Tabella affiancata di 2–4 schede con attributi documentati e date |
| Aggiornamenti | `#/aggiornamenti` | Novità dalle fonti monitorate, separate in "nuove" e "già viste" |
| I miei progressi | `#/progressi` | Storico attività, tentativi, esercizi, evoluzione competenze |
| Impostazioni | `#/impostazioni` | Profilo, notifiche (giorni/orari/canali/pausa), push |
| Amministrazione | `#/admin` | Utenti, catalogo, fonti, provider AI, job e log, proposte di modifica |

## 5. Flussi di navigazione

**Primo accesso**
Registrazione → Impostazioni rapide (livello) → Catalogo → selezione AI ("Aggiungi alle mie AI") → "Crea percorso" → procedura guidata → percorso generato con calendario → Dashboard.

**Studio quotidiano**
Notifica (push/email/in-app) "Sessione alle 18:30" → link alla sessione → lezione → "Completata" → lezione successiva → a fine modulo "Verifica" → esito:
- ≥ 70% → modulo completato, successivo sbloccato, competenza aggiornata;
- < 70% → modulo in stato *rinforzo*: aggiunta lezione di rinforzo con gli argomenti delle risposte sbagliate + esercizio; dopo averla completata la verifica si ripete.

**Esercitazione pratica**
Laboratorio → scegli esercizio → leggi il compito → scrivi il prompt (e incolla il risultato ottenuto dall'AI esterna) → valutazione (regole o AI interna se configurata) → punteggi per criterio + suggerimenti → archivio.

**Ricerca risorse**
Ricerca risorse → filtri → apri risorsa (link originale in nuova scheda) / aggiungi ai preferiti. In background lo scheduler aggiorna l'indice dalle fonti e verifica i link.

**Amministratore**
Admin → Fonti (aggiungi/abilita/esegui ora) → Job e log → Catalogo (modifica scheda, segna dato come verificato con fonte e data) → Provider AI (chiave, modello, budget) → Proposte di modifica (approva/respingi con confronto versioni).

## 6. Integrazioni necessarie

| Integrazione | Uso | Autenticazione | Note su termini d'uso |
|---|---|---|---|
| GitHub REST API (`/search/repositories`) | Repository didattici, raccolte di prompt, esempi | Facoltativa (token aumenta il limite da 10 a 30 ricerche/min) | API pubblica documentata |
| arXiv API (`export.arxiv.org/api/query`) | Pubblicazioni scientifiche | Nessuna | Max 1 richiesta ogni 3 s, rispettato dal connettore |
| Hacker News Search (Algolia) | Discussioni e articoli della community | Nessuna | API pubblica |
| YouTube Data API v3 | Videolezioni | Chiave API Google | Quota 10.000 unità/giorno; una ricerca = 100 unità |
| Feed RSS/Atom | Blog ufficiali (OpenAI, Google, Hugging Face, ecc.) e newsletter | Nessuna | Feed pubblicati dagli editori per la distribuzione |
| Reddit API | Community | OAuth app registrata | Da attivare in fase 2: richiede accettazione dei termini API di Reddit da parte del titolare |
| Anthropic API (SDK ufficiale) | AI interna | Chiave API | Costi a token |
| OpenAI API | AI interna | Chiave API | Costi a token |
| Google Gemini API | AI interna | Chiave API | Costi a token |
| Web Push (VAPID) | Notifiche | Chiavi VAPID generate automaticamente | Standard W3C |
| SMTP | Email | Credenziali SMTP | Qualsiasi provider (es. servizio transazionale) |

## 7. Stima di complessità e costi operativi

### 7.1 Complessità (giornate/persona indicative)

| Fase | Contenuto | Complessità | Stima |
|---|---|---|---|
| 1 – MVP | Utenti, catalogo, percorsi, calendario, verifiche, risorse, notifiche, dashboard, admin | Media | 35–45 gg |
| 2 – Intelligenza | Raccomandazione, confronto avanzato, laboratorio prompt completo, generazione e valutazione con AI | Alta | 30–40 gg |
| 3 – Aggiornamento continuo | Monitoraggio, report, revisione corsi con approvazione | Alta | 25–35 gg |
| 4 – Evoluzione | Certificazioni, strumenti docenti, nuovi provider | Media | 20–30 gg |

Il punto più delicato non è il codice ma la **cura dei contenuti**: ogni scheda e lezione richiede verifica umana periodica. Va previsto un responsabile didattico (anche part-time).

### 7.2 Costi operativi mensili stimati

| Voce | Piccolo (≤ 500 utenti) | Medio (≤ 10.000 utenti) |
|---|---|---|
| Hosting (VPS / container) | 5–20 € | 40–150 € (passaggio a PostgreSQL gestito) |
| Dominio + TLS | ~1 € | ~1 € |
| Email transazionali | 0 € (fascia gratuita) | 10–30 € |
| API di ricerca (GitHub, arXiv, HN, RSS) | 0 € | 0 € |
| YouTube Data API | 0 € entro quota | 0 € entro quota (richiesta aumento se necessario) |
| AI interne | variabile: dipende dall'uso | variabile |

Stima del costo AI interno (con modelli economici per compiti semplici e modelli di fascia alta solo per la valutazione degli esercizi): una valutazione di esercizio usa circa 2–4 mila token in ingresso e 1 mila in uscita. Il costo per chiamata è registrato in `ai_usage` con i prezzi configurati dall'amministratore per ogni provider, così la spesa reale è sempre visibile. È previsto un **limite giornaliero di chiamate per utente** configurabile.

---

## 8. Stato dell'implementazione

Vedi `README.md`, sezione "Cosa è implementato", per l'elenco aggiornato di ciò che funziona,
di ciò che è parziale e di ciò che resta per le fasi successive.

Nota sulle fonti: Papers with Code, citato nei requisiti, è stato chiuso nel 2025 e oggi
reindirizza alle pagine "Papers" di Hugging Face; il monitoraggio delle pubblicazioni è quindi
coperto da arXiv e dal blog di Hugging Face. Anthropic non pubblica un feed RSS ufficiale delle
novità: per Claude le novità arrivano da arXiv, Hacker News e dalle fonti aggiungibili dall'amministratore.
