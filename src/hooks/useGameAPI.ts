import { useEffect, useRef, useState, useCallback } from 'react';
import type { ClientState, ClientMessage } from '../lib/types';

const API_BASE = import.meta.env.VITE_API_URL || '/api/game';
const POLL_INTERVAL = 1500;

export function useGameAPI(active: boolean, gameCode: string | null) {
  const [gameState, setGameState] = useState<ClientState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const sessionRef = useRef<{ playerId: string; gameCode: string } | null>(null);
  const versionRef = useRef(0);

  const updateState = useCallback((state: ClientState) => {
    if (state.stateVersion >= versionRef.current) {
      versionRef.current = state.stateVersion;
      setGameState(state);
    }
  }, []);

  const clearSession = useCallback(() => {
    sessionRef.current = null;
    versionRef.current = 0;
    sessionStorage.removeItem('ruse_player_id');
    sessionStorage.removeItem('ruse_game_code');
  }, []);

  const pollState = useCallback(async (signal: AbortSignal) => {
    const session = sessionRef.current;
    if (!session) return;

    try {
      const res = await fetch(
        `${API_BASE}/state?code=${session.gameCode}&playerId=${session.playerId}`,
        { signal },
      );
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 404) {
          clearSession();
          setGameState(null);
          setConnected(false);
        }
        setError(data.error || 'Failed to fetch state');
        setTimeout(() => setError(null), 4000);
        return;
      }
      const data = await res.json();
      updateState(data.state);
      setConnected(true);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setConnected(false);
      }
    }
  }, [clearSession, updateState]);

  useEffect(() => {
    if (!active) return;

    const abort = new AbortController();

    const existingPlayerId = sessionStorage.getItem('ruse_player_id');
    const existingGameCode = sessionStorage.getItem('ruse_game_code');

    async function init() {
      if (existingPlayerId && existingGameCode) {
        sessionRef.current = { playerId: existingPlayerId, gameCode: existingGameCode };
        await pollState(abort.signal);
      } else {
        const playerName = sessionStorage.getItem('ruse_player_name');
        if (!playerName) return;

        try {
          const res = await fetch(`${API_BASE}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: playerName, gameCode: gameCode || undefined }),
            signal: abort.signal,
          });

          if (!res.ok) {
            const data = await res.json();
            setError(data.error || 'Failed to join');
            setTimeout(() => setError(null), 4000);
            return;
          }

          const data = await res.json();
          sessionRef.current = { playerId: data.playerId, gameCode: data.gameCode };
          sessionStorage.setItem('ruse_player_id', data.playerId);
          sessionStorage.setItem('ruse_game_code', data.gameCode);
          updateState(data.state);
          setConnected(true);
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            setError('Failed to connect');
            setTimeout(() => setError(null), 4000);
          }
        }
      }

      pollRef.current = setInterval(() => pollState(abort.signal), POLL_INTERVAL);
    }

    init();

    return () => {
      abort.abort();
      clearInterval(pollRef.current);
    };
  }, [active, gameCode, pollState, updateState]);

  const send = useCallback(async (msg: ClientMessage) => {
    const session = sessionRef.current;
    if (!session) return;

    try {
      const res = await fetch(`${API_BASE}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...msg, gameCode: session.gameCode, playerId: session.playerId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Action failed');
        setTimeout(() => setError(null), 4000);
        return;
      }

      updateState(data.state);
    } catch {
      setError('Network error');
      setTimeout(() => setError(null), 4000);
    }
  }, [updateState]);

  return { gameState, error, connected, send };
}
