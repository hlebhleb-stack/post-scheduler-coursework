import React from 'react';
import {NavLink,Route,Routes,Navigate,useLocation} from 'react-router-dom';
import {LogOut,Shield,LayoutDashboard,ChevronRight,Images} from 'lucide-react';
import {sections} from '../config.js';
import {useAuth} from '../context/AuthContext.jsx';
import List from '../pages/List.jsx';
import Detail from '../pages/Detail.jsx';
import Editor from '../pages/Editor.jsx';
import Admin from '../pages/Admin.jsx';
import Dashboard from '../pages/Dashboard.jsx';
import MediaLibrary from '../pages/MediaLibrary.jsx';
export default function Layout() {
  const { session,logout } = useAuth();
  const location = useLocation();
  const title = location.pathname.startsWith('/media') ? 'Медиатека' : location.pathname.startsWith('/overview') ? 'Обзор' : location.pathname.startsWith('/admin') ? 'Администрирование' : sections[location.pathname.split('/')[1]]?.title || 'Обзор';
  return <div className="shell"><aside className="sidebar">
    <nav aria-label="Разделы"><NavLink to="/overview"><LayoutDashboard size={18}/><span>Обзор</span></NavLink>{Object.entries(sections).map(([key, {title, icon: Icon}]) =>
      <NavLink key={key} to={'/' + key}><Icon size={18}/><span>{title}</span></NavLink>)}<NavLink to="/media"><Images size={18}/><span>Медиатека</span></NavLink>{session.role === 'admin' && <NavLink to="/admin"><Shield size={18}/><span>Администрирование</span></NavLink>}</nav>
    <div className="identity"><span title={session.email}>{session.email}</span><button type="button" className="quiet logout" onClick={logout} aria-label="Выйти"><LogOut size={17} aria-hidden="true"/><span>Выйти</span></button></div>
  </aside><div className="mainArea"><div className="workspaceBar"><span>Планировщик</span><ChevronRight size={14}/><strong>{title}</strong></div><main className="workspace"><Routes>
    <Route path="media" element={<MediaLibrary/>}/>
    <Route path="overview" element={<Dashboard/>}/>
    {Object.keys(sections).map(kind => <React.Fragment key={kind}>
      <Route path={kind} element={<List key={kind} kind={kind}/>}/>
      <Route path={kind + '/new'} element={<Editor key={kind + '/new'} kind={kind} create/>}/>
      <Route path={kind + '/:id'} element={<Detail key={kind + '/detail'} kind={kind}/>}/>
      <Route path={kind + '/:id/edit'} element={<Editor key={kind + '/edit'} kind={kind}/>}/>
    </React.Fragment>)}
    <Route path="admin" element={session.role === 'admin' ? <Admin/> : <Navigate to="/overview" replace/>}/>
    <Route path="*" element={<Navigate to="/overview" replace/>}/>
  </Routes></main></div></div>;
}

