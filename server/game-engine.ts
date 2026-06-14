import type {
  Role,
  ActionType,
  GamePhase,
  GameState,
  Player,
  ClientState,
  SerializedGameState,
} from './types.js';
import { ALL_ROLES, ROLE_NAMES, ACTION_CONFIG } from './types.js';

function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): Role[] {
  const roles: Role[] = [];
  for (const role of ALL_ROLES) {
    roles.push(role, role, role);
  }
  return shuffle(roles);
}

function isAlive(player: Player): boolean {
  return player.influences.some(i => !i.revealed);
}

function getAlivePlayers(game: GameState): Player[] {
  return game.players.filter(isAlive);
}

function getPlayer(game: GameState, id: string): Player | undefined {
  return game.players.find(p => p.id === id);
}

function getCurrentPlayer(game: GameState): Player {
  return game.players[game.currentPlayerIndex];
}

function checkGameOver(game: GameState): boolean {
  const alive = getAlivePlayers(game);
  if (alive.length <= 1) {
    game.phase = 'game_over';
    game.winner = alive[0]?.id ?? null;
    return true;
  }
  return false;
}

function advanceTurn(game: GameState): void {
  if (checkGameOver(game)) return;

  game.pendingAction = null;
  game.pendingBlock = null;
  game.resolution = null;
  game.losingPlayerId = null;
  game.exchangeCards = [];
  game.respondedPlayers = new Set();
  game.turnNumber++;

  let next = (game.currentPlayerIndex + 1) % game.players.length;
  while (!isAlive(game.players[next])) {
    next = (next + 1) % game.players.length;
  }
  game.currentPlayerIndex = next;
  game.phase = 'action';
}

function replaceCard(game: GameState, player: Player, influenceIndex: number): void {
  const old = player.influences[influenceIndex];
  game.deck.push(old.role);
  game.deck = shuffle(game.deck);
  const newRole = game.deck.pop()!;
  player.influences[influenceIndex] = { role: newRole, revealed: false };
}

function getEligibleResponders(game: GameState): string[] {
  const alive = getAlivePlayers(game);

  if (game.phase === 'action_response') {
    return alive.filter(p => p.id !== game.pendingAction!.playerId).map(p => p.id);
  }

  if (game.phase === 'block') {
    if (game.pendingAction!.type === 'foreign_aid') {
      return alive.filter(p => p.id !== game.pendingAction!.playerId).map(p => p.id);
    }
    const targetId = game.pendingAction!.targetId;
    return alive.filter(p => p.id === targetId).map(p => p.id);
  }

  if (game.phase === 'block_response') {
    return alive.filter(p => p.id !== game.pendingBlock!.blockerId).map(p => p.id);
  }

  return [];
}

function allResponded(game: GameState): boolean {
  return getEligibleResponders(game).every(id => game.respondedPlayers.has(id));
}

function resolveAction(game: GameState): void {
  const action = game.pendingAction!;
  const actor = getPlayer(game, action.playerId)!;

  switch (action.type) {
    case 'income':
      actor.coins += 1;
      game.log.push(`${actor.name} took income (+1 coin)`);
      advanceTurn(game);
      break;

    case 'foreign_aid':
      actor.coins += 2;
      game.log.push(`${actor.name} took foreign aid (+2 coins)`);
      advanceTurn(game);
      break;

    case 'tax':
      actor.coins += 3;
      game.log.push(`${actor.name} collected tax (+3 coins)`);
      advanceTurn(game);
      break;

    case 'steal': {
      const target = getPlayer(game, action.targetId!)!;
      const stolen = Math.min(2, target.coins);
      target.coins -= stolen;
      actor.coins += stolen;
      game.log.push(`${actor.name} stole ${stolen} coin${stolen !== 1 ? 's' : ''} from ${target.name}`);
      advanceTurn(game);
      break;
    }

    case 'assassinate': {
      const target = getPlayer(game, action.targetId!)!;
      if (isAlive(target)) {
        game.phase = 'lose_influence';
        game.losingPlayerId = target.id;
        game.resolution = 'next_turn';
        game.respondedPlayers = new Set();
        game.log.push(`${actor.name} assassinated ${target.name}`);
      } else {
        advanceTurn(game);
      }
      break;
    }

    case 'exchange': {
      const drawn = game.deck.splice(0, Math.min(2, game.deck.length));
      const hand = actor.influences.filter(i => !i.revealed).map(i => i.role);
      game.exchangeCards = [...hand, ...drawn];
      game.phase = 'exchange';
      break;
    }

    case 'coup': {
      const target = getPlayer(game, action.targetId!)!;
      game.phase = 'lose_influence';
      game.losingPlayerId = target.id;
      game.resolution = 'next_turn';
      game.respondedPlayers = new Set();
      game.log.push(`${actor.name} launched a coup against ${target.name}`);
      break;
    }
  }
}

function bumpVersion(game: GameState): void {
  game.stateVersion++;
}

function recordChallenge(
  game: GameState,
  challengerName: string,
  claimantName: string,
  claimedRole: Role,
  proven: boolean,
  context: 'action' | 'block',
): void {
  game.lastEvent = {
    seq: ++game.eventSeq,
    kind: 'challenge',
    context,
    challengerName,
    claimantName,
    claimedRole,
    proven,
  };
}

export function createGame(code: string): GameState {
  return {
    gameCode: code,
    phase: 'lobby',
    players: [],
    currentPlayerIndex: 0,
    deck: [],
    pendingAction: null,
    pendingBlock: null,
    resolution: null,
    losingPlayerId: null,
    exchangeCards: [],
    respondedPlayers: new Set(),
    hostId: '',
    turnNumber: 0,
    stateVersion: 0,
    phaseDeadline: null,
    eventSeq: 0,
    lastEvent: null,
    log: [],
    winner: null,
  };
}

export function addPlayer(game: GameState, id: string, name: string): boolean {
  if (game.phase !== 'lobby') return false;
  if (game.players.length >= 6) return false;
  if (game.players.some(p => p.id === id)) return false;
  bumpVersion(game);

  game.players.push({ id, name, coins: 0, influences: [] });

  if (game.players.length === 1) {
    game.hostId = id;
  }

  return true;
}

export function removePlayer(game: GameState, playerId: string): boolean {
  if (game.phase !== 'lobby') return false;
  const index = game.players.findIndex(p => p.id === playerId);
  if (index === -1) return false;
  bumpVersion(game);

  game.players.splice(index, 1);

  if (game.hostId === playerId && game.players.length > 0) {
    game.hostId = game.players[0].id;
  }

  return true;
}

export function startGame(game: GameState, playerId: string): boolean {
  if (game.phase !== 'lobby') return false;
  if (game.hostId !== playerId) return false;
  if (game.players.length < 2) return false;
  bumpVersion(game);

  game.deck = buildDeck();

  for (const player of game.players) {
    player.coins = 2;
    player.influences = [
      { role: game.deck.pop()!, revealed: false },
      { role: game.deck.pop()!, revealed: false },
    ];
  }

  game.currentPlayerIndex = Math.floor(Math.random() * game.players.length);
  game.phase = 'action';
  game.turnNumber = 1;
  game.log = ['The court is assembled. Let the scheming begin.'];

  return true;
}

export function declareAction(
  game: GameState,
  playerId: string,
  actionType: ActionType,
  targetId?: string,
): boolean {
  if (game.phase !== 'action') return false;
  const current = getCurrentPlayer(game);
  if (current.id !== playerId) return false;

  const config = ACTION_CONFIG[actionType];

  if (config.requiresTarget && !targetId) return false;
  if (targetId) {
    const target = getPlayer(game, targetId);
    if (!target || !isAlive(target) || target.id === playerId) return false;
  }

  if (current.coins < config.cost) return false;
  if (current.coins >= 10 && actionType !== 'coup') return false;
  bumpVersion(game);

  current.coins -= config.cost;

  game.pendingAction = {
    type: actionType,
    playerId,
    targetId,
    claimedRole: config.claimedRole,
  };
  game.respondedPlayers = new Set();

  if (!config.challengeable && config.blockableBy.length === 0) {
    resolveAction(game);
  } else {
    // Combined window: from one prompt, any eligible player may challenge
    // (if the action claims a role) or block (if they're an eligible blocker)
    // or allow.
    game.phase = 'action_response';
    if (getEligibleResponders(game).length === 0) {
      resolveAction(game);
    }
  }

  return true;
}

export function challengeAction(game: GameState, challengerId: string): boolean {
  if (game.phase !== 'action_response') return false;
  const action = game.pendingAction!;
  if (challengerId === action.playerId) return false;

  const challenger = getPlayer(game, challengerId)!;
  const actor = getPlayer(game, action.playerId)!;
  if (!isAlive(challenger)) return false;
  bumpVersion(game);

  const claimedRole = action.claimedRole!;
  const actorHasRole = actor.influences.some(i => !i.revealed && i.role === claimedRole);
  recordChallenge(game, challenger.name, actor.name, claimedRole, actorHasRole, 'action');

  if (actorHasRole) {
    const cardIndex = actor.influences.findIndex(i => !i.revealed && i.role === claimedRole);
    replaceCard(game, actor, cardIndex);

    game.log.push(
      `${challenger.name} challenged ${actor.name}'s ${ROLE_NAMES[claimedRole]} claim — ${actor.name} had it!`,
    );

    const config = ACTION_CONFIG[action.type];
    game.phase = 'lose_influence';
    game.losingPlayerId = challengerId;
    game.resolution = config.blockableBy.length > 0 ? 'block_window' : 'resolve_action';
    game.respondedPlayers = new Set();
  } else {
    game.log.push(
      `${challenger.name} challenged ${actor.name}'s ${ROLE_NAMES[claimedRole]} claim — ${actor.name} was bluffing!`,
    );

    game.phase = 'lose_influence';
    game.losingPlayerId = action.playerId;
    game.resolution = 'next_turn';
    game.respondedPlayers = new Set();
  }

  return true;
}

export function declareBlock(game: GameState, blockerId: string, claimedRole: Role): boolean {
  // A block can come from the combined action window or the post-challenge
  // block window.
  if (game.phase !== 'block' && game.phase !== 'action_response') return false;
  const action = game.pendingAction!;
  const config = ACTION_CONFIG[action.type];

  if (!config.blockableBy.includes(claimedRole)) return false;

  const blocker = getPlayer(game, blockerId)!;
  if (!isAlive(blocker)) return false;
  if (!getEligibleResponders(game).includes(blockerId)) return false;
  if (game.respondedPlayers.has(blockerId)) return false;

  if (action.type !== 'foreign_aid' && blockerId !== action.targetId) return false;
  bumpVersion(game);

  const actor = getPlayer(game, action.playerId)!;
  game.pendingBlock = { blockerId, claimedRole };
  game.respondedPlayers = new Set();
  game.phase = 'block_response';
  game.log.push(`${blocker.name} claims ${ROLE_NAMES[claimedRole]} to block ${actor.name}`);

  return true;
}

export function challengeBlock(game: GameState, challengerId: string): boolean {
  if (game.phase !== 'block_response') return false;
  const block = game.pendingBlock!;
  if (challengerId === block.blockerId) return false;

  const challenger = getPlayer(game, challengerId)!;
  const blocker = getPlayer(game, block.blockerId)!;
  if (!isAlive(challenger)) return false;
  bumpVersion(game);

  const blockerHasRole = blocker.influences.some(i => !i.revealed && i.role === block.claimedRole);
  recordChallenge(game, challenger.name, blocker.name, block.claimedRole, blockerHasRole, 'block');

  if (blockerHasRole) {
    const cardIndex = blocker.influences.findIndex(i => !i.revealed && i.role === block.claimedRole);
    replaceCard(game, blocker, cardIndex);

    game.log.push(
      `${challenger.name} challenged ${blocker.name}'s ${ROLE_NAMES[block.claimedRole]} block — ${blocker.name} had it!`,
    );

    game.phase = 'lose_influence';
    game.losingPlayerId = challengerId;
    game.resolution = 'next_turn';
    game.respondedPlayers = new Set();
  } else {
    game.log.push(
      `${challenger.name} challenged ${blocker.name}'s ${ROLE_NAMES[block.claimedRole]} block — ${blocker.name} was bluffing!`,
    );

    game.phase = 'lose_influence';
    game.losingPlayerId = block.blockerId;
    game.resolution = 'resolve_action';
    game.respondedPlayers = new Set();
  }

  return true;
}

export function pass(game: GameState, playerId: string): boolean {
  if (game.phase !== 'action_response' && game.phase !== 'block' && game.phase !== 'block_response') {
    return false;
  }

  const eligible = getEligibleResponders(game);
  if (!eligible.includes(playerId)) return false;
  if (game.respondedPlayers.has(playerId)) return false;
  bumpVersion(game);

  game.respondedPlayers.add(playerId);

  if (!allResponded(game)) return true;

  if (game.phase === 'action_response') {
    // Nobody challenged or blocked in the combined window — the action stands.
    game.respondedPlayers = new Set();
    resolveAction(game);
  } else if (game.phase === 'block') {
    game.respondedPlayers = new Set();
    resolveAction(game);
  } else if (game.phase === 'block_response') {
    game.log.push(`Block by ${getPlayer(game, game.pendingBlock!.blockerId)!.name} succeeds`);
    advanceTurn(game);
  }

  return true;
}

export function loseInfluence(game: GameState, playerId: string, influenceIndex: number): boolean {
  if (game.phase !== 'lose_influence') return false;
  if (game.losingPlayerId !== playerId) return false;

  const player = getPlayer(game, playerId)!;
  if (influenceIndex < 0 || influenceIndex >= player.influences.length) return false;
  if (player.influences[influenceIndex].revealed) return false;
  bumpVersion(game);

  player.influences[influenceIndex].revealed = true;
  game.log.push(`${player.name} revealed ${ROLE_NAMES[player.influences[influenceIndex].role]}`);

  if (checkGameOver(game)) return true;

  const resolution = game.resolution!;
  game.respondedPlayers = new Set();

  switch (resolution) {
    case 'next_turn':
      advanceTurn(game);
      break;
    case 'resolve_action':
      resolveAction(game);
      break;
    case 'block_window': {
      game.phase = 'block';
      const eligible = getEligibleResponders(game);
      if (eligible.length === 0) {
        resolveAction(game);
      }
      break;
    }
  }

  return true;
}

export function exchangeSelect(game: GameState, playerId: string, keptIndices: number[]): boolean {
  if (game.phase !== 'exchange') return false;
  if (game.pendingAction?.playerId !== playerId) return false;

  const player = getPlayer(game, playerId)!;
  const aliveCount = player.influences.filter(i => !i.revealed).length;

  if (keptIndices.length !== aliveCount) return false;

  const options = game.exchangeCards;
  if (keptIndices.some(i => i < 0 || i >= options.length)) return false;
  if (new Set(keptIndices).size !== keptIndices.length) return false;
  bumpVersion(game);

  const kept = keptIndices.map(i => options[i]);
  const returned = options.filter((_, i) => !keptIndices.includes(i));

  let keptIdx = 0;
  for (const inf of player.influences) {
    if (!inf.revealed) {
      inf.role = kept[keptIdx++];
    }
  }

  game.deck.push(...returned);
  game.deck = shuffle(game.deck);
  game.exchangeCards = [];

  game.log.push(`${player.name} exchanged cards with the court`);
  advanceTurn(game);

  return true;
}

export function resetGame(game: GameState, playerId: string): boolean {
  if (game.phase !== 'game_over') return false;
  if (game.hostId !== playerId) return false;
  bumpVersion(game);

  game.phase = 'lobby';
  game.deck = [];
  game.pendingAction = null;
  game.pendingBlock = null;
  game.resolution = null;
  game.losingPlayerId = null;
  game.exchangeCards = [];
  game.respondedPlayers = new Set();
  game.currentPlayerIndex = 0;
  game.turnNumber = 0;
  game.phaseDeadline = null;
  game.lastEvent = null;
  game.log = [];
  game.winner = null;

  for (const player of game.players) {
    player.coins = 0;
    player.influences = [];
  }

  return true;
}

/**
 * Returns the single player whose input the game is currently waiting on, or
 * null if no one needs to act (lobby / game over). Response phases are
 * serialized in seating order, which is what single-device (pass-and-play)
 * mode needs to prompt one player at a time.
 */
export function getActiveActor(game: GameState): string | null {
  switch (game.phase) {
    case 'action':
      return getCurrentPlayer(game)?.id ?? null;
    case 'exchange':
      return game.pendingAction?.playerId ?? null;
    case 'lose_influence':
      return game.losingPlayerId;
    case 'action_response':
    case 'block':
    case 'block_response':
      return getEligibleResponders(game).find(id => !game.respondedPlayers.has(id)) ?? null;
    default:
      return null;
  }
}

export function getClientState(game: GameState, playerId: string, now = 0): ClientState {
  const player = getPlayer(game, playerId);
  const currentPlayer = game.phase !== 'lobby' && game.phase !== 'game_over'
    ? getCurrentPlayer(game)
    : game.players[0];

  const eligible = getEligibleResponders(game);
  const canRespond = eligible.includes(playerId) && !game.respondedPlayers.has(playerId);

  let canChallenge = false;
  let canBlock = false;
  let blockableBy: Role[] = [];

  if (canRespond) {
    const action = game.pendingAction;
    if (game.phase === 'action_response' && action) {
      const config = ACTION_CONFIG[action.type];
      if (action.claimedRole) canChallenge = true;
      const isBlocker = config.blockableBy.length > 0
        && (action.type === 'foreign_aid' || playerId === action.targetId);
      if (isBlocker) {
        canBlock = true;
        blockableBy = config.blockableBy;
      }
    } else if (game.phase === 'block_response') {
      canChallenge = true;
    } else if (game.phase === 'block' && action) {
      canBlock = true;
      blockableBy = ACTION_CONFIG[action.type].blockableBy;
    }
  }

  return {
    gameCode: game.gameCode,
    phase: game.phase,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      coins: p.coins,
      influenceCount: p.influences.filter(i => !i.revealed).length,
      revealedInfluences: p.influences.filter(i => i.revealed).map(i => i.role),
      isAlive: isAlive(p),
      hasResponded: game.respondedPlayers.has(p.id),
    })),
    myId: playerId,
    myInfluences: player?.influences ?? [],
    currentPlayerId: currentPlayer?.id ?? '',
    pendingAction: game.pendingAction,
    pendingBlock: game.pendingBlock,
    canChallenge,
    canBlock,
    blockableBy,
    mustLoseInfluence: game.phase === 'lose_influence' && game.losingPlayerId === playerId,
    exchangeOptions: game.phase === 'exchange' && game.pendingAction?.playerId === playerId
      ? game.exchangeCards
      : null,
    respondedPlayerIds: [...game.respondedPlayers],
    winner: game.winner,
    log: game.log.slice(-10),
    isHost: playerId === game.hostId,
    stateVersion: game.stateVersion,
    deadline: game.phaseDeadline,
    serverNow: now,
    lastEvent: game.lastEvent,
  };
}

/**
 * How long (ms) a player has to act in each phase before the game auto-resolves
 * on their behalf. Returns null for phases that should never time out (lobby,
 * game over). Enforced by the transport layer (online only) — single-device
 * pass-and-play never sets a deadline.
 */
export function phaseTimeoutMs(phase: GamePhase): number | null {
  switch (phase) {
    case 'action':
      return 45_000;
    case 'action_response':
    case 'block':
    case 'block_response':
      return 25_000;
    case 'lose_influence':
    case 'exchange':
      return 30_000;
    default:
      return null;
  }
}

/**
 * Performs the least-disruptive default action for whoever the game is waiting
 * on. Called when a phase deadline passes so one idle player can't stall the
 * table: responders allow, a player losing influence reveals their first card,
 * an exchanger keeps their current hand, and an idle turn takes income (or the
 * forced coup at 10+ coins).
 */
export function autoResolve(game: GameState): void {
  switch (game.phase) {
    case 'action': {
      const current = getCurrentPlayer(game);
      if (current.coins >= 10) {
        const target = getAlivePlayers(game).find(p => p.id !== current.id);
        if (target) declareAction(game, current.id, 'coup', target.id);
      } else {
        declareAction(game, current.id, 'income');
      }
      break;
    }
    case 'action_response':
    case 'block':
    case 'block_response': {
      const pending = getEligibleResponders(game).filter(id => !game.respondedPlayers.has(id));
      for (const id of pending) pass(game, id);
      break;
    }
    case 'lose_influence': {
      const pid = game.losingPlayerId;
      if (pid) {
        const p = getPlayer(game, pid);
        const idx = p?.influences.findIndex(i => !i.revealed) ?? -1;
        if (idx >= 0) loseInfluence(game, pid, idx);
      }
      break;
    }
    case 'exchange': {
      const pid = game.pendingAction?.playerId;
      if (pid) {
        const p = getPlayer(game, pid)!;
        const keep = p.influences.filter(i => !i.revealed).length;
        // The player's current cards occupy the first slots of exchangeCards.
        exchangeSelect(game, pid, Array.from({ length: keep }, (_, i) => i));
      }
      break;
    }
  }
}

export function serializeGame(game: GameState): SerializedGameState {
  return { ...game, respondedPlayers: [...game.respondedPlayers] };
}

export function deserializeGame(data: SerializedGameState): GameState {
  return { ...data, respondedPlayers: new Set(data.respondedPlayers) };
}
