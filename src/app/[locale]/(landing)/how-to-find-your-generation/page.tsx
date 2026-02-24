import { redirect } from '@/core/i18n/navigation';

export default async function LegacyHelpPathRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: '/coloring-pages-help', locale });
}
