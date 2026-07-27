-- Follow-up to 0001_init.sql: make party rooms deletable, and add a cleanup
-- path for finished/abandoned ones.
--
-- 0001 created cluedown_guesses.player_id and cluedown_rounds.winner_player_id
-- with no `on delete` action — the SQL default, NO ACTION — so both block
-- deletes of the cluedown_players rows they reference:
--
--   delete from cluedown_games where room_code = 'XXXX';
--   ERROR: 23503: update or delete on table "cluedown_players" violates foreign
--   key constraint "cluedown_guesses_player_id_fkey" on table "cluedown_guesses"
--
-- Deleting a game cascades to both players and rounds, and rounds cascade on to
-- guesses — so the guesses *would* be gone by the end of the statement. But the
-- NO ACTION check queued by the player delete is processed before the round
-- cascade that clears those guesses, so the statement aborts. Net effect: once
-- a room has a single guess it can never be deleted, and finished/abandoned
-- rooms accumulate forever. The only workaround was deleting from
-- cluedown_guesses by hand first.
--
-- cluedown_rounds.winner_player_id has the same missing action. It happens to
-- survive the game delete (the round cascade is processed before its check),
-- but it does block deleting an individual player who won a round — e.g.
-- removing someone who left mid-game. It is nullable, and losing one round's
-- winner is not worth deleting the round, so it becomes ON DELETE SET NULL
-- rather than CASCADE. Relying on trigger-processing order for correctness is
-- fragile besides; fixing it makes the outcome order-independent.
--
-- SHARED PROJECT: this Supabase project is shared with other apps, which own
-- the unprefixed `games`/`players`/`questions` tables. Every statement below
-- names a public.cluedown_* table explicitly, and the constraint lookup further
-- requires the foreign key to reference public.cluedown_players — so no
-- constraint outside Cluedown's own tables can be matched, let alone dropped.
--
-- Idempotent: safe to re-run.

-- 1. Drop the two constraints by (table, column, referenced table) rather than
--    by name, so this still works if they were created with non-default names.
do $$
declare
  spec record;
  con  text;
begin
  for spec in
    select * from (values
      ('cluedown_guesses', 'player_id'),
      ('cluedown_rounds',  'winner_player_id')
    ) as t(tbl, col)
  loop
    for con in
      select c.conname
      from pg_constraint c
      where c.contype  = 'f'
        and c.conrelid  = format('public.%I', spec.tbl)::regclass
        and c.confrelid = 'public.cluedown_players'::regclass
        and c.conkey = array[
              (select a.attnum from pg_attribute a
               where a.attrelid = c.conrelid and a.attname = spec.col)
            ]::smallint[]
    loop
      execute format('alter table public.%I drop constraint %I', spec.tbl, con);
    end loop;
  end loop;
end $$;

-- 2. Recreate them with the right referential actions.

-- A guess belongs to the player who made it: remove the player, remove their
-- guesses. This is what unblocks `delete from cluedown_games`.
alter table public.cluedown_guesses
  add constraint cluedown_guesses_player_id_fkey
  foreign key (player_id) references public.cluedown_players(id)
  on delete cascade;

-- A round outlives its winner. Deleting the player who won it clears the
-- winner (resolved-with-no-winner is already a valid state — it is what
-- happens when the last clue runs out), it does not delete the round.
alter table public.cluedown_rounds
  add constraint cluedown_rounds_winner_player_id_fkey
  foreign key (winner_player_id) references public.cluedown_players(id)
  on delete set null;

-- 3. Index the referencing columns. Postgres has no index on either side of
--    these FKs, so every player delete would seq-scan cluedown_guesses and
--    cluedown_rounds to enforce the new actions.
create index if not exists cluedown_guesses_player_idx
  on public.cluedown_guesses (player_id);
create index if not exists cluedown_rounds_winner_idx
  on public.cluedown_rounds (winner_player_id);

-- 4. Cleanup path for rooms nobody is coming back to. With the cascades above
--    correct, deleting the cluedown_games row is enough: it reaches players,
--    rounds, round_questions and guesses on its own.
--
--    Two windows, because they mean different things. A finished game is done
--    but its results screen may still be open, so it gets a short grace period.
--    A lobby/active game that is hours old was abandoned mid-play and gets a
--    longer one. Both are measured from created_at — party games run for
--    minutes, so age is a good enough proxy for "nobody is in here".
create index if not exists cluedown_games_created_idx
  on public.cluedown_games (created_at);

-- Which rooms count as stale. Kept as its own function so the "what would be
-- removed" preview and the delete below share one definition and cannot drift.
create or replace function public.cluedown_stale_games(
  finished_grace  interval default interval '2 hours',
  abandoned_after interval default interval '24 hours'
) returns table (id uuid, room_code text, status text, created_at timestamptz)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select g.id, g.room_code, g.status, g.created_at
  from public.cluedown_games g
  where (g.status = 'finished' and g.created_at < now() - finished_grace)
     or  g.created_at < now() - abandoned_after
  order by g.created_at;
$$;

create or replace function public.cluedown_cleanup_stale_games(
  finished_grace  interval default interval '2 hours',
  abandoned_after interval default interval '24 hours'
) returns integer
language sql
security invoker
set search_path = public, pg_temp
as $$
  with removed as (
    delete from public.cluedown_games g
    where g.id in (
      select s.id from public.cluedown_stale_games(finished_grace, abandoned_after) s
    )
    returning 1
  )
  select count(*)::int from removed;
$$;

comment on function public.cluedown_stale_games(interval, interval) is
  'Cluedown party rooms old enough to sweep up. Preview for '
  'cluedown_cleanup_stale_games(), which deletes exactly this set.';

comment on function public.cluedown_cleanup_stale_games(interval, interval) is
  'Delete finished/abandoned Cluedown party rooms and everything under them. '
  'Returns the number of games removed. Service role only (RLS grants anon no '
  'delete, so an invoker without bypassrls would silently remove nothing).';

-- Supabase grants EXECUTE on new public-schema functions to anon/authenticated
-- by default. One of these deletes rooms, so keep both to the service role.
-- (RLS already blocks anon — security-invoker means the caller's policies
-- apply and anon has select-only — but do not rely on that alone.)
do $$
declare
  fn text;
  r  text;
begin
  foreach fn in array array[
    'public.cluedown_stale_games(interval, interval)',
    'public.cluedown_cleanup_stale_games(interval, interval)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on function %s from %I', fn, r);
      end if;
    end loop;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end $$;

-- To run it on a schedule, either call it from a cron'd `pnpm cleanup-rooms`
-- (see pipeline/cleanup-party-rooms.ts), or — only if the project's other
-- owners are on board, since it is a project-wide extension — enable pg_cron
-- in the Supabase dashboard and schedule it:
--
--   select cron.schedule('cluedown-room-cleanup', '0 * * * *',
--                        $cron$ select public.cluedown_cleanup_stale_games() $cron$);
