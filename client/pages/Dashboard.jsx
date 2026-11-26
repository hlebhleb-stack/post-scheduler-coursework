import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useData } from '../hooks/useData.js';
import { Feedback } from '../components/Common.jsx';

const dateLabel = (date) =>
  new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
function Activity({ daily }) {
  const [selected, setSelected] = useState(null);
  const first = daily.findIndex((day) => new Date(day.date + 'T12:00:00').getDay() === 1);
  const days = daily.slice(first);
  const peak = Math.max(1, ...days.map((day) => day.count));
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  );
  return (
    <section className="activitySection">
      <div className="sectionHeading">
        <div>
          <h2>Активность публикаций</h2>
          <p>Подтверждённые отправки за последние 12 месяцев</p>
        </div>
        <span className="muted">{days.reduce((sum, day) => sum + day.count, 0)} отправлено</span>
      </div>
      <div className="heatScroll">
        <div className="heatCalendar">
          <div className="weekLabels">
            <span>Пн</span>
            <span>Ср</span>
            <span>Пт</span>
            <span>Вс</span>
          </div>
          <div
            className="heatWeeks"
            style={{ gridTemplateColumns: `repeat(${weeks.length},minmax(0,1fr))` }}
          >
            {weeks.map((week, index) => {
              const month = new Date(week[0].date + 'T12:00:00').getMonth();
              const previous = index
                ? new Date(weeks[index - 1][0].date + 'T12:00:00').getMonth()
                : -1;
              return (
                <div className="heatWeek" key={week[0].date}>
                  <span className="heatMonth">
                    {month !== previous && (index > 0 || Number(week[0].date.slice(-2)) <= 10)
                      ? months[month]
                      : ''}
                  </span>
                  {week.map((day) => (
                    <button
                      type="button"
                      key={day.date}
                      className={
                        'heatCell level' +
                        (day.count ? Math.min(4, Math.ceil((day.count / peak) * 4)) : 0) +
                        (selected?.date === day.date ? ' selected' : '')
                      }
                      title={dateLabel(day.date) + ' · ' + day.count + ' публикаций'}
                      aria-label={dateLabel(day.date) + ', отправлено ' + day.count}
                      aria-pressed={selected?.date === day.date}
                      onClick={() => setSelected(day)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="chartFooter">
        <span>
          {selected
            ? dateLabel(selected.date) + ' · отправлено ' + selected.count
            : 'Выберите день, чтобы посмотреть число отправок'}
        </span>
        <div className="heatLegend">
          <span>Меньше</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} className={'level' + level} />
          ))}
          <span>Больше</span>
        </div>
      </div>
    </section>
  );
}
export default function Dashboard() {
  const result = useData('analytics');
  if (!result.data)
    return (
      <section>
        <header className="pageHeading">
          <h1>Обзор</h1>
        </header>
        <Feedback result={result} />
      </section>
    );
  const { daily, counts } = result.data;
  const lastWeek = daily.slice(-7).reduce((sum, day) => sum + day.count, 0);
  const metrics = [
    ['За 7 дней', lastWeek],
    ['Опубликовано', counts.published],
    ['В расписании', counts.scheduled],
    ['Требуют проверки', counts.failed],
  ];
  return (
    <section className="dashboard">
      <header className="pageHeading">
        <div>
          <h1>Обзор</h1>
          <p className="pageCount">Публикации, расписание и активность каналов</p>
        </div>
        <Link className="primary" to="/posts/new">
          <Plus size={17} />
          Создать публикацию
        </Link>
      </header>
      <div className="metrics">
        {metrics.map(([label, value]) => (
          <div className="metric" key={label}>
            <span className="metricLabel">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <Activity daily={daily} />
    </section>
  );
}
