"use server";

/**
 * Party-mode server actions. Everything that touches the answer or decides a
 * winner happens here, server-side, with the Supabase service-role key. The
 * client only ever receives sanitized state: clue texts up to the revealed
 * index, scores, and the answer only once a round has resolved.
 *
 * Party mode requires Supabase to be configured WITH the service-role key —
 * RLS grants anon only SELECT on the coordination tables, so all writes (and
 * reads of the server-only question mapping) must go through the service role.
 */

import { matchGuess } from "@/lib/game/answerMatch";
import { clueValue } from "@/lib/game/scoring";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  rankStandings,
  DEFAULT_PARTY_ROUNDS,
  type PartyStanding,
} from "@/lib/game/party";
import type { Question } from "@/lib/game/types";
import { getQuestionById, getRandomQuestion } from "@/lib/questions/source";
import { getServerSupabase } from "@/lib/supabase/questions";

const MAX_NAME = 24;
const MAX_GUESS = 120;
const MAX_PLAYERS = 12;

function assertPartyEnabled(): void {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Party mode is unavailable: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
}

function cleanName(raw: string): string {
  const name = String(raw ?? "").trim().slice(0, MAX_NAME);
  if (!name) throw new Error("Please enter a name.");
  return name;
}

// --- DTOs sent to the client -------------------------------------------------

export interface PartyPlayerDto {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

export interface PartyRoundDto {
  roundNumber: number;
  /** 0-based index of the clue currently showing. */
  clueIndex: number;
  clueCount: number;
  /** Clue texts revealed so far (0..clueIndex). Future clues are withheld. */
  revealedClues: string[];
  category: string;
  status: "revealing" | "resolved";
  winner: { playerId: string; name: string } | null;
  /** Answer only once the round has resolved; null while in play. */
  answer: string | null;
  youLockedOut: boolean;
  youWon: boolean;
}

export interface PartyStateDto {
  gameId: string;
  roomCode: string;
  status: "lobby" | "active" | "finished";
  currentRound: number;
  totalRounds: number;
  youAreHost: boolean;
  players: PartyPlayerDto[];
  round: PartyRoundDto | null;
  standings: PartyStanding[];
}

export interface CreateRoomResult {
  gameId: string;
  playerId: string;
  roomCode: string;
}

// --- Internal helpers --------------------------------------------------------

interface GameRow {
  id: string;
  room_code: string;
  host_player_id: string | null;
  status: "lobby" | "active" | "finished";
  settings: { totalRounds?: number } | null;
  current_round: number;
}

interface PlayerRow {
  id: string;
  name: string;
  score: number;
  is_host: boolean;
  joined_at: string;
}

interface RoundRow {
  id: string;
  round_number: number;
  current_clue: number;
  clue_count: number;
  state: "revealing" | "resolved";
  winner_player_id: string | null;
}

async function loadGame(gameId: string): Promise<GameRow> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("cluedown_games")
    .select("id, room_code, host_player_id, status, settings, current_round")
    .eq("id", gameId)
    .maybeSingle();
  if (error || !data) throw new Error("Game not found.");
  return data as GameRow;
}

async function loadPlayers(gameId: string): Promise<PlayerRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("cluedown_players")
    .select("id, name, score, is_host, joined_at")
    .eq("game_id", gameId)
    .order("joined_at", { ascending: true });
  if (error) throw new Error("Could not load players.");
  return (data ?? []) as PlayerRow[];
}

async function loadRound(gameId: string, roundNumber: number): Promise<RoundRow | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("cluedown_rounds")
    .select("id, round_number, current_clue, clue_count, state, winner_player_id")
    .eq("game_id", gameId)
    .eq("round_number", roundNumber)
    .maybeSingle();
  if (error || !data) return null;
  return data as RoundRow;
}

async function questionForRound(roundId: string): Promise<Question> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("cluedown_round_questions")
    .select("question_ref")
    .eq("round_id", roundId)
    .maybeSingle();
  if (error || !data) throw new Error("Round question missing.");
  const question = await getQuestionById(data.question_ref as string);
  if (!question) throw new Error("Round question not found in bank.");
  return question;
}

/** Create a round with a fresh question not yet used in this game. */
async function createRound(gameId: string, roundNumber: number): Promise<void> {
  const sb = getServerSupabase();

  // Exclude questions already used this game so rounds don't repeat.
  const { data: roundRows } = await sb
    .from("cluedown_rounds")
    .select("id")
    .eq("game_id", gameId);
  const roundIds = (roundRows ?? []).map((r) => r.id as string);
  let used: string[] = [];
  if (roundIds.length) {
    const { data: refRows } = await sb
      .from("cluedown_round_questions")
      .select("question_ref")
      .in("round_id", roundIds);
    used = (refRows ?? []).map((r) => r.question_ref as string);
  }

  const question = await getRandomQuestion(used);

  const { data: round, error: roundErr } = await sb
    .from("cluedown_rounds")
    .insert({
      game_id: gameId,
      round_number: roundNumber,
      current_clue: 1,
      clue_count: question.clues.length,
      clue_started_at: new Date().toISOString(),
      state: "revealing",
    })
    .select("id")
    .single();
  if (roundErr || !round) throw new Error("Could not start the round.");

  const { error: linkErr } = await sb
    .from("cluedown_round_questions")
    .insert({ round_id: round.id, question_ref: question.id });
  if (linkErr) {
    await sb.from("cluedown_rounds").delete().eq("id", round.id);
    throw new Error("Could not start the round.");
  }
}

async function playerLockedOut(roundId: string, playerId: string, cluePos: number): Promise<boolean> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("cluedown_guesses")
    .select("id")
    .eq("round_id", roundId)
    .eq("player_id", playerId)
    .eq("clue_position", cluePos)
    .eq("is_correct", false)
    .limit(1);
  return Boolean(data?.length);
}

// --- Public actions ----------------------------------------------------------

export async function createPartyRoom(hostName: string): Promise<CreateRoomResult> {
  assertPartyEnabled();
  const name = cleanName(hostName);
  const sb = getServerSupabase();

  // Find a free room code (unique index guards against races).
  let gameId: string | null = null;
  let roomCode = "";
  for (let attempt = 0; attempt < 12 && !gameId; attempt++) {
    roomCode = generateRoomCode();
    const { data, error } = await sb
      .from("cluedown_games")
      .insert({ room_code: roomCode, status: "lobby", settings: { totalRounds: DEFAULT_PARTY_ROUNDS } })
      .select("id")
      .single();
    if (!error && data) gameId = data.id as string;
    else if (error && error.code !== "23505") throw new Error("Could not create room.");
  }
  if (!gameId) throw new Error("Could not allocate a room code — try again.");

  const { data: player, error: playerErr } = await sb
    .from("cluedown_players")
    .insert({ game_id: gameId, name, is_host: true })
    .select("id")
    .single();
  if (playerErr || !player) throw new Error("Could not create host player.");

  await sb.from("cluedown_games").update({ host_player_id: player.id }).eq("id", gameId);
  return { gameId, playerId: player.id as string, roomCode };
}

export async function joinPartyRoom(
  roomCode: string,
  name: string,
): Promise<{ gameId: string; playerId: string }> {
  assertPartyEnabled();
  const cleanCode = normalizeRoomCode(roomCode);
  if (!isValidRoomCode(cleanCode)) throw new Error("That room code isn't valid.");
  const playerName = cleanName(name);
  const sb = getServerSupabase();

  const { data: game } = await sb
    .from("cluedown_games")
    .select("id, status")
    .eq("room_code", cleanCode)
    .maybeSingle();
  if (!game) throw new Error("No room with that code.");
  if (game.status !== "lobby") throw new Error("That game has already started.");

  const { count } = await sb
    .from("cluedown_players")
    .select("id", { count: "exact", head: true })
    .eq("game_id", game.id);
  if ((count ?? 0) >= MAX_PLAYERS) throw new Error("That room is full.");

  const { data: player, error } = await sb
    .from("cluedown_players")
    .insert({ game_id: game.id, name: playerName })
    .select("id")
    .single();
  if (error || !player) throw new Error("Could not join the room.");
  return { gameId: game.id as string, playerId: player.id as string };
}

export async function startPartyGame(gameId: string, playerId: string): Promise<void> {
  assertPartyEnabled();
  const game = await loadGame(gameId);
  if (game.host_player_id !== playerId) throw new Error("Only the host can start.");
  if (game.status !== "lobby") throw new Error("The game has already started.");

  const sb = getServerSupabase();
  await sb.from("cluedown_games").update({ status: "active", current_round: 1 }).eq("id", gameId);
  await createRound(gameId, 1);
}

export interface PartyGuessResult {
  accepted: boolean;
  correct: boolean;
  wonRound: boolean;
  /** True when the guess was right but another player resolved it first. */
  tooLate: boolean;
}

export async function submitPartyGuess(
  gameId: string,
  playerId: string,
  guess: string,
): Promise<PartyGuessResult> {
  assertPartyEnabled();
  const noop = { accepted: false, correct: false, wonRound: false, tooLate: false };
  const game = await loadGame(gameId);
  if (game.status !== "active") return noop;

  const round = await loadRound(gameId, game.current_round);
  if (!round || round.state !== "revealing") return noop;
  if (await playerLockedOut(round.id, playerId, round.current_clue)) return noop;

  const question = await questionForRound(round.id);
  const match = matchGuess(question, String(guess).slice(0, MAX_GUESS));
  const sb = getServerSupabase();

  const { error: insErr } = await sb.from("cluedown_guesses").insert({
    round_id: round.id,
    player_id: playerId,
    clue_position: round.current_clue,
    answer_text: String(guess).slice(0, MAX_GUESS),
    is_correct: match.correct,
  });

  // Unique partial index (one correct per round) makes first-correct-wins
  // atomic: a second correct insert fails with 23505 -> this player was late.
  if (insErr) {
    if (match.correct && insErr.code === "23505") {
      return { accepted: true, correct: true, wonRound: false, tooLate: true };
    }
    return noop;
  }

  if (!match.correct) {
    return { accepted: true, correct: false, wonRound: false, tooLate: false };
  }

  // This player recorded the first correct guess: resolve + award points.
  const points = clueValue(round.current_clue - 1);
  await sb
    .from("cluedown_rounds")
    .update({ state: "resolved", winner_player_id: playerId })
    .eq("id", round.id);
  const { data: me } = await sb
    .from("cluedown_players")
    .select("score")
    .eq("id", playerId)
    .maybeSingle();
  await sb
    .from("cluedown_players")
    .update({ score: (me?.score ?? 0) + points })
    .eq("id", playerId);

  return { accepted: true, correct: true, wonRound: true, tooLate: false };
}

export async function revealNextPartyClue(gameId: string, playerId: string): Promise<void> {
  assertPartyEnabled();
  const game = await loadGame(gameId);
  if (game.host_player_id !== playerId) throw new Error("Only the host can reveal clues.");
  const round = await loadRound(gameId, game.current_round);
  if (!round || round.state !== "revealing") return;

  const sb = getServerSupabase();
  if (round.current_clue < round.clue_count) {
    await sb
      .from("cluedown_rounds")
      .update({ current_clue: round.current_clue + 1, clue_started_at: new Date().toISOString() })
      .eq("id", round.id);
  } else {
    // Last clue exhausted with no winner: resolve the round.
    await sb.from("cluedown_rounds").update({ state: "resolved" }).eq("id", round.id);
  }
}

export async function startNextPartyRound(gameId: string, playerId: string): Promise<void> {
  assertPartyEnabled();
  const game = await loadGame(gameId);
  if (game.host_player_id !== playerId) throw new Error("Only the host can advance.");
  if (game.status !== "active") return;

  const round = await loadRound(gameId, game.current_round);
  if (!round || round.state !== "resolved") return; // finish the current round first

  const totalRounds = game.settings?.totalRounds ?? DEFAULT_PARTY_ROUNDS;
  const sb = getServerSupabase();
  if (game.current_round >= totalRounds) {
    await sb.from("cluedown_games").update({ status: "finished" }).eq("id", gameId);
    return;
  }
  const next = game.current_round + 1;
  await sb.from("cluedown_games").update({ current_round: next }).eq("id", gameId);
  await createRound(gameId, next);
}

export async function getPartyState(gameId: string, playerId: string): Promise<PartyStateDto> {
  assertPartyEnabled();
  const game = await loadGame(gameId);
  const players = await loadPlayers(gameId);
  const totalRounds = game.settings?.totalRounds ?? DEFAULT_PARTY_ROUNDS;

  const playerDtos: PartyPlayerDto[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    isHost: p.is_host,
  }));
  const standings = rankStandings(
    players.map((p) => ({ id: p.id, name: p.name, score: p.score, joinedAt: p.joined_at })),
  );

  let round: PartyRoundDto | null = null;
  if (game.status !== "lobby") {
    const r = await loadRound(gameId, game.current_round);
    if (r) {
      const question = await questionForRound(r.id);
      const clueTexts = [...question.clues]
        .sort((a, b) => a.position - b.position)
        .map((c) => c.text);
      const winnerPlayer = r.winner_player_id
        ? players.find((p) => p.id === r.winner_player_id) ?? null
        : null;
      round = {
        roundNumber: r.round_number,
        clueIndex: r.current_clue - 1,
        clueCount: r.clue_count,
        revealedClues: clueTexts.slice(0, r.current_clue),
        category: question.category,
        status: r.state,
        winner: winnerPlayer ? { playerId: winnerPlayer.id, name: winnerPlayer.name } : null,
        answer: r.state === "resolved" ? question.answer : null,
        youLockedOut:
          r.state === "revealing" && (await playerLockedOut(r.id, playerId, r.current_clue)),
        youWon: r.winner_player_id === playerId,
      };
    }
  }

  return {
    gameId,
    roomCode: game.room_code,
    status: game.status,
    currentRound: game.current_round,
    totalRounds,
    youAreHost: game.host_player_id === playerId,
    players: playerDtos,
    round,
    standings,
  };
}
