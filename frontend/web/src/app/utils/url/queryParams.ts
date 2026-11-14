export const createScopedSearchParams = (
  source: URLSearchParams,
  allowedKeys: readonly string[],
) => {
  const allowed = new Set(allowedKeys);
  const next = new URLSearchParams();

  source.forEach((value, key) => {
    if (allowed.has(key)) {
      next.set(key, value);
    }
  });

  return next;
};

export const applyScopedSearchParams = (
  source: URLSearchParams,
  allowedKeys: readonly string[],
  updates: Record<string, string | undefined>,
) => {
  const next = createScopedSearchParams(source, allowedKeys);

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      next.delete(key);
      return;
    }

    next.set(key, value);
  });

  return next;
};

