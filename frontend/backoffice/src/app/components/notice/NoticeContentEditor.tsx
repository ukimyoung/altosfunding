import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Bold, Heading2, Italic, Link, List, Minus, Quote, Strikethrough } from 'lucide-react';

export interface NoticeContentEditorHandle {
  getHTML: () => string;
  getMarkdown: () => string;
  getPlainText: () => string;
}

interface NoticeContentEditorProps {
  initialValue?: string;
  placeholder?: string;
  dark?: boolean;
}

export const NoticeContentEditor = forwardRef<NoticeContentEditorHandle, NoticeContentEditorProps>(
  ({ initialValue = '', placeholder, dark = false }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isPlaceholderVisible, setIsPlaceholderVisible] = useState(
      initialValue.replace(/<[^>]*>/g, '').replace(/[\u00a0\u200b\ufeff]/g, '').trim().length === 0,
    );

    useImperativeHandle(ref, () => ({
      getHTML: () => editorRef.current?.innerHTML ?? '',
      getMarkdown: () => editorRef.current?.innerHTML ?? '',
      getPlainText: () => editorRef.current?.innerText ?? '',
    }));

    useEffect(() => {
      if (!editorRef.current) return;

      editorRef.current.innerHTML = initialValue;
      setIsPlaceholderVisible(
        initialValue.replace(/<[^>]*>/g, '').replace(/[\u00a0\u200b\ufeff]/g, '').trim()
          .length === 0,
      );
    }, [initialValue]);

    const exec = (command: string, value?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
    };

    const insertLink = () => {
      const url = window.prompt('URL을 입력하세요', 'https://');
      if (url) exec('createLink', url);
    };

    const bg = dark ? '#1A2035' : '#ffffff';
    const bg2 = dark ? '#232C44' : '#F4F5F7';
    const border = dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)';
    const divider = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const iconColor = dark ? '#8B8FA8' : '#4A4A58';

    const btnStyle = {
      width: 28,
      height: 26,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px solid ${divider}`,
      borderRadius: 4,
      background: 'transparent',
      color: iconColor,
      cursor: 'pointer',
    } as const;

    const toolbarItems = [
      { icon: <Heading2 size={13} />, title: '제목 (H2)', action: () => exec('formatBlock', 'H2') },
      { icon: <Bold size={13} />, title: '굵게', action: () => exec('bold') },
      { icon: <Italic size={13} />, title: '기울임', action: () => exec('italic') },
      { icon: <Strikethrough size={13} />, title: '취소선', action: () => exec('strikeThrough') },
      null,
      { icon: <Minus size={13} />, title: '구분선', action: () => exec('insertHorizontalRule') },
      { icon: <Quote size={13} />, title: '인용', action: () => exec('formatBlock', 'BLOCKQUOTE') },
      { icon: <List size={13} />, title: '목록', action: () => exec('insertUnorderedList') },
      null,
      { icon: <Link size={13} />, title: '링크', action: insertLink },
    ];

    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '5px 8px',
            background: bg2,
            borderTop: `1px solid ${border}`,
            borderLeft: `1px solid ${border}`,
            borderRight: `1px solid ${border}`,
            borderBottom: `1px solid ${divider}`,
            borderRadius: '8px 8px 0 0',
            flexWrap: 'wrap',
          }}
        >
          {toolbarItems.map((item, index) =>
            item === null ? (
              <div
                key={`sep-${index}`}
                style={{ width: 1, height: 18, background: divider, margin: '0 3px' }}
              />
            ) : (
              <button
                key={item.title}
                type="button"
                title={item.title}
                onMouseDown={(event) => {
                  event.preventDefault();
                  item.action();
                }}
                style={btnStyle}
              >
                {item.icon}
              </button>
            ),
          )}
        </div>

        <div style={{ position: 'relative' }}>
          {placeholder && isPlaceholderVisible && (
            <span
              style={{
                position: 'absolute',
                top: 12,
                left: 14,
                color: dark ? '#5A6080' : '#A0A0AA',
                fontSize: 14,
                lineHeight: 1.7,
                fontFamily: "'Noto Sans KR', sans-serif",
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {placeholder}
            </span>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: initialValue }}
            onInput={() => {
              setIsPlaceholderVisible(
                (editorRef.current?.innerText ?? '').replace(/[\u00a0\u200b\ufeff]/g, '').trim()
                  .length === 0,
              );
            }}
            style={{
              minHeight: 280,
              padding: '12px 14px',
              borderLeft: `1px solid ${border}`,
              borderRight: `1px solid ${border}`,
              borderBottom: `1px solid ${border}`,
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              background: bg,
              color: dark ? '#E8EAF0' : '#1A1A1A',
              fontSize: 14,
              lineHeight: 1.7,
              fontFamily: "'Noto Sans KR', sans-serif",
              outline: 'none',
              overflowY: 'auto',
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
                event.preventDefault();
                exec('bold');
              }
              if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
                event.preventDefault();
                exec('italic');
              }
            }}
          />
        </div>
      </div>
    );
  },
);

NoticeContentEditor.displayName = 'NoticeContentEditor';
