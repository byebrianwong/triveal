-- Cluedown schema (handoff spec §4, scoring updated to 10/8/6/4 with
-- -1 per wrong guess computed in app logic).

-- Question bank (populated by the offline pipeline)
create table questions (
  id                uuid primary key default gen_random_uuid(),
  answer            text not null,               -- display form
  answer_canonical  text not null,               -- normalized for matching
  answer_aliases    text[] not null default '{}',
  category          text,
  difficulty        text check (difficulty in ('easy','medium','hard')),
  wikipedia_title   text,
  status            text not null default 'draft'
                    check (status in ('draft','verified','rejected')),
  created_at        timestamptz not null default now()
);

create table clues (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references questions(id) on delete cascade,
  position      int  not null,                   -- 1..n, 1 = hardest
  text          text not null,
  points_value  int  not null,                   -- 10/8/6/4(/2) by position
  unique (question_id, position)
);

create table decoys (
  id                 uuid primary key default gen_random_uuid(),
  question_id        uuid not null references questions(id) on delete cascade,
  text               text not null,
  eliminated_by_clue int
);

-- Daily mode
create table daily_questions (
  play_date   date primary key,
  question_id uuid not null references questions(id)
);

-- Party mode
create table games (
  id             uuid primary key default gen_random_uuid(),
  room_code      text unique not null,            -- 4 chars, no I/O/1/0
  host_player_id uuid,
  status         text not null default 'lobby'
                 check (status in ('lobby','active','finished')),
  settings       jsonb not null default '{}',
  current_round  int  not null default 0,
  created_at     timestamptz not null default now()
);

create table players (
  id        uuid primary key default gen_random_uuid(),
  game_id   uuid not null references games(id) on delete cascade,
  name      text not null,
  score     int  not null default 0,
  is_host   boolean not null default false,
  joined_at timestamptz not null default now()
);

create table rounds (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references games(id) on delete cascade,
  question_id      uuid not null references questions(id),
  round_number     int  not null,
  current_clue     int  not null default 1,
  clue_started_at  timestamptz,                   -- server time, for synced timers
  state            text not null default 'revealing'
                   check (state in ('revealing','resolved')),
  winner_player_id uuid references players(id)
);

create table guesses (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid not null references rounds(id) on delete cascade,
  player_id     uuid not null references players(id),
  clue_position int  not null,
  answer_text   text not null,
  is_correct    boolean not null,
  created_at    timestamptz not null default now()
);

-- Only one player can win a round: enforce first-correct-wins at the DB
-- level so two simultaneous correct guesses can't both resolve it.
create unique index one_correct_guess_per_round
  on guesses (round_id) where is_correct;

create index guesses_round_idx on guesses (round_id);
create index players_game_idx on players (game_id);
create index rounds_game_idx on rounds (game_id);
create index clues_question_idx on clues (question_id);
create index decoys_question_idx on decoys (question_id);
create index questions_status_idx on questions (status);

-- Realtime: party clients subscribe per game_id.
alter publication supabase_realtime add table games, players, rounds, guesses;

-- RLS: the app reads via server (service role). Lock tables down by
-- default; anon can read only what party clients need via realtime.
alter table questions enable row level security;
alter table clues enable row level security;
alter table decoys enable row level security;
alter table daily_questions enable row level security;
alter table games enable row level security;
alter table players enable row level security;
alter table rounds enable row level security;
alter table guesses enable row level security;

create policy "anon read games"   on games   for select using (true);
create policy "anon read players" on players for select using (true);
create policy "anon read rounds"  on rounds  for select using (true);
create policy "anon read guesses" on guesses for select using (true);
-- questions/clues/decoys/daily_questions: no anon policies — answers never
-- reach the client; the server (service role) bypasses RLS.
