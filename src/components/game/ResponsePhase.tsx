import { motion } from 'framer-motion';
import type { ClientState, ClientMessage, Role, ActionType } from '../../lib/types';
import { ROLE_NAMES, ACTION_CONFIG } from '../../lib/types';
import { Button } from '../ui/Button';

interface ResponsePhaseProps {
  state: ClientState;
  send: (msg: ClientMessage) => void;
}

function actionPhrase(type: ActionType, targetName?: string): string {
  switch (type) {
    case 'income': return 'take income';
    case 'foreign_aid': return 'take foreign aid';
    case 'tax': return 'collect tax';
    case 'steal': return `steal from ${targetName}`;
    case 'assassinate': return `assassinate ${targetName}`;
    case 'exchange': return 'exchange influence';
    case 'coup': return `launch a coup on ${targetName}`;
  }
}

function roleList(roles: Role[]): string {
  return roles.map(r => ROLE_NAMES[r]).join(' or ');
}

export function ResponsePhase({ state, send }: ResponsePhaseProps) {
  const { pendingAction, pendingBlock, canChallenge, canBlock, blockableBy, phase, players } = state;
  const actor = players.find(p => p.id === pendingAction?.playerId);
  const target = players.find(p => p.id === pendingAction?.targetId);
  const blocker = players.find(p => p.id === pendingBlock?.blockerId);

  const type = pendingAction?.type ?? 'income';
  const phrase = actionPhrase(type, target?.name);
  const blockers = ACTION_CONFIG[type].blockableBy;

  const description =
    phase === 'action_response'
      ? `${actor?.name} claims ${ROLE_NAMES[pendingAction?.claimedRole as Role]} to ${phrase}`
      : phase === 'block'
        ? type === 'foreign_aid'
          ? `${actor?.name} wants to take foreign aid — anyone may block as ${roleList(blockers)}`
          : `${actor?.name} wants to ${phrase} — ${target?.name} may block as ${roleList(blockers)}`
        : `${blocker?.name} claims ${ROLE_NAMES[pendingBlock?.claimedRole as Role]} to block`;

  const waitingFor = players.filter(p => {
    if (!p.isAlive) return false;
    if (phase === 'action_response' && p.id === pendingAction?.playerId) return false;
    if (phase === 'block_response' && p.id === pendingBlock?.blockerId) return false;
    if (phase === 'block' && pendingAction?.type !== 'foreign_aid' && p.id !== pendingAction?.targetId) return false;
    if (phase === 'block' && p.id === pendingAction?.playerId) return false;
    return !p.hasResponded;
  });

  const canRespond = canChallenge || canBlock;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="text-center">
        <p className="text-parchment/80 text-sm">{description}</p>
        {waitingFor.length > 0 && (
          <p className="text-parchment/40 text-xs mt-1">
            Waiting for: {waitingFor.map(p => p.name).join(', ')}
          </p>
        )}
      </div>

      {canRespond && (
        <div className="flex flex-col gap-2">
          {canChallenge && (
            <Button variant="danger" onClick={() => send({ type: 'challenge' })} className="w-full">
              Challenge
            </Button>
          )}
          {canBlock && blockableBy.map((role) => (
            <Button
              key={role}
              variant="secondary"
              onClick={() => send({ type: 'block', role })}
              className="w-full"
            >
              Block as {ROLE_NAMES[role]}
            </Button>
          ))}
          <Button variant="ghost" onClick={() => send({ type: 'pass' })} className="w-full">
            {canBlock && !canChallenge ? 'Allow' : 'Pass'}
          </Button>
        </div>
      )}

      {!canRespond && (
        <p className="text-parchment/40 text-xs text-center">Waiting for others to respond...</p>
      )}
    </motion.div>
  );
}
