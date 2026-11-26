import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { db, transaction } from '../db.js';
import { encrypt, verifyChannel } from '../providers.js';

// Запускается явно, а не при деплое. Пароли передаются окружением и не печатаются.
const password = z.string().min(8).max(72).refine(value=>Buffer.byteLength(value)<=72);
const settings = z.object({
  SEED_USER_EMAIL:z.email().default('student@coursework.local'),
  SEED_ADMIN_EMAIL:z.email().default('admin@coursework.local'),
  SEED_USER_PASSWORD:password,
  SEED_ADMIN_PASSWORD:password,
  SEED_TELEGRAM_DESTINATION:z.string().optional(),
  SEED_TELEGRAM_TOKEN:z.string().optional(),
}).refine(value=>value.SEED_USER_EMAIL!==value.SEED_ADMIN_EMAIL);

export async function seedDemo(input) {
  const config=settings.parse(input);
  if (Boolean(config.SEED_TELEGRAM_TOKEN)!==Boolean(config.SEED_TELEGRAM_DESTINATION)) throw new Error('Для канала нужны SEED_TELEGRAM_DESTINATION и SEED_TELEGRAM_TOKEN вместе');
  // Неподтверждённые или выдуманные каналы в рабочее приложение не добавляются.
  const destination=config.SEED_TELEGRAM_TOKEN ? await verifyChannel('telegram',config.SEED_TELEGRAM_DESTINATION,config.SEED_TELEGRAM_TOKEN) : null;
  const hashes=await Promise.all([config.SEED_USER_PASSWORD,config.SEED_ADMIN_PASSWORD].map(value=>bcrypt.hash(value,12)));
  const fixture=await readFile(new URL('../../postman/fixtures/example.txt',import.meta.url));
  return transaction(async client=>{
    const users=[];
    for (const [index,role] of ['user','admin'].entries()) {
      const email=role==='user'?config.SEED_USER_EMAIL:config.SEED_ADMIN_EMAIL;
      const {rows:[user]}=await client.query(`INSERT INTO users(email,password_hash,role) VALUES ($1,$2,$3)
        ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,role=EXCLUDED.role RETURNING id,email,role`,[email,hashes[index],role]);
      users.push(user);
    }
    const owner=users[0].id;
    // Повторный запуск обновляет учётные данные, но не создаёт копии примеров.
    await client.query(`INSERT INTO attachments(user_id,name,mime,kind,content,size,position)
      SELECT $1,'Пример для защиты.txt','text/plain','document',$2,$3,0
      WHERE NOT EXISTS (SELECT 1 FROM attachments WHERE user_id=$1 AND post_id IS NULL AND name='Пример для защиты.txt')`,[owner,fixture,fixture.length]);
    if (destination) {
      const {rows:[channel]}=await client.query(`INSERT INTO channels(user_id,name,platform,destination,credential) VALUES ($1,'Учебный Telegram','telegram',$2,$3)
        ON CONFLICT(user_id,platform,destination) DO UPDATE SET credential=EXCLUDED.credential RETURNING id`,[owner,destination,encrypt(config.SEED_TELEGRAM_TOKEN)]);
      await client.query(`INSERT INTO posts(user_id,channel_id,body,scheduled_at,status)
        SELECT $1,$2,'Пример черновика для защиты',now()+interval '1 day','draft'
        WHERE NOT EXISTS (SELECT 1 FROM posts WHERE user_id=$1 AND channel_id=$2 AND body='Пример черновика для защиты')`,[owner,channel.id]);
    }
    return users.map(({email,role})=>({email,role}));
  });
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {console.log('Демонстрационные аккаунты готовы:',await seedDemo(process.env));}
  catch {console.error('Seed не выполнен. Проверьте пароли (8–72 байта), разные email, соединение БД и доступ к Telegram при его указании.');process.exitCode=1;}
  finally {await db.end();}
}
