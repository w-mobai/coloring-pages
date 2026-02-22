import { Configs } from '@/shared/models/config';

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function normalizeBaseUrl(value: string): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    const basePath = trimSlashes(parsed.pathname || '');
    const base = `${parsed.origin}${basePath ? `/${basePath}` : ''}`;
    return base.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function buildR2AllowedUrlPrefixes(configs: Configs): string[] {
  const prefixes = new Set<string>();

  const uploadPath = trimSlashes(configs.r2_upload_path || 'uploads');
  const bucket = trimSlashes(configs.r2_bucket_name || '');

  const publicDomainBase = normalizeBaseUrl(configs.r2_domain || '');
  if (publicDomainBase) {
    prefixes.add(`${publicDomainBase}/${uploadPath}/`);
  }

  const endpointBase =
    normalizeBaseUrl(configs.r2_endpoint || '') ||
    (configs.r2_account_id
      ? `https://${trimSlashes(configs.r2_account_id)}.r2.cloudflarestorage.com`
      : null);

  if (endpointBase && bucket) {
    prefixes.add(`${endpointBase}/${bucket}/${uploadPath}/`);
  }

  return Array.from(prefixes);
}

export function isAllowedR2Url(
  url: string,
  allowedPrefixes: string[]
): boolean {
  if (!url || allowedPrefixes.length === 0) {
    return false;
  }

  return allowedPrefixes.some((prefix) => url.startsWith(prefix));
}
