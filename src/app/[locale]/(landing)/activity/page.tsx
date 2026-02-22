import { notFound } from 'next/navigation';

export default async function ActivityPage({
  params: _params,
}: {
  params: Promise<{ locale: string }>;
}) {
  notFound();
}
