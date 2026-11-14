import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Extension, Mark, Node } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Table as TableExtension, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold, Code, Heading2, ImagePlus, Italic, Link, List, ListOrdered, ListTodo, Minus,
  MousePointerClick, Quote, Strikethrough, Table,
} from 'lucide-react';

export interface EmailTemplateEditorHandle {
  getHTML: () => string;
  insertText: (text: string) => void;
  setHTML: (html: string) => void;
}

interface EmailTemplateEditorProps {
  initialValue?: string;
  dark?: boolean;
  mode?: 'textarea' | 'wysiwyg';
  onImageUpload?: (blob: Blob | File) => Promise<string>;
}

const buttonStyle = (backgroundColor = '#2563eb', textColor = '#ffffff') =>
  `display:inline-block;background:${backgroundColor};color:${textColor};padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:700;`;

const EmailLink = Mark.create({
  name: 'emailLink',
  priority: 1001,
  inclusive: false,
  addAttributes() {
    return {
      href: { default: null, parseHTML: (element) => element.getAttribute('href') },
      target: { default: null, parseHTML: (element) => element.getAttribute('target') },
      rel: { default: null, parseHTML: (element) => element.getAttribute('rel') },
      style: { default: null, parseHTML: (element) => element.getAttribute('style') },
      dataEmailButton: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-email-button'),
        renderHTML: (attributes) =>
          attributes.dataEmailButton ? { 'data-email-button': attributes.dataEmailButton } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'a[href]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['a', HTMLAttributes, 0];
  },
});

// Keep email-template presentation attributes while Tiptap parses and serializes HTML.
// This changes the document model only; the existing editor UI stays untouched.
const EmailHtmlAttributes = Extension.create({
  name: 'emailHtmlAttributes',
  addGlobalAttributes() {
    return [{
      types: [
        'paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem',
        'taskList', 'taskItem', 'table', 'tableRow', 'tableCell', 'tableHeader', 'image',
        'codeBlock', 'horizontalRule', 'bold', 'italic', 'strike', 'code',
      ],
      attributes: {
        style: { default: null, parseHTML: (element) => element.getAttribute('style') },
        class: { default: null, parseHTML: (element) => element.getAttribute('class') },
      },
    }];
  },
});

const StyledSpan = Mark.create({
  name: 'styledSpan',
  priority: 1001,
  addAttributes() {
    return {
      style: { default: null, parseHTML: (element) => element.getAttribute('style') },
      class: { default: null, parseHTML: (element) => element.getAttribute('class') },
    };
  },
  parseHTML() {
    return [{ tag: 'span[style], span[class]', priority: 1001 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});

const StyledDiv = Node.create({
  name: 'styledDiv',
  group: 'block',
  content: 'block*',
  defining: true,
  priority: 1001,
  addAttributes() {
    return {
      style: { default: null, parseHTML: (element) => element.getAttribute('style') },
      class: { default: null, parseHTML: (element) => element.getAttribute('class') },
    };
  },
  parseHTML() {
    return [{ tag: 'div[style], div[class]', priority: 1001 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, 0];
  },
});

function TextareaEmailTemplateEditor({ initialValue, dark, refHandle }: {
  initialValue: string; dark: boolean; refHandle: React.ForwardedRef<EmailTemplateEditorHandle>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [html, setHtml] = useState(initialValue);
  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const position = textarea.selectionStart;
    setHtml((current) => current.slice(0, position) + snippet + current.slice(position));
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(position + snippet.length, position + snippet.length); });
  };
  const wrapSelection = (open: string, close: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart; const end = textarea.selectionEnd;
    setHtml((current) => current.slice(0, start) + open + current.slice(start, end) + close + current.slice(end));
  };
  const insertLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const href = window.prompt('Enter URL:', 'https://');
    if (!href) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = html.slice(start, end) || 'link text';
    const linkTag = `<a href="${href}">${selectedText}</a>`;
    setHtml(html.slice(0, start) + linkTag + html.slice(end));
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start + linkTag.length, start + linkTag.length); });
  };
  useEffect(() => setHtml(initialValue), [initialValue]);
  useImperativeHandle(refHandle, () => ({ getHTML: () => html, insertText: insertSnippet, setHTML: setHtml }), [html]);
  const toolbarButtons: { icon: ReactNode; title: string; action: () => void }[] = [
    { icon: <Heading2 size={13} />, title: 'H2', action: () => wrapSelection('<h2>', '</h2>') },
    { icon: <Bold size={13} />, title: 'Bold', action: () => wrapSelection('<strong>', '</strong>') },
    { icon: <Italic size={13} />, title: 'Italic', action: () => wrapSelection('<em>', '</em>') },
    { icon: <Strikethrough size={13} />, title: 'Strike', action: () => wrapSelection('<s>', '</s>') },
    { icon: <Minus size={13} />, title: 'HR', action: () => insertSnippet('<hr>') },
    { icon: <Quote size={13} />, title: 'Blockquote', action: () => wrapSelection('<blockquote>', '</blockquote>') },
    { icon: <List size={13} />, title: 'UL', action: () => insertSnippet('<ul>\n  <li></li>\n</ul>') },
    { icon: <ListOrdered size={13} />, title: 'OL', action: () => insertSnippet('<ol>\n  <li></li>\n</ol>') },
    { icon: <Table size={13} />, title: 'Table', action: () => insertSnippet('<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;"><tr><td style="padding:9px 14px;color:#6B7280;width:160px;border-bottom:1px solid #F0F0F0;">Label</td><td style="padding:9px 14px;color:#111827;font-weight:500;border-bottom:1px solid #F0F0F0;">Value</td></tr></table>') },
    { icon: <Link size={13} />, title: 'Link', action: insertLink },
    { icon: <Code size={13} />, title: 'Code', action: () => wrapSelection('<code>', '</code>') },
  ];
  const border = dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)';
  return <div><div style={{ display: 'flex', gap: 2, padding: '6px 8px', background: dark ? '#232C44' : '#F4F5F7', border: `1px solid ${border}`, borderRadius: '8px 8px 0 0', flexWrap: 'wrap' }}>
    {toolbarButtons.map(({ icon, title, action }) => <button key={title} type="button" title={title} onClick={action} style={{ width: 28, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${border}`, borderRadius: 4, background: 'transparent', cursor: 'pointer' }}>{icon}</button>)}
  </div><textarea ref={textareaRef} value={html} onChange={(event) => setHtml(event.target.value)} spellCheck={false} style={{ width: '100%', minHeight: 360, padding: '12px 14px', border: `1px solid ${border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', background: dark ? '#1A2035' : '#FAFAFA', color: dark ? '#C8D3F5' : '#1A1A1A', fontSize: 12, lineHeight: 1.7, fontFamily: "'DM Mono', 'Fira Mono', monospace", resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} /></div>;
}

function WysiwygEmailTemplateEditor({ initialValue, dark, onImageUpload, refHandle }: {
  initialValue: string; dark: boolean; onImageUpload?: (blob: Blob | File) => Promise<string>; refHandle: React.ForwardedRef<EmailTemplateEditorHandle>;
}) {
  const [html, setHtml] = useState(initialValue);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }), Image.configure({ allowBase64: false, HTMLAttributes: { style: 'max-width:100%;height:auto;' } }),
      TaskList, TaskItem.configure({ nested: true }), TableExtension.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      EmailLink, EmailHtmlAttributes, StyledSpan, StyledDiv,
    ], content: initialValue, shouldRerenderOnTransaction: true, editorProps: { attributes: { class: 'email-template-editor-content' } }, onUpdate: ({ editor: nextEditor }) => setHtml(nextEditor.getHTML()),
  });
  useEffect(() => { if (editor && initialValue !== editor.getHTML()) { editor.commands.setContent(initialValue, { emitUpdate: false }); setHtml(initialValue); } }, [editor, initialValue]);
  useImperativeHandle(refHandle, () => ({
    getHTML: () => editor?.getHTML() ?? html,
    insertText: (text) => { editor?.chain().focus().insertContent(text).run(); setHtml(editor?.getHTML() ?? html); },
    setHTML: (nextHtml) => { editor?.commands.setContent(nextHtml, { emitUpdate: false }); setHtml(editor?.getHTML() ?? nextHtml); },
  }), [editor, html]);
  const insertLink = () => {
    if (!editor) return;
    const href = window.prompt('Enter URL:', 'https://'); if (!href) return;
    const { from, to } = editor.state.selection; const selectedText = editor.state.doc.textBetween(from, to, ' ');
    const attrs = { href, target: '_blank', rel: 'noopener noreferrer' };
    if (selectedText) editor.chain().focus().setMark('emailLink', attrs).run();
    else editor.chain().focus().insertContent({ type: 'text', text: 'link text', marks: [{ type: 'emailLink', attrs }] }).run();
  };
  const insertEmailButton = () => {
    if (!editor) return;
    const label = window.prompt('Button text:', 'Learn more'); if (!label) return;
    const href = window.prompt('Button URL:', 'https://'); if (!href) return;
    const backgroundColor = window.prompt('Button background color:', '#2563eb') || '#2563eb';
    const textColor = window.prompt('Button text color:', '#ffffff') || '#ffffff';
    editor.chain().focus().insertContent({ type: 'text', text: label, marks: [{ type: 'emailLink', attrs: { href, target: '_blank', rel: 'noopener noreferrer', style: buttonStyle(backgroundColor, textColor), dataEmailButton: 'true' } }] }).run();
  };
  const uploadImage = async (file: File) => {
    if (!editor) return;
    try {
      if (!onImageUpload) { window.alert('이미지 업로드 API가 설정되지 않았습니다.'); return; }
      const imageUrl = await onImageUpload(file);
      editor.chain().focus().setImage({ src: imageUrl, alt: file.name }).run();
    } catch { window.alert('이미지 첨부에 실패했습니다.'); }
  };
  const toolbarButton = (title: string, icon: ReactNode, action: () => void, active = false) => <button type="button" title={title} onClick={action} style={{ width: 30, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 4, background: active ? (dark ? '#36415f' : '#e1e6ef') : 'transparent', color: dark ? '#c8d3f5' : '#4a4a58', cursor: 'pointer' }}>{icon}</button>;
  return <div className={dark ? 'email-template-editor email-template-editor-dark' : 'email-template-editor'}>
    <div className="email-template-editor-toolbar">
      {toolbarButton('Heading', <Heading2 size={15} />, () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), editor?.isActive('heading', { level: 2 }))}{toolbarButton('Bold', <Bold size={15} />, () => editor?.chain().focus().toggleBold().run(), editor?.isActive('bold'))}{toolbarButton('Italic', <Italic size={15} />, () => editor?.chain().focus().toggleItalic().run(), editor?.isActive('italic'))}{toolbarButton('Strike', <Strikethrough size={15} />, () => editor?.chain().focus().toggleStrike().run(), editor?.isActive('strike'))}{toolbarButton('Horizontal rule', <Minus size={15} />, () => editor?.chain().focus().setHorizontalRule().run())}{toolbarButton('Quote', <Quote size={15} />, () => editor?.chain().focus().toggleBlockquote().run(), editor?.isActive('blockquote'))}{toolbarButton('Bullet list', <List size={15} />, () => editor?.chain().focus().toggleBulletList().run(), editor?.isActive('bulletList'))}{toolbarButton('Ordered list', <ListOrdered size={15} />, () => editor?.chain().focus().toggleOrderedList().run(), editor?.isActive('orderedList'))}{toolbarButton('Task list', <ListTodo size={15} />, () => editor?.chain().focus().toggleTaskList().run(), editor?.isActive('taskList'))}{toolbarButton('Table', <Table size={15} />, () => editor?.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run())}{toolbarButton('Link', <Link size={15} />, insertLink, editor?.isActive('emailLink'))}{toolbarButton('Image', <ImagePlus size={15} />, () => imageInputRef.current?.click())}{toolbarButton('Email button', <MousePointerClick size={15} />, insertEmailButton, editor?.isActive('emailLink', { dataEmailButton: 'true' }))}{toolbarButton('Inline code', <Code size={15} />, () => editor?.chain().focus().toggleCode().run(), editor?.isActive('code'))}{toolbarButton('Code block', <Code size={15} />, () => editor?.chain().focus().toggleCodeBlock().run(), editor?.isActive('codeBlock'))}
    </div>
    <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.target.value = ''; }} />
    <EditorContent editor={editor} />
  </div>;
}

export const EmailTemplateEditor = forwardRef<EmailTemplateEditorHandle, EmailTemplateEditorProps>(
  ({ initialValue = '', dark = false, mode = 'textarea', onImageUpload }, ref) => mode === 'wysiwyg'
    ? <WysiwygEmailTemplateEditor initialValue={initialValue} dark={dark} onImageUpload={onImageUpload} refHandle={ref} />
    : <TextareaEmailTemplateEditor initialValue={initialValue} dark={dark} refHandle={ref} />,
);

EmailTemplateEditor.displayName = 'EmailTemplateEditor';
