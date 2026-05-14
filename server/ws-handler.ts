import type { WebSocket } from 'ws';
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
} from './game-engine.js';

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const games = new Map<string, GameState>();
const connections = new Map<WebSocket, { gameCode: string; playerId: string }>();

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

function broadcastGame(gameCode: string): void {
  const game = games.get(gameCode);
  if (!game) return;
  for (const [ws, info] of connections) {
    if (info.gameCode === gameCode && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'state', state: getClientState(game, info.playerId) }));
    }
  }
}

function sendTo(ws: WebSocket, msg: Record<string, unknown>): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function sendError(ws: WebSocket, message: string): void {
  sendTo(ws, { type: 'error', message });
}

export function handleConnection(ws: WebSocket, gameCode: string | null): void {
  const game = getOrCreateGame(gameCode);
  const connInfo = { gameCode: game.gameCode, playerId: '' };

  ws.on('message', (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      sendError(ws, 'Invalid message format');
      return;
    }

    const currentGame = games.get(connInfo.gameCode);
    if (!currentGame) {
      sendError(ws, 'Game not found');
      return;
    }

    switch (msg.type) {
      case 'join': {
        const name = msg.name as string;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          sendError(ws, 'Name is required');
          return;
        }
        const playerId = uuid();
        if (!addPlayer(currentGame, playerId, name.trim())) {
          sendError(ws, currentGame.phase !== 'lobby' ? 'Game already in progress' : 'Game is full');
          return;
        }
        connInfo.playerId = playerId;
        connections.set(ws, connInfo);
        sendTo(ws, { type: 'joined', playerId, gameCode: connInfo.gameCode });
        broadcastGame(connInfo.gameCode);
        break;
      }

      case 'start_game':
        if (!connInfo.playerId) return;
        if (!startGame(currentGame, connInfo.playerId)) {
          sendError(ws, 'Cannot start game. Need 2-6 players and you must be host.');
          return;
        }
        broadcastGame(connInfo.gameCode);
        break;

      case 'action': {
        if (!connInfo.playerId) return;
        const action = msg.action as string;
        const targetId = msg.targetId as string | undefined;
        if (!declareAction(currentGame, connInfo.playerId, action as never, targetId)) {
          sendError(ws, 'Invalid action');
          return;
        }
        broadcastGame(connInfo.gameCode);
        break;
      }

      case 'challenge':
        if (!connInfo.playerId) return;
        if (currentGame.phase === 'action_response') {
          if (!challengeAction(currentGame, connInfo.playerId)) {
            sendError(ws, 'Cannot challenge');
            return;
          }
        } else if (currentGame.phase === 'block_response') {
          if (!challengeBlock(currentGame, connInfo.playerId)) {
            sendError(ws, 'Cannot challenge block');
            return;
          }
        } else {
          sendError(ws, 'Nothing to challenge');
          return;
        }
        broadcastGame(connInfo.gameCode);
        break;

      case 'block': {
        if (!connInfo.playerId) return;
        const role = msg.role as string;
        if (!declareBlock(currentGame, connInfo.playerId, role as never)) {
          sendError(ws, 'Cannot block');
          return;
        }
        broadcastGame(connInfo.gameCode);
        break;
      }

      case 'pass':
        if (!connInfo.playerId) return;
        if (!pass(currentGame, connInfo.playerId)) {
          sendError(ws, 'Cannot pass');
          return;
        }
        broadcastGame(connInfo.gameCode);
        break;

      case 'lose_influence': {
        if (!connInfo.playerId) return;
        const influenceIndex = msg.influenceIndex as number;
        if (!loseInfluence(currentGame, connInfo.playerId, influenceIndex)) {
          sendError(ws, 'Invalid choice');
          return;
        }
        broadcastGame(connInfo.gameCode);
        break;
      }

      case 'exchange_select': {
        if (!connInfo.playerId) return;
        const kept = msg.kept as number[];
        if (!exchangeSelect(currentGame, connInfo.playerId, kept)) {
          sendError(ws, 'Invalid exchange selection');
          return;
        }
        broadcastGame(connInfo.gameCode);
        break;
      }

      case 'rematch':
        if (!connInfo.playerId) return;
        if (!resetGame(currentGame, connInfo.playerId)) {
          sendError(ws, 'Cannot restart');
          return;
        }
        broadcastGame(connInfo.gameCode);
        break;

      default:
        sendError(ws, 'Unknown message type');
    }
  });

  ws.on('close', () => {
    const info = connections.get(ws);
    if (info?.playerId) {
      const g = games.get(info.gameCode);
      if (g) {
        removePlayer(g, info.playerId);
        broadcastGame(info.gameCode);
        if (g.players.length === 0) games.delete(info.gameCode);
      }
    }
    connections.delete(ws);
  });
}
