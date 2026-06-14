import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import type { ClientState, ClientMessage, GamePhase } from '../lib/types';
import type { GameState, SerializedGameState } from '../../server/types';
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
  getActiveActor,
  serializeGame,
  deserializeGame,
} from '../../server/game-engine';

const STORAGE_KEY = 'ruse_local_game';

function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return deserializeGame(JSON.parse(raw) as SerializedGameState);
  } catch {
    // corrupt or absent — start fresh
  }
  return createGame('LOCAL');
}

function persist(game: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeGame(game)));
  } catch {
    // storage full / unavailable — game still playable in memory
  }
}

function dispatch(game: GameState, actorId: string, msg: ClientMessage): void {
  switch (msg.type) {
    case 'start_game':
      startGame(game, game.hostId);
      break;
    case 'rematch':
      resetGame(game, game.hostId);
      break;
    case 'action':
      declareAction(game, actorId, msg.action, msg.targetId);
      break;
    case 'challenge':
      if (game.phase === 'action_response') challengeAction(game, actorId);
      else if (game.phase === 'block_response') challengeBlock(game, actorId);
      break;
    case 'block':
      declareBlock(game, actorId, msg.role);
      break;
    case 'pass':
      pass(game, actorId);
      break;
    case 'lose_influence':
      loseInfluence(game, actorId, msg.influenceIndex);
      break;
    case 'exchange_select':
      exchangeSelect(game, actorId, msg.kept);
      break;
    case 'join':
      break;
  }
}

export function useLocalGame() {
  const [game, setGame] = useState<GameState>(loadGame);
  const [viewerId, setViewerId] = useState<string | null>(null);

  // The engine mutates GameState in place, so we deep-clone the current state,
  // mutate the clone, then commit it — never touching the object held in state.
  const addLocalPlayer = useCallback((name: string) => {
    const next = structuredClone(game);
    if (addPlayer(next, uuid(), name.trim())) {
      persist(next);
      setGame(next);
    }
  }, [game]);

  const removeLocalPlayer = useCallback((id: string) => {
    const next = structuredClone(game);
    if (removePlayer(next, id)) {
      persist(next);
      setGame(next);
    }
  }, [game]);

  const startLocalGame = useCallback(() => {
    const next = structuredClone(game);
    if (startGame(next, next.hostId)) {
      persist(next);
      setViewerId(null);
      setGame(next);
    }
  }, [game]);

  // Active player taps through the pass-the-device screen to view their cards.
  const reveal = useCallback(() => {
    setViewerId(getActiveActor(game));
  }, [game]);

  const send = useCallback((msg: ClientMessage) => {
    const next = structuredClone(game);
    const actorId = getActiveActor(next) ?? next.hostId;
    dispatch(next, actorId, msg);
    persist(next);
    setGame(next);
    // If control moves to a different player, hide the board until they tap in.
    if (getActiveActor(next) !== actorId) setViewerId(null);
  }, [game]);

  const exit = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setViewerId(null);
    setGame(createGame('LOCAL'));
  }, []);

  const phase: GamePhase = game.phase;
  const activeActor = getActiveActor(game);
  const needsPass =
    phase !== 'lobby' && phase !== 'game_over' && viewerId !== activeActor;

  let clientState: ClientState | null = null;
  if (game.players.length > 0) {
    if (phase === 'lobby' || phase === 'game_over') {
      clientState = getClientState(game, game.players[0].id);
    } else if (!needsPass && viewerId) {
      clientState = getClientState(game, viewerId);
    }
  }

  const activeActorName = game.players.find(p => p.id === activeActor)?.name ?? '';

  return {
    phase,
    setupPlayers: game.players.map(p => ({ id: p.id, name: p.name })),
    clientState,
    lastEvent: game.lastEvent,
    needsPass,
    activeActorName,
    addLocalPlayer,
    removeLocalPlayer,
    startLocalGame,
    reveal,
    send,
    exit,
  };
}
