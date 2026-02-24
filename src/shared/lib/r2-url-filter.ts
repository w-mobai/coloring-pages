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

function buildLegacyPublicDomainBases(baseUrl: string): string[] {
  try {
    const parsed = new URL(baseUrl);
    const host = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol;
    const port = parsed.port ? `:${parsed.port}` : '';
    const basePath = trimSlashes(parsed.pathname || '');

    const hostCandidates = new Set<string>([host]);
    if (host.startsWith('static.')) {
      const rootHost = host.slice('static.'.length);
      if (rootHost) {
        hostCandidates.add(rootHost);
        hostCandidates.add(`www.${rootHost}`);
      }
    }

    const variants = new Set<string>();
    for (const candidateHost of hostCandidates) {
      const origin = `${protocol}//${candidateHost}${port}`;
      const fullBase = `${origin}${basePath ? `/${basePath}` : ''}`.replace(
        /\/+$/,
        ''
      );
      variants.add(fullBase);
    }

    return Array.from(variants);
  } catch {
    return [baseUrl];
  }
}

export function buildR2AllowedUrlPrefixes(configs: Configs): string[] {
  const prefixes = new Set<string>();

  const uploadPath = trimSlashes(configs.r2_upload_path || 'uploads');
  const bucket = trimSlashes(configs.r2_bucket_name || '');

  const publicDomainBase = normalizeBaseUrl(configs.r2_domain || '');
  if (publicDomainBase) {
    for (const publicBase of buildLegacyPublicDomainBases(publicDomainBase)) {
      prefixes.add(`${publicBase}/${uploadPath}/`);
    }
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

export function normalizeR2UrlToPrimaryPrefix(
  url: string,
  allowedPrefixes: string[]
): string {
  if (!url || allowedPrefixes.length === 0) {
    return url;
  }

  const primaryPrefix = allowedPrefixes[0];
  const matchedPrefix = allowedPrefixes.find((prefix) => url.startsWith(prefix));
  if (!matchedPrefix) {
    return url;
  }

  if (matchedPrefix === primaryPrefix) {
    return url;
  }

  return `${primaryPrefix}${url.slice(matchedPrefix.length)}`;
}
