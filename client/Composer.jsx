import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Mark } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Underline, Strikethrough, Link as LinkIcon, Code, Quote, EyeOff, Paperclip, X, File, Music, Film, Image, Download } from 'lucide-react';

const Spoiler = Mark.create({
  name: 'spoiler', parseHTML: () => [{ tag:'tg-spoiler' }],
  renderHTML: () => ['tg-spoiler', {}, 0],
});
const extensions = [StarterKit.configure({ heading:false, horizontalRule:false, link: { openOnClick:false, protocols:['https','http','mailto'] } }), Spoiler,
  Placeholder.configure({ placeholder:'Напишите текст публикации…' })];
const escape = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','<br>');

export function RichText({ body, html, onChange, readOnly = false, limit = 4096 }) {
  const editor = useEditor({
    extensions, content: html || '<p>' + escape(body || '') + '</p>', editable:!readOnly,
    editorProps:{ attributes: { role:'textbox', 'aria-label':'Текст публикации', 'aria-multiline':'true' } },
    onUpdate: ({ editor }) => onChange?.({ body:editor.getText({ blockSeparator:'\n' }), html:editor.getHTML() }),
  });
  // Templates and channel changes may replace the text outside the editor.
  useEffect(() => {
    if (editor && editor.getText({ blockSeparator:'\n' }) !== body) editor.commands.setContent(html || '<p>' + escape(body || '') + '</p>', { emitUpdate:false });
  }, [body, html, editor]);
  if (!editor) return null;
  const tools = [
    ['Жирный', Bold, 'bold', () => editor.chain().focus().toggleBold().run()],
    ['Курсив', Italic, 'italic', () => editor.chain().focus().toggleItalic().run()],
    ['Подчёркнутый', Underline, 'underline', () => editor.chain().focus().toggleUnderline().run()],
    ['Зачёркнутый', Strikethrough, 'strike', () => editor.chain().focus().toggleStrike().run()],
    ['Спойлер', EyeOff, 'spoiler', () => editor.chain().focus().toggleMark('spoiler').run()],
    ['Моноширинный', Code, 'code', () => editor.chain().focus().toggleCode().run()],
    ['Цитата', Quote, 'blockquote', () => editor.chain().focus().toggleBlockquote().run()],
    ['Ссылка', LinkIcon, 'link', () => {
      const href = window.prompt('Адрес ссылки', editor.getAttributes('link').href || 'https://');
      if (href === null) return;
      if (!href.trim()) return editor.chain().focus().extendMarkRange('link').unsetLink().run();
      if (/^(https?:\/\/|mailto:)/i.test(href)) editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }],
  ];
  return <div className={readOnly ? 'richRead' : 'richField'}>
    {!readOnly && <div className="formatTools" role="group" aria-label="Форматирование текста">{tools.map(([title,Icon,mark,run]) =>
      <button type="button" title={title} aria-label={title} aria-pressed={editor.isActive(mark)} key={mark} onClick={run}><Icon size={17}/></button>)}</div>}
    <EditorContent editor={editor}/>
    {!readOnly && <span className={'textCount' + (body.length > limit ? ' overLimit' : '')}>{body.length} / {limit}</span>}
  </div>;
}

function SavedPreview({ file }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let objectURL;
    const session = JSON.parse(sessionStorage.getItem('schedule-session') || 'null');
    fetch('/api/attachments/' + file.id, { headers:{ Authorization:'Bearer ' + session?.token }, signal:controller.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.blob(); })
      .then(blob => { objectURL = URL.createObjectURL(new Blob([blob], { type:file.mime })); setUrl(objectURL); }).catch(() => {});
    return () => { controller.abort(); if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [file.id, file.mime]);
  return url ? <Preview file={file} url={url}/> : null;
}
function Preview({ file, url }) {
  if (file.kind === 'photo' || file.kind === 'animation') return <img className="mediaPreview" src={url} alt={file.name}/>;
  if (file.kind === 'video') return <video className="mediaPreview" src={url} controls preload="metadata"/>;
  if (file.kind === 'audio') return <audio src={url} controls preload="metadata"/>;
  return null;
}
export function AttachmentList({ files, onRemove }) {
  const [error, setError] = useState('');
  async function download(file) {
    setError('');
    try {
      const session = JSON.parse(sessionStorage.getItem('schedule-session') || 'null');
      const response = await fetch('/api/attachments/' + file.id, { headers:{ Authorization:'Bearer ' + session?.token } });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href=url; link.download=file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Не удалось скачать файл. Попробуйте ещё раз.'); }
  }
  return <div className="attachmentList">{error && <p role="alert" className="error">{error}</p>}{files.map((file,index) => {
    const Icon = { photo:Image,animation:Image,video:Film,audio:Music }[file.kind] || File;
    return <div className="attachment" key={file.id || file.url || index}>
      <div className="attachmentInfo"><Icon size={19}/><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} МБ · {file.kind === 'document' ? 'Файл' : {photo:'Фото',video:'Видео',audio:'Музыка',animation:'GIF'}[file.kind]}</small></span>
        {file.id && <button type="button" className="quiet" aria-label={'Скачать ' + file.name} onClick={() => download(file)}><Download size={17}/></button>}
        {onRemove && <button type="button" className="quiet" aria-label={'Удалить вложение ' + file.name} onClick={() => onRemove(index)}><X size={17}/></button>}</div>
      {file.url ? <Preview file={file} url={file.url}/> : file.id && file.kind !== 'document' ? <SavedPreview file={file}/> : null}
    </div>;
  })}</div>;
}
export function FilePicker({ onSelect, disabled }) {
  return <label className={'filePicker' + (disabled ? ' disabled' : '')}><Paperclip size={18}/><span>Прикрепить файлы</span>
    <input type="file" multiple disabled={disabled} onChange={event => { onSelect(Array.from(event.target.files)); event.target.value = ''; }}/></label>;
}
