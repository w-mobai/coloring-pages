import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';
import { getLocalPage } from '@/shared/models/post';

export const revalidate = 3600;

function normalizePagePath(slug: string): string {
  const trimmed = (slug || '').trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '/';
}

function buildCanonical(locale: string, path: string): string {
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');
  if (locale !== defaultLocale) {
    return path === '/' ? `${appUrl}/${locale}` : `${appUrl}/${locale}${path}`;
  }
  return `${appUrl}${path}`;
}

function buildLanguageAlternates(path: string) {
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');
  const languages = Object.fromEntries(
    locales.map((locale) => {
      if (locale !== defaultLocale) {
        return [
          locale,
          path === '/' ? `${appUrl}/${locale}` : `${appUrl}/${locale}${path}`,
        ];
      }
      return [locale, `${appUrl}${path}`];
    })
  );

  return {
    ...languages,
    'x-default': `${appUrl}${path}`,
  };
}

// dynamic page metadata
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  // metadata values
  let title = '';
  let description = '';
  let canonicalUrl = '';

  // 1. try to get static page metadata from
  // content/pages/**/*.mdx

  // static page slug
  const staticPageSlug =
    typeof slug === 'string' ? slug : (slug as string[]).join('/') || '';

  // filter invalid slug
  if (staticPageSlug.includes('.')) {
    return;
  }

  // build canonical url
  const canonicalPath = normalizePagePath(staticPageSlug);
  canonicalUrl = buildCanonical(locale, canonicalPath);
  const languageAlternates = buildLanguageAlternates(canonicalPath);

  // get static page content
  const staticPage = await getLocalPage({ slug: staticPageSlug, locale });

  // return static page metadata
  if (staticPage) {
    title = staticPage.title || '';
    description = staticPage.description || '';

    return {
      title,
      description,
      alternates: {
        canonical: canonicalUrl,
        languages: languageAlternates,
      },
    };
  }

  // 2. static page not found, try to get dynamic page metadata from
  // src/config/locale/messages/{locale}/pages/**/*.json

  // dynamic page slug
  const dynamicPageSlug =
    typeof slug === 'string' ? slug : (slug as string[]).join('.') || '';

  const messageKey = `pages.${dynamicPageSlug}`;
  try {
    const t = await getTranslations({ locale, namespace: messageKey });

    // return dynamic page metadata
    if (t.has('metadata')) {
      title = t.raw('metadata.title');
      description = t.raw('metadata.description');

      return {
        title,
        description,
        alternates: {
          canonical: canonicalUrl,
          languages: languageAlternates,
        },
      };
    }
  } catch {
    // ignore translation lookup failures and fallback to common metadata
  }

  // 3. return common metadata
  const tc = await getTranslations('common.metadata');

  title = tc('title');
  description = tc('description');

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: languageAlternates,
    },
  };
}

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // 1. try to get static page from
  // content/pages/**/*.mdx

  // static page slug
  const staticPageSlug =
    typeof slug === 'string' ? slug : (slug as string[]).join('/') || '';

  // filter invalid slug
  if (staticPageSlug.includes('.')) {
    return notFound();
  }

  // get static page content
  const staticPage = await getLocalPage({ slug: staticPageSlug, locale });

  // return static page
  if (staticPage) {
    const Page = await getThemePage('static-page');

    return <Page locale={locale} post={staticPage} />;
  }

  // 2. static page not found
  // try to get dynamic page content from
  // src/config/locale/messages/{locale}/pages/**/*.json

  // dynamic page slug
  const dynamicPageSlug =
    typeof slug === 'string' ? slug : (slug as string[]).join('.') || '';

  const messageKey = `pages.${dynamicPageSlug}`;

  try {
    const t = await getTranslations({ locale, namespace: messageKey });

    // return dynamic page
    if (t.has('page')) {
      const Page = await getThemePage('dynamic-page');
      return <Page locale={locale} page={t.raw('page')} />;
    }
  } catch (error) {
    // ignore error if translation not found
    return notFound();
  }

  // 3. page not found
  return notFound();
}
