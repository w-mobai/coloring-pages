import { eq, like } from 'drizzle-orm';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { config } from '@/config/db/schema';
import { AIMediaType, AITaskStatus } from '@/extensions/ai';
import { md5 } from '@/shared/lib/hash';

const GUEST_TASK_TTL_MS = 12 * 60 * 60 * 1000;
const GUEST_TASK_CONFIG_PREFIX = 'guest_ai_task:';
const MAX_GUEST_TASK_SCAN = 5000;

export interface GuestAITaskRecord {
  id: string;
  ownerKey: string;
  providerTaskId: string;
  mediaType: AIMediaType;
  provider: string;
  model: string;
  scene: string;
  prompt: string;
  options: string | null;
  status: AITaskStatus;
  taskInfo: string | null;
  taskResult: string | null;
  createdAt: number;
  updatedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __guestAiTaskStore: Map<string, GuestAITaskRecord> | undefined;
}

function getStore(): Map<string, GuestAITaskRecord> {
  if (!globalThis.__guestAiTaskStore) {
    globalThis.__guestAiTaskStore = new Map();
  }
  return globalThis.__guestAiTaskStore;
}

function buildGuestTaskConfigKey(id: string): string {
  return `${GUEST_TASK_CONFIG_PREFIX}${id}`;
}

function isPersistentStoreEnabled(): boolean {
  return Boolean(envConfigs.database_url);
}

function isValidGuestTaskRecord(value: any): value is GuestAITaskRecord {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.ownerKey === 'string' &&
    typeof value.providerTaskId === 'string' &&
    typeof value.mediaType === 'string' &&
    typeof value.provider === 'string' &&
    typeof value.model === 'string' &&
    typeof value.scene === 'string' &&
    typeof value.prompt === 'string' &&
    (typeof value.options === 'string' || value.options === null) &&
    typeof value.status === 'string' &&
    (typeof value.taskInfo === 'string' || value.taskInfo === null) &&
    (typeof value.taskResult === 'string' || value.taskResult === null) &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number'
  );
}

function parseGuestTaskRecord(value: unknown): GuestAITaskRecord | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (!isValidGuestTaskRecord(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function findGuestTaskInDb(id: string): Promise<GuestAITaskRecord | null> {
  if (!isPersistentStoreEnabled()) {
    return null;
  }

  try {
    const [row] = await db()
      .select({ value: config.value })
      .from(config)
      .where(eq(config.name, buildGuestTaskConfigKey(id)))
      .limit(1);

    return parseGuestTaskRecord(row?.value ?? null);
  } catch (error) {
    console.warn('find guest task from db failed:', error);
    return null;
  }
}

async function saveGuestTaskToDb(task: GuestAITaskRecord): Promise<void> {
  if (!isPersistentStoreEnabled()) {
    return;
  }

  try {
    const serialized = JSON.stringify(task);
    await db()
      .insert(config)
      .values({
        name: buildGuestTaskConfigKey(task.id),
        value: serialized,
      })
      .onConflictDoUpdate({
        target: config.name,
        set: { value: serialized },
      });
  } catch (error) {
    console.warn('save guest task to db failed:', error);
  }
}

async function listGuestTasksFromDb(): Promise<GuestAITaskRecord[]> {
  if (!isPersistentStoreEnabled()) {
    return [];
  }

  try {
    const rows = await db()
      .select({ value: config.value })
      .from(config)
      .where(like(config.name, `${GUEST_TASK_CONFIG_PREFIX}%`))
      .limit(MAX_GUEST_TASK_SCAN);

    return rows
      .map((row: { value: string | null }) =>
        parseGuestTaskRecord(row.value ?? null)
      )
      .filter(
        (item: GuestAITaskRecord | null): item is GuestAITaskRecord =>
          Boolean(item)
      )
      .sort(
        (a: GuestAITaskRecord, b: GuestAITaskRecord) =>
          b.updatedAt - a.updatedAt
      );
  } catch (error) {
    console.warn('list guest tasks from db failed:', error);
    return [];
  }
}

function cleanupExpiredTasks() {
  const now = Date.now();
  const store = getStore();
  for (const [id, task] of store) {
    if (now - task.updatedAt > GUEST_TASK_TTL_MS) {
      store.delete(id);
    }
  }
}

function getClientIpFromRequest(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0]?.trim() || '';
  }

  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    ''
  );
}

export function getGuestOwnerKey(request: Request): string {
  const ip = getClientIpFromRequest(request);
  const userAgent = request.headers.get('user-agent') || '';
  const cookie = request.headers.get('cookie') || '';
  return md5(`${ip}|${userAgent}|${cookie}`);
}

export async function saveGuestAITask(
  task: Omit<GuestAITaskRecord, 'updatedAt'>
): Promise<void> {
  cleanupExpiredTasks();
  const store = getStore();
  const nextTask: GuestAITaskRecord = {
    ...task,
    updatedAt: Date.now(),
  };

  store.set(task.id, nextTask);
  await saveGuestTaskToDb(nextTask);
}

export async function findGuestAITaskById(
  id: string
): Promise<GuestAITaskRecord | null> {
  cleanupExpiredTasks();
  const store = getStore();
  const local = store.get(id) || null;
  if (local) {
    return local;
  }

  const fromDb = await findGuestTaskInDb(id);
  if (fromDb) {
    store.set(id, fromDb);
  }
  return fromDb;
}

export async function updateGuestAITaskById(
  id: string,
  updates: Partial<GuestAITaskRecord>
): Promise<GuestAITaskRecord | null> {
  cleanupExpiredTasks();
  const store = getStore();
  let current = store.get(id);
  if (!current) {
    current = await findGuestTaskInDb(id) || undefined;
  }

  if (!current) {
    return null;
  }

  const nextTask: GuestAITaskRecord = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };
  store.set(id, nextTask);
  await saveGuestTaskToDb(nextTask);
  return nextTask;
}

export async function listGuestAITasks(): Promise<GuestAITaskRecord[]> {
  if (isPersistentStoreEnabled()) {
    const dbTasks = await listGuestTasksFromDb();
    if (dbTasks.length > 0) {
      return dbTasks;
    }
  }

  cleanupExpiredTasks();
  const store = getStore();
  return Array.from(store.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}
