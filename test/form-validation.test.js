import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { fields } from '../server/middleware/validation.js';

test('Ошибки валидации привязаны к полям и не содержат введённых секретов', () => {
  const schema = z.object({
    name: z.string().trim().min(1).max(80),
    email: z.email(),
    token: z.string().max(4),
  });
  const req = { body: { name: '', email: 'wrong-email', token: 'secret-value' } };
  let error;
  fields(schema)(req, {}, (err) => {
    error = err;
  });
  assert.equal(error.status, 400);
  assert.equal(error.fields.name, 'Заполните это поле');
  assert.equal(error.fields.email, 'Введите корректный адрес электронной почты');
  assert.equal(error.fields.token, 'Не более 4 символов');
  assert(!JSON.stringify(error.fields).includes('secret-value'));
});
test('Корректные значения проходят без ошибок', () => {
  const req = { body: { name: ' Название ' } };
  let called = false;
  fields(z.object({ name: z.string().trim().min(1) }))(req, {}, (err) => {
    assert.equal(err, undefined);
    called = true;
  });
  assert(called);
  assert.equal(req.input.name, 'Название');
});
