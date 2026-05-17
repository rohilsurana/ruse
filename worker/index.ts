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

    if (url.pathname === '/api/game/join' && request.method === 'POST') {
      const body = await request.json() as { gameCode?: string };
      const gameCode = body.gameCode || generateGameCode();
      const id = env.GAME_ROOM.idFromName(gameCode);
      const room = env.GAME_ROOM.get(id);
      const roomUrl = new URL(request.url);
      roomUrl.searchParams.set('code', gameCode);
      return room.fetch(new Request(roomUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }));
    }

    if (url.pathname === '/api/game/action' && request.method === 'POST') {
      const body = await request.json() as { gameCode?: string };
      const gameCode = body.gameCode;
      if (!gameCode) return Response.json({ error: 'Missing gameCode' }, { status: 400 });
      const id = env.GAME_ROOM.idFromName(gameCode);
      const room = env.GAME_ROOM.get(id);
      return room.fetch(new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }));
    }

    if (url.pathname === '/api/game/state' && request.method === 'GET') {
      const gameCode = url.searchParams.get('code');
      if (!gameCode) return Response.json({ error: 'Missing code' }, { status: 400 });
      const id = env.GAME_ROOM.idFromName(gameCode);
      const room = env.GAME_ROOM.get(id);
      return room.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
