import { useState, useRef, useCallback, useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

export const TOOLTIP_DESCRIPTIONS = {
  profitTarget:
    'The minimum profit you must achieve to successfully complete the evaluation phase.',
  maxDrawdownEod:
    "The maximum amount your account is allowed to lose. The drawdown threshold is calculated based on the End-of-Day (EOD) account balance and may adjust according to the account's trading rules.",
  dailyLossLimit:
    'The maximum loss allowed within a single trading day. Exceeding this limit may result in a rule violation or trading restriction, depending on the account type.',
  consistency:
    "A trading rule designed to ensure that profits are generated consistently rather than from a single large winning day. The maximum contribution of one trading day's profit is determined by the account's consistency requirements.",
  tradingPeriod:
    'The period or minimum number of trading days required to complete the evaluation. Any applicable minimum trading days, time limits, or unrestricted trading periods depend on the account type.',
  profitSplit:
    'Traders keep 80% of the profits generated, and the firm takes 20%.',
} as const;

interface InfoTooltipProps {
  content: string;
}

const MAX_W = 240;

export function InfoTooltip({ content }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);

  const reposition = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    // Center tooltip on icon, clamped to viewport
    const rawLeft = r.left + r.width / 2;
    const left = Math.max(MAX_W / 2 + 8, Math.min(rawLeft, window.innerWidth - MAX_W / 2 - 8));
    setStyle({
      position: 'fixed',
      // 8px gap between tooltip bottom and icon top
      top: r.top - 8,
      left,
      transform: 'translate(-50%, -100%)',
      zIndex: 9999,
      maxWidth: MAX_W,
    });
  }, []);

  const show = useCallback(() => {
    reposition();
    setOpen(true);
  }, [reposition]);

  const hide = useCallback(() => setOpen(false), []);

  // Keyboard: ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hide]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="More information"
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (open ? hide() : show())}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full
          bg-gray-600/25 border border-gray-500/35 text-gray-400
          hover:bg-gray-500/45 hover:border-gray-400/55 hover:text-gray-200
          focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400
          transition-colors cursor-help shrink-0 select-none leading-none text-[9px] font-extrabold"
      >
        !
      </button>

      {open &&
        createPortal(
          <div
            role="tooltip"
            style={style}
            className="relative px-3 py-2.5 bg-[#1a1a2e] border border-[#3a3a55] rounded-lg shadow-2xl"
          >
            <p className="text-gray-200 text-xs leading-relaxed">{content}</p>
            {/* Downward arrow */}
            <span
              aria-hidden="true"
              className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 block w-2.5 h-2.5
                bg-[#1a1a2e] border-b border-r border-[#3a3a55] rotate-45"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
