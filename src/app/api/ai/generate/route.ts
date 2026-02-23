import { envConfigs } from '@/config';
import { AIMediaType } from '@/extensions/ai';
import { getGuestOwnerKey, saveGuestAITask } from '@/shared/lib/guest-ai-task';
import { getUuid } from '@/shared/lib/hash';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { respData, respErr } from '@/shared/lib/resp';
import { buildUserStorageKeyPrefix } from '@/shared/lib/storage-key-prefix';
import { createAITask, NewAITask } from '@/shared/models/ai_task';
import { getRemainingCredits } from '@/shared/models/credit';
import { getOrdersCount, OrderStatus } from '@/shared/models/order';
import { getUserInfo } from '@/shared/models/user';
import { getAIService } from '@/shared/services/ai';

export async function POST(request: Request) {
  try {
    let { provider, mediaType, model, prompt, options, scene } =
      await request.json();

    if (!provider || !mediaType || !model) {
      throw new Error('invalid params');
    }

    if (!prompt && !options) {
      throw new Error('prompt or options is required');
    }

    const aiService = await getAIService();

    // check generate type
    if (!aiService.getMediaTypes().includes(mediaType)) {
      throw new Error('invalid mediaType');
    }

    // check ai provider
    const aiProvider = aiService.getProvider(provider);
    if (!aiProvider) {
      throw new Error('invalid provider');
    }

    // get current user
    const user = await getUserInfo();
    const isGuest = !user;
    let isPaidUser = false;
    if (user?.id) {
      const paidOrders = await getOrdersCount({
        userId: user.id,
        status: OrderStatus.PAID,
      });
      isPaidUser = paidOrders > 0;
    }

    // Paid users are exempt from generate rate-limit.
    if (!isPaidUser) {
      const rateLimitedResp = enforceMinIntervalRateLimit(request, {
        keyPrefix: 'ai-generate',
        intervalMs: isGuest ? 15000 : 5000,
        extraKey: `${mediaType}|${scene || ''}|${provider}|${model}`,
      });
      if (rateLimitedResp) {
        return rateLimitedResp;
      }
    }

    // todo: get cost credits from settings
    let costCredits = 2;

    if (mediaType === AIMediaType.IMAGE) {
      // generate image
      if (scene === 'image-to-image') {
        costCredits = 4;
      } else if (scene === 'text-to-image') {
        costCredits = 2;
      } else {
        throw new Error('invalid scene');
      }
    } else if (mediaType === AIMediaType.VIDEO) {
      // generate video
      if (scene === 'text-to-video') {
        costCredits = 6;
      } else if (scene === 'image-to-video') {
        costCredits = 8;
      } else if (scene === 'video-to-video') {
        costCredits = 10;
      } else {
        throw new Error('invalid scene');
      }
    } else if (mediaType === AIMediaType.MUSIC) {
      // generate music
      costCredits = 10;
      scene = 'text-to-music';
    } else {
      throw new Error('invalid mediaType');
    }

    if (isGuest) {
      const guestAllowed =
        mediaType === AIMediaType.IMAGE &&
        scene === 'text-to-image' &&
        provider === 'kie' &&
        model === 'nano-banana-pro';
      if (!guestAllowed) {
        throw new Error('no auth, please sign in');
      }
      costCredits = 0;
    } else {
      // check credits
      const remainingCredits = await getRemainingCredits(user.id);
      if (remainingCredits < costCredits) {
        throw new Error('insufficient credits');
      }
    }

    const callbackUrl = `${envConfigs.app_url}/api/ai/notify/${provider}`;
    const storageKeyPrefix = buildUserStorageKeyPrefix({
      fallbackId: user?.id,
    });

    const params: any = {
      mediaType,
      model,
      prompt,
      callbackUrl,
      options,
      ...(storageKeyPrefix ? { storageKeyPrefix } : {}),
    };

    // generate content
    const result = await aiProvider.generate({ params });
    if (!result?.taskId) {
      throw new Error(
        `ai generate failed, mediaType: ${mediaType}, provider: ${provider}, model: ${model}`
      );
    }

    if (isGuest) {
      const guestTaskId = `guest_${getUuid()}`;
      const taskInfo = result.taskInfo ? JSON.stringify(result.taskInfo) : null;
      const taskResult = result.taskResult
        ? JSON.stringify(result.taskResult)
        : null;
      saveGuestAITask({
        id: guestTaskId,
        ownerKey: getGuestOwnerKey(request),
        providerTaskId: result.taskId,
        mediaType,
        provider,
        model,
        scene,
        prompt,
        options: options ? JSON.stringify(options) : null,
        status: result.taskStatus,
        taskInfo,
        taskResult,
        createdAt: Date.now(),
      });

      return respData({
        id: guestTaskId,
        status: result.taskStatus,
        provider,
        model,
        prompt,
        options: options ? JSON.stringify(options) : null,
        taskInfo,
        taskResult,
        costCredits: 0,
      });
    }

    // create ai task
    const newAITask: NewAITask = {
      id: getUuid(),
      userId: user.id,
      mediaType,
      provider,
      model,
      prompt,
      scene,
      options: options ? JSON.stringify(options) : null,
      status: result.taskStatus,
      costCredits,
      taskId: result.taskId,
      taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
      taskResult: result.taskResult ? JSON.stringify(result.taskResult) : null,
    };
    await createAITask(newAITask);

    return respData(newAITask);
  } catch (e: any) {
    console.log('generate failed', e);
    return respErr(e.message);
  }
}
