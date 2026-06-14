import { useEffect, useRef } from 'react';
import type { ClientState } from '../lib/types';

const BASE_TITLE = 'Ruse';

type AudioWindow = typeof window & { webkitAudioContext?: typeof AudioContext };

function playChime(ctx: AudioContext) {
  // Two short ascending notes — a gentle "your move" cue, no asset needed.
  const now = ctx.currentTime;
  [660, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.16;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.16);
  });
}

/**
 * Pulls the player's attention back when the game is waiting on them —
 * especially if they've tabbed away. Fires a sound, a vibration, a system
 * notification (when hidden), and a flashing tab title on the rising edge of
 * "it's my move". Audio and notification permission are unlocked on the first
 * user gesture, since browsers require that.
 */
export function useTurnAlert(state: ClientState | null) {
  const audioRef = useRef<AudioContext | null>(null);
  const wasActionNeeded = useRef<boolean | null>(null);
  const titleTimer = useRef<ReturnType<typeof setInterval>>(undefined);

  const actionNeeded = !!state && (
    (state.phase === 'action' && state.currentPlayerId === state.myId) ||
    state.canChallenge ||
    state.canBlock ||
    state.mustLoseInfluence ||
    state.exchangeOptions != null
  );

  // Unlock audio + request notification permission on first interaction.
  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current) {
        const Ctx = (window as AudioWindow).AudioContext ?? (window as AudioWindow).webkitAudioContext;
        if (Ctx) audioRef.current = new Ctx();
      }
      void audioRef.current?.resume?.();
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Fire the alert on the transition into "my move".
  useEffect(() => {
    if (wasActionNeeded.current === null) {
      wasActionNeeded.current = actionNeeded;
      return;
    }
    if (actionNeeded && !wasActionNeeded.current) {
      const ctx = audioRef.current;
      if (ctx && ctx.state !== 'closed') {
        void ctx.resume?.();
        try { playChime(ctx); } catch { /* ignore */ }
      }
      if ('vibrate' in navigator) navigator.vibrate?.([120, 60, 120]);
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Ruse', { body: "It's your move", tag: 'ruse-turn' });
        } catch { /* ignore */ }
      }
    }
    wasActionNeeded.current = actionNeeded;
  }, [actionNeeded]);

  // Flash the tab title while the player is away and it's their move.
  useEffect(() => {
    const stopFlash = () => {
      clearInterval(titleTimer.current);
      titleTimer.current = undefined;
      document.title = BASE_TITLE;
    };

    const startFlash = () => {
      if (titleTimer.current) return;
      let on = false;
      titleTimer.current = setInterval(() => {
        on = !on;
        document.title = on ? '🔔 Your move!' : BASE_TITLE;
      }, 1000);
    };

    const sync = () => {
      if (actionNeeded && document.hidden) startFlash();
      else stopFlash();
    };

    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      stopFlash();
    };
  }, [actionNeeded]);
}
