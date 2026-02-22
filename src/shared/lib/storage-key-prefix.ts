function toSafePathSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._@-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildUserStorageKeyPrefix({
  email,
  fallbackId,
}: {
  email?: string | null;
  fallbackId?: string | null;
}): string | null {
  const safeEmail = email ? toSafePathSegment(email) : '';
  if (safeEmail) {
    return `users/${safeEmail}`;
  }

  const safeId = fallbackId ? toSafePathSegment(fallbackId) : '';
  if (safeId) {
    return `users/${safeId}`;
  }

  return null;
}
