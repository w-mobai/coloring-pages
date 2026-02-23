import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';
import { getPost } from '@/shared/models/post';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

function buildCanonicalUrl(locale: string, slug: string): string {
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');
  return locale !== defaultLocale
    ? `${appUrl}/${locale}/blog/${slug}`
    : `${appUrl}/blog/${slug}`;
}

function buildLanguageAlternates(slug: string) {
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');
  const languages = Object.fromEntries(
    locales.map((locale) => [
      locale,
      locale !== defaultLocale
        ? `${appUrl}/${locale}/blog/${slug}`
        : `${appUrl}/blog/${slug}`,
    ])
  );

  return {
    ...languages,
    'x-default': `${appUrl}/blog/${slug}`,
  };
}

function toAbsoluteUrl(imageUrl?: string): string | undefined {
  if (!imageUrl) {
    return undefined;
  }

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  if (imageUrl.startsWith('/')) {
    return `${envConfigs.app_url.replace(/\/+$/, '')}${imageUrl}`;
  }

  return `${envConfigs.app_url.replace(/\/+$/, '')}/${imageUrl}`;
}

function toIsoDate(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations('pages.blog.metadata');

  const canonicalUrl = buildCanonicalUrl(locale, slug);

  const post = await getPost({ slug, locale });
  if (!post) {
    notFound();
  }

  const imageUrl = toAbsoluteUrl(post.image);
  const publishedTime = toIsoDate(post.created_at);
  const title = `${post.title} | ${t('title')}`;
  const description = post.description || t('description');

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: buildLanguageAlternates(slug),
    },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
      ...(publishedTime ? { publishedTime } : {}),
      ...(post.author_name ? { authors: [post.author_name] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = await getPost({ slug, locale });

  if (!post) {
    notFound();
  }

  // build page sections
  const page: DynamicPage = {
    sections: {
      blogDetail: {
        block: 'blog-detail',
        data: {
          post,
        },
      },
    },
  };

  const Page = await getThemePage('dynamic-page');
  const canonicalUrl = buildCanonicalUrl(locale, slug);
  const imageUrl = toAbsoluteUrl(post.image);
  const publishedTime = toIsoDate(post.created_at);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title || '',
    description: post.description || '',
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    ...(imageUrl ? { image: [imageUrl] } : {}),
    ...(publishedTime ? { datePublished: publishedTime } : {}),
    ...(post.author_name
      ? {
          author: {
            '@type': 'Person',
            name: post.author_name,
          },
        }
      : {}),
  };

  return (
    <>
      <Page locale={locale} page={page} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
