import { useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { ModalCloseBtn } from '../shared/ModalCloseButton';
import { tok } from '../../theme/tokens';
import { phoneRender } from '../../utils/utils';
import {
  MemberBasicInfoFields,
  type MemberBasicInfoFieldKey,
  type MemberBasicInfoValues,
} from './MemberBasicInfoFields';
import type { UpdateUserRequest, User } from '@/api/user';

const emptyValue = '-';

const text = {
  editTitle: '정보 수정',
  basicInfo: '기본 인적사항',
  password: '비밀번호',
  passwordPlaceholder: '••••••••',
  issueTemp: '임시 발급',
  accountSettings: '계정 설정',
  accountMemo: '계정 메모 (선택)',
  mailLocale: '메일 언어',
  mailLocaleHint: '입출금 승인, KYC 결과 등 알림 메일을 이 언어로 보냅니다. 회원이 웹에서 언어를 바꾸면 자동으로 바뀝니다.',
  memoPlaceholder: '내부 메모',
  cancel: '취소',
  save: '저장',
  saving: '저장 중...',
} as const;

const getDisplayName = (user: User) => {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return fullName || emptyValue;
};

export function MemberReadOnlyField({
  label,
  value,
  t,
}: {
  label: string;
  value: string;
  t: ReturnType<typeof tok>;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: t.textHint,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          minHeight: 36,
          padding: '8px 10px',
          background: t.surface2,
          border: `1px solid ${t.border}`,
          borderRadius: 6,
          fontSize: 13,
          color: t.text,
          fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
          boxSizing: 'border-box',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EditInput({
  label,
  value,
  onChange,
  t,
  required,
  type = 'text',
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  t: ReturnType<typeof tok>;
  required?: boolean;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 500,
          color: t.textSec,
          marginBottom: 6,
          fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
        }}
      >
        {label}
        {required && <span style={{ color: '#DC2626' }}>*</span>}
      </label>
      <input
        value={value}
        type={type}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: '100%',
          height: 36,
          padding: '0 12px',
          borderRadius: 8,
          border: `1px solid ${t.border}`,
          background: t.surface2,
          color: t.text,
          fontSize: 13,
          fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
          boxSizing: 'border-box',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'text',
          opacity: disabled ? 0.72 : 1,
        }}
      />
    </div>
  );
}

function SectionTitle({ children, t }: { children: string; t: ReturnType<typeof tok> }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: t.textSec,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        fontFamily: "'DM Sans',sans-serif",
        borderBottom: `1px solid ${t.border}`,
        paddingBottom: 8,
        marginBottom: 20,
      }}
    >
      {children}
    </div>
  );
}

export function MemberEditDrawer({
  user,
  dark,
  onClose,
  onSave,
  saving,
}: {
  user: User;
  dark: boolean;
  onClose: () => void;
  onSave: (payload: UpdateUserRequest) => void;
  saving: boolean;
}) {
  const t = tok(dark);
  const [firstName, setFirstName] = useState(user.first_name ?? '');
  const [lastName, setLastName] = useState(user.last_name ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState(user.country ?? '');
  const [city, setCity] = useState(user.city ?? '');
  const [stateProvince, setStateProvince] = useState(user.state_province ?? '');
  const [phone, setPhone] = useState(user.phone ? phoneRender(user.phone) : '');
  const [address, setAddress] = useState(user.address_line1 ?? '');
  const [addressDetail, setAddressDetail] = useState(user.address_line2 ?? '');
  const [zipCode, setZipCode] = useState(user.zip_code ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState<'NORMAL' | 'VIP'>(
    String(user.grade).toUpperCase() === 'VIP' ? 'VIP' : 'NORMAL',
  );
  const [memo, setMemo] = useState(user.admin_note ?? '');
  const [mailLocale, setMailLocale] = useState<'en' | 'ko'>(user.locale === 'ko' ? 'ko' : 'en');

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
    setPassword(
      Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
    );
  };

  const handleSave = () => {
    onSave({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      country: country.trim() || undefined,
      city: city.trim() || undefined,
      state_province: stateProvince.trim() || undefined,
      address_line1: address.trim() || undefined,
      address_line2: addressDetail.trim() || undefined,
      zip_code: zipCode.trim() || undefined,
      phone: phone.trim() || undefined,
      avatar_url: user.avatar_url || undefined,
      password: password.trim() || undefined,
      grade: userType,
      admin_note: memo.trim() || undefined,
      locale: mailLocale,
    });
  };

  const basicInfoValues: MemberBasicInfoValues = {
    firstName,
    lastName,
    email,
    phone,
    country,
    city,
    stateProvince,
    addressLine1: address,
    addressLine2: addressDetail,
    zipCode,
  };

  const handleBasicInfoChange = (field: MemberBasicInfoFieldKey, value: string) => {
    if (field === 'firstName') setFirstName(value);
    if (field === 'lastName') setLastName(value);
    if (field === 'email') setEmail(value);
    if (field === 'phone') setPhone(phoneRender(value));
    if (field === 'country') setCountry(value);
    if (field === 'city') setCity(value);
    if (field === 'stateProvince') setStateProvince(value);
    if (field === 'addressLine1') setAddress(value);
    if (field === 'addressLine2') setAddressDetail(value);
    if (field === 'zipCode') setZipCode(value);
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.5)' }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 560,
          maxWidth: '100vw',
          zIndex: 95,
          background: t.surface,
          borderLeft: `1px solid ${t.border}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
          fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{text.editTitle}</span>
            <ModalCloseBtn onClick={onClose} t={t} />
          </div>
          <div style={{ fontSize: 12, color: t.textSec }}>
            {getDisplayName(user)} · {user.uid || emptyValue}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <SectionTitle t={t}>{text.basicInfo}</SectionTitle>
          <MemberBasicInfoFields
            values={basicInfoValues}
            onChange={handleBasicInfoChange}
            gap={12}
            bottomMargin={28}
            renderField={({ key, label, value, onChange, required, type }) => (
              <EditInput
                key={key}
                label={label}
                value={value}
                onChange={onChange}
                t={t}
                required={required}
                type={type}
                disabled={key === 'email'}
              />
            )}
            renderPassword={() => (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: t.textSec,
                    marginBottom: 6,
                  }}
                >
                  {text.password}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={showPassword ? 'text' : 'password'}
                      placeholder={text.passwordPlaceholder}
                      style={{
                        height: 38,
                        background: t.surface2,
                        border: `1px solid ${t.border2}`,
                        borderRadius: 8,
                        fontSize: 13,
                        padding: '0 38px 0 12px',
                        color: t.text,
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                        fontFamily: "'DM Mono',monospace",
                      }}
                    />
                    <button
                      onClick={() => setShowPassword((value) => !value)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: t.textHint,
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0,
                      }}
                    >
                      {showPassword ? (
                        <EyeOff size={14} strokeWidth={1.75} />
                      ) : (
                        <Eye size={14} strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                  <button
                    onClick={generateTempPassword}
                    style={{
                      height: 38,
                      padding: '0 14px',
                      border: `1px solid ${t.border2}`,
                      background: t.surface2,
                      color: t.textSec,
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: "'Noto Sans KR',sans-serif",
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <RefreshCw size={13} strokeWidth={1.75} />
                    {text.issueTemp}
                  </button>
                </div>
              </div>
            )}
          />

          <SectionTitle t={t}>{text.accountSettings}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: t.textSec,
                  marginBottom: 8,
                }}
              >
                User Type
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['NORMAL', 'VIP'] as const).map((type) => {
                  const active = userType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setUserType(type)}
                      style={{
                        flex: 1,
                        height: 36,
                        borderRadius: 8,
                        border: active ? 'none' : `1px solid ${t.border}`,
                        background: active ? t.accent : 'transparent',
                        color: active ? '#fff' : t.textSec,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {type === 'VIP' ? 'VIP' : 'Normal'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: t.textSec,
                  marginBottom: 8,
                }}
              >
                {text.mailLocale}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['en', 'ko'] as const).map((code) => {
                  const active = mailLocale === code;
                  return (
                    <button
                      key={code}
                      onClick={() => setMailLocale(code)}
                      style={{
                        flex: 1,
                        height: 36,
                        borderRadius: 8,
                        border: active ? 'none' : `1px solid ${t.border}`,
                        background: active ? t.accent : 'transparent',
                        color: active ? '#fff' : t.textSec,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {code === 'ko' ? '한국어' : 'English'}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: t.textSec, marginTop: 6 }}>{text.mailLocaleHint}</div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: t.textSec,
                  marginBottom: 6,
                }}
              >
                {text.accountMemo}
              </label>
              <textarea
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder={text.memoPlaceholder}
                rows={2}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.surface2,
                  color: t.text,
                  fontSize: 13,
                  fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              height: 36,
              padding: '0 20px',
              borderRadius: 8,
              border: `1px solid ${t.border2}`,
              background: 'transparent',
              color: t.textSec,
              fontSize: 13,
              fontWeight: 500,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {text.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              height: 36,
              padding: '0 20px',
              borderRadius: 8,
              border: 'none',
              background: t.accent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? text.saving : text.save}
          </button>
        </div>
      </div>
    </>
  );
}
