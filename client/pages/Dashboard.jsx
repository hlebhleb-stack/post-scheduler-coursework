import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import {Plus,ArrowUpRight,Check,Clock,CalendarDays,AlertCircle} from 'lucide-react';
import {useData} from '../hooks/useData.js';
import {Feedback} from '../components/Common.jsx';
import {time,platforms} from '../config.js';

const dateLabel = date => new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
const months = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
function Activity({daily}) {
  const [selected,setSelected] = useState(null);
  const first = daily.findIndex(day => new Date(day.date+'T12:00:00').getDay() === 1);
  const days = daily.slice(first);
  const peak = Math.max(1,...days.map(day=>day.count));
  const weeks = Array.from({length:Math.ceil(days.length/7)},(_,index)=>days.slice(index*7,index*7+7));
  return <section className="activitySection">
    <div className="sectionHeading"><div><h2>Активность публикаций</h2><p>Подтверждённые отправки за последние 12 месяцев · Минск</p></div><span className="muted">{days.reduce((sum,day)=>sum+day.count,0)} отправлено</span></div>
    <div className="heatScroll"><div className="heatCalendar"><div className="weekLabels"><span>Пн</span><span>Ср</span><span>Пт</span><span>Вс</span></div><div className="heatWeeks">{weeks.map((week,index) => {
      const month = new Date(week[0].date+'T12:00:00').getMonth();
      const previous = index ? new Date(weeks[index-1][0].date+'T12:00:00').getMonth() : -1;
      return <div className="heatWeek" key={week[0].date}><span className="heatMonth">{month !== previous && (index > 0 || Number(week[0].date.slice(-2)) <= 10) ? months[month] : ''}</span>{week.map(day => <button type="button" key={day.date} className={'heatCell level'+(day.count ? Math.min(4,Math.ceil(day.count/peak*4)) : 0)+(selected?.date === day.date ? ' selected' : '')} title={dateLabel(day.date)+' · '+day.count+' публикаций'} aria-label={dateLabel(day.date)+', отправлено '+day.count} aria-pressed={selected?.date===day.date} onClick={()=>setSelected(day)}/>)}</div>;
    })}</div></div></div>
    <div className="chartFooter"><span>{selected ? dateLabel(selected.date)+' · отправлено '+selected.count : 'Выберите день, чтобы посмотреть число отправок'}</span><div className="heatLegend"><span>Меньше</span>{[0,1,2,3,4].map(level=><i key={level} className={'level'+level}/>)}<span>Больше</span></div></div>
  </section>;
}
function Frequency({daily}) {
  const [period,setPeriod] = useState(30);
  const [selected,setSelected] = useState(null);
  const days = daily.slice(-period);
  const peak = Math.max(1,...days.map(day=>day.count));
  return <section className="frequencySection"><div className="sectionHeading"><div><h2>Частота публикаций</h2><p>Количество отправленных публикаций по дням</p></div><div className="periodControl" role="group" aria-label="Период графика">{[7,30,90].map(value=><button type="button" key={value} aria-pressed={period===value} onClick={()=>{setPeriod(value);setSelected(null);}}>{value} дней</button>)}</div></div>
    <div className="frequencyPanel"><div className="frequencySummary"><span>За период <strong>{days.reduce((sum,day)=>sum+day.count,0)}</strong></span><span className="muted">{selected ? dateLabel(selected.date)+' · '+selected.count : 'Максимум за день — '+Math.max(...days.map(day=>day.count))}</span></div>
      <div className="frequencyGrid" style={{'--columns':days.length,'--subcolumns':period===7?12:period===30?3:1}}>{days.map(day=><button className="pixelColumn" type="button" key={day.date} aria-label={dateLabel(day.date)+', отправлено '+day.count} onClick={()=>setSelected(day)} title={dateLabel(day.date)+' · '+day.count}>{Array.from({length:16},(_,index)=><i key={index} className={16-index<=(day.count ? Math.max(1,Math.round(day.count/peak*16)) : 0) ? 'filled' : ''}>{Array.from({length:period===7?12:period===30?3:1},(_,cell)=><span key={cell}/>)}</i>)}</button>)}</div>
      <div className="frequencyAxis"><span>{dateLabel(days[0].date)}</span><span>{dateLabel(days.at(-1).date)}</span></div>
      {!days.some(day=>day.count) && <p className="chartNote">В этом периоде ещё нет подтверждённых отправок</p>}
    </div>
  </section>;
}
export default function Dashboard() {
  const result=useData('analytics');
  if (!result.data) return <section><header className="pageHeading"><h1>Обзор</h1></header><Feedback result={result}/></section>;
  const {daily,counts,channels,upcoming} = result.data;
  const lastWeek=daily.slice(-7).reduce((sum,day)=>sum+day.count,0);
  const previousWeek=daily.slice(-14,-7).reduce((sum,day)=>sum+day.count,0);
  const metrics=[['За 7 дней',lastWeek,CalendarDays,(lastWeek-previousWeek>=0?'+':'')+(lastWeek-previousWeek)+' к прошлой неделе'],['Опубликовано',counts.published,Check,'За всё время'],['В расписании',counts.scheduled,Clock,'Ожидают отправки'],['Требуют проверки',counts.failed,AlertCircle,'Ошибки и неизвестный результат']];
  const peak=Math.max(1,...channels.map(channel=>channel.published));
  return <section className="dashboard"><header className="pageHeading"><div><h1>Обзор</h1><p className="pageCount">Публикации, расписание и активность каналов</p></div><Link className="primary" to="/posts/new"><Plus size={17}/>Создать публикацию</Link></header>
    <div className="metrics">{metrics.map(([label,value,Icon,note])=><div className="metric" key={label}><span className="metricLabel"><Icon size={15}/>{label}</span><strong>{value}</strong><span className="metricNote">{note}</span></div>)}</div>
    <Frequency daily={daily}/><Activity daily={daily}/>
    <div className="dashboardBottom"><section><div className="sectionHeading"><div><h2>Каналы</h2><p>Опубликовано за всё время</p></div><Link className="iconLink" to="/channels" aria-label="Открыть каналы"><ArrowUpRight size={19}/></Link></div>
      <div className="channelStats">{channels.length ? channels.map(channel=><Link to={'/channels/'+channel.id} key={channel.id}><div className="channelStatLabel"><span>{channel.name}<small>{platforms[channel.platform]}</small></span><strong>{channel.published}</strong></div><div className="channelTrack"><i style={{width:(channel.published/peak*100)+'%'}}/></div></Link>) : <p className="muted">Подключите канал, чтобы начать публиковать</p>}</div>
    </section><section><div className="sectionHeading"><div><h2>Ближайшие публикации</h2><p>Очередь отправки</p></div><Link className="iconLink" to="/posts" aria-label="Открыть публикации"><ArrowUpRight size={19}/></Link></div><div className="upcomingList">{upcoming.length ? upcoming.map(post=><Link to={'/posts/'+post.id} key={post.id}><span><strong>{post.body.slice(0,60)||post.attachment_name||'Вложение'}</strong><small>{post.channel_name}</small></span><time dateTime={post.scheduled_at}>{time(post.scheduled_at)}</time></Link>) : <p className="muted">Запланированных публикаций пока нет</p>}</div></section></div>
  </section>;
}
