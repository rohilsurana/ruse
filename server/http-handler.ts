import type { Request, Response } from 'express';
import type { GameState } from './types.js';
import { v4 as uuid } from 'uuid';
import {
  createGame,
  addPlayer,
  removePlayer,
  startGame,
  declareAction,
  challengeAction,
  declareBlock,
  challengeBlock,
  pass,
  loseInfluence,
  exchangeSelect,
  resetGame,
  getClientState,
  autoResolve,
  phaseTimeoutMs,
} from './game-engine.js';

// Reset the response/turn deadline for the game's current phase. Called after
// every action so the clock reflects the latest activity.
function touchDeadline(game: GameState): void {
  const ms = phaseTimeoutMs(game.phase);
  game.phaseDeadline = ms == null ? null : Date.now() + ms;
}

// Lazily enforce timeouts: if the deadline has passed, auto-resolve on the idle
// player's behalf and arm a fresh deadline for whatever phase we land in.
function enforceDeadline(game: GameState): void {
  let guard = 0;
  while (game.phaseDeadline != null && Date.now() > game.phaseDeadline && guard++ < 32) {
    autoResolve(game);
    touchDeadline(game);
  }
}

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const games = new Map<string, GameState>();
const playerSessions = new Map<string, { gameCode: string; lastSeen: number }>();

function getOrCreateGame(code: string | null): GameState {
  if (code) {
    const existing = games.get(code);
    if (existing) return existing;
  }
  let gameCode = code || generateGameCode();
  while (games.has(gameCode)) gameCode = generateGameCode();
  const game = createGame(gameCode);
  games.set(gameCode, game);
  return game;
}

setInterval(() => {
  const now = Date.now();
  for (const [playerId, session] of playerSessions) {
    if (now - session.lastSeen > 60_000) {
      const game = games.get(session.gameCode);
      if (game && game.phase === 'lobby') {
        removePlayer(game, playerId);
        if (game.players.length === 0) games.delete(session.gameCode);
      }
      playerSessions.delete(playerId);
    }
  }
}, 30_000);

export function handleJoin(req: Request, res: Response): void {
  const { name, gameCode } = req.body as { name?: string; gameCode?: string };

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const game = getOrCreateGame(gameCode || null);
  const playerId = uuid();

  if (!addPlayer(game, playerId, name.trim())) {
    res.status(409).json({
      error: game.phase !== 'lobby' ? 'Game already in progress' : 'Game is full',
    });
    return;
  }

  playerSessions.set(playerId, { gameCode: game.gameCode, lastSeen: Date.now() });
  res.json({ playerId, gameCode: game.gameCode, state: getClientState(game, playerId, Date.now()) });
}

function dispatchAction(
  game: GameState,
  playerId: string,
  type: string,
  params: Record<string, unknown>,
): { ok: boolean; error: string } {
  switch (type) {
    case 'start_game':
      return { ok: startGame(game, playerId), error: 'Cannot start game' };
    case 'action':
      return { ok: declareAction(game, playerId, params.action as never, params.targetId as string | undefined), error: 'Invalid action' };
    case 'challenge':
      if (game.phase === 'action_response') return { ok: challengeAction(game, playerId), error: 'Cannot challenge' };
      if (game.phase === 'block_response') return { ok: challengeBlock(game, playerId), error: 'Cannot challenge' };
      return { ok: false, error: 'Cannot challenge' };
    case 'block':
      return { ok: declareBlock(game, playerId, params.role as never), error: 'Cannot block' };
    case 'pass':
      return { ok: pass(game, playerId), error: 'Cannot pass' };
    case 'lose_influence':
      return { ok: loseInfluence(game, playerId, params.influenceIndex as number), error: 'Invalid choice' };
    case 'exchange_select':
      return { ok: exchangeSelect(game, playerId, params.kept as number[]), error: 'Invalid exchange selection' };
    case 'rematch':
      return { ok: resetGame(game, playerId), error: 'Cannot restart' };
    default:
      return { ok: false, error: 'Unknown action type' };
  }
}

export function handleAction(req: Request, res: Response): void {
  const { gameCode, playerId, type, ...params } = req.body as Record<string, unknown>;

  if (!gameCode || !playerId || !type) {
    res.status(400).json({ error: 'Missing gameCode, playerId, or type' });
    return;
  }

  const game = games.get(gameCode as string);
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  const session = playerSessions.get(playerId as string);
  if (session) session.lastSeen = Date.now();

  const result = dispatchAction(game, playerId as string, type as string, params);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  touchDeadline(game);
  res.json({ state: getClientState(game, playerId as string, Date.now()) });
}

export function handleGetState(req: Request, res: Response): void {
  const code = req.query.code as string;
  const playerId = req.query.playerId as string;

  if (!code || !playerId) {
    res.status(400).json({ error: 'Missing code or playerId' });
    return;
  }

  const game = games.get(code);
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  const player = game.players.find(p => p.id === playerId);
  if (!player) {
    res.status(404).json({ error: 'Player not in game' });
    return;
  }

  const session = playerSessions.get(playerId);
  if (session) session.lastSeen = Date.now();

  enforceDeadline(game);
  res.json({ state: getClientState(game, playerId, Date.now()) });
}
