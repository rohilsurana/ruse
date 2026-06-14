import { describe, it, expect } from 'vitest';
import type { GameState, Role } from './types.js';
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
  autoResolve,
  phaseTimeoutMs,
  serializeGame,
  deserializeGame,
} from './game-engine.js';

/**
 * Builds a started game with deterministic hands so we can assert flow without
 * fighting the shuffle. Player ids are p0..pN, p0 is host, and it's p0's turn.
 */
function startedGame(hands: Role[][], deck: Role[] = []): GameState {
  const g = createGame('TEST');
  hands.forEach((_, i) => addPlayer(g, `p${i}`, `P${i}`));
  startGame(g, g.hostId);
  hands.forEach((roles, i) => {
    g.players[i].influences = roles.map(role => ({ role, revealed: false }));
    g.players[i].coins = 2;
  });
  g.currentPlayerIndex = 0;
  g.deck = [...deck];
  return g;
}

const alive = (g: GameState, id: string) =>
  g.players.find(p => p.id === id)!.influences.filter(i => !i.revealed).length;

describe('lobby', () => {
  it('adds players, first is host, caps at 6', () => {
    const g = createGame('TEST');
    expect(addPlayer(g, 'a', 'A')).toBe(true);
    expect(g.hostId).toBe('a');
    for (let i = 1; i < 6; i++) expect(addPlayer(g, `x${i}`, `X${i}`)).toBe(true);
    expect(addPlayer(g, 'overflow', 'O')).toBe(false);
    expect(g.players).toHaveLength(6);
  });

  it('rejects duplicate ids and non-lobby joins', () => {
    const g = createGame('TEST');
    addPlayer(g, 'a', 'A');
    expect(addPlayer(g, 'a', 'A2')).toBe(false);
    addPlayer(g, 'b', 'B');
    startGame(g, 'a');
    expect(addPlayer(g, 'c', 'C')).toBe(false);
  });

  it('reassigns host when host leaves in lobby', () => {
    const g = createGame('TEST');
    addPlayer(g, 'a', 'A');
    addPlayer(g, 'b', 'B');
    expect(removePlayer(g, 'a')).toBe(true);
    expect(g.hostId).toBe('b');
  });

  it('start requires host and 2+ players', () => {
    const g = createGame('TEST');
    addPlayer(g, 'a', 'A');
    expect(startGame(g, 'a')).toBe(false); // only 1 player
    addPlayer(g, 'b', 'B');
    expect(startGame(g, 'b')).toBe(false); // not host
    expect(startGame(g, 'a')).toBe(true);
    expect(g.phase).toBe('action');
    g.players.forEach(p => {
      expect(p.coins).toBe(2);
      expect(p.influences).toHaveLength(2);
    });
  });
});

describe('basic actions', () => {
  it('income gives +1 and advances the turn', () => {
    const g = startedGame([['duke', 'captain'], ['duke', 'contessa']]);
    expect(declareAction(g, 'p0', 'income')).toBe(true);
    expect(g.players[0].coins).toBe(3);
    expect(g.phase).toBe('action');
    expect(g.players[g.currentPlayerIndex].id).toBe('p1');
  });

  it('coup costs 7 and forces target to lose influence', () => {
    const g = startedGame([['duke', 'captain'], ['duke', 'contessa']]);
    g.players[0].coins = 7;
    expect(declareAction(g, 'p0', 'coup', 'p1')).toBe(true);
    expect(g.players[0].coins).toBe(0);
    expect(g.phase).toBe('lose_influence');
    expect(g.losingPlayerId).toBe('p1');
  });

  it('cannot coup without 7 coins, must coup at 10', () => {
    const g = startedGame([['duke', 'captain'], ['duke', 'contessa']]);
    g.players[0].coins = 6;
    expect(declareAction(g, 'p0', 'coup', 'p1')).toBe(false);
    g.players[0].coins = 10;
    expect(declareAction(g, 'p0', 'income')).toBe(false); // forced to coup
    expect(declareAction(g, 'p0', 'coup', 'p1')).toBe(true);
  });

  it('rejects acting out of turn', () => {
    const g = startedGame([['duke', 'captain'], ['duke', 'contessa']]);
    expect(declareAction(g, 'p1', 'income')).toBe(false);
  });
});

describe('combined response window', () => {
  it('target sees both challenge and block; others only challenge', () => {
    const g = startedGame([['captain', 'duke'], ['contessa', 'duke'], ['duke', 'contessa']]);
    declareAction(g, 'p0', 'steal', 'p1');
    expect(g.phase).toBe('action_response');

    const target = getClientState(g, 'p1');
    expect(target.canChallenge).toBe(true);
    expect(target.canBlock).toBe(true);
    expect(target.blockableBy).toEqual(['captain', 'ambassador']);

    const bystander = getClientState(g, 'p2');
    expect(bystander.canChallenge).toBe(true);
    expect(bystander.canBlock).toBe(false);
  });

  it('foreign aid is blockable by anyone but not challengeable', () => {
    const g = startedGame([['duke', 'captain'], ['duke', 'contessa']]);
    declareAction(g, 'p0', 'foreign_aid');
    expect(g.phase).toBe('action_response');
    const other = getClientState(g, 'p1');
    expect(other.canChallenge).toBe(false);
    expect(other.canBlock).toBe(true);
    expect(other.blockableBy).toEqual(['duke']);
  });

  it('all allowing resolves the action directly (no separate block phase)', () => {
    const g = startedGame([['duke', 'captain'], ['duke', 'contessa'], ['duke', 'contessa']]);
    declareAction(g, 'p0', 'tax');
    pass(g, 'p1');
    expect(g.phase).toBe('action_response'); // still waiting on p2
    pass(g, 'p2');
    expect(g.phase).toBe('action');
    expect(g.players[0].coins).toBe(5); // +3 tax
  });

  it('a non-target cannot block a targeted action', () => {
    const g = startedGame([['captain', 'duke'], ['contessa', 'duke'], ['duke', 'contessa']]);
    declareAction(g, 'p0', 'steal', 'p1');
    expect(declareBlock(g, 'p2', 'captain')).toBe(false);
    expect(declareBlock(g, 'p1', 'captain')).toBe(true);
    expect(g.phase).toBe('block_response');
  });
});

describe('challenging an action', () => {
  it('challenging a truthful claim makes the challenger lose influence', () => {
    const g = startedGame([['duke', 'captain'], ['contessa', 'assassin']]);
    declareAction(g, 'p0', 'tax'); // claims Duke, truthfully
    expect(challengeAction(g, 'p1')).toBe(true);
    expect(g.phase).toBe('lose_influence');
    expect(g.losingPlayerId).toBe('p1');
    expect(g.resolution).toBe('resolve_action'); // tax not blockable
    expect(g.lastEvent?.proven).toBe(true);

    loseInfluence(g, 'p1', 0);
    expect(g.players[0].coins).toBe(5); // tax resolved (+3)
    expect(g.phase).toBe('action');
  });

  it('challenging a bluff makes the actor lose influence and cancels the action', () => {
    const g = startedGame([['captain', 'contessa'], ['duke', 'assassin']]);
    declareAction(g, 'p0', 'tax'); // claims Duke, bluffing
    expect(challengeAction(g, 'p1')).toBe(true);
    expect(g.phase).toBe('lose_influence');
    expect(g.losingPlayerId).toBe('p0');
    expect(g.resolution).toBe('next_turn');
    expect(g.lastEvent?.proven).toBe(false);

    loseInfluence(g, 'p0', 0);
    expect(g.players[0].coins).toBe(2); // no tax
  });

  it('opens a block window after a failed challenge of a blockable action', () => {
    const g = startedGame([['captain', 'duke'], ['contessa', 'assassin'], ['duke', 'contessa']]);
    g.players[1].coins = 2;
    declareAction(g, 'p0', 'steal', 'p1'); // claims Captain, truthfully
    expect(challengeAction(g, 'p2')).toBe(true); // bystander challenges and is wrong
    expect(g.resolution).toBe('block_window');
    loseInfluence(g, 'p2', 0);
    expect(g.phase).toBe('block'); // target p1 now gets to block
    expect(getActiveActor(g)).toBe('p1');
  });
});

describe('blocking and counter-challenge', () => {
  it('an unchallenged block stops the action', () => {
    const g = startedGame([['captain', 'duke'], ['captain', 'contessa']]);
    g.players[1].coins = 2;
    declareAction(g, 'p0', 'steal', 'p1');
    declareBlock(g, 'p1', 'captain');
    expect(g.phase).toBe('block_response');
    pass(g, 'p0'); // actor allows the block
    expect(g.phase).toBe('action');
    expect(g.players[0].coins).toBe(2); // steal blocked, no coins moved
    expect(g.players[1].coins).toBe(2);
  });

  it('challenging a truthful block costs the challenger', () => {
    const g = startedGame([['captain', 'duke'], ['captain', 'contessa']]);
    declareAction(g, 'p0', 'steal', 'p1');
    declareBlock(g, 'p1', 'captain'); // p1 truthfully has Captain
    expect(challengeBlock(g, 'p0')).toBe(true);
    expect(g.losingPlayerId).toBe('p0');
    expect(g.resolution).toBe('next_turn'); // block stands
  });

  it('challenging a bluffed block lets the action through', () => {
    const g = startedGame([['captain', 'duke'], ['contessa', 'assassin']]);
    g.players[1].coins = 2;
    declareAction(g, 'p0', 'steal', 'p1');
    declareBlock(g, 'p1', 'captain'); // p1 bluffs Captain
    expect(challengeBlock(g, 'p0')).toBe(true);
    expect(g.losingPlayerId).toBe('p1');
    expect(g.resolution).toBe('resolve_action');
    loseInfluence(g, 'p1', 0);
    expect(g.players[0].coins).toBe(4); // steal resolves (+2)
  });
});

describe('exchange', () => {
  it('keeps the chosen cards and returns the rest to the deck', () => {
    const g = startedGame([['ambassador', 'captain'], ['duke', 'contessa']], ['assassin', 'duke']);
    declareAction(g, 'p0', 'exchange');
    pass(g, 'p1'); // allow
    expect(g.phase).toBe('exchange');
    expect(g.exchangeCards).toEqual(['ambassador', 'captain', 'assassin', 'duke']);
    const deckBefore = g.deck.length;
    expect(exchangeSelect(g, 'p0', [0, 1])).toBe(true); // keep originals
    expect(g.players[0].influences.map(i => i.role)).toEqual(['ambassador', 'captain']);
    expect(g.deck.length).toBe(deckBefore + 2); // two cards returned
    expect(g.phase).toBe('action');
  });
});

describe('win condition', () => {
  it('declares a winner when one player remains', () => {
    const g = startedGame([['duke', 'captain'], ['contessa']]);
    g.players[0].coins = 7;
    declareAction(g, 'p0', 'coup', 'p1');
    loseInfluence(g, 'p1', 0); // p1 loses last influence
    expect(g.phase).toBe('game_over');
    expect(g.winner).toBe('p0');
  });
});

describe('auto-resolve (timeout)', () => {
  it('takes income on an idle turn', () => {
    const g = startedGame([['duke', 'captain'], ['duke', 'contessa']]);
    autoResolve(g);
    expect(g.players[0].coins).toBe(3);
    expect(g.players[g.currentPlayerIndex].id).toBe('p1');
  });

  it('coups when idle at 10+ coins', () => {
    const g = startedGame([['duke', 'captain'], ['duke', 'contessa']]);
    g.players[0].coins = 10;
    autoResolve(g);
    expect(g.players[0].coins).toBe(3);
    expect(g.phase).toBe('lose_influence');
  });

  it('allows for all idle responders', () => {
    const g = startedGame([['duke', 'captain'], ['duke', 'contessa'], ['duke', 'contessa']]);
    declareAction(g, 'p0', 'tax');
    autoResolve(g);
    expect(g.phase).toBe('action');
    expect(g.players[0].coins).toBe(5);
  });

  it('reveals the first card when idle in lose_influence', () => {
    const g = startedGame([['duke', 'captain'], ['duke', 'contessa']]);
    g.players[0].coins = 7;
    declareAction(g, 'p0', 'coup', 'p1');
    autoResolve(g);
    expect(alive(g, 'p1')).toBe(1);
  });

  it('keeps the current hand when idle in exchange', () => {
    const g = startedGame([['ambassador', 'captain'], ['duke', 'contessa']], ['assassin', 'duke']);
    declareAction(g, 'p0', 'exchange');
    pass(g, 'p1');
    expect(g.phase).toBe('exchange');
    autoResolve(g);
    expect(g.players[0].influences.map(i => i.role)).toEqual(['ambassador', 'captain']);
    expect(g.phase).toBe('action');
  });
});

describe('getActiveActor & timeouts', () => {
  it('points to the current player on a turn and the first pending responder', () => {
    const g = startedGame([['duke', 'captain'], ['duke', 'contessa'], ['duke', 'contessa']]);
    expect(getActiveActor(g)).toBe('p0');
    declareAction(g, 'p0', 'tax');
    expect(getActiveActor(g)).toBe('p1');
    pass(g, 'p1');
    expect(getActiveActor(g)).toBe('p2');
  });

  it('has no deadline phase for lobby / game over', () => {
    expect(phaseTimeoutMs('lobby')).toBeNull();
    expect(phaseTimeoutMs('game_over')).toBeNull();
    expect(phaseTimeoutMs('action')).toBeGreaterThan(0);
    expect(phaseTimeoutMs('action_response')).toBeGreaterThan(0);
  });
});

describe('client state privacy', () => {
  it('hides opponents’ hidden cards but shows your own', () => {
    const g = startedGame([['duke', 'captain'], ['assassin', 'contessa']]);
    const view = getClientState(g, 'p0');
    expect(view.myInfluences.map(i => i.role)).toEqual(['duke', 'captain']);
    const opponent = view.players.find(p => p.id === 'p1')!;
    expect(opponent).not.toHaveProperty('influences');
    expect(opponent.influenceCount).toBe(2);
    expect(opponent.revealedInfluences).toEqual([]);
  });

  it('exposes a revealed card to everyone', () => {
    const g = startedGame([['duke', 'captain'], ['assassin', 'contessa']]);
    g.players[1].influences[0].revealed = true;
    const view = getClientState(g, 'p0');
    const opponent = view.players.find(p => p.id === 'p1')!;
    expect(opponent.revealedInfluences).toEqual(['assassin']);
    expect(opponent.influenceCount).toBe(1);
  });
});

describe('serialization', () => {
  it('round-trips the respondedPlayers set', () => {
    const g = startedGame([['duke', 'captain'], ['duke', 'contessa'], ['duke', 'contessa']]);
    declareAction(g, 'p0', 'tax');
    pass(g, 'p1');
    const restored = deserializeGame(serializeGame(g));
    expect(restored.respondedPlayers).toBeInstanceOf(Set);
    expect(restored.respondedPlayers.has('p1')).toBe(true);
    expect(restored.phase).toBe('action_response');
  });
});

describe('rematch', () => {
  it('returns a finished game to the lobby', () => {
    const g = startedGame([['duke', 'captain'], ['contessa']]);
    g.players[0].coins = 7;
    declareAction(g, 'p0', 'coup', 'p1');
    loseInfluence(g, 'p1', 0);
    expect(g.phase).toBe('game_over');
    expect(resetGame(g, g.hostId)).toBe(true);
    expect(g.phase).toBe('lobby');
    expect(g.winner).toBeNull();
    expect(g.players.every(p => p.influences.length === 0)).toBe(true);
  });
});
