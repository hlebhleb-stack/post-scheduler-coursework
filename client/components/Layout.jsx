import React from 'react';
import {NavLink,Route,Routes,Navigate} from 'react-router-dom';
import {LogOut,Shield} from 'lucide-react';
import {sections} from '../config.js';
import {useAuth} from '../context/AuthContext.jsx';
import List from '../pages/List.jsx';
import Detail from '../pages/Detail.jsx';
import Editor from '../pages/Editor.jsx';
import Admin from '../pages/Admin.jsx';
export default function Layout() {
  const { session,logout } = useAuth();
  return <div className="shell"><aside className="sidebar">
    <nav aria-label="Разделы">{Object.entries(sections).map(([key, {title, icon: Icon}]) =>
      <NavLink key={key} to={'/' + key}><Icon size={18}/>{title}</NavLink>)}{session.role === 'admin' && <NavLink to="/admin"><Shield size={18}/>Администрирование</NavLink>}</nav>
    <div className="identity"><span title={session.email}>{session.email}</span><button type="button" className="quiet logout" onClick={logout}><LogOut size={17} aria-hidden="true"/> Выйти</button></div>
  </aside><main className="workspace"><Routes>
    {Object.keys(sections).map(kind => <React.Fragment key={kind}>
      <Route path={kind} element={<List key={kind} kind={kind}/>}/>
      <Route path={kind + '/new'} element={<Editor key={kind + '/new'} kind={kind} create/>}/>
      <Route path={kind + '/:id'} element={<Detail key={kind + '/detail'} kind={kind}/>}/>
      <Route path={kind + '/:id/edit'} element={<Editor key={kind + '/edit'} kind={kind}/>}/>
    </React.Fragment>)}
    <Route path="admin" element={session.role === 'admin' ? <Admin/> : <Navigate to="/posts" replace/>}/>
    <Route path="*" element={<Navigate to="/posts" replace/>}/>
  </Routes></main></div>;
}

