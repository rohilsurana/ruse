import { DurableObject } from 'cloudflare:workers';
import type { GameState, SerializedGameState } from '../server/types';
import { v4 as uuid } from 'uuid';
import {
  createGame,
  addPlayer,
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
  serializeGame,
  deserializeGame,
} from '../server/game-engine';

const TTL_MS = 2 * 60 * 60 * 1000;

export class GameRoom extends DurableObject {
  private game!: GameState;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      await this.loadState();
    });
  }

  private async loadState(): Promise<void> {
    const stored = await this.ctx.storage.get<SerializedGameState>('game');
    if (stored) {
      this.game = deserializeGame(stored);
    }
    this.initialized = true;
  }

  private async saveState(): Promise<void> {
    await this.ctx.storage.put('game', serializeGame(this.game));
    await this.ctx.storage.put('lastActivity', Date.now());
    await this.ctx.storage.setAlarm(Date.now() + TTL_MS);
  }

  async alarm(): Promise<void> {
    const lastActivity = await this.ctx.storage.get<number>('lastActivity') ?? 0;
    if (Date.now() - lastActivity > TTL_MS) {
      await this.ctx.storage.deleteAll();
    } else {
      await this.ctx.storage.setAlarm(Date.now() + TTL_MS);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/game/join' && request.method === 'POST') {
      return this.handleJoin(request, url);
    }
    if (url.pathname === '/api/game/action' && request.method === 'POST') {
      return this.handleAction(request);
    }
    if (url.pathname === '/api/game/state' && request.method === 'GET') {
      return this.handleGetState(url);
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  private async handleJoin(request: Request, url: URL): Promise<Response> {
    const body = await request.json() as { name?: string; gameCode?: string };
    const name = body.name;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return Response.json({ error: 'Name is required' }, { status: 400 });
    }

    const gameCode = url.searchParams.get('code') || 'XXXX';
    if (!this.initialized || !this.game) {
      this.game = createGame(gameCode);
    }

    const playerId = uuid();
    if (!addPlayer(this.game, playerId, name.trim())) {
      return Response.json({
        error: this.game.phase !== 'lobby' ? 'Game already in progress' : 'Game is full',
      }, { status: 409 });
    }

    await this.saveState();
    return Response.json({
      playerId,
      gameCode: this.game.gameCode,
      state: getClientState(this.game, playerId),
    });
  }

  private dispatchAction(playerId: string, type: string, params: Record<string, unknown>): { ok: boolean; error: string } {
    switch (type) {
      case 'start_game':
        return { ok: startGame(this.game, playerId), error: 'Cannot start game' };
      case 'action':
        return { ok: declareAction(this.game, playerId, params.action as never, params.targetId as string | undefined), error: 'Invalid action' };
      case 'challenge':
        if (this.game.phase === 'action_response') return { ok: challengeAction(this.game, playerId), error: 'Cannot challenge' };
        if (this.game.phase === 'block_response') return { ok: challengeBlock(this.game, playerId), error: 'Cannot challenge' };
        return { ok: false, error: 'Cannot challenge' };
      case 'block':
        return { ok: declareBlock(this.game, playerId, params.role as never), error: 'Cannot block' };
      case 'pass':
        return { ok: pass(this.game, playerId), error: 'Cannot pass' };
      case 'lose_influence':
        return { ok: loseInfluence(this.game, playerId, params.influenceIndex as number), error: 'Invalid choice' };
      case 'exchange_select':
        return { ok: exchangeSelect(this.game, playerId, params.kept as number[]), error: 'Invalid exchange selection' };
      case 'rematch':
        return { ok: resetGame(this.game, playerId), error: 'Cannot restart' };
      default:
        return { ok: false, error: 'Unknown action type' };
    }
  }

  private async handleAction(request: Request): Promise<Response> {
    const body = await request.json() as Record<string, unknown>;
    const { playerId, type } = body;

    if (!playerId || !type) {
      return Response.json({ error: 'Missing playerId or type' }, { status: 400 });
    }

    if (!this.game) {
      return Response.json({ error: 'Game not found' }, { status: 404 });
    }

    const result = this.dispatchAction(playerId as string, type as string, body);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    await this.saveState();
    return Response.json({ state: getClientState(this.game, playerId as string) });
  }

  private handleGetState(url: URL): Response {
    const playerId = url.searchParams.get('playerId');

    if (!playerId) {
      return Response.json({ error: 'Missing playerId' }, { status: 400 });
    }

    if (!this.game) {
      return Response.json({ error: 'Game not found' }, { status: 404 });
    }

    const player = this.game.players.find(p => p.id === playerId);
    if (!player) {
      return Response.json({ error: 'Player not in game' }, { status: 404 });
    }

    return Response.json({ state: getClientState(this.game, playerId) });
  }
}
