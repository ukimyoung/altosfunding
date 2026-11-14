const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

const toUtcDate = (value: string | Date) => {
  if (value instanceof Date) {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  // Treat plain backend timestamps as UTC unless a timezone is already present.
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(trimmed);
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const parsed = new Date(hasTimezone ? normalized : `${normalized}Z`);

  return isValidDate(parsed) ? parsed : null;
};

const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const getNextBrowserMidnight = (now = new Date()) => ({
  expiresAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime(),
  timeZone: getBrowserTimeZone(),
});

const getDateTimeParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return formatter.formatToParts(date).reduce(
    (acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }

      return acc;
    },
    {} as Record<string, string>,
  );
};

export const formatBrowserGmtOffset = (value?: string | Date) => {
  const date = value ? toUtcDate(value) : new Date();

  if (!date) {
    return '';
  }

  const offsetMinutes = -date.getTimezoneOffset();

  if (offsetMinutes === 0) {
    return 'GMT';
  }

  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;

  return minutes === 0
    ? `GMT${sign}${hours}`
    : `GMT${sign}${hours}:${String(minutes).padStart(2, '0')}`;
};

export const formatDateByBrowserTimeZone = (value: string | Date) => {
  const date = toUtcDate(value);

  if (!date) {
    return '';
  }

  const timeZone = getBrowserTimeZone();
  const parts = getDateTimeParts(date, timeZone);

  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const formatDateTimeByBrowserTimeZone = (value: string | Date) => {
  const date = toUtcDate(value);

  if (!date) {
    return '';
  }

  const timeZone = getBrowserTimeZone();
  const parts = getDateTimeParts(date, timeZone);

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

export const formatGmtDate = formatDateByBrowserTimeZone;
export const formatGmtDateTime = formatDateTimeByBrowserTimeZone;
