import { error } from '../lib/http.js';
export const fields = schema => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(error(400, 'Проверь заполнение полей'));
  req.input = result.data;
  next();
};
