import { DurableObject } from 'cloudflare:workers';
import type { GameState, SerializedGameState } from '../server/types';
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
    await this.ctx.storage.setAlarm(Date.now() + TTL_MS);
  }

  private async broadcastAndSave(): Promise<void> {
    this.broadcast();
    await this.saveState();
  }

  async alarm(): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    if (sockets.length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + TTL_MS);
      return;
    }
    await this.ctx.storage.deleteAll();
  }

  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const url = new URL(request.url);
    const gameCode = url.searchParams.get('code') || 'XXXX';
    if (!this.initialized || !this.game) {
      this.game = createGame(gameCode);
      await this.saveState();
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.sendError(ws, 'Invalid message format');
      return;
    }

    switch (msg.type) {
      case 'join':
        await this.handleJoin(ws, msg);
        break;
      case 'start_game':
        await this.handleStartGame(ws);
        break;
      case 'action':
        await this.handleAction(ws, msg);
        break;
      case 'challenge':
        await this.handleChallenge(ws);
        break;
      case 'block':
        await this.handleBlock(ws, msg);
        break;
      case 'pass':
        await this.handlePass(ws);
        break;
      case 'lose_influence':
        await this.handleLoseInfluence(ws, msg);
        break;
      case 'exchange_select':
        await this.handleExchangeSelect(ws, msg);
        break;
      case 'rematch':
        await this.handleRematch(ws);
        break;
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const playerId = this.getPlayerId(ws);
    if (playerId) {
      removePlayer(this.game, playerId);
      await this.broadcastAndSave();
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    const playerId = this.getPlayerId(ws);
    if (playerId) {
      removePlayer(this.game, playerId);
      await this.broadcastAndSave();
    }
  }

  private getPlayerId(ws: WebSocket): string | null {
    const attachment = ws.deserializeAttachment() as { playerId?: string } | null;
    return attachment?.playerId ?? null;
  }

  private setPlayerId(ws: WebSocket, playerId: string): void {
    ws.serializeAttachment({ playerId });
  }

  private broadcast(): void {
    for (const ws of this.ctx.getWebSockets()) {
      const playerId = this.getPlayerId(ws);
      if (playerId) {
        try {
          ws.send(JSON.stringify({ type: 'state', state: getClientState(this.game, playerId) }));
        } catch {
          // connection closed
        }
      }
    }
  }

  private sendTo(ws: WebSocket, msg: Record<string, unknown>): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // connection closed
    }
  }

  private sendError(ws: WebSocket, message: string): void {
    this.sendTo(ws, { type: 'error', message });
  }

  private async handleJoin(ws: WebSocket, msg: Record<string, unknown>): Promise<void> {
    const name = msg.name as string;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      this.sendError(ws, 'Name is required');
      return;
    }

    const playerId = uuid();
    if (!addPlayer(this.game, playerId, name.trim())) {
      this.sendError(ws, this.game.phase !== 'lobby' ? 'Game already in progress' : 'Game is full');
      return;
    }

    this.setPlayerId(ws, playerId);
    this.sendTo(ws, { type: 'joined', playerId, gameCode: this.game.gameCode });
    await this.broadcastAndSave();
  }

  private async handleStartGame(ws: WebSocket): Promise<void> {
    const playerId = this.getPlayerId(ws);
    if (!playerId) return;
    if (!startGame(this.game, playerId)) {
      this.sendError(ws, 'Cannot start game');
      return;
    }
    await this.broadcastAndSave();
  }

  private async handleAction(ws: WebSocket, msg: Record<string, unknown>): Promise<void> {
    const playerId = this.getPlayerId(ws);
    if (!playerId) return;
    if (!declareAction(this.game, playerId, msg.action as never, msg.targetId as string | undefined)) {
      this.sendError(ws, 'Invalid action');
      return;
    }
    await this.broadcastAndSave();
  }

  private async handleChallenge(ws: WebSocket): Promise<void> {
    const playerId = this.getPlayerId(ws);
    if (!playerId) return;

    let ok = false;
    if (this.game.phase === 'action_response') {
      ok = challengeAction(this.game, playerId);
    } else if (this.game.phase === 'block_response') {
      ok = challengeBlock(this.game, playerId);
    }

    if (!ok) {
      this.sendError(ws, 'Cannot challenge');
      return;
    }
    await this.broadcastAndSave();
  }

  private async handleBlock(ws: WebSocket, msg: Record<string, unknown>): Promise<void> {
    const playerId = this.getPlayerId(ws);
    if (!playerId) return;
    if (!declareBlock(this.game, playerId, msg.role as never)) {
      this.sendError(ws, 'Cannot block');
      return;
    }
    await this.broadcastAndSave();
  }

  private async handlePass(ws: WebSocket): Promise<void> {
    const playerId = this.getPlayerId(ws);
    if (!playerId) return;
    if (!pass(this.game, playerId)) {
      this.sendError(ws, 'Cannot pass');
      return;
    }
    await this.broadcastAndSave();
  }

  private async handleLoseInfluence(ws: WebSocket, msg: Record<string, unknown>): Promise<void> {
    const playerId = this.getPlayerId(ws);
    if (!playerId) return;
    if (!loseInfluence(this.game, playerId, msg.influenceIndex as number)) {
      this.sendError(ws, 'Invalid choice');
      return;
    }
    await this.broadcastAndSave();
  }

  private async handleExchangeSelect(ws: WebSocket, msg: Record<string, unknown>): Promise<void> {
    const playerId = this.getPlayerId(ws);
    if (!playerId) return;
    if (!exchangeSelect(this.game, playerId, msg.kept as number[])) {
      this.sendError(ws, 'Invalid exchange selection');
      return;
    }
    await this.broadcastAndSave();
  }

  private async handleRematch(ws: WebSocket): Promise<void> {
    const playerId = this.getPlayerId(ws);
    if (!playerId) return;
    if (!resetGame(this.game, playerId)) {
      this.sendError(ws, 'Cannot restart');
      return;
    }
    await this.broadcastAndSave();
  }
}
