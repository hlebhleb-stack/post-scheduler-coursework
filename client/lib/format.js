export function localDateTime(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export const fileSize = (value) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(Number(value) / 1048576) +
  ' МБ';
