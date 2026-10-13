-- Brigade 2026 schema (PostgreSQL / Neon). Safe to run more than once.

CREATE TABLE IF NOT EXISTS troops (
  troop_id       SERIAL PRIMARY KEY,
  troop_name     VARCHAR(100) NOT NULL UNIQUE,
  merit_points   INTEGER NOT NULL DEFAULT 0,
  demerit_points INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  category_id   SERIAL PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS scores (
  score_id    SERIAL PRIMARY KEY,
  troop_id    INTEGER NOT NULL REFERENCES troops(troop_id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  score       INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (troop_id, category_id)
);

-- New: every point change is logged so the organizers can see a feed and undo mistakes.
CREATE TABLE IF NOT EXISTS point_log (
  log_id      SERIAL PRIMARY KEY,
  troop_id    INTEGER NOT NULL REFERENCES troops(troop_id) ON DELETE CASCADE,
  kind        VARCHAR(10) NOT NULL CHECK (kind IN ('merit', 'demerit', 'game')),
  category_id INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
  points      INTEGER NOT NULL,
  note        VARCHAR(120),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS point_log_created_idx ON point_log (created_at DESC);

-- Judging: judges score troops on criteria; the admin publishes the result into the leaderboard.
CREATE TABLE IF NOT EXISTS judges (
  judge_id   SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  code_hash  CHAR(64) NOT NULL UNIQUE,   -- the login code is never stored, only a keyed hash
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A judged event (for example Mr. Brigade). It owns one game on the leaderboard.
CREATE TABLE IF NOT EXISTS events (
  event_id    SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  category_id INTEGER NOT NULL UNIQUE REFERENCES categories(category_id) ON DELETE CASCADE,
  status      VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'published')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_criteria (
  criterion_id SERIAL PRIMARY KEY,
  event_id     INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  max_points   INTEGER NOT NULL CHECK (max_points > 0),
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS event_judges (
  event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  judge_id INTEGER NOT NULL REFERENCES judges(judge_id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, judge_id)
);

CREATE TABLE IF NOT EXISTS judge_scores (
  event_id     INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  judge_id     INTEGER NOT NULL REFERENCES judges(judge_id) ON DELETE CASCADE,
  troop_id     INTEGER NOT NULL REFERENCES troops(troop_id) ON DELETE CASCADE,
  criterion_id INTEGER NOT NULL REFERENCES event_criteria(criterion_id) ON DELETE CASCADE,
  score        NUMERIC(6, 2) NOT NULL CHECK (score >= 0),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (judge_id, troop_id, criterion_id)
);

-- A judge "submits" when they are done; only submitted scores count.
CREATE TABLE IF NOT EXISTS judge_submissions (
  event_id     INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  judge_id     INTEGER NOT NULL REFERENCES judges(judge_id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, judge_id)
);

-- Merit and demerit guide. Organizers edit it on the Games & guide page. Seeded only while the table is empty.
CREATE TABLE IF NOT EXISTS rules (
  rule_id    SERIAL PRIMARY KEY,
  kind       VARCHAR(10) NOT NULL CHECK (kind IN ('merit', 'demerit')),
  label      VARCHAR(80) NOT NULL,
  points     INTEGER NOT NULL CHECK (points > 0 AND points <= 1000),
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO rules (kind, label, points, sort_order)
SELECT v.kind, v.label, v.points, v.sort_order
FROM (VALUES
  ('merit', 'Punctuality', 10, 1), ('merit', 'Teamwork', 10, 2), ('merit', 'Cleanest place', 50, 3),
  ('merit', 'Volunteerism', 15, 4), ('merit', 'Good sports', 15, 5), ('merit', 'Generosity', 50, 6),
  ('demerit', 'Late / incompleteness', 15, 1), ('demerit', 'Littering / untidiness', 15, 2), ('demerit', 'Disrespecting', 50, 3),
  ('demerit', 'Violating camp rules', 50, 4), ('demerit', 'Arguing / causing disturbance', 20, 5), ('demerit', 'Tampering with camp materials', 50, 6)
) AS v(kind, label, points, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM rules);

-- Seed data: the 6 continental troops and 7 scoreboard games from the camp score sheet (points start at 0)
INSERT INTO categories (category_name) VALUES
  ('Whistle Game'), ('Amazing Race'), ('Trashion Show'),
  ('Volleyball'), ('Yell'), ('Flag Raising'), ('Games')
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO troops (troop_name) VALUES
  ('Africa'), ('Asia'), ('Australia'), ('Europe'), ('North America'), ('South America')
ON CONFLICT (troop_name) DO NOTHING;

INSERT INTO scores (troop_id, category_id)
SELECT t.troop_id, c.category_id FROM troops t CROSS JOIN categories c
ON CONFLICT (troop_id, category_id) DO NOTHING;
