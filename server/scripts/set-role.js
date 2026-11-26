import { db } from '../db.js';
const [email, role] = process.argv.slice(2);
if (!email || !['user', 'admin'].includes(role)) {
  console.error('Использование: node --env-file=.env server/scripts/set-role.js email admin|user');
  process.exit(1);
}
try {
  const result = await db.query('UPDATE users SET role=$1 WHERE email=$2 RETURNING email,role', [
    role,
    email.trim().toLowerCase(),
  ]);
  if (!result.rowCount) {
    console.error('Сначала зарегистрируйте этот аккаунт');
    process.exitCode = 1;
  } else console.log(result.rows[0]);
} finally {
  await db.end();
}
