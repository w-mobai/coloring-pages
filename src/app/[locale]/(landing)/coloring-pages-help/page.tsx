import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';
import { getThemePage } from '@/core/theme';
import { normalizeMetadataCopy } from '@/shared/lib/seo';
import { getLocalPage } from '@/shared/models/post';

export const revalidate = 3600;

function buildCanonical(locale: string): string {
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');
  return locale !== defaultLocale
    ? `${appUrl}/${locale}/coloring-pages-help`
    : `${appUrl}/coloring-pages-help`;
}

function buildLanguageAlternates() {
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');
  const path = '/coloring-pages-help';
  const languages = Object.fromEntries(
    locales.map((locale) => [
      locale,
      locale !== defaultLocale ? `${appUrl}/${locale}${path}` : `${appUrl}${path}`,
    ])
  );

  return {
    ...languages,
    'x-default': `${appUrl}${path}`,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const post = await getLocalPage({
    slug: 'how-to-find-your-generation',
    locale,
  });

  const canonical = buildCanonical(locale);

  if (post) {
    const metadata = normalizeMetadataCopy({
      title: post.title || '',
      description: post.description || '',
    });
    return {
      title: metadata.title,
      description: metadata.description,
      alternates: {
        canonical,
        languages: buildLanguageAlternates(),
      },
    };
  }

  const t = await getTranslations({ locale, namespace: 'common.metadata' });
  const metadata = normalizeMetadataCopy({
    title: t('title'),
    description: t('description'),
  });
  return {
    title: metadata.title,
    description: metadata.description,
    alternates: {
      canonical,
      languages: buildLanguageAlternates(),
    },
  };
}

export default async function ColoringPangesHelpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const post = await getLocalPage({
    slug: 'how-to-find-your-generation',
    locale,
  });

  if (!post) {
    return notFound();
  }

  const Page = await getThemePage('static-page');
  return <Page locale={locale} post={post} />;
}
