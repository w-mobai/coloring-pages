import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';
import { locales } from '@/config/locale';

export default function robots(): MetadataRoute.Robots {
  const appUrl = envConfigs.app_url;
  const disallowPathGroups = [
    '/sign-in',
    '/sign-up',
    '/verify-email',
    '/settings',
    '/settings/*',
    '/activity',
    '/activity/*',
    '/history',
    '/history/*',
    '/admin',
    '/admin/*',
    '/api/*',
  ];
  const disallow = Array.from(
    new Set([
      '/*?*q=',
      ...disallowPathGroups,
      ...locales.flatMap((locale) =>
        disallowPathGroups.map((path) => `/${locale}${path}`)
      ),
      ...locales.map((locale) => `/${locale}/*?*q=`),
    ])
  );

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow,
    },
    host: appUrl,
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
