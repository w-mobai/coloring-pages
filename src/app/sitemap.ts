import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';

type SeoRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

const seoRoutes: SeoRoute[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/coloring-pages', changeFrequency: 'daily', priority: 0.9 },
  {
    path: '/how-to-find-your-generation',
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  { path: '/blog', changeFrequency: 'weekly', priority: 0.8 },
  {
    path: '/blog/what-generation-am-i',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  { path: '/updates', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/privacy-policy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms-of-service', changeFrequency: 'yearly', priority: 0.3 },
];

function withLocale(path: string, locale: string) {
  if (locale === defaultLocale) {
    return path;
  }
  if (path === '/') {
    return `/${locale}`;
  }
  return `/${locale}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');

  const entries: MetadataRoute.Sitemap = [];

  for (const route of seoRoutes) {
    for (const locale of locales) {
      const localizedPath = withLocale(route.path, locale);
      const alternates = Object.fromEntries(
        locales.map((altLocale) => [
          altLocale,
          `${appUrl}${withLocale(route.path, altLocale)}`,
        ])
      );

      entries.push({
        url: `${appUrl}${localizedPath}`,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: alternates,
        },
      });
    }
  }

  return entries;
}
