import { eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { config } from '@/config/db/schema';

const PERSISTED_GUEST_COLORING_CONFIG_KEY = 'public_guest_coloring_tasks_v1';
const MAX_PERSISTED_GUEST_COLORING_ITEMS = 800;
const PUBLIC_COLORING_GALLERY_CACHE_TAG = 'public-coloring-gallery';

export type PersistedGuestColoringTask = {
  id: string;
  mediaType: string;
  status: string;
  provider: string;
  model: string;
  prompt: string | null;
  imageUrl: string;
  createdAt: number;
};

function isValidPersistedTask(item: any): item is PersistedGuestColoringTask {
  return (
    item &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.mediaType === 'string' &&
    typeof item.status === 'string' &&
    typeof item.provider === 'string' &&
    typeof item.model === 'string' &&
    typeof item.imageUrl === 'string' &&
    typeof item.createdAt === 'number'
  );
}

async function getPersistedItemsRaw(): Promise<PersistedGuestColoringTask[]> {
  if (!envConfigs.database_url) {
    return [];
  }

  const [row] = await db()
    .select({ value: config.value })
    .from(config)
    .where(eq(config.name, PERSISTED_GUEST_COLORING_CONFIG_KEY))
    .limit(1);

  const raw = row?.value;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidPersistedTask);
  } catch {
    return [];
  }
}

async function savePersistedItems(
  items: PersistedGuestColoringTask[]
): Promise<void> {
  if (!envConfigs.database_url) {
    return;
  }

  const serialized = JSON.stringify(items);
  await db()
    .insert(config)
    .values({
      name: PERSISTED_GUEST_COLORING_CONFIG_KEY,
      value: serialized,
    })
    .onConflictDoUpdate({
      target: config.name,
      set: {
        value: serialized,
      },
    });

  revalidateTag(PUBLIC_COLORING_GALLERY_CACHE_TAG, 'max');
}

export async function listPersistedGuestColoringTasks({
  limit,
}: {
  limit?: number;
} = {}): Promise<PersistedGuestColoringTask[]> {
  const items = await getPersistedItemsRaw();
  const sorted = items.sort((a, b) => b.createdAt - a.createdAt);

  if (!limit || !Number.isFinite(limit)) {
    return sorted;
  }

  const normalizedLimit = Math.max(1, Math.floor(limit));
  return sorted.slice(0, normalizedLimit);
}

export async function findPersistedGuestColoringTaskById(
  id: string
): Promise<PersistedGuestColoringTask | null> {
  if (!id) {
    return null;
  }

  const items = await getPersistedItemsRaw();
  return items.find((item) => item.id === id) || null;
}

export async function upsertPersistedGuestColoringTask(
  task: PersistedGuestColoringTask
): Promise<void> {
  if (!task?.id || !task?.imageUrl) {
    return;
  }

  const items = await getPersistedItemsRaw();
  const next = [task, ...items.filter((item) => item.id !== task.id)].slice(
    0,
    MAX_PERSISTED_GUEST_COLORING_ITEMS
  );
  await savePersistedItems(next);
}

