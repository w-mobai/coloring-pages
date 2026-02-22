import { AIMediaType, AITaskStatus } from '@/extensions/ai';
import { md5 } from '@/shared/lib/hash';

const GUEST_TASK_TTL_MS = 12 * 60 * 60 * 1000;

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

export function saveGuestAITask(task: Omit<GuestAITaskRecord, 'updatedAt'>) {
  cleanupExpiredTasks();
  const store = getStore();
  store.set(task.id, {
    ...task,
    updatedAt: Date.now(),
  });
}

export function findGuestAITaskById(id: string): GuestAITaskRecord | null {
  cleanupExpiredTasks();
  const store = getStore();
  return store.get(id) || null;
}

export function updateGuestAITaskById(
  id: string,
  updates: Partial<GuestAITaskRecord>
): GuestAITaskRecord | null {
  cleanupExpiredTasks();
  const store = getStore();
  const current = store.get(id);
  if (!current) {
    return null;
  }

  const nextTask: GuestAITaskRecord = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };
  store.set(id, nextTask);
  return nextTask;
}

export function listGuestAITasks(): GuestAITaskRecord[] {
  cleanupExpiredTasks();
  const store = getStore();
  return Array.from(store.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}
