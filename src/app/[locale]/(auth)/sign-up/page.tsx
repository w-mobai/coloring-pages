import { getTranslations } from 'next-intl/server';

import { envConfigs } from '@/config';
import { defaultLocale } from '@/config/locale';
import { redirect } from '@/core/i18n/navigation';
import { SignUpForm } from '@/shared/blocks/sign/sign-up-form';
import { normalizeMetadataCopy } from '@/shared/lib/seo';
import { getSignUser } from '@/shared/models/user';

function safeInternalPath(raw?: string) {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  return raw;
}

function stripLocalePrefix(path: string, locale: string) {
  if (!path?.startsWith('/')) return '/';
  if (locale === defaultLocale) return path;
  if (path === `/${locale}`) return '/';
  if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1) || '/';
  return path;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const t = await getTranslations('common');
  const metadata = normalizeMetadataCopy({
    title: `${t('sign.sign_up_title')} - ${t('metadata.title')}`,
    description: t('sign.sign_up_description'),
  });

  return {
    title: metadata.title,
    description: metadata.description,
    alternates: {
      canonical:
        locale !== defaultLocale
          ? `${envConfigs.app_url}/${locale}/sign-up`
          : `${envConfigs.app_url}/sign-up`,
    },
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

export default async function SignUpPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
  params: Promise<{ locale: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const { locale } = await params;
  const t = await getTranslations('common.sign');

  // If user is already signed in, don't show sign-up form again.
  const sessionUser = await getSignUser();
  if (sessionUser) {
    const target = stripLocalePrefix(safeInternalPath(callbackUrl), locale);
    redirect({ href: target || '/', locale });
  }

  return (
    <div className="mx-auto w-full max-w-[425px] rounded-xl border bg-card/95 p-6 shadow-lg backdrop-blur-sm">
      <div className="mb-4 space-y-1">
        <h1 className="text-lg font-semibold md:text-xl">{t('sign_up_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('sign_up_description')}</p>
      </div>
      <SignUpForm callbackUrl={callbackUrl || '/'} />
    </div>
  );
}
