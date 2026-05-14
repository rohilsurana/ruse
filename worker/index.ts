export { GameRoom } from './game-room';

interface Env {
  GAME_ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
}

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      const upgrade = request.headers.get('Upgrade');
      if (upgrade !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }
      const gameCode = url.searchParams.get('code') || generateGameCode();
      const id = env.GAME_ROOM.idFromName(gameCode);
      const room = env.GAME_ROOM.get(id);
      const roomUrl = new URL(request.url);
      roomUrl.searchParams.set('code', gameCode);
      return room.fetch(new Request(roomUrl.toString(), request));
    }

    return env.ASSETS.fetch(request);
  },
};
