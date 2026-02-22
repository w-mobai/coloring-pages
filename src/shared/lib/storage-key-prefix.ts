function toSafePathSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildUserStorageKeyPrefix({
  fallbackId,
}: {
  fallbackId?: string | null;
}): string | null {
  const safeId = fallbackId ? toSafePathSegment(fallbackId) : '';
  if (safeId) {
    return `users/${safeId}`;
  }

  return null;
}

export function buildGuestStorageKeyPrefix({
  ownerKey,
}: {
  ownerKey?: string | null;
}): string {
  const safeOwnerKey = ownerKey ? toSafePathSegment(ownerKey).slice(0, 24) : '';
  if (safeOwnerKey) {
    return `guest/${safeOwnerKey}`;
  }

  return 'guest';
}
