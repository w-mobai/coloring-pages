import { AIMediaType } from '@/extensions/ai/types';
import { respData, respErr } from '@/shared/lib/resp';
import {
  normalizeImageUrlForDedup,
  removeImageUrlFromPayload,
  safeParseJSON,
} from '@/shared/lib/ai-image-history';
import {
  countAITaskImageUrlReferences,
  findAITaskById,
  updateAITaskById,
} from '@/shared/models/ai_task';
import { getSignUser } from '@/shared/models/user';
import { getStorageService } from '@/shared/services/storage';

function serializePayload(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.stringify(value);
}

export async function DELETE(req: Request) {
  try {
    const user = await getSignUser();
    if (!user?.id) {
      return respErr('no auth, please sign in');
    }

    const { taskId, imageUrl } = await req.json();
    if (!taskId || !imageUrl) {
      return respErr('taskId and imageUrl are required');
    }

    const task = await findAITaskById(taskId);
    if (!task || task.userId !== user.id || task.mediaType !== AIMediaType.IMAGE) {
      return respErr('task not found');
    }

    let removed = false;
    let nextTaskResult = task.taskResult;
    let nextTaskInfo = task.taskInfo;

    const parsedTaskResult = safeParseJSON(task.taskResult);
    if (parsedTaskResult) {
      const result = removeImageUrlFromPayload(parsedTaskResult, imageUrl);
      removed = removed || result.removed;
      if (result.removed) {
        nextTaskResult = serializePayload(result.payload);
      }
    }

    const parsedTaskInfo = safeParseJSON(task.taskInfo);
    if (parsedTaskInfo) {
      const result = removeImageUrlFromPayload(parsedTaskInfo, imageUrl);
      removed = removed || result.removed;
      if (result.removed) {
        nextTaskInfo = serializePayload(result.payload);
      }
    }

    if (!removed) {
      return respErr('image not found');
    }

    await updateAITaskById(task.id, {
      taskResult: nextTaskResult,
      taskInfo: nextTaskInfo,
    });

    const normalizedImageUrl = normalizeImageUrlForDedup(imageUrl);
    const remainingReferences =
      await countAITaskImageUrlReferences(normalizedImageUrl);

    let storageDeleted = false;
    if (remainingReferences === 0) {
      try {
        const storageService = await getStorageService();
        storageDeleted = await storageService.deleteFileByUrl(imageUrl);
      } catch (storageError) {
        console.warn('delete history image storage file failed:', storageError);
      }
    }

    return respData({
      taskId: task.id,
      remainingReferences,
      storageDeleted,
    });
  } catch (error: any) {
    console.error('delete image history failed:', error);
    return respErr(error?.message || 'delete image history failed');
  }
}
