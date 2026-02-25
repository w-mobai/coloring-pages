import { unstable_cache } from 'next/cache';

import { AIMediaType, AITaskStatus } from '@/extensions/ai';
import {
  extractImageUrls,
  normalizeImageUrlForDedup,
  safeParseJSON,
} from '@/shared/lib/ai-image-history';
import {
  classifyColoringPrompt,
  extractUserPrompt,
  isColoringTaskPrompt,
  isLikelyHttpUrl,
} from '@/shared/lib/coloring-gallery';
import { listGuestAITasks } from '@/shared/lib/guest-ai-task';
import { listPersistedGuestColoringTasks } from '@/shared/lib/persistent-guest-coloring-gallery';
import {
  buildR2AllowedUrlPrefixes,
  isAllowedR2Url,
  normalizeR2UrlToPrimaryPrefix,
} from '@/shared/lib/r2-url-filter';
import { getAITasks } from '@/shared/models/ai_task';
import { CACHE_TAG_CONFIGS, getAllConfigs } from '@/shared/models/config';

export type PublicColoringGalleryItem = {
  id: string;
  taskId: string;
  url: string;
  createdAt: string | null;
  categoryKey: string;
  prompt: string | null;
};

type GalleryTaskItem = {
  id: string;
  taskId: string;
  prompt: string | null;
  taskInfo: string | null;
  taskResult: string | null;
  imageUrl?: string | null;
  mediaType?: AIMediaType;
  status?: AITaskStatus;
  createdAtMs: number;
};

export const DEFAULT_GALLERY_LIMIT = 24;
const MAX_GALLERY_LIMIT = 5000;
const MAX_SCAN_LIMIT = 20000;
export const PUBLIC_COLORING_GALLERY_CACHE_TAG = 'public-coloring-gallery';

async function fetchPublicColoringGalleryItems(
  normalizedLimit: number
): Promise<PublicColoringGalleryItem[]> {
  const scanLimit = Math.min(
    Math.max(normalizedLimit * 4, 80),
    MAX_SCAN_LIMIT
  );

  const configs = await getAllConfigs();
  const r2UrlPrefixes = buildR2AllowedUrlPrefixes(configs);
  if (r2UrlPrefixes.length === 0) {
    return [];
  }

  const tasks = await getAITasks({
    mediaType: AIMediaType.IMAGE,
    status: AITaskStatus.SUCCESS,
    page: 1,
    limit: scanLimit,
  });
  const guestTasks = (await listGuestAITasks())
    .filter(
      (task) =>
        task.mediaType === AIMediaType.IMAGE &&
        task.status === AITaskStatus.SUCCESS
    )
    .slice(0, scanLimit);
  const persistedGuestTasks = await listPersistedGuestColoringTasks({
    limit: scanLimit,
  });

  const mergedTasks: GalleryTaskItem[] = [
    ...tasks.map((task) => ({
      id: task.id,
      taskId: task.id,
      prompt: task.prompt,
      taskInfo: task.taskInfo,
      taskResult: task.taskResult,
      createdAtMs: task.createdAt ? new Date(task.createdAt).getTime() : 0,
    })),
    ...persistedGuestTasks.map((task) => ({
      id: task.id,
      taskId: task.id,
      prompt: task.prompt,
      taskInfo: null,
      taskResult: null,
      imageUrl: task.imageUrl,
      mediaType: AIMediaType.IMAGE,
      status: AITaskStatus.SUCCESS,
      createdAtMs: task.createdAt || 0,
    })),
    ...guestTasks.map((task) => ({
      id: task.id,
      taskId: task.id,
      prompt: task.prompt,
      taskInfo: task.taskInfo,
      taskResult: task.taskResult,
      createdAtMs: task.createdAt || 0,
    })),
  ].sort((a, b) => b.createdAtMs - a.createdAtMs);

  const seen = new Set<string>();
  const list: PublicColoringGalleryItem[] = [];

  for (const task of mergedTasks) {
    if (
      (task.mediaType && task.mediaType !== AIMediaType.IMAGE) ||
      (task.status && task.status !== AITaskStatus.SUCCESS)
    ) {
      continue;
    }

    if (!isColoringTaskPrompt(task.prompt)) {
      continue;
    }

    const userPrompt = extractUserPrompt(task.prompt);
    const taskResult = safeParseJSON(task.taskResult);
    const taskInfo = safeParseJSON(task.taskInfo);
    const directImageUrls = task.imageUrl ? [task.imageUrl] : [];
    const taskInfoImageUrls = extractImageUrls(taskInfo);
    const resultImageUrls = extractImageUrls(taskResult);
    const imageUrls = [...directImageUrls, ...taskInfoImageUrls, ...resultImageUrls];

    let selectedImageUrl: string | null = null;
    for (const imageUrl of imageUrls) {
      const normalizedImageUrl = normalizeR2UrlToPrimaryPrefix(
        imageUrl,
        r2UrlPrefixes
      );
      const dedupKey = normalizeImageUrlForDedup(normalizedImageUrl);
      if (
        !normalizedImageUrl ||
        !isLikelyHttpUrl(normalizedImageUrl) ||
        !isAllowedR2Url(normalizedImageUrl, r2UrlPrefixes) ||
        seen.has(dedupKey)
      ) {
        continue;
      }

      seen.add(dedupKey);
      selectedImageUrl = normalizedImageUrl;
      break;
    }

    if (!selectedImageUrl) {
      continue;
    }

    list.push({
      id: `${task.id}-${list.length + 1}`,
      taskId: task.taskId,
      url: selectedImageUrl,
      createdAt: task.createdAtMs ? new Date(task.createdAtMs).toISOString() : null,
      categoryKey: classifyColoringPrompt(userPrompt || task.prompt),
      prompt: userPrompt,
    });

    if (list.length >= normalizedLimit) {
      break;
    }
  }

  return list;
}

const getPublicColoringGalleryItemsCached = unstable_cache(
  async (normalizedLimit: number) =>
    fetchPublicColoringGalleryItems(normalizedLimit),
  ['public-coloring-gallery-items-v2'],
  {
    revalidate: 120,
    tags: [PUBLIC_COLORING_GALLERY_CACHE_TAG, CACHE_TAG_CONFIGS],
  }
);

export async function getPublicColoringGalleryItems({
  limit = DEFAULT_GALLERY_LIMIT,
}: {
  limit?: number;
} = {}): Promise<PublicColoringGalleryItem[]> {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.floor(limit), 1), MAX_GALLERY_LIMIT)
    : DEFAULT_GALLERY_LIMIT;

  return getPublicColoringGalleryItemsCached(normalizedLimit);
}
