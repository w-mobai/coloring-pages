import { setRequestLocale } from 'next-intl/server';

import { redirect } from '@/core/i18n/navigation';
import { AIMediaType, AITaskStatus } from '@/extensions/ai/types';
import {
  ImageHistory,
  type HistoryTaskGroup,
} from '@/shared/blocks/activity/image-history';
import {
  extractImageUrls,
  normalizeImageUrlForDedup,
  safeParseJSON,
} from '@/shared/lib/ai-image-history';
import { getAITasks, getAITasksCount } from '@/shared/models/ai_task';
import { getSignUser } from '@/shared/models/user';

const HISTORY_PAGE_SIZE = 24;

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string | number }>;
}) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  setRequestLocale(locale);

  const user = await getSignUser();
  if (!user?.id) {
    redirect({ href: '/sign-in', locale });
  }

  const total = await getAITasksCount({
    userId: user.id,
    mediaType: AIMediaType.IMAGE,
    status: AITaskStatus.SUCCESS,
  });
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const requestedPage = toPositiveInt(pageParam, 1);
  const page = Math.min(requestedPage, totalPages);

  const tasks = await getAITasks({
    userId: user.id,
    mediaType: AIMediaType.IMAGE,
    status: AITaskStatus.SUCCESS,
    page,
    limit: HISTORY_PAGE_SIZE,
  });

  const initialGroups: HistoryTaskGroup[] = tasks
    .map((task) => {
      const taskResult = safeParseJSON(task.taskResult);
      const taskInfo = safeParseJSON(task.taskInfo);
      const resultUrls = extractImageUrls(taskResult);
      const fallbackUrls = resultUrls.length > 0 ? [] : extractImageUrls(taskInfo);

      const seen = new Set<string>();
      const imageUrls = [...resultUrls, ...fallbackUrls].filter((url) => {
        if (!url) {
          return false;
        }

        const key = normalizeImageUrlForDedup(url);
        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });

      return {
        taskId: task.id,
        prompt: task.prompt,
        createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : null,
        images: imageUrls.map((imageUrl, index) => ({
          id: `${task.id}-${index + 1}`,
          taskId: task.id,
          imageUrl,
        })),
      };
    })
    .filter((group) => group.images.length > 0);

  return (
    <ImageHistory
      initialGroups={initialGroups}
      pagination={{
        total,
        page,
        limit: HISTORY_PAGE_SIZE,
      }}
    />
  );
}
