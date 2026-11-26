import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Mark } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link as LinkIcon,
  Code,
  Quote,
  EyeOff,
} from 'lucide-react';

const Spoiler = Mark.create({
  name: 'spoiler',
  parseHTML: () => [{ tag: 'tg-spoiler' }],
  renderHTML: () => ['tg-spoiler', {}, 0],
});
const extensions = [
  StarterKit.configure({
    heading: false,
    horizontalRule: false,
    link: { openOnClick: false, protocols: ['https', 'http', 'mailto'] },
  }),
  Spoiler,
  Placeholder.configure({ placeholder: 'Напишите текст публикации…' }),
];
const escape = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '<br>');

export function RichText({
  body,
  html,
  onChange,
  readOnly = false,
  limit = 4096,
  invalid = false,
}) {
  const editor = useEditor({
    extensions,
    content: html || '<p>' + escape(body || '') + '</p>',
    editable: !readOnly,
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': 'Текст публикации', 'aria-multiline': 'true' },
    },
    onUpdate: ({ editor }) =>
      onChange?.({ body: editor.getText({ blockSeparator: '\n' }), html: editor.getHTML() }),
  });
  // При смене данных синхронизируем редактор с текстом публикации.
  useEffect(() => {
    if (editor && editor.getText({ blockSeparator: '\n' }) !== body)
      editor.commands.setContent(html || '<p>' + escape(body || '') + '</p>', {
        emitUpdate: false,
      });
  }, [body, html, editor]);
  useEffect(() => {
    if (!editor) return;
    editor.view.dom.setAttribute('aria-invalid', String(invalid));
    if (invalid) editor.view.dom.setAttribute('aria-describedby', 'error-body');
    else editor.view.dom.removeAttribute('aria-describedby');
  }, [editor, invalid]);
  if (!editor) return null;
  const tools = [
    ['Жирный', Bold, 'bold', () => editor.chain().focus().toggleBold().run()],
    ['Курсив', Italic, 'italic', () => editor.chain().focus().toggleItalic().run()],
    ['Подчёркнутый', Underline, 'underline', () => editor.chain().focus().toggleUnderline().run()],
    ['Зачёркнутый', Strikethrough, 'strike', () => editor.chain().focus().toggleStrike().run()],
    ['Спойлер', EyeOff, 'spoiler', () => editor.chain().focus().toggleMark('spoiler').run()],
    ['Моноширинный', Code, 'code', () => editor.chain().focus().toggleCode().run()],
    ['Цитата', Quote, 'blockquote', () => editor.chain().focus().toggleBlockquote().run()],
    [
      'Ссылка',
      LinkIcon,
      'link',
      () => {
        const href = window.prompt('Адрес ссылки', editor.getAttributes('link').href || 'https://');
        if (href === null) return;
        if (!href.trim()) return editor.chain().focus().extendMarkRange('link').unsetLink().run();
        if (/^(https?:\/\/|mailto:)/i.test(href))
          editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
      },
    ],
  ];
  return (
    <div className={readOnly ? 'richRead' : 'richField' + (invalid ? ' fieldInvalid' : '')}>
      {!readOnly && (
        <div className="formatTools" role="group" aria-label="Форматирование текста">
          {tools.map(([title, Icon, mark, run]) => (
            <button
              type="button"
              title={title}
              aria-label={title}
              aria-pressed={editor.isActive(mark)}
              key={mark}
              onClick={run}
            >
              <Icon size={17} />
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
      {!readOnly && (
        <span className={'textCount' + (body.length > limit ? ' overLimit' : '')}>
          {body.length} / {limit}
        </span>
      )}
    </div>
  );
}
