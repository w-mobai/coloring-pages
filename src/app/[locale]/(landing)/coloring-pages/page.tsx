import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;
export const generateMetadata = getMetadata({
  metadataKey: 'pages.coloring-pages.metadata',
  canonicalUrl: '/coloring-pages',
});

export default async function ColoringPagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.coloring-pages');
  const page: DynamicPage = t.raw('page');

  const Page = await getThemePage('dynamic-page');
  return <Page locale={locale} page={page} />;
}
