import { AITaskStatus } from '@/extensions/ai';
import {
  findGuestAITaskById,
  getGuestOwnerKey,
  updateGuestAITaskById,
} from '@/shared/lib/guest-ai-task';
import { respData, respErr } from '@/shared/lib/resp';
import { buildUserStorageKeyPrefix } from '@/shared/lib/storage-key-prefix';
import {
  findAITaskById,
  UpdateAITask,
  updateAITaskById,
} from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';
import { getAIService } from '@/shared/services/ai';

export async function POST(req: Request) {
  try {
    const { taskId } = await req.json();
    if (!taskId) {
      return respErr('invalid params');
    }

    const user = await getUserInfo();
    const isGuestTask =
      typeof taskId === 'string' && taskId.startsWith('guest_');

    if (!user && !isGuestTask) {
      return respErr('no auth, please sign in');
    }

    if (!user && isGuestTask) {
      const guestTask = findGuestAITaskById(taskId);
      if (!guestTask) {
        return respErr('task not found');
      }

      const ownerKey = getGuestOwnerKey(req);
      if (guestTask.ownerKey !== ownerKey) {
        return respErr('no permission');
      }

      if (
        [AITaskStatus.SUCCESS, AITaskStatus.FAILED, AITaskStatus.CANCELED].includes(
          guestTask.status
        ) &&
        guestTask.taskInfo
      ) {
        return respData({
          id: guestTask.id,
          status: guestTask.status,
          provider: guestTask.provider,
          model: guestTask.model,
          prompt: guestTask.prompt,
          options: guestTask.options,
          taskInfo: guestTask.taskInfo,
          taskResult: guestTask.taskResult,
        });
      }

      const aiService = await getAIService();
      const aiProvider = aiService.getProvider(guestTask.provider);
      if (!aiProvider) {
        return respErr('invalid ai provider');
      }

      const result = await aiProvider?.query?.({
        taskId: guestTask.providerTaskId,
        mediaType: guestTask.mediaType,
        model: guestTask.model,
      });

      if (!result?.taskStatus) {
        return respErr('query ai task failed');
      }

      const taskInfo = result.taskInfo ? JSON.stringify(result.taskInfo) : null;
      const taskResult = result.taskResult
        ? JSON.stringify(result.taskResult)
        : null;

      updateGuestAITaskById(guestTask.id, {
        status: result.taskStatus,
        taskInfo,
        taskResult,
      });

      return respData({
        id: guestTask.id,
        status: result.taskStatus,
        provider: guestTask.provider,
        model: guestTask.model,
        prompt: guestTask.prompt,
        options: guestTask.options,
        taskInfo,
        taskResult,
      });
    }

    if (!user) {
      return respErr('no auth, please sign in');
    }

    const task = await findAITaskById(taskId);
    if (!task || !task.taskId) {
      return respErr('task not found');
    }

    if (task.userId !== user.id) {
      return respErr('no permission');
    }

    if (
      [AITaskStatus.SUCCESS, AITaskStatus.FAILED, AITaskStatus.CANCELED].includes(
        task.status as AITaskStatus
      ) &&
      task.taskInfo
    ) {
      return respData(task);
    }

    const aiService = await getAIService();
    const aiProvider = aiService.getProvider(task.provider);
    if (!aiProvider) {
      return respErr('invalid ai provider');
    }
    const storageKeyPrefix = buildUserStorageKeyPrefix({
      email: user.email,
      fallbackId: user.id,
    });

    const result = await aiProvider?.query?.({
      taskId: task.taskId,
      mediaType: task.mediaType,
      model: task.model,
      storageKeyPrefix: storageKeyPrefix || undefined,
    });

    if (!result?.taskStatus) {
      return respErr('query ai task failed');
    }

    // update ai task
    const updateAITask: UpdateAITask = {
      status: result.taskStatus,
      taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
      taskResult: result.taskResult ? JSON.stringify(result.taskResult) : null,
      creditId: task.creditId, // credit consumption record id
    };
    if (updateAITask.taskInfo !== task.taskInfo) {
      await updateAITaskById(task.id, updateAITask);
    }

    task.status = updateAITask.status || '';
    task.taskInfo = updateAITask.taskInfo || null;
    task.taskResult = updateAITask.taskResult || null;

    return respData(task);
  } catch (e: any) {
    console.log('ai query failed', e);
    return respErr(e.message);
  }
}
