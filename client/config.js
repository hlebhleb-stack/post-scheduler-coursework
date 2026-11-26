import { CalendarDays, Hash } from 'lucide-react';
export const sections = {
  posts: { title: 'Публикации', action: 'Создать публикацию', search: 'Поиск по тексту', empty: 'Публикаций пока нет', icon: CalendarDays },
  channels: { title: 'Каналы', action: 'Подключить канал', search: 'Поиск по названию', empty: 'Каналы пока не подключены', icon: Hash },
};
export const labels = {
  draft: 'Черновик', scheduled: 'В расписании', publishing: 'Отправляется',
  published: 'Опубликовано', failed: 'Ошибка отправки', uncertain: 'Проверить вручную',
};
export const platforms = { telegram: 'Telegram', youtube: 'YouTube' };
export const time = date => new Date(date).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
export const clock = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
export const day = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

