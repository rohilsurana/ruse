import { useEffect, useRef, useState } from 'react';
import type { ClientState, ClientMessage, ServerMessage } from '../lib/types';

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_BASE = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}/ws`;

function sendMessage(ws: WebSocket | null, msg: ClientMessage) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function useWebSocket(active: boolean, gameCode: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [gameState, setGameState] = useState<ClientState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!active) return;

    function connect() {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const url = gameCode ? `${WS_BASE}?code=${gameCode}` : WS_BASE;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);

        const playerName = sessionStorage.getItem('ruse_player_name');
        if (playerName) {
          sendMessage(ws, { type: 'join', name: playerName });
        }
      };

      ws.onmessage = (event) => {
        const msg: ServerMessage = JSON.parse(event.data);
        switch (msg.type) {
          case 'state':
            setGameState(msg.state);
            setError(null);
            if (msg.state.gameCode) {
              sessionStorage.setItem('ruse_game_code', msg.state.gameCode);
            }
            break;
          case 'error':
            setError(msg.message);
            setTimeout(() => setError(null), 4000);
            break;
          case 'joined':
            sessionStorage.setItem('ruse_player_id', msg.playerId);
            sessionStorage.setItem('ruse_game_code', msg.gameCode);
            break;
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (active) {
          reconnectTimer.current = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [active, gameCode]);

  const send = (msg: ClientMessage) => sendMessage(wsRef.current, msg);

  return { gameState, error, connected, send };
}
