import ReCAPTCHA from 'react-google-recaptcha';

type RecaptchaWidgetProps = {
  siteKey: string;
  onChange: (token: string | null) => void;
  onExpired?: () => void;
  onError?: () => void;
  className?: string;
  theme?: 'light' | 'dark';
  hl?: string;
};

export function RecaptchaWidget({
  siteKey,
  onChange,
  onExpired,
  onError,
  className = '',
  theme = 'dark',
  hl,
}: RecaptchaWidgetProps) {
  if (!siteKey) {
    return (
      <div
        className={`rounded-lg border border-dashed border-red-500/50 bg-[#1a1a24] p-4 text-sm text-red-300 ${className}`}
      >
        VITE_RECAPTCHA_SITE_KEY가 설정되지 않았습니다.
      </div>
    );
  }

  return (
    <ReCAPTCHA
      sitekey={siteKey}
      theme={theme}
      hl={hl}
      onChange={onChange}
      onExpired={onExpired}
      onErrored={onError}
    />
  );
}
