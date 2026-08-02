-- Rename every `cluedown_*` object to `triveal_*` — the game is now called
-- Triveal. The prefix itself stays load-bearing: this Supabase project is
-- SHARED with other apps that own the unprefixed `games`/`players`/`questions`
-- tables, so the tables still need a namespace, it just spells the new name.
--
-- SHARED PROJECT SAFETY: every loop below matches on the literal `cluedown_`
-- prefix inside schema `public`. The other apps' tables are unprefixed, so
-- nothing outside this game's own objects can be matched, let alone renamed.
--
-- `alter table ... rename` preserves table OIDs, so RLS policies, grants, row
-- data and — importantly — `supabase_realtime` publication membership all
-- survive untouched. Party clients keep getting realtime, they just subscribe
-- under the new table names (see components/usePartyState.ts).
--
-- Idempotent: safe to re-run. Deploy this together with the code change; the
-- app references the new names and will 404 against the old ones.

-- 1. Tables. Guarded both ways so a partial run can be resumed.
do $$
declare
  t text;
begin
  foreach t in array array[
    'questions', 'clues', 'decoys', 'daily_questions',
    'games', 'players', 'rounds', 'round_questions', 'guesses'
  ] loop
    if to_regclass(format('public.%I', 'cluedown_' || t)) is not null
       and to_regclass(format('public.%I', 'triveal_' || t)) is null then
      execute format('alter table public.%I rename to %I',
                     'cluedown_' || t, 'triveal_' || t);
    end if;
  end loop;
end $$;

-- 2. Constraints (primary keys, foreign keys, uniques). Postgres does NOT
--    rename these when their table is renamed, so they keep the auto-generated
--    `cluedown_*_pkey` / `cluedown_*_fkey` names until fixed by hand.
--
--    Constraints come before indexes: renaming a constraint also renames its
--    backing index, so doing indexes first would leave the constraint rename
--    trying to claim a name its own index already holds.
do $$
declare
  r record;
begin
  for r in
    select con.conname, rel.relname as tbl
    from pg_constraint con
    join pg_class     rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and con.conname like 'cluedown\_%'
      and rel.relname like 'triveal\_%'   -- only tables step 1 just renamed
  loop
    execute format('alter table public.%I rename constraint %I to %I',
                   r.tbl, r.conname, 'triveal_' || substring(r.conname from 10));
  end loop;
end $$;

-- 3. Remaining standalone indexes (the `*_idx` ones and the partial unique
--    index cluedown_one_correct_guess_per_round, which is not a constraint).
do $$
declare
  r record;
begin
  for r in
    select cls.relname
    from pg_class     cls
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relkind = 'i'
      and cls.relname like 'cluedown\_%'
  loop
    if to_regclass(format('public.%I', 'triveal_' || substring(r.relname from 10))) is null then
      execute format('alter index public.%I rename to %I',
                     r.relname, 'triveal_' || substring(r.relname from 10));
    end if;
  end loop;
end $$;

-- 4. Functions. `alter function ... rename` would work, but the bodies also
--    reference the old table names, so recreate them outright and drop the
--    originals. Definitions are otherwise identical to 0002.
create or replace function public.triveal_stale_games(
  finished_grace  interval default interval '2 hours',
  abandoned_after interval default interval '24 hours'
) returns table (id uuid, room_code text, status text, created_at timestamptz)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select g.id, g.room_code, g.status, g.created_at
  from public.triveal_games g
  where (g.status = 'finished' and g.created_at < now() - finished_grace)
     or  g.created_at < now() - abandoned_after
  order by g.created_at;
$$;

create or replace function public.triveal_cleanup_stale_games(
  finished_grace  interval default interval '2 hours',
  abandoned_after interval default interval '24 hours'
) returns integer
language sql
security invoker
set search_path = public, pg_temp
as $$
  with removed as (
    delete from public.triveal_games g
    where g.id in (
      select s.id from public.triveal_stale_games(finished_grace, abandoned_after) s
    )
    returning 1
  )
  select count(*)::int from removed;
$$;

comment on function public.triveal_stale_games(interval, interval) is
  'Triveal party rooms old enough to sweep up. Preview for '
  'triveal_cleanup_stale_games(), which deletes exactly this set.';

comment on function public.triveal_cleanup_stale_games(interval, interval) is
  'Delete finished/abandoned Triveal party rooms and everything under them. '
  'Returns the number of games removed. Service role only (RLS grants anon no '
  'delete, so an invoker without bypassrls would silently remove nothing).';

-- Same lockdown as 0002: Supabase grants EXECUTE on new public functions to
-- anon/authenticated by default, and one of these deletes rooms.
do $$
declare
  fn text;
  r  text;
begin
  foreach fn in array array[
    'public.triveal_stale_games(interval, interval)',
    'public.triveal_cleanup_stale_games(interval, interval)'
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

drop function if exists public.cluedown_cleanup_stale_games(interval, interval);
drop function if exists public.cluedown_stale_games(interval, interval);

-- If you scheduled the cleanup with pg_cron under the old job name, re-point it:
--
--   select cron.unschedule('cluedown-room-cleanup');
--   select cron.schedule('triveal-room-cleanup', '0 * * * *',
--                        $cron$ select public.triveal_cleanup_stale_games() $cron$);
