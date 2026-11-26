import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { sections, labels } from '../config.js';
export function Status({ status }) {
  return <span className={'status ' + status}>{labels[status]}</span>;
}

export function Feedback({ result }) {
  return result.error ? (
    <p role="alert" className="error">
      {result.error}
    </p>
  ) : (
    <p role="status" className="muted">
      Загрузка…
    </p>
  );
}

export function Back({ kind }) {
  return (
    <Link className="back" to={'/' + kind}>
      <ArrowLeft size={16} />
      {sections[kind].title}
    </Link>
  );
}
