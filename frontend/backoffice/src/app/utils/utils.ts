// 연락처 대시표시 렌더링
export const phoneRender = (value: string) => {
  if (value !== undefined && value !== null && value !== '') {
    value = value
      .replace(/[^0-9]/g, '')
      .replace(/(^02|^0505|^1[0-9]{3}|^0[0-9]{2})([0-9]+)?([0-9]{4})/, '$1-$2-$3')
      .replace('--', '-');
  }
  return value;
};

const usdMoneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const kstDateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const kstDateTimeWithSecondFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export const formatUsdMoney = (value: number, options?: Intl.NumberFormatOptions) => {
  if (!options) return usdMoneyFormatter.format(value);

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    ...options,
  }).format(value);
};

export const formatSignedUsdMoney = (value: number) => {
  if (value > 0) return `+${formatUsdMoney(value)}`;
  if (value < 0) return `-${formatUsdMoney(Math.abs(value))}`;
  return formatUsdMoney(0);
};

export const formatSignedPercent = (value: number) => {
  if (value > 0) return `+${value}%`;
  if (value < 0) return `${value}%`;
  return '0%';
};

export const formatKstDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : kstDateTimeFormatter.format(date);
};

export const formatNumber = (value: number | null | undefined) =>
  typeof value === 'number' ? value.toLocaleString() : '0';

export const formatKstDateTimeParts = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, time: '-' };

  const parts = kstDateTimeWithSecondFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
  };
};

export const copyTextToClipboard = async (text: string) => {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  }
};
