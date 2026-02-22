const IMAGE_URL_FIELDS = ['url', 'uri', 'image', 'src', 'imageUrl', 'originalUrl'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function safeParseJSON(value: string | null): any {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function extractImageUrls(payload: any): string[] {
  if (!payload) {
    return [];
  }

  const output =
    payload.output ??
    payload.images ??
    payload.data ??
    payload.resultUrls ??
    payload.urls;

  if (!output && payload.resultJson) {
    return extractImageUrls(safeParseJSON(payload.resultJson as string));
  }

  if (!output) {
    return [];
  }

  if (typeof output === 'string') {
    return [output];
  }

  if (Array.isArray(output)) {
    return output
      .flatMap((item) => {
        if (!item) return [];
        if (typeof item === 'string') return [item];
        if (isRecord(item)) {
          for (const field of IMAGE_URL_FIELDS) {
            const candidate = item[field];
            if (typeof candidate === 'string') {
              return [candidate];
            }
          }
        }
        return [];
      })
      .filter(Boolean);
  }

  if (isRecord(output)) {
    for (const field of IMAGE_URL_FIELDS) {
      const candidate = output[field];
      if (typeof candidate === 'string') {
        return [candidate];
      }
    }
  }

  return [];
}

export function normalizeImageUrlForDedup(value: string): string {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return value.split('#')[0].split('?')[0] || value;
  }
}

function isSameImageUrl(a: string, b: string): boolean {
  return normalizeImageUrlForDedup(a) === normalizeImageUrlForDedup(b);
}

function removeImageFromUnknown(
  value: unknown,
  targetUrl: string
): { value: unknown; removed: boolean } {
  if (typeof value === 'string') {
    if (isSameImageUrl(value, targetUrl)) {
      return { value: null, removed: true };
    }
    return { value, removed: false };
  }

  if (Array.isArray(value)) {
    let removed = false;
    const next: unknown[] = [];
    for (const item of value) {
      const result = removeImageFromUnknown(item, targetUrl);
      removed = removed || result.removed;
      if (result.value !== null && result.value !== undefined) {
        next.push(result.value);
      }
    }
    return { value: next, removed };
  }

  if (!isRecord(value)) {
    return { value, removed: false };
  }

  for (const field of IMAGE_URL_FIELDS) {
    const candidate = value[field];
    if (typeof candidate === 'string' && isSameImageUrl(candidate, targetUrl)) {
      return { value: null, removed: true };
    }
  }

  let removed = false;
  const next: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (key === 'resultJson' && typeof item === 'string') {
      const parsedResultJson = safeParseJSON(item);
      if (parsedResultJson) {
        const result = removeImageFromUnknown(parsedResultJson, targetUrl);
        removed = removed || result.removed;
        if (result.value !== null && result.value !== undefined) {
          next[key] = JSON.stringify(result.value);
        }
        continue;
      }
    }

    const result = removeImageFromUnknown(item, targetUrl);
    removed = removed || result.removed;
    if (result.value !== null && result.value !== undefined) {
      next[key] = result.value;
    }
  }

  return { value: next, removed };
}

export function removeImageUrlFromPayload(
  payload: any,
  targetUrl: string
): { payload: any; removed: boolean } {
  if (!payload) {
    return { payload, removed: false };
  }

  const result = removeImageFromUnknown(payload, targetUrl);
  return {
    payload: result.value,
    removed: result.removed,
  };
}
