import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { useNavigate } from 'react-router';
import { DEFAULT_APP_ROUTE } from '@/app/config/navigation';
import { useLoginMutation } from '@/app/queries/auth';

export default function Login() {
  const navigate = useNavigate();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { mutateAsync: submitLogin, isPending: isSubmitting } = useLoginMutation();
  const [id, setId] = useState(() => localStorage.getItem('loginUserId') ?? '');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(() => localStorage.getItem('loginRememberId') === 'true');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const idRef = useRef<HTMLInputElement | null>(null);
  const pwdRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const savedId = localStorage.getItem('loginUserId') ?? '';
    const savedRemember = localStorage.getItem('loginRememberId') ?? '';

    if (savedId && savedRemember === 'true') {
      setId(savedId);
      setRememberId(true);
      pwdRef.current?.focus();
      return;
    }

    idRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!id) {
      idRef.current?.focus();
    }
  }, [id]);

  const getRecaptchaToken = async () => {
    if (!executeRecaptcha) {
      throw new Error('reCAPTCHA is not ready yet. Please try again.');
    }

    const token = await executeRecaptcha('login');

    if (!token) {
      throw new Error('reCAPTCHA verification failed. Please try again.');
    }

    return token;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    const email = id.trim();
    const passwordValue = password;

    if (!email || !passwordValue.trim()) {
      setErrorMessage('아이디와 비밀번호를 입력해 주세요.');
      return;
    }

    try {
      const recaptchaToken = await getRecaptchaToken();

      const loginResponse = await submitLogin({
        email,
        password: passwordValue,
        recaptcha_token: recaptchaToken,
      });

      if (rememberId) {
        localStorage.setItem('loginUserId', email);
        localStorage.setItem('loginRememberId', 'true');
      } else {
        localStorage.removeItem('loginUserId');
        localStorage.removeItem('loginRememberId');
      }

      if (loginResponse.requires_2fa) {
        setErrorMessage('2차 인증이 필요한 계정입니다.');
        return;
      }

      navigate(DEFAULT_APP_ROUTE, { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          setErrorMessage('아이디를 찾을 수 없습니다.');
          return;
        }

        if (error.response?.status === 409) {
          setErrorMessage('비밀번호가 올바르지 않습니다.');
          return;
        }
      }

      setErrorMessage('로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(124,106,247,0.12),_transparent_28%),linear-gradient(180deg,_#FFFFFF_0%,_#F5F7FB_100%)] px-4 text-slate-900"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_30px_120px_rgba(15,23,42,0.08)]">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
            <span className="text-lg font-bold">A</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">관리자 로그인</h1>
        </div>

        <div className="relative space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">아이디</span>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={idRef}
                value={id}
                onChange={(e) => {
                  setId(e.target.value);
                  if (errorMessage) {
                    setErrorMessage('');
                  }
                }}
                placeholder="아이디"
                autoComplete="username"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/10"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">비밀번호</span>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={pwdRef}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) {
                    setErrorMessage('');
                  }
                }}
                type={showPassword ? 'text' : 'password'}
                placeholder="비밀번호"
                autoComplete="current-password"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                onMouseDown={(event) => event.preventDefault()}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-800"
                aria-label="toggle password visibility"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRememberId((value) => !value)}
              className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                rememberId ? 'border-indigo-400 bg-indigo-400' : 'border-slate-300 bg-transparent'
              }`}
              aria-pressed={rememberId}
            >
              {rememberId && <span className="h-2 w-2 rounded-sm bg-white" />}
            </button>
            <button
              type="button"
              onClick={() => setRememberId((value) => !value)}
              className="text-sm text-slate-600 transition hover:text-slate-900"
            >
              아이디 기억하기
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>

          <p className="text-center text-[11px] leading-4 text-slate-400">
            이 사이트는 reCAPTCHA로 보호되며 Google{' '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-slate-600"
            >
              개인정보처리방침
            </a>
            과{' '}
            <a
              href="https://policies.google.com/terms"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-slate-600"
            >
              서비스 약관
            </a>
            이 적용됩니다.
          </p>

          {errorMessage ? (
            <p className="text-sm text-rose-500" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
