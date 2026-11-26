import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import newman from 'newman';
import {checkSecurity} from './security-api.mjs';
import {checkSeed} from './seed-api.mjs';
import {checkWorker} from './worker-api.mjs';
import { checkAdmin } from './admin-api.mjs';
import { checkAnalytics } from './analytics-api.mjs';
import {checkYouTube} from './youtube-api.mjs';
import { checkMediaLibrary } from './media-library-api.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.TEST_DATABASE_URL) throw new Error('Задай TEST_DATABASE_URL отдельной тестовой PostgreSQL');
const port = process.env.API_TEST_PORT || '3211';
const base = 'http://127.0.0.1:' + port;
const env = {
  ...process.env, DATABASE_URL:process.env.TEST_DATABASE_URL,
  JWT_SECRET:randomBytes(32).toString('hex'), CHANNEL_KEY:randomBytes(32).toString('base64'),
  EMBEDDED_WORKER:'0', PORT:port,
  YOUTUBE_CLIENT_ID:'test-client',YOUTUBE_CLIENT_SECRET:'test-secret',YOUTUBE_REDIRECT_URI:base+'/api/youtube/callback',
};
const migration = spawnSync(process.execPath, ['server/migrate.js'], { cwd:root, env, stdio:'inherit' });
if (migration.status !== 0) process.exit(1);
const server = spawn(process.execPath, ['--import','./test/support/telegram-postman-stub.mjs','server/app.js'], { cwd:root, env, stdio:['ignore','pipe','pipe'] });
let logs = '';
server.stdout.on('data', data => { logs += data; });
server.stderr.on('data', data => { logs += data; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw new Error('Тестовый сервер остановился\n' + logs);
    if (logs.includes('API запущен')) {
      try { const response = await fetch(base + '/api/health'); ready = response.ok; } catch {}
    }
    if (ready) break;
    await delay(250);
  }
  if (!ready) throw new Error('Тестовый сервер не запустился\n' + logs);
  const summary = await new Promise((resolve, reject) => newman.run({
    collection:root + 'postman/coursework.postman_collection.json',
    environment:root + 'postman/local.postman_environment.json',
    envVar:[{key:'base_url',value:base},{key:'telegram_channel',value:'@postman_test'},{key:'telegram_bot_token',value:'123:postman-test'}],
    workingDir:root, timeoutRequest:10000, reporters:['cli'],
  }, (error, result) => error ? reject(error) : resolve(result)));
  if (summary.run.failures.length) process.exitCode = 1;
  else {
    await checkAdmin(base, env.DATABASE_URL);
    await checkAnalytics(base, env.DATABASE_URL, env.JWT_SECRET);
    await checkMediaLibrary(base, env.DATABASE_URL, env.JWT_SECRET);
    await checkYouTube(base, env.DATABASE_URL, env.JWT_SECRET);
    await checkSecurity(base,env.DATABASE_URL,env.JWT_SECRET);
    await checkWorker(root,env);
    await checkSeed(root,env);
  }
} finally {
  server.kill('SIGTERM');
  await new Promise(resolve => {
    if (server.exitCode !== null) return resolve();
    const timer = setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 5000);
    server.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}
