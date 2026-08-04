-- Question ratings: how players felt about a question once the round ended.
-- Three faces (bad/okay/good) plus an optional note, reviewed later at
-- /ratings to work out which questions earn their place in the bank.
--
-- Idempotent, like every migration here — safe to re-run.

create table if not exists triveal_question_ratings (
  id           uuid primary key default gen_random_uuid(),
  -- Local bank slug or a triveal_questions uuid, same convention as
  -- triveal_round_questions.question_ref. Deliberately NOT a foreign key: the
  -- app serves the committed bank when Supabase holds no questions, and a
  -- rating of one of those questions must still be recordable.
  question_ref text not null,
  rating       text not null check (rating in ('bad','okay','good')),
  comment      text,
  mode         text not null default 'daily' check (mode in ('daily','practice')),
  -- Whether the rater solved the round. A "bad" from someone who lost reads
  -- differently from one from someone who breezed through it.
  solved       boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists triveal_question_ratings_ref_idx
  on triveal_question_ratings (question_ref);
create index if not exists triveal_question_ratings_created_idx
  on triveal_question_ratings (created_at desc);

-- RLS with no policies at all: only the service role (which bypasses RLS)
-- touches this table. Anon must not read it — the notes are private feedback
-- and the review page they feed shows answers — and must not write it either,
-- since an anon update policy broad enough for the "add a note" step would let
-- anyone rewrite every rating in the table.
alter table triveal_question_ratings enable row level security;
