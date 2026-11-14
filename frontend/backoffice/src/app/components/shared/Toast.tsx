import { useEffect } from 'react';
import { AlertTriangle, Check } from 'lucide-react';

type ToastType = 'success' | 'warning';

// 화면 하단에 잠깐 노출되는 토스트입니다.
export function Toast({
  message,
  dark,
  type = 'success',
  onDone,
}: {
  message: string;
  dark: boolean;
  type?: ToastType;
  onDone: () => void;
}) {
  const isWarning = type === 'warning';
  useEffect(() => {
    const id = setTimeout(onDone, 3000);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        background: dark ? '#1A2035' : '#1A1A1A',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: 10,
        fontSize: 13,
        fontFamily: "'Noto Sans KR',sans-serif",
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: isWarning ? '#D97706' : '#16A34A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isWarning ? (
          <AlertTriangle size={11} strokeWidth={2.5} style={{ color: '#fff' }} />
        ) : (
          <Check size={11} strokeWidth={2.5} style={{ color: '#fff' }} />
        )}
      </div>
      {message}
    </div>
  );
}
