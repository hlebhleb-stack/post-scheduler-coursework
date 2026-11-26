import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import {Plus,Search,X,ArrowRight} from 'lucide-react';
import {sections,labels,platforms,clock,day} from '../config.js';
import {useData} from '../hooks/useData.js';
import {Status,Feedback} from '../components/Common.jsx';
export default function List({ kind }) {
  const result = useData(kind);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const meta = sections[kind];
  const rows = result.data?.filter(row => (
    (row.name || row.body).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    && (!status || row.status === status)
  ));
  return <section aria-label={meta.title}>
    <h1 className="visuallyHidden">{meta.title}</h1>
    <header className="pageHeading compactHeading"><p className="pageCount">{rows ? `${rows.length} ${kind === 'posts' ? 'в списке' : kind === 'channels' ? 'подключено' : 'в списке'}` : 'Загрузка…'}</p>
      <Link className="primary" to={'/' + kind + '/new'}><Plus size={18} aria-hidden="true"/> {meta.action}</Link></header>
    <div className="listPanel">
      <div className="filters"><div className="searchField"><Search size={17} aria-hidden="true"/>
        <input aria-label={meta.search} placeholder={meta.search} value={search} onChange={event => setSearch(event.target.value)}/>
        {search && <button type="button" onClick={() => setSearch('')} aria-label="Очистить поиск"><X size={16} aria-hidden="true"/></button>}
      </div>
        {kind === 'posts' && <select aria-label="Статус" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">Все статусы</option>{Object.entries(labels).map(([key,label]) => <option value={key} key={key}>{label}</option>)}
        </select>}</div>
      {!rows ? <div className="empty"><Feedback result={result}/></div> : rows.length ? <>
        <div className="tableHead"><span>{kind === 'posts' ? 'Публикация' : 'Название'}</span><span>{kind === 'posts' ? 'Дата и время' : kind === 'channels' ? 'Платформа' : 'Текст'}</span><span>{kind === 'posts' ? 'Статус' : ''}</span></div>
        <ul className="rows">{rows.map(row => <li key={row.id}><Link to={'/' + kind + '/' + row.id}>
          <span className="rowTitle"><strong>{row.name || row.body.slice(0, 90) || row.attachments?.[0]?.name || 'Вложение'}</strong>{row.channel_name && <small>{row.channel_name}</small>}</span>
          <span className="rowMeta">{row.scheduled_at ? <time dateTime={row.scheduled_at}>{day.format(new Date(row.scheduled_at))}<small>{clock.format(new Date(row.scheduled_at))}</small></time>
            : row.platform ? platforms[row.platform] : row.body.slice(0,55)}</span>
          <span className="rowEnd">{row.status && <Status status={row.status}/>}<ArrowRight size={16} aria-hidden="true"/></span></Link></li>)}</ul>
      </> : <div className="empty"><span className="emptyIcon"><meta.icon size={28} strokeWidth={1.4}/></span><strong>{search || status ? 'Совпадений нет' : meta.empty}</strong>
        {(search || status) && <button className="quiet" type="button" onClick={() => { setSearch(''); setStatus(''); }}>Сбросить фильтры</button>}</div>}
    </div>
  </section>;
}

