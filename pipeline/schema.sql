-- Lexil dictionary pack schema. Language-agnostic — every pack uses this exact shape.
-- Per-pack identifying info (language codes, source URL, license) lives in pack_meta.

CREATE TABLE entries (
    id INTEGER PRIMARY KEY,
    headword TEXT NOT NULL,
    headword_normalized TEXT NOT NULL,
    pos TEXT,
    gender TEXT,
    ipa TEXT,
    frequency INTEGER
);
CREATE INDEX idx_entries_normalized ON entries(headword_normalized);

CREATE TABLE senses (
    id INTEGER PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    sense_number INTEGER NOT NULL,
    definition TEXT NOT NULL,
    translation_en TEXT,
    register TEXT,
    domain TEXT
);
CREATE INDEX idx_senses_entry ON senses(entry_id);

CREATE TABLE examples (
    id INTEGER PRIMARY KEY,
    sense_id INTEGER NOT NULL REFERENCES senses(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    translation TEXT
);

CREATE TABLE inflections (
    id INTEGER PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    form TEXT NOT NULL,
    form_normalized TEXT NOT NULL,
    tags TEXT NOT NULL
);
CREATE INDEX idx_inflections_form ON inflections(form_normalized);

CREATE VIRTUAL TABLE entries_fts USING fts5(
    headword, headword_normalized,
    content=entries, content_rowid=id,
    tokenize='unicode61 remove_diacritics 2'
);

-- Reverse-lookup index. Porter stemming so "house" matches "houses" and
-- "running" matches "to run". unicode61 underneath for tokenization.
CREATE VIRTUAL TABLE senses_fts USING fts5(
    definition,
    content=senses, content_rowid=id,
    tokenize='porter unicode61'
);

CREATE TABLE pack_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
