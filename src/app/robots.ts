import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';
import { locales } from '@/config/locale';

export default function robots(): MetadataRoute.Robots {
  const appUrl = envConfigs.app_url;
  const disallowBasePaths = [
    '/sign-in',
    '/sign-up',
    '/verify-email',
    '/settings/*',
    '/activity/*',
    '/history/*',
    '/admin/*',
    '/api/*',
  ];
  const disallow = Array.from(
    new Set([
      '/*?*q=',
      ...disallowBasePaths,
      ...locales.flatMap((locale) =>
        disallowBasePaths.map((path) => `/${locale}${path}`)
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
