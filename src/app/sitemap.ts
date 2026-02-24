import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';
import { buildColoringPageDetailPath } from '@/shared/lib/coloring-page-seo';
import { getPublicColoringGalleryItems } from '@/shared/lib/public-coloring-gallery';
import { getPostsAndCategories } from '@/shared/models/post';

type SeoRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

const seoRoutes: SeoRoute[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/coloring-pages', changeFrequency: 'daily', priority: 0.9 },
  {
    path: '/coloring-pages-help',
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  { path: '/blog', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/updates', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/privacy-policy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms-of-service', changeFrequency: 'yearly', priority: 0.3 },
];

const DYNAMIC_BLOG_LIMIT = 1000;
const DYNAMIC_COLORING_LIMIT = 2000;

function withLocale(path: string, locale: string) {
  if (locale === defaultLocale) {
    return path;
  }
  if (path === '/') {
    return `/${locale}`;
  }
  return `/${locale}${path}`;
}

function toAbsoluteUrl(appUrl: string, path: string) {
  return `${appUrl}${path}`;
}

function normalizeRelativePath(path: string): string {
  const trimmed = (path || '').trim();
  if (!trimmed) {
    return '/';
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return `/${trimmed}`;
}

function parseDate(value: string | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}

function addEntry(
  entries: MetadataRoute.Sitemap,
  seen: Set<string>,
  entry: MetadataRoute.Sitemap[number]
) {
  if (seen.has(entry.url)) {
    return;
  }

  seen.add(entry.url);
  entries.push(entry);
}

export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');

  const entries: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();

  for (const route of seoRoutes) {
    for (const locale of locales) {
      const localizedPath = withLocale(route.path, locale);
      const alternates = Object.fromEntries(
        locales.map((altLocale) => [
          altLocale,
          `${appUrl}${withLocale(route.path, altLocale)}`,
        ])
      );

      addEntry(entries, seen, {
        url: toAbsoluteUrl(appUrl, localizedPath),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: {
            ...alternates,
            'x-default': `${appUrl}${route.path}`,
          },
        },
      });
    }
  }

  for (const locale of locales) {
    try {
      const { posts } = await getPostsAndCategories({
        locale,
        page: 1,
        limit: DYNAMIC_BLOG_LIMIT,
      });

      for (const post of posts) {
        const postPath = normalizeRelativePath(post.url || `/blog/${post.slug || ''}`);
        const localizedPath = withLocale(postPath, locale);
        addEntry(entries, seen, {
          url: toAbsoluteUrl(appUrl, localizedPath),
          changeFrequency: 'weekly',
          priority: 0.7,
          ...(parseDate(post.date || post.created_at) ? { lastModified: parseDate(post.date || post.created_at) } : {}),
        });
      }

    } catch (error) {
      console.error(`failed to build blog sitemap entries for locale ${locale}:`, error);
    }
  }

  try {
    const items = await getPublicColoringGalleryItems({
      limit: DYNAMIC_COLORING_LIMIT,
    });

    for (const item of items) {
      const languageAlternates = Object.fromEntries(
        locales.map((locale) => [
          locale,
          `${appUrl}${buildColoringPageDetailPath({
            locale,
            taskId: item.taskId,
            prompt: item.prompt,
          })}`,
        ])
      );

      for (const locale of locales) {
        const localizedPath = buildColoringPageDetailPath({
          locale,
          taskId: item.taskId,
          prompt: item.prompt,
        });

        addEntry(entries, seen, {
          url: toAbsoluteUrl(appUrl, localizedPath),
          changeFrequency: 'weekly',
          priority: 0.75,
          ...(parseDate(item.createdAt) ? { lastModified: parseDate(item.createdAt) } : {}),
          alternates: {
            languages: {
              ...languageAlternates,
              'x-default': `${appUrl}${buildColoringPageDetailPath({
                locale: defaultLocale,
                taskId: item.taskId,
                prompt: item.prompt,
              })}`,
            },
          },
        });
      }
    }
  } catch (error) {
    console.error('failed to build coloring detail sitemap entries:', error);
  }

  return entries;
}
