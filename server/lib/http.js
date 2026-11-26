export const error = (status, message) => Object.assign(new Error(message), { status });
export const take = (result) => {
  if (!result.rowCount) throw error(404, 'Запись не найдена');
  return result.rows[0];
};
