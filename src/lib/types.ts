export type Role = 'duke' | 'assassin' | 'captain' | 'ambassador' | 'contessa';

export type ActionType = 'income' | 'foreign_aid' | 'tax' | 'steal' | 'assassinate' | 'exchange' | 'coup';

export type GamePhase =
  | 'lobby'
  | 'action'
  | 'action_response'
  | 'block'
  | 'block_response'
  | 'lose_influence'
  | 'exchange'
  | 'game_over';

export interface Influence {
  role: Role;
  revealed: boolean;
}

export interface PendingAction {
  type: ActionType;
  playerId: string;
  targetId?: string;
  claimedRole?: Role;
}

export interface PendingBlock {
  blockerId: string;
  claimedRole: Role;
}

export interface ClientPlayer {
  id: string;
  name: string;
  coins: number;
  influenceCount: number;
  revealedInfluences: Role[];
  isAlive: boolean;
  hasResponded: boolean;
}

export interface ClientState {
  gameCode: string;
  phase: GamePhase;
  players: ClientPlayer[];
  myId: string;
  myInfluences: Influence[];
  currentPlayerId: string;
  pendingAction: PendingAction | null;
  pendingBlock: PendingBlock | null;
  canChallenge: boolean;
  canBlock: boolean;
  blockableBy: Role[];
  mustLoseInfluence: boolean;
  exchangeOptions: Role[] | null;
  respondedPlayerIds: string[];
  winner: string | null;
  log: string[];
  isHost: boolean;
  stateVersion: number;
}

export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'start_game' }
  | { type: 'action'; action: ActionType; targetId?: string }
  | { type: 'challenge' }
  | { type: 'block'; role: Role }
  | { type: 'pass' }
  | { type: 'lose_influence'; influenceIndex: number }
  | { type: 'exchange_select'; kept: number[] }
  | { type: 'rematch' };

export type ServerMessage =
  | { type: 'state'; state: ClientState }
  | { type: 'error'; message: string }
  | { type: 'joined'; playerId: string; gameCode: string };

export const ROLE_NAMES: Record<Role, string> = {
  duke: 'Duke',
  assassin: 'Assassin',
  captain: 'Captain',
  ambassador: 'Ambassador',
  contessa: 'Contessa',
};

export const ROLE_COLORS: Record<Role, string> = {
  duke: 'text-red-400',
  assassin: 'text-emerald-400',
  captain: 'text-blue-400',
  ambassador: 'text-amber-400',
  contessa: 'text-purple-400',
};

export const ROLE_BG_COLORS: Record<Role, string> = {
  duke: 'bg-red-900/30 border-red-700/40',
  assassin: 'bg-emerald-900/30 border-emerald-700/40',
  captain: 'bg-blue-900/30 border-blue-700/40',
  ambassador: 'bg-amber-900/30 border-amber-700/40',
  contessa: 'bg-purple-900/30 border-purple-700/40',
};

export const ACTION_LABELS: Record<ActionType, string> = {
  income: 'Income',
  foreign_aid: 'Foreign Aid',
  tax: 'Tax',
  steal: 'Steal',
  assassinate: 'Assassinate',
  exchange: 'Exchange',
  coup: 'Coup',
};

export const ACTION_DESCRIPTIONS: Record<ActionType, string> = {
  income: 'Take 1 coin',
  foreign_aid: 'Take 2 coins (blockable)',
  tax: 'Take 3 coins (Duke)',
  steal: 'Steal 2 coins (Captain)',
  assassinate: 'Pay 3, eliminate (Assassin)',
  exchange: 'Swap cards (Ambassador)',
  coup: 'Pay 7, force elimination',
};

export const ACTION_CONFIG: Record<ActionType, {
  claimedRole?: Role;
  blockableBy: Role[];
  cost: number;
  requiresTarget: boolean;
}> = {
  income: { blockableBy: [], cost: 0, requiresTarget: false },
  foreign_aid: { blockableBy: ['duke'], cost: 0, requiresTarget: false },
  tax: { claimedRole: 'duke', blockableBy: [], cost: 0, requiresTarget: false },
  steal: { claimedRole: 'captain', blockableBy: ['captain', 'ambassador'], cost: 0, requiresTarget: true },
  assassinate: { claimedRole: 'assassin', blockableBy: ['contessa'], cost: 3, requiresTarget: true },
  exchange: { claimedRole: 'ambassador', blockableBy: [], cost: 0, requiresTarget: false },
  coup: { blockableBy: [], cost: 7, requiresTarget: true },
};
