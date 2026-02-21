import { AIMediaType, AITaskStatus } from '@/extensions/ai';
import { respData, respErr } from '@/shared/lib/resp';
import { getAITasks } from '@/shared/models/ai_task';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 120;
const MAX_SCAN_LIMIT = 360;
const IMAGE_TO_IMAGE_PREFIX =
  'convert the uploaded reference image into a printable black and white coloring page, keep the main subject and composition';
const BUILTIN_COLORING_SUFFIXES = [
  'simple coloring page for toddlers, very thick bold black outlines, minimal details, large simple shapes, lots of white space, black and white line art only, no shading, no colors, clean lines, plain white background only, keep full subject visible with margins, no black background, no gray background, no colored background, no page border, no frame, no rectangular border, no paper edges, no photo background, no table texture, no wood texture, no watermark, suitable for 3-5 year olds',
  'coloring page for children, medium thickness black outlines, moderate details, clear defined areas, black and white line art only, no shading, no colors, clean lines, plain white background only, keep full subject visible with margins, no black background, no gray background, no colored background, no page border, no frame, no rectangular border, no paper edges, no photo background, no table texture, no wood texture, no watermark, suitable for 6-10 year olds',
];

const CATEGORY_RULES: Array<{ key: string; keywords: string[] }> = [
  {
    key: 'cat',
    keywords: ['cat', 'cats', 'kitten', 'kitty', '猫', '小猫', '猫咪'],
  },
  {
    key: 'dog',
    keywords: ['dog', 'dogs', 'puppy', 'puppies', '狗', '小狗', '狗狗'],
  },
  {
    key: 'bird',
    keywords: ['bird', 'birds', 'owl', 'parrot', 'eagle', '鸟', '猫头鹰'],
  },
  {
    key: 'dinosaur',
    keywords: ['dinosaur', 'dinosaurs', 'dino', '恐龙'],
  },
  {
    key: 'vehicle',
    keywords: [
      'car',
      'cars',
      'truck',
      'bus',
      'train',
      'airplane',
      'plane',
      'rocket',
      'ship',
      'boat',
      '汽车',
      '卡车',
      '公交',
      '火车',
      '飞机',
      '火箭',
      '轮船',
    ],
  },
  {
    key: 'princess',
    keywords: ['princess', 'queen', 'fairy', '公主', '女王', '仙女'],
  },
  {
    key: 'unicorn',
    keywords: ['unicorn', 'unicorns', '独角兽'],
  },
  {
    key: 'nature',
    keywords: ['flower', 'flowers', 'tree', 'forest', 'garden', '花', '树', '森林'],
  },
  {
    key: 'food',
    keywords: ['cake', 'pizza', 'ice cream', 'burger', '水果', '蛋糕', '披萨', '汉堡'],
  },
];

function safeParseJSON(value: string | null): any {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractImageUrls(payload: any): string[] {
  if (!payload) {
    return [];
  }

  const output =
    payload.output ??
    payload.images ??
    payload.data ??
    payload.resultUrls ??
    payload.urls;

  if (!output && payload.resultJson) {
    return extractImageUrls(safeParseJSON(payload.resultJson));
  }

  if (!output) {
    return [];
  }

  if (typeof output === 'string') {
    return [output];
  }

  if (Array.isArray(output)) {
    return output
      .flatMap((item) => {
        if (!item) return [];
        if (typeof item === 'string') return [item];
        if (typeof item === 'object') {
          const candidate =
            item.url ??
            item.uri ??
            item.image ??
            item.src ??
            item.imageUrl ??
            item.originalUrl;
          return typeof candidate === 'string' ? [candidate] : [];
        }
        return [];
      })
      .filter(Boolean);
  }

  if (typeof output === 'object') {
    const candidate =
      output.url ??
      output.uri ??
      output.image ??
      output.src ??
      output.imageUrl ??
      output.originalUrl;
    if (typeof candidate === 'string') {
      return [candidate];
    }
  }

  return [];
}

function isLikelyHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeImageUrlForDedup(value: string): string {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return value.split('#')[0].split('?')[0] || value;
  }
}

function isColoringTaskPrompt(prompt?: string | null): boolean {
  if (!prompt) {
    return false;
  }

  const text = prompt.toLowerCase();
  return (
    text.includes('coloring page') ||
    text.includes('black and white line art') ||
    text.includes('涂色')
  );
}

function classifyPrompt(prompt?: string | null): string {
  if (!prompt) {
    return 'other';
  }

  const text = prompt.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      return rule.key;
    }
  }

  return 'other';
}

function stripTrailingComma(value: string): string {
  return value.replace(/[,，]\s*$/, '').trim();
}

function extractUserPrompt(prompt?: string | null): string | null {
  if (!prompt) {
    return null;
  }

  const raw = prompt.trim();
  if (!raw) {
    return null;
  }

  for (const suffix of BUILTIN_COLORING_SUFFIXES) {
    if (!raw.endsWith(suffix)) {
      continue;
    }

    let core = stripTrailingComma(raw.slice(0, raw.length - suffix.length));
    if (!core) {
      return null;
    }

    if (core.toLowerCase().startsWith(IMAGE_TO_IMAGE_PREFIX.toLowerCase())) {
      core = stripTrailingComma(core.slice(IMAGE_TO_IMAGE_PREFIX.length));
    }

    return core || null;
  }

  if (raw.toLowerCase().startsWith(IMAGE_TO_IMAGE_PREFIX.toLowerCase())) {
    const remainder = stripTrailingComma(raw.slice(IMAGE_TO_IMAGE_PREFIX.length));
    return remainder || null;
  }

  return raw;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get('limit') || DEFAULT_LIMIT);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.floor(limitParam), 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const scanLimit = Math.min(Math.max(limit * 4, 80), MAX_SCAN_LIMIT);

    const tasks = await getAITasks({
      mediaType: AIMediaType.IMAGE,
      status: AITaskStatus.SUCCESS,
      page: 1,
      limit: scanLimit,
    });

    const seen = new Set<string>();
    const list: Array<{
      id: string;
      taskId: string;
      url: string;
      createdAt: string | null;
      categoryKey: string;
      prompt: string | null;
    }> = [];

    for (const task of tasks) {
      if (!isColoringTaskPrompt(task.prompt)) {
        continue;
      }

      const userPrompt = extractUserPrompt(task.prompt);

      const taskResult = safeParseJSON(task.taskResult);
      const taskInfo = safeParseJSON(task.taskInfo);
      const resultImageUrls = extractImageUrls(taskResult);
      const imageUrls =
        resultImageUrls.length > 0
          ? resultImageUrls
          : extractImageUrls(taskInfo);

      let selectedImageUrl: string | null = null;
      for (const imageUrl of imageUrls) {
        const dedupKey = normalizeImageUrlForDedup(imageUrl);
        if (!imageUrl || !isLikelyHttpUrl(imageUrl) || seen.has(dedupKey)) {
          continue;
        }

        seen.add(dedupKey);
        selectedImageUrl = imageUrl;
        break;
      }

      if (!selectedImageUrl) {
        continue;
      }

      list.push({
        id: `${task.id}-${list.length + 1}`,
        taskId: task.id,
        url: selectedImageUrl,
        createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : null,
        categoryKey: classifyPrompt(userPrompt || task.prompt),
        prompt: userPrompt,
      });

      if (list.length >= limit) {
        break;
      }

      if (list.length >= limit) {
        break;
      }
    }

    return respData({
      list,
      total: list.length,
      limit,
    });
  } catch (error: any) {
    console.error('get ai gallery failed:', error);
    return respErr(error?.message || 'get ai gallery failed');
  }
}
