import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { defaultLocale } from '@/config/locale';
import { routing } from '@/core/i18n/config';
import { ThemeProvider } from '@/core/theme/provider';
import { Toaster } from '@/shared/components/ui/sonner';
import { AppContextProvider } from '@/shared/contexts/app';
import { getMetadata } from '@/shared/lib/seo';

export const generateMetadata = getMetadata();

function buildLocalizedSiteUrl(locale: string): string {
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');
  if (locale === defaultLocale) {
    return appUrl;
  }
  return `${appUrl}/${locale}`;
}

function toAbsoluteUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');
  return url.startsWith('/') ? `${appUrl}${url}` : `${appUrl}/${url}`;
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const localizedSiteUrl = buildLocalizedSiteUrl(locale);
  const websiteStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: envConfigs.app_name,
    description: envConfigs.app_description,
    url: localizedSiteUrl,
    inLanguage: locale,
  };
  const organizationStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: envConfigs.app_name,
    url: envConfigs.app_url,
    logo: toAbsoluteUrl(envConfigs.app_logo),
  };

  return (
    <NextIntlClientProvider>
      <ThemeProvider>
        <AppContextProvider>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(websiteStructuredData),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(organizationStructuredData),
            }}
          />
          {children}
          <Toaster position="top-center" richColors />
        </AppContextProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
