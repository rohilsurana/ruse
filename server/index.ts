import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { handleJoin, handleAction, handleGetState } from './http-handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

app.post('/api/game/join', handleJoin);
app.post('/api/game/action', handleAction);
app.get('/api/game/state', handleGetState);

const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('{*path}', (_req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
