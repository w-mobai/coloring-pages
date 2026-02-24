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
import {
  buildR2AllowedUrlPrefixes,
  isAllowedR2Url,
  normalizeR2UrlToPrimaryPrefix,
} from '@/shared/lib/r2-url-filter';
import {
  getAITasksByImageUrlPrefixes,
  getAITasksCountByImageUrlPrefixes,
  getAITasks,
  getAITasksCount,
} from '@/shared/models/ai_task';
import { getAllConfigs } from '@/shared/models/config';
import { getMetadata } from '@/shared/lib/seo';
import { getSignUser } from '@/shared/models/user';

const HISTORY_PAGE_SIZE = 24;
export const generateMetadata = getMetadata({
  canonicalUrl: '/history',
  noIndex: true,
});

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function toHistoryTaskGroup(task: any, r2UrlPrefixes: string[]): HistoryTaskGroup | null {
  const shouldEnforceR2Prefix = r2UrlPrefixes.length > 0;
  const taskResult = safeParseJSON(task.taskResult);
  const taskInfo = safeParseJSON(task.taskInfo);
  const taskInfoUrls = extractImageUrls(taskInfo);
  const resultUrls = extractImageUrls(taskResult);

  const seen = new Set<string>();
  const imageUrls: string[] = [];
  for (const url of [...taskInfoUrls, ...resultUrls]) {
    if (!url) {
      continue;
    }

    const normalizedUrl = shouldEnforceR2Prefix
      ? normalizeR2UrlToPrimaryPrefix(url, r2UrlPrefixes)
      : url;

    if (shouldEnforceR2Prefix && !isAllowedR2Url(normalizedUrl, r2UrlPrefixes)) {
      continue;
    }

    const key = normalizeImageUrlForDedup(normalizedUrl);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    imageUrls.push(normalizedUrl);
  }

  if (imageUrls.length === 0) {
    return null;
  }

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
  const userId = user?.id;
  if (!userId) {
    redirect({ href: '/sign-in', locale });
  }
  const ensuredUserId = userId as string;

  const requestedPage = toPositiveInt(pageParam, 1);
  const configs = await getAllConfigs();
  const r2UrlPrefixes = buildR2AllowedUrlPrefixes(configs);
  const shouldEnforceR2Prefix = r2UrlPrefixes.length > 0;
  const total = shouldEnforceR2Prefix
    ? await getAITasksCountByImageUrlPrefixes({
        userId: ensuredUserId,
        mediaType: AIMediaType.IMAGE,
        status: AITaskStatus.SUCCESS,
        prefixes: r2UrlPrefixes,
      })
    : await getAITasksCount({
        userId: ensuredUserId,
        mediaType: AIMediaType.IMAGE,
        status: AITaskStatus.SUCCESS,
      });
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const tasks = total > 0
    ? shouldEnforceR2Prefix
      ? await getAITasksByImageUrlPrefixes({
          userId: ensuredUserId,
          mediaType: AIMediaType.IMAGE,
          status: AITaskStatus.SUCCESS,
          prefixes: r2UrlPrefixes,
          page,
          limit: HISTORY_PAGE_SIZE,
        })
      : await getAITasks({
          userId: ensuredUserId,
          mediaType: AIMediaType.IMAGE,
          status: AITaskStatus.SUCCESS,
          page,
          limit: HISTORY_PAGE_SIZE,
        })
    : [];
  const initialGroups = tasks
    .map((task) => toHistoryTaskGroup(task, r2UrlPrefixes))
    .filter((group): group is HistoryTaskGroup => Boolean(group));

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
