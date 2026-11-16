import { useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Table,
  X,
} from 'lucide-react';

type SendMode = '즉시 발송' | '지연 발송';

export interface AddTemplateDraft {
  templateId: string;
  templateName: string;
  eventType: string;
  sendTiming: string;
  delayMinutes: number;
  subject: string;
  htmlContent: string;
}

interface HtmlBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  dark: boolean;
  minHeight?: number;
  error?: boolean;
}

function HtmlBodyEditor({
  value,
  onChange,
  dark,
  minHeight = 280,
  error = false,
}: HtmlBodyEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const border = dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)';
  const errColor = '#DC2626';
  const bg2 = dark ? '#232C44' : '#F4F5F7';
  const textColor = dark ? '#E8EAF0' : '#1A1A1A';
  const hintColor = dark ? '#5A6080' : '#A0A0AA';

  const wrap = (open: string, close: string) => {
    const el = ref.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selectedText = value.slice(start, end);
    const nextValue = value.slice(0, start) + open + selectedText + close + value.slice(end);
    onChange(nextValue);

    requestAnimationFrame(() => {
      el.focus();
      const nextPosition = start + open.length + selectedText.length + close.length;
      el.setSelectionRange(nextPosition, nextPosition);
    });
  };

  const insert = (snippet: string) => {
    const el = ref.current;
    if (!el) return;

    const position = el.selectionStart;
    const nextValue = value.slice(0, position) + snippet + value.slice(position);
    onChange(nextValue);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(position + snippet.length, position + snippet.length);
    });
  };

  const promptLink = () => {
    const el = ref.current;
    if (!el) return;

    const url = window.prompt('Enter URL:', 'https://');
    if (!url) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selectedText = value.slice(start, end) || 'link text';
    const tag = `<a href="${url}">${selectedText}</a>`;
    onChange(value.slice(0, start) + tag + value.slice(end));
  };

  const tableSnippet = `<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;">
  <tr>
    <td style="padding:9px 14px;color:#6B7280;width:160px;border-bottom:1px solid #F0F0F0;">Label</td>
    <td style="padding:9px 14px;color:#111827;font-weight:500;border-bottom:1px solid #F0F0F0;">Value</td>
  </tr>
</table>`;

  const toolbarButtons: { icon: ReactNode; title: string; action: () => void }[] = [
    { icon: <Heading2 size={13} />, title: 'H2', action: () => wrap('<h2>', '</h2>') },
    { icon: <Bold size={13} />, title: 'Bold', action: () => wrap('<strong>', '</strong>') },
    { icon: <Italic size={13} />, title: 'Italic', action: () => wrap('<em>', '</em>') },
    { icon: <Strikethrough size={13} />, title: 'Strike', action: () => wrap('<s>', '</s>') },
    { icon: <Minus size={13} />, title: 'HR', action: () => insert('<hr>') },
    {
      icon: <Quote size={13} />,
      title: 'Blockquote',
      action: () => wrap('<blockquote>', '</blockquote>'),
    },
    { icon: <List size={13} />, title: 'UL', action: () => insert('<ul>\n  <li></li>\n</ul>') },
    {
      icon: <ListOrdered size={13} />,
      title: 'OL',
      action: () => insert('<ol>\n  <li></li>\n</ol>'),
    },
    { icon: <Table size={13} />, title: 'Table', action: () => insert(tableSnippet) },
    { icon: <Link size={13} />, title: 'Link', action: promptLink },
    { icon: <Code size={13} />, title: 'Code', action: () => wrap('<code>', '</code>') },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '6px 8px',
          background: bg2,
          border: `1px solid ${error ? errColor : border}`,
          borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: '8px 8px 0 0',
          flexWrap: 'wrap',
        }}
      >
        {toolbarButtons.map(({ icon, title, action }) => (
          <button
            key={title}
            type="button"
            title={title}
            onClick={action}
            style={{
              width: 28,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: 4,
              background: 'transparent',
              color: dark ? '#8B8FA8' : '#4A4A58',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            {icon}
          </button>
        ))}
        <span
          style={{
            fontSize: 10,
            color: hintColor,
            marginLeft: 'auto',
            alignSelf: 'center',
            paddingRight: 4,
          }}
        >
          HTML
        </span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        style={{
          width: '100%',
          minHeight,
          padding: '12px 14px',
          border: `1px solid ${error ? errColor : border}`,
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          background: dark ? '#1A2035' : '#FAFAFA',
          color: dark ? '#C8D3F5' : textColor,
          fontSize: 12,
          lineHeight: 1.7,
          fontFamily: "'DM Mono', 'Fira Mono', monospace",
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

interface AddTemplateModalProps {
  dark: boolean;
  onClose: () => void;
  /** 저장에 성공하면 null, 실패하면 화면에 보여 줄 오류 문구를 돌려준다. */
  onSave: (template: AddTemplateDraft) => Promise<string | null>;
}

const TEMPLATE_ID_RE = /^[a-z][a-z0-9_]{2,63}$/;

export function AddTemplateModal({ dark, onClose, onSave }: AddTemplateModalProps) {
  const t = {
    surface: dark ? '#1A2035' : '#ffffff',
    surface2: dark ? '#232C44' : '#F4F5F7',
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
    border2: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    text: dark ? '#E8EAF0' : '#1A1A1A',
    textSec: dark ? '#8B8FA8' : '#4A4A58',
    textHint: dark ? '#5A6080' : '#A0A0AA',
    accent: '#7C6AF7',
    overlay: 'rgba(0,0,0,0.55)',
    error: '#DC2626',
  };

  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendTiming, setSendTiming] = useState('');
  const [sendMode, setSendMode] = useState<SendMode>('즉시 발송');
  const [delayMinutes, setDelayMinutes] = useState(120);
  const [emailSubject, setEmailSubject] = useState('');
  const [body, setBody] = useState(
    '<p>Dear <strong>{{user_name}}</strong></p>\n<p>Enter content here.</p>\n<p>Best regards,<br>The Altos Funding Team.</p>',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inputStyle: CSSProperties = {
    width: '100%',
    height: 38,
    padding: '0 12px',
    borderRadius: 8,
    border: `1px solid ${t.border2}`,
    background: t.surface2,
    color: t.text,
    fontSize: 13,
    boxSizing: 'border-box',
    outline: 'none',
  };
  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: t.textSec,
    marginBottom: 6,
  };
  const errorStyle: CSSProperties = { fontSize: 11, color: t.error, marginTop: 4 };
  const hintStyle: CSSProperties = { fontSize: 11, color: t.textHint, marginTop: 5, lineHeight: 1.5 };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!TEMPLATE_ID_RE.test(templateId.trim()))
      nextErrors.templateId = '영문 소문자로 시작하는 영문 소문자·숫자·_ 3~64자로 입력하세요.';
    if (!name.trim()) nextErrors.name = '템플릿 명을 입력하세요.';
    if (!sendTiming.trim()) nextErrors.sendTiming = '발송 시점 설명을 입력하세요.';
    if (!emailSubject.trim()) nextErrors.emailSubject = '이메일 제목을 입력하세요.';
    if (!body.trim()) nextErrors.body = '본문을 입력하세요.';
    return nextErrors;
  };

  const handleSave = async () => {
    if (saving) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    const errorMessage = await onSave({
      templateId: templateId.trim(),
      templateName: name.trim(),
      eventType: sendTiming.trim(),
      sendTiming: sendMode,
      delayMinutes: sendMode === '지연 발송' ? delayMinutes : 0,
      subject: emailSubject.trim(),
      htmlContent: body,
    });
    setSaving(false);
    if (errorMessage) {
      setErrors({ form: errorMessage });
      return;
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: t.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 640,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: '90vh',
          background: t.surface,
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>이메일 템플릿 신규 등록</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: `1px solid ${t.border}`,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} style={{ color: t.textSec }} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div>
            <label style={labelStyle}>
              템플릿 코드 <span style={{ color: t.error }}>*</span>
            </label>
            <input
              type="text"
              value={templateId}
              onChange={(event) => {
                setTemplateId(event.target.value.toLowerCase());
                setErrors((prev) => ({ ...prev, templateId: '', form: '' }));
              }}
              placeholder="예: withdrawal_completed"
              style={{
                ...inputStyle,
                fontFamily: "'DM Mono',monospace",
                border: `1px solid ${errors.templateId ? t.error : t.border2}`,
              }}
            />
            {errors.templateId && <div style={errorStyle}>{errors.templateId}</div>}
            <div style={hintStyle}>
              서버가 메일을 보낼 때 이 코드로 템플릿을 찾습니다. 등록 후에는 바꿀 수 없으며, 실제 발송은 개발에서 이 코드를 연결해야 시작됩니다.
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              템플릿 명 <span style={{ color: t.error }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="예: 출금 완료 안내"
              style={{ ...inputStyle, border: `1px solid ${errors.name ? t.error : t.border2}` }}
            />
            {errors.name && <div style={errorStyle}>{errors.name}</div>}
          </div>

          <div>
            <label style={labelStyle}>
              발송 시점 - 이벤트 설명 <span style={{ color: t.error }}>*</span>
            </label>
            <input
              type="text"
              value={sendTiming}
              onChange={(event) => {
                setSendTiming(event.target.value);
                setErrors((prev) => ({ ...prev, sendTiming: '' }));
              }}
              placeholder="예: 출금 승인 직후 자동 발송"
              style={{
                ...inputStyle,
                border: `1px solid ${errors.sendTiming ? t.error : t.border2}`,
              }}
            />
            {errors.sendTiming && <div style={errorStyle}>{errors.sendTiming}</div>}
            <div style={hintStyle}>
              목록에 부제목으로 표시되며, 실제 백엔드 이벤트 연동 시 개발자 참고용으로 사용됩니다.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>
                발송 방식 <span style={{ color: t.error }}>*</span>
              </label>
              <select
                value={sendMode}
                onChange={(event) => setSendMode(event.target.value as SendMode)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="즉시 발송">즉시 발송</option>
                <option value="지연 발송">지연 발송</option>
              </select>
            </div>
            {sendMode === '지연 발송' && (
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>지연 시간</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={delayMinutes}
                    onChange={(event) =>
                      setDelayMinutes(Math.min(4320, Math.max(1, Number(event.target.value))))
                    }
                    min={1}
                    max={4320}
                    style={{ ...inputStyle, paddingRight: 60, fontFamily: "'DM Mono',monospace" }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 12,
                      color: t.textSec,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    분 후
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>
              이메일 제목 (Subject) <span style={{ color: t.error }}>*</span>
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(event) => {
                setEmailSubject(event.target.value);
                setErrors((prev) => ({ ...prev, emailSubject: '' }));
              }}
              placeholder="예: 출금이 완료되었습니다"
              style={{
                ...inputStyle,
                border: `1px solid ${errors.emailSubject ? t.error : t.border2}`,
              }}
            />
            {errors.emailSubject && <div style={errorStyle}>{errors.emailSubject}</div>}
          </div>

          <div>
            <label style={labelStyle}>
              본문 (Body - HTML) <span style={{ color: t.error }}>*</span>
            </label>
            <HtmlBodyEditor
              value={body}
              onChange={(nextBody) => {
                setBody(nextBody);
                setErrors((prev) => ({ ...prev, body: '' }));
              }}
              dark={dark}
              minHeight={260}
              error={!!errors.body}
            />
            {errors.body && <div style={errorStyle}>{errors.body}</div>}
            <div style={hintStyle}>
              헤더와 푸터는 모든 이메일에 자동 적용됩니다. 본문 내용만 작성해 주세요. 변수는 {'{{ 변수명 }}'} 형식으로 넣고, 영문(EN) 내용으로 등록한 뒤 편집 화면의 KO 탭에서 한국어를 추가할 수 있습니다.
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          {errors.form && (
            <div style={{ ...errorStyle, fontSize: 12, marginTop: 0, marginRight: 'auto' }}>{errors.form}</div>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 36,
              padding: '0 18px',
              borderRadius: 8,
              border: `1px solid ${t.border2}`,
              background: 'transparent',
              color: t.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              height: 36,
              padding: '0 22px',
              borderRadius: 8,
              border: 'none',
              background: t.accent,
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
