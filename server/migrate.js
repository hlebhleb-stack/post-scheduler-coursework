import { readFile } from 'node:fs/promises';
import { db, transaction } from './db.js';

try {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(2705329)');
    await client.query(schema);
  });
  console.log('Схема PostgreSQL готова');
} finally {
  await db.end();
}
