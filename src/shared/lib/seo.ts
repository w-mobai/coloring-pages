import { getTranslations, setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';

// get metadata for page component
export function getMetadata(
  options: {
    title?: string;
    description?: string;
    metadataKey?: string;
    canonicalUrl?: string; // relative path or full url
    imageUrl?: string;
    appName?: string;
    noIndex?: boolean;
  } = {}
) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }) {
    const { locale } = await params;
    setRequestLocale(locale);

    // passed metadata
    const passedMetadata = {
      title: options.title,
      description: options.description,
    };

    // default metadata
    const defaultMetadata = await getTranslatedMetadata(
      defaultMetadataKey,
      locale
    );

    // translated metadata
    let translatedMetadata: any = {};
    if (options.metadataKey) {
      translatedMetadata = await getTranslatedMetadata(
        options.metadataKey,
        locale
      );
    }

    const hasExplicitCanonical = Boolean(options.canonicalUrl);
    const canonicalUrl = hasExplicitCanonical
      ? await getCanonicalUrl(options.canonicalUrl || '', locale || '')
      : '';

    const title =
      passedMetadata.title || translatedMetadata.title || defaultMetadata.title;
    const description =
      passedMetadata.description ||
      translatedMetadata.description ||
      defaultMetadata.description;

    // image url
    let imageUrl = options.imageUrl || envConfigs.app_preview_image;
    if (imageUrl.startsWith('http')) {
      imageUrl = imageUrl;
    } else {
      imageUrl = `${envConfigs.app_url}${imageUrl}`;
    }

    // app name
    let appName = options.appName;
    if (!appName) {
      appName = envConfigs.app_name || '';
    }

    // Google site verification
    const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

    const metadata: any = {
      title:
        passedMetadata.title ||
        translatedMetadata.title ||
        defaultMetadata.title,
      description:
        passedMetadata.description ||
        translatedMetadata.description ||
        defaultMetadata.description,

      openGraph: {
        type: 'website',
        locale: locale,
        title,
        description,
        siteName: appName,
        images: [imageUrl.toString()],
      },

      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl.toString()],
        site: envConfigs.app_url,
      },

      robots: {
        index: options.noIndex ? false : true,
        follow: options.noIndex ? false : true,
      },
    };

    if (hasExplicitCanonical) {
      metadata.alternates = {
        canonical: canonicalUrl,
        languages: buildLocaleAlternates(
          normalizeCanonicalPath(options.canonicalUrl || '/')
        ),
      };
      metadata.openGraph.url = canonicalUrl;
    }

    // Add Google site verification if available
    if (googleSiteVerification) {
      metadata.verification = {
        google: googleSiteVerification,
      };
    }

    return metadata;
  };
}

const defaultMetadataKey = 'common.metadata';

async function getTranslatedMetadata(metadataKey: string, locale: string) {
  setRequestLocale(locale);
  const t = await getTranslations(metadataKey);

  return {
    title: t.has('title') ? t('title') : '',
    description: t.has('description') ? t('description') : '',
  };
}

async function getCanonicalUrl(canonicalUrl: string, locale: string) {
  if (!canonicalUrl) {
    canonicalUrl = '/';
  }

  if (canonicalUrl.startsWith('http')) {
    // full url
    canonicalUrl = canonicalUrl;
  } else {
    // relative path
    if (!canonicalUrl.startsWith('/')) {
      canonicalUrl = `/${canonicalUrl}`;
    }

    canonicalUrl = `${envConfigs.app_url}${
      !locale || locale === defaultLocale ? '' : `/${locale}`
    }${canonicalUrl}`;

    if (locale !== defaultLocale && canonicalUrl.endsWith('/')) {
      canonicalUrl = canonicalUrl.slice(0, -1);
    }
  }

  return canonicalUrl;
}

function normalizeCanonicalPath(canonicalUrl: string): string {
  let path = canonicalUrl || '/';

  if (path.startsWith('http')) {
    try {
      path = new URL(path).pathname || '/';
    } catch {
      path = '/';
    }
  }

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  for (const locale of locales) {
    if (locale === defaultLocale) {
      continue;
    }

    if (path === `/${locale}`) {
      return '/';
    }

    if (path.startsWith(`/${locale}/`)) {
      path = path.slice(locale.length + 1) || '/';
      break;
    }
  }

  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  return path || '/';
}

function buildLocaleAlternates(path: string) {
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');

  const alternates = Object.fromEntries(
    locales.map((locale) => {
      const localizedPath =
        locale === defaultLocale
          ? path
          : path === '/'
            ? `/${locale}`
            : `/${locale}${path}`;
      return [locale, `${appUrl}${localizedPath}`];
    })
  );

  return {
    ...alternates,
    'x-default': `${appUrl}${path}`,
  };
}
