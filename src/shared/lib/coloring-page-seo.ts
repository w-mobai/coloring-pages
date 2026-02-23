import { defaultLocale } from '@/config/locale';
import { getLocalizedColoringPromptTitle } from '@/shared/lib/coloring-prompt-display';

const DEFAULT_MAX_TITLE_LENGTH = 72;
const DEFAULT_MAX_SLUG_LENGTH = 70;
const MIN_PROMPT_LENGTH = 12;

const UUID_TASK_ID_PATTERN =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const DETAIL_TASK_ID_PATTERN = `(?:${UUID_TASK_ID_PATTERN}|guest_${UUID_TASK_ID_PATTERN})`;
const DETAIL_SEGMENT_PATTERN = new RegExp(
  `^(${DETAIL_TASK_ID_PATTERN})(?:-(.+))?$`,
  'i'
);

export function normalizePrompt(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

export function buildSeoGalleryTitle(
  prompt: string | null | undefined,
  index: number,
  locale?: string,
  maxLength = DEFAULT_MAX_TITLE_LENGTH
): string {
  const isZh = locale?.startsWith('zh');
  const promptText = normalizePrompt(
    getLocalizedColoringPromptTitle({
      prompt,
      locale,
      fallbackZh: '',
      fallbackEn: '',
    })
  );

  if (isZh) {
    const suffix = ' 涂色页';
    if (!promptText) {
      return `涂色页 #${index + 1}`;
    }
    const maxPromptLength = Math.max(MIN_PROMPT_LENGTH, maxLength - suffix.length);
    return `${truncateText(promptText, maxPromptLength)}${suffix}`;
  }

  const suffix = ' Coloring Page';
  if (!promptText) {
    return `Coloring Page #${index + 1}`;
  }
  const maxPromptLength = Math.max(MIN_PROMPT_LENGTH, maxLength - suffix.length);
  return `${truncateText(promptText, maxPromptLength)}${suffix}`;
}

export function buildSeoDetailTitle(
  prompt: string | null | undefined,
  locale?: string,
  maxLength = DEFAULT_MAX_TITLE_LENGTH
): string {
  const isZh = locale?.startsWith('zh');
  const promptText = normalizePrompt(
    getLocalizedColoringPromptTitle({
      prompt,
      locale,
      fallbackZh: '',
      fallbackEn: '',
    })
  );

  if (isZh) {
    const suffix = ' 涂色页';
    if (!promptText) {
      return `涂色页`;
    }
    const maxPromptLength = Math.max(MIN_PROMPT_LENGTH, maxLength - suffix.length);
    return `${truncateText(promptText, maxPromptLength)}${suffix}`;
  }

  const suffix = ' Coloring Page';
  if (!promptText) {
    return `Coloring Page`;
  }
  const maxPromptLength = Math.max(MIN_PROMPT_LENGTH, maxLength - suffix.length);
  return `${truncateText(promptText, maxPromptLength)}${suffix}`;
}

export function slugifyPrompt(
  prompt: string | null | undefined,
  maxLength = DEFAULT_MAX_SLUG_LENGTH
): string {
  const normalized = normalizePrompt(prompt).toLowerCase();
  const slug = normalized
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');

  return slug || 'coloring-page';
}

export function buildColoringPageDetailSegment(
  taskId: string,
  prompt: string | null | undefined
): string {
  return `${taskId}-${slugifyPrompt(prompt)}`;
}

export function buildColoringPageDetailPath({
  locale,
  taskId,
  prompt,
}: {
  locale?: string;
  taskId: string;
  prompt: string | null | undefined;
}): string {
  const segment = buildColoringPageDetailSegment(taskId, prompt);
  const path = `/coloring-pages/${segment}`;
  if (!locale || locale === defaultLocale) {
    return path;
  }
  return `/${locale}${path}`;
}

export function parseColoringPageDetailSegment(detail: string): {
  taskId: string;
  slug: string;
} | null {
  const matched = detail.match(DETAIL_SEGMENT_PATTERN);
  if (!matched) {
    return null;
  }

  return {
    taskId: matched[1],
    slug: matched[2] || '',
  };
}
