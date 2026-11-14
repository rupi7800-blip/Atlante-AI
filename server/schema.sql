-- Atlante AI — schema del database (SQLite; SQL compatibile con PostgreSQL salvo AUTOINCREMENT/datetime)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','teacher','admin')),
  level TEXT NOT NULL DEFAULT 'principiante',
  timezone TEXT NOT NULL DEFAULT 'Europe/Rome',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notify_days TEXT NOT NULL DEFAULT '[1,2,3,4,5]',      -- 0=domenica … 6=sabato
  notify_times TEXT NOT NULL DEFAULT '["18:00"]',
  max_per_day INTEGER NOT NULL DEFAULT 3,
  lead_minutes INTEGER NOT NULL DEFAULT 10,             -- anticipo del promemoria di sessione
  channels TEXT NOT NULL DEFAULT '["inapp"]',           -- inapp | push | email
  reminder_types TEXT NOT NULL DEFAULT '["sessione","verifica","esercizio","ripasso","sospeso","novita"]',
  paused_until TEXT,
  topics TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== Catalogo AI =====
CREATE TABLE IF NOT EXISTS ai_tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  developer TEXT NOT NULL,
  category TEXT NOT NULL,                 -- assistente, ricerca, codice, immagini, video, audio, studio
  website TEXT NOT NULL,
  docs_url TEXT,
  pricing_url TEXT,
  description TEXT NOT NULL,
  features TEXT NOT NULL DEFAULT '[]',
  use_cases TEXT NOT NULL DEFAULT '[]',
  strengths TEXT NOT NULL DEFAULT '[]',
  limitations TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'attivo',
  last_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dati variabili (versioni, piani, prezzi…) ciascuno con fonte e stato di verifica
CREATE TABLE IF NOT EXISTS ai_tool_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id INTEGER NOT NULL REFERENCES ai_tools(id) ON DELETE CASCADE,
  field TEXT NOT NULL,                    -- versioni | piano_gratuito | piani_pagamento | prezzo | altro
  value TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'da_verificare' CHECK (status IN ('verificato','da_verificare','obsoleto')),
  verified_at TEXT,
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_tools (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id INTEGER NOT NULL REFERENCES ai_tools(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, tool_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                     -- resource | tool | lesson
  item_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, item_id)
);

-- ===== Didattica =====
CREATE TABLE IF NOT EXISTS topics (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  level TEXT NOT NULL,                    -- principiante | intermedio | avanzato | professionale
  topic_slug TEXT NOT NULL REFERENCES topics(slug),
  tool_categories TEXT NOT NULL DEFAULT '[]', -- categorie di AI a cui si applica ([] = tutte)
  tool_id INTEGER REFERENCES ai_tools(id) ON DELETE CASCADE, -- NULL = modulo trasversale
  order_index INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'redazione',  -- redazione | ai_generato | docente
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'teoria',     -- teoria | pratica | rinforzo
  est_minutes INTEGER NOT NULL DEFAULT 15,
  order_index INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'redazione',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'scelta_multipla', -- scelta_multipla | aperta
  prompt TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  answer_index INTEGER,
  explanation TEXT NOT NULL DEFAULT '',
  skill TEXT,                              -- competenza verificata
  rubric TEXT                              -- per le aperte: parole/concetti attesi (json)
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'prompt',      -- prompt | pratico
  level TEXT NOT NULL DEFAULT 'principiante',
  tool_categories TEXT NOT NULL DEFAULT '[]',
  rubric TEXT NOT NULL DEFAULT '[]',        -- [{criterio, descrizione, peso}]
  origin TEXT NOT NULL DEFAULT 'redazione'
);

-- ===== Percorsi =====
CREATE TABLE IF NOT EXISTS study_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  level TEXT NOT NULL,
  goals TEXT NOT NULL DEFAULT '',
  topics TEXT NOT NULL DEFAULT '[]',
  tools TEXT NOT NULL DEFAULT '[]',        -- slug delle AI
  comparative INTEGER NOT NULL DEFAULT 0,
  schedule TEXT NOT NULL,                  -- {days:[..], times:[..], sessionsPerDay, sessionMinutes, startDate}
  status TEXT NOT NULL DEFAULT 'attivo',   -- attivo | sospeso | completato
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity_at TEXT
);

CREATE TABLE IF NOT EXISTS path_modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path_id INTEGER NOT NULL REFERENCES study_paths(id) ON DELETE CASCADE,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'bloccato', -- bloccato | attivo | rinforzo | completato
  best_score REAL,
  attempts INTEGER NOT NULL DEFAULT 0,
  UNIQUE (path_id, module_id)
);

CREATE TABLE IF NOT EXISTS path_lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path_id INTEGER NOT NULL REFERENCES study_paths(id) ON DELETE CASCADE,
  path_module_id INTEGER NOT NULL REFERENCES path_modules(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'da_fare',  -- da_fare | completata
  added_reason TEXT,                       -- es. 'rinforzo dopo verifica'
  completed_at TEXT,
  minutes_spent INTEGER NOT NULL DEFAULT 0,
  UNIQUE (path_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path_id INTEGER NOT NULL REFERENCES study_paths(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,                 -- ISO UTC
  duration_min INTEGER NOT NULL,
  lesson_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pianificata', -- pianificata | svolta | saltata
  notified_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON study_sessions(starts_at, status);

-- ===== Valutazione =====
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_module_id INTEGER REFERENCES path_modules(id) ON DELETE SET NULL,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  passed INTEGER NOT NULL,
  answers TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercise_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  result_text TEXT NOT NULL DEFAULT '',
  evaluation TEXT NOT NULL,
  score REAL NOT NULL,
  evaluator TEXT NOT NULL,                 -- regole | ai:<provider>/<modello>
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_skill_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,                     -- = topic slug
  score REAL NOT NULL,                     -- 0..100
  source TEXT NOT NULL,                    -- quiz | esercizio
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== Risorse e fonti =====
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,                      -- github | arxiv | hackernews | youtube | rss
  config TEXT NOT NULL DEFAULT '{}',       -- {url} per rss, {queries:[..]} per api
  trust_tier TEXT NOT NULL DEFAULT 'comunita', -- ufficiale | istituzionale | specializzata | comunita
  purpose TEXT NOT NULL DEFAULT 'risorse', -- risorse | novita | entrambi
  tool_slugs TEXT NOT NULL DEFAULT '[]',
  language TEXT NOT NULL DEFAULT 'en',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  last_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  url_normalized TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL,
  content_type TEXT NOT NULL,              -- documentazione | repository | articolo | paper | video | discussione | corso | guida
  published_at TEXT,
  level TEXT NOT NULL DEFAULT 'non_classificato',
  topic TEXT,
  tool_slugs TEXT NOT NULL DEFAULT '[]',
  language TEXT NOT NULL DEFAULT 'en',
  is_free INTEGER,                         -- 1 gratuito, 0 a pagamento, NULL sconosciuto
  free_basis TEXT,                         -- motivo della classificazione
  quality_score REAL NOT NULL DEFAULT 0,
  quality_breakdown TEXT NOT NULL DEFAULT '{}',
  link_status TEXT NOT NULL DEFAULT 'non_verificato', -- ok | rotto | non_verificato
  last_checked_at TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resources_pub ON resources(published_at);

CREATE TABLE IF NOT EXISTS news_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL,
  url_normalized TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  tool_slugs TEXT NOT NULL DEFAULT '[]',
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_reports (
  date TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS course_change_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_kind TEXT NOT NULL,               -- module | lesson | tool_fact
  target_id INTEGER NOT NULL,
  previous_version TEXT NOT NULL,
  proposed_version TEXT NOT NULL,
  reason TEXT NOT NULL,
  source_url TEXT,
  proposed_by TEXT NOT NULL,               -- utente o 'sistema'
  status TEXT NOT NULL DEFAULT 'proposta', -- proposta | approvata | respinta
  reviewer_id INTEGER REFERENCES users(id),
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== Sistema =====
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT,
  dedupe_key TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS ai_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,                      -- anthropic | openai | gemini
  model TEXT NOT NULL,
  api_key_enc TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  purposes TEXT NOT NULL DEFAULT '["valutazione","generazione"]',
  input_price_per_mtok REAL NOT NULL DEFAULT 0,
  output_price_per_mtok REAL NOT NULL DEFAULT 0,
  daily_user_limit INTEGER NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER REFERENCES ai_providers(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_estimate REAL NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'in_corso',  -- in_corso | ok | errore
  detail TEXT
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  minutes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
