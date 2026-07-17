-- Cluedown schema (handoff spec §4, scoring 10/8/6/4 with -1 per wrong guess
-- computed in app logic).
--
-- All tables are prefixed `cluedown_` because this project may be SHARED with
-- other apps — the prefix namespaces Cluedown's tables inside the public
-- schema so they can't collide with another app's `games`, `players`, etc.,
-- while keeping the default PostgREST/Realtime setup working with no extra
-- "exposed schemas" configuration.

-- Question bank (populated by the offline pipeline)
create table if not exists cluedown_questions (
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

create table if not exists cluedown_clues (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references cluedown_questions(id) on delete cascade,
  position      int  not null,                   -- 1..n, 1 = hardest
  text          text not null,
  points_value  int  not null,                   -- 10/8/6/4(/2) by position
  unique (question_id, position)
);

create table if not exists cluedown_decoys (
  id                 uuid primary key default gen_random_uuid(),
  question_id        uuid not null references cluedown_questions(id) on delete cascade,
  text               text not null,
  eliminated_by_clue int
);

-- Daily mode
create table if not exists cluedown_daily_questions (
  play_date   date primary key,
  question_id uuid not null references cluedown_questions(id)
);

-- Party mode
create table if not exists cluedown_games (
  id             uuid primary key default gen_random_uuid(),
  room_code      text unique not null,            -- 4 chars, no I/O/1/0
  host_player_id uuid,
  status         text not null default 'lobby'
                 check (status in ('lobby','active','finished')),
  settings       jsonb not null default '{}',
  current_round  int  not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists cluedown_players (
  id        uuid primary key default gen_random_uuid(),
  game_id   uuid not null references cluedown_games(id) on delete cascade,
  name      text not null,
  score     int  not null default 0,
  is_host   boolean not null default false,
  joined_at timestamptz not null default now()
);

-- Rounds carry ONLY non-secret coordination data so they can stay
-- anon-readable (party clients need realtime clue-advance signals). The
-- question behind a round — and therefore the answer — is never referenced
-- here; that mapping lives in the server-only cluedown_round_questions table.
create table if not exists cluedown_rounds (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references cluedown_games(id) on delete cascade,
  round_number     int  not null,
  current_clue     int  not null default 1,       -- 1-based; the clue now showing
  clue_count       int  not null default 4,       -- total clues, so clients can page
  clue_started_at  timestamptz,                   -- server time, for synced timers
  state            text not null default 'revealing'
                   check (state in ('revealing','resolved')),
  winner_player_id uuid references cluedown_players(id),
  unique (game_id, round_number)
);

-- Which bank question backs each round. Server-only (RLS on, no anon policy)
-- so clients can never read the question id and pre-map it to the answer via
-- the public bank; the server sends only clue texts up to the revealed index.
create table if not exists cluedown_round_questions (
  round_id      uuid primary key references cluedown_rounds(id) on delete cascade,
  question_ref  text not null                     -- local bank slug or DB uuid
);

create table if not exists cluedown_guesses (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid not null references cluedown_rounds(id) on delete cascade,
  player_id     uuid not null references cluedown_players(id),
  clue_position int  not null,
  answer_text   text not null,
  is_correct    boolean not null,
  created_at    timestamptz not null default now()
);

-- Only one player can win a round: enforce first-correct-wins at the DB
-- level so two simultaneous correct guesses can't both resolve it.
create unique index if not exists cluedown_one_correct_guess_per_round
  on cluedown_guesses (round_id) where is_correct;

create index if not exists cluedown_guesses_round_idx on cluedown_guesses (round_id);
create index if not exists cluedown_players_game_idx on cluedown_players (game_id);
create index if not exists cluedown_rounds_game_idx on cluedown_rounds (game_id);
create index if not exists cluedown_clues_question_idx on cluedown_clues (question_id);
create index if not exists cluedown_decoys_question_idx on cluedown_decoys (question_id);
create index if not exists cluedown_questions_status_idx on cluedown_questions (status);

-- Realtime: party clients subscribe per game_id. Added one table at a time
-- inside a guard so re-running the migration doesn't error on tables already
-- in the publication (there is no `add table if not exists`).
do $$
declare
  t text;
begin
  foreach t in array array[
    'cluedown_games', 'cluedown_players', 'cluedown_rounds', 'cluedown_guesses'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- RLS: the app reads via server (service role). Lock tables down by
-- default; anon can read only what party clients need via realtime.
alter table cluedown_questions         enable row level security;
alter table cluedown_clues             enable row level security;
alter table cluedown_decoys            enable row level security;
alter table cluedown_daily_questions   enable row level security;
alter table cluedown_games             enable row level security;
alter table cluedown_players           enable row level security;
alter table cluedown_rounds            enable row level security;
alter table cluedown_guesses           enable row level security;
alter table cluedown_round_questions   enable row level security;

drop policy if exists "anon read games"   on cluedown_games;
drop policy if exists "anon read players" on cluedown_players;
drop policy if exists "anon read rounds"  on cluedown_rounds;
drop policy if exists "anon read guesses" on cluedown_guesses;
create policy "anon read games"   on cluedown_games   for select using (true);
create policy "anon read players" on cluedown_players for select using (true);
create policy "anon read rounds"  on cluedown_rounds  for select using (true);
create policy "anon read guesses" on cluedown_guesses for select using (true);
-- questions/clues/decoys/daily_questions/round_questions: no anon policies —
-- answers (and which question backs a round) never reach the client; the
-- server (service role) bypasses RLS.
