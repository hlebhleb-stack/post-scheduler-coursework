import React from 'react';
import { useParams } from 'react-router-dom';
import { sections } from '../config.js';
import { useData } from '../hooks/useData.js';
import { Feedback, Back } from '../components/Common.jsx';
import { ChannelForm } from '../components/forms/ChannelForm.jsx';
import { PostForm } from '../components/forms/PostForm.jsx';

export default function Editor({ kind, create = false }) {
  const { id } = useParams();
  const result = useData(kind, create ? 'new' : id);
  const references = useData(!create && kind === 'posts' ? 'posts' : 'channels', 'new');
  const channels = create ? result.channels : references.channels;
  const ready = create
    ? kind !== 'posts' || channels
    : result.data && (kind !== 'posts' || channels);
  return (
    <section className="formPage">
      <Back kind={kind} />
      <header className="pageHeading">
        <h1>{create ? sections[kind].action : 'Редактирование'}</h1>
      </header>
      {!ready ? (
        <Feedback result={result.error ? result : references} />
      ) : kind === 'channels' ? (
        <ChannelForm key={id || 'new'} data={result.data} />
      ) : (
        <PostForm key={id || 'new'} data={result.data} channels={channels} />
      )}
    </section>
  );
}
