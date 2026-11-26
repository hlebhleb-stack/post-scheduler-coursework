import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import api from './routes/api.js';
import { errorHandler } from './middleware/errors.js';
import { db } from './db.js';
import { runWorker } from './worker.js';
const app = express();
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { imgSrc: ["'self'", 'blob:'], mediaSrc: ["'self'", 'blob:'] },
    },
  }),
);
if (process.env.CLIENT_ORIGIN) app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '96kb' }));
app.use('/api', api);
app.use(express.static(fileURLToPath(new URL('../dist', import.meta.url))));
app.get('/{*path}', (req, res) =>
  res.sendFile(fileURLToPath(new URL('../dist/index.html', import.meta.url))),
);
app.use(errorHandler);
const server = app.listen(process.env.PORT || 3000, () => console.log('API запущен'));
const queueController = new AbortController();
const queue =
  process.env.EMBEDDED_WORKER === '0'
    ? Promise.resolve()
    : runWorker({ signal: queueController.signal });
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    queueController.abort();
    server.close(async () => {
      await queue;
      await db.end();
    });
  });
