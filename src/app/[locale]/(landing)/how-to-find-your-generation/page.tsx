import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { getThemePage } from '@/core/theme';
import { getLocalPage } from '@/shared/models/post';

export const revalidate = 3600;

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

  const canonical =
    locale !== envConfigs.locale
      ? `${envConfigs.app_url}/${locale}/how-to-find-your-generation`
      : `${envConfigs.app_url}/how-to-find-your-generation`;

  if (post) {
    return {
      title: post.title || '',
      description: post.description || '',
      alternates: {
        canonical,
      },
    };
  }

  const t = await getTranslations({ locale, namespace: 'common.metadata' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical,
    },
  };
}

export default async function HowToFindYourGenerationPage({
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
