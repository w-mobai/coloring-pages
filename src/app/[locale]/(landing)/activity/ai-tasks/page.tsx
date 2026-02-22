import { notFound } from 'next/navigation';

export default async function ActivityAiTasksPage({
  params: _params,
}: {
  params: Promise<{ locale: string }>;
}) {
  notFound();
}
