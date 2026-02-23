import { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { notFound, permanentRedirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';
import { Link } from '@/core/i18n/navigation';
import { AIMediaType, AITaskStatus } from '@/extensions/ai/types';
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
import {
  buildColoringPageDetailPath,
  buildColoringPageDetailSegment,
  buildSeoDetailTitle,
  normalizePrompt,
  parseColoringPageDetailSegment,
  slugifyPrompt,
  truncateText,
} from '@/shared/lib/coloring-page-seo';
import { getLocalizedColoringPromptTitle } from '@/shared/lib/coloring-prompt-display';
import {
  buildR2AllowedUrlPrefixes,
  isAllowedR2Url,
} from '@/shared/lib/r2-url-filter';
import { findGuestAITaskById } from '@/shared/lib/guest-ai-task';
import { findPersistedGuestColoringTaskById } from '@/shared/lib/persistent-guest-coloring-gallery';
import { findAITaskById, getAITasks } from '@/shared/models/ai_task';
import { getAllConfigs } from '@/shared/models/config';
import { DetailPreviewActions } from './detail-preview-actions';

export const revalidate = 3600;

type ColoringPageDetail = {
  taskId: string;
  prompt: string | null;
  imageUrl: string;
  createdAt: string | null;
  categoryKey: string;
  canonicalSegment: string;
};

type SimilarColoringPageItem = {
  taskId: string;
  prompt: string | null;
  imageUrl: string;
  createdAt: string | null;
  categoryKey: string;
  detailPath: string;
  title: string;
  score: number;
};

const SIMILAR_SCAN_LIMIT = 140;
const SIMILAR_LIMIT = 10;
const SIMILAR_CACHE_TAG = 'coloring-page-similar';

function withLocalePath(locale: string, path: string): string {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  if (locale === defaultLocale) {
    return path;
  }
  return `/${locale}${path}`;
}

function buildDetailLanguageAlternates(taskId: string, prompt: string | null) {
  const appUrl = envConfigs.app_url.replace(/\/+$/, '');
  const languages = Object.fromEntries(
    locales.map((locale) => [
      locale,
      `${appUrl}${buildColoringPageDetailPath({
        locale,
        taskId,
        prompt,
      })}`,
    ])
  );

  return {
    ...languages,
    'x-default': `${appUrl}${buildColoringPageDetailPath({
      locale: defaultLocale,
      taskId,
      prompt,
    })}`,
  };
}

function buildMetadataDescription(prompt: string | null, locale: string): string {
  const cleanedPrompt = normalizePrompt(prompt);
  if (locale.startsWith('zh')) {
    if (!cleanedPrompt) {
      return '免费下载可打印涂色页，支持快速预览与下载。';
    }
    return `免费下载可打印涂色页：${truncateText(cleanedPrompt, 80)}。`;
  }

  if (!cleanedPrompt) {
    return 'Download a free printable coloring page generated with AI.';
  }
  return `Download a free printable coloring page: ${truncateText(cleanedPrompt, 90)}.`;
}

function tokenizePrompt(prompt: string | null | undefined): string[] {
  return normalizePrompt(prompt)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function countTokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  const set = new Set(a);
  let count = 0;
  for (const token of b) {
    if (set.has(token)) {
      count += 1;
    }
  }
  return count;
}

function buildSimilarCardTitle(prompt: string | null, locale: string): string {
  const localizedTitle = getLocalizedColoringPromptTitle({
    prompt,
    locale,
    fallbackZh: '可打印涂色页',
    fallbackEn: 'Printable Coloring Page',
  });
  return truncateText(normalizePrompt(localizedTitle), 46);
}

function formatPublishedTime(value: string | null, locale: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale || 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function pickPublicImageUrl(
  taskResult: any,
  taskInfo: any,
  r2UrlPrefixes: string[]
): string | null {
  const shouldEnforceR2Prefix = r2UrlPrefixes.length > 0;
  const taskInfoUrls = extractImageUrls(taskInfo);
  const resultUrls = extractImageUrls(taskResult);

  const seen = new Set<string>();
  // Prefer custom storage URLs (usually in taskInfo), then fallback to provider URLs.
  for (const url of [...taskInfoUrls, ...resultUrls]) {
    if (
      !url ||
      !isLikelyHttpUrl(url) ||
      (shouldEnforceR2Prefix && !isAllowedR2Url(url, r2UrlPrefixes))
    ) {
      continue;
    }

    const key = normalizeImageUrlForDedup(url);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    return url;
  }

  return null;
}

function toPublicColoringPage(
  task: any,
  r2UrlPrefixes: string[]
): Omit<SimilarColoringPageItem, 'detailPath' | 'title' | 'score'> | null {
  if (!task) {
    return null;
  }

  if (task.mediaType !== AIMediaType.IMAGE || task.status !== AITaskStatus.SUCCESS) {
    return null;
  }

  if (!isColoringTaskPrompt(task.prompt)) {
    return null;
  }

  const userPrompt = extractUserPrompt(task.prompt) || normalizePrompt(task.prompt);
  const taskResult = safeParseJSON(task.taskResult);
  const taskInfo = safeParseJSON(task.taskInfo);
  const shouldEnforceR2Prefix = r2UrlPrefixes.length > 0;
  const directImageUrl =
    typeof task.imageUrl === 'string' ? task.imageUrl : null;
  const imageUrl =
    directImageUrl &&
    isLikelyHttpUrl(directImageUrl) &&
    (!shouldEnforceR2Prefix || isAllowedR2Url(directImageUrl, r2UrlPrefixes))
      ? directImageUrl
      : pickPublicImageUrl(taskResult, taskInfo, r2UrlPrefixes);
  if (!imageUrl) {
    return null;
  }

  return {
    taskId: task.id,
    prompt: userPrompt || null,
    imageUrl,
    createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : null,
    categoryKey: classifyColoringPrompt(userPrompt || task.prompt),
  };
}

async function getSimilarColoringPagesUncached({
  locale,
  currentTaskId,
  currentPrompt,
  currentCategoryKey,
  r2UrlPrefixes,
}: {
  locale: string;
  currentTaskId: string;
  currentPrompt: string | null;
  currentCategoryKey: string;
  r2UrlPrefixes: string[];
}): Promise<SimilarColoringPageItem[]> {
  const tasks = await getAITasks({
    mediaType: AIMediaType.IMAGE,
    status: AITaskStatus.SUCCESS,
    page: 1,
    limit: SIMILAR_SCAN_LIMIT,
  });

  const currentTokens = tokenizePrompt(currentPrompt);
  const seenImageUrls = new Set<string>();
  const list: SimilarColoringPageItem[] = [];

  for (const task of tasks) {
    const item = toPublicColoringPage(task, r2UrlPrefixes);
    if (!item || item.taskId === currentTaskId) {
      continue;
    }

    const dedupKey = normalizeImageUrlForDedup(item.imageUrl);
    if (seenImageUrls.has(dedupKey)) {
      continue;
    }
    seenImageUrls.add(dedupKey);

    const overlap = countTokenOverlap(currentTokens, tokenizePrompt(item.prompt));
    const sameCategory = item.categoryKey === currentCategoryKey ? 1 : 0;
    const recencyScore = item.createdAt
      ? Math.floor(new Date(item.createdAt).getTime() / 1_000_000_000)
      : 0;
    const score = sameCategory * 10 + Math.min(overlap, 5) * 2 + recencyScore / 10_000_000;

    list.push({
      ...item,
      detailPath: buildColoringPageDetailPath({
        locale,
        taskId: item.taskId,
        prompt: item.prompt,
      }),
      title: buildSimilarCardTitle(item.prompt, locale),
      score,
    });
  }

  return list
    .sort((a, b) => b.score - a.score)
    .slice(0, SIMILAR_LIMIT);
}

const getSimilarColoringPagesCached = unstable_cache(
  async (
    locale: string,
    currentTaskId: string,
    currentPrompt: string | null,
    currentCategoryKey: string,
    r2PrefixSignature: string
  ) => {
    const r2UrlPrefixes = r2PrefixSignature
      .split('\n')
      .map((prefix) => prefix.trim())
      .filter((prefix) => prefix.length > 0);

    return getSimilarColoringPagesUncached({
      locale,
      currentTaskId,
      currentPrompt,
      currentCategoryKey,
      r2UrlPrefixes,
    });
  },
  ['coloring-page-similar-items'],
  {
    revalidate: 600,
    tags: [SIMILAR_CACHE_TAG],
  }
);

async function getSimilarColoringPages({
  locale,
  currentTaskId,
  currentPrompt,
  currentCategoryKey,
  r2UrlPrefixes,
}: {
  locale: string;
  currentTaskId: string;
  currentPrompt: string | null;
  currentCategoryKey: string;
  r2UrlPrefixes: string[];
}): Promise<SimilarColoringPageItem[]> {
  const r2PrefixSignature = r2UrlPrefixes.join('\n');
  return getSimilarColoringPagesCached(
    locale,
    currentTaskId,
    currentPrompt,
    currentCategoryKey,
    r2PrefixSignature
  );
}

async function getColoringPageDetail(
  taskId: string,
  r2UrlPrefixes: string[]
): Promise<ColoringPageDetail | null> {
  let task: any = null;
  const fallbackGuestTaskIds = taskId.startsWith('guest_')
    ? [taskId]
    : [taskId, `guest_${taskId}`];

  if (taskId.startsWith('guest_')) {
    task =
      findGuestAITaskById(taskId) ||
      (await findPersistedGuestColoringTaskById(taskId));
  } else {
    try {
      task = await findAITaskById(taskId);
    } catch (error) {
      console.error('find coloring task failed:', { taskId, error });
      task = null;
    }
  }

  if (!task) {
    for (const guestTaskId of fallbackGuestTaskIds) {
      task =
        findGuestAITaskById(guestTaskId) ||
        (await findPersistedGuestColoringTaskById(guestTaskId));
      if (task) {
        break;
      }
    }
  }

  const item = toPublicColoringPage(task, r2UrlPrefixes);
  if (!item) {
    return null;
  }

  return {
    ...item,
    canonicalSegment: buildColoringPageDetailSegment(item.taskId, item.prompt),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; detail: string }>;
}): Promise<Metadata> {
  const { locale, detail } = await params;
  const parsed = parseColoringPageDetailSegment(detail);
  const path = withLocalePath(locale, `/coloring-pages/${detail}`);
  const fallbackCanonical = `${envConfigs.app_url}${path}`;

  if (!parsed) {
    return {
      title: 'Coloring Page',
      description: 'Free printable coloring page details.',
      alternates: {
        canonical: fallbackCanonical,
      },
    };
  }

  const configs = await getAllConfigs();
  const r2UrlPrefixes = buildR2AllowedUrlPrefixes(configs);
  const detailData = await getColoringPageDetail(parsed.taskId, r2UrlPrefixes);
  if (!detailData) {
    return {
      title: 'Coloring Page',
      description: 'Free printable coloring page details.',
      alternates: {
        canonical: fallbackCanonical,
      },
    };
  }

  const canonicalPath = buildColoringPageDetailPath({
    locale,
    taskId: detailData.taskId,
    prompt: detailData.prompt,
  });
  const canonicalUrl = `${envConfigs.app_url}${canonicalPath}`;
  const title = buildSeoDetailTitle(detailData.prompt, locale);
  const description = buildMetadataDescription(detailData.prompt, locale);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: buildDetailLanguageAlternates(detailData.taskId, detailData.prompt),
    },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      title,
      description,
      images: [detailData.imageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [detailData.imageUrl],
    },
  };
}

export default async function ColoringPageDetailPage({
  params,
}: {
  params: Promise<{ locale: string; detail: string }>;
}) {
  const { locale, detail } = await params;
  setRequestLocale(locale);

  const parsed = parseColoringPageDetailSegment(detail);
  if (!parsed) {
    notFound();
  }

  const configs = await getAllConfigs();
  const r2UrlPrefixes = buildR2AllowedUrlPrefixes(configs);
  const detailData = await getColoringPageDetail(parsed.taskId, r2UrlPrefixes);
  if (!detailData) {
    notFound();
  }

  const canonicalPath = buildColoringPageDetailPath({
    locale,
    taskId: detailData.taskId,
    prompt: detailData.prompt,
  });
  if (detail !== detailData.canonicalSegment) {
    permanentRedirect(canonicalPath);
  }

  const title = buildSeoDetailTitle(detailData.prompt, locale);
  const description = buildMetadataDescription(detailData.prompt, locale);
  const publishedTime = formatPublishedTime(detailData.createdAt, locale);
  const similarItems = await getSimilarColoringPages({
    locale,
    currentTaskId: detailData.taskId,
    currentPrompt: detailData.prompt,
    currentCategoryKey: detailData.categoryKey,
    r2UrlPrefixes,
  });

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    name: title,
    description,
    contentUrl: detailData.imageUrl,
    datePublished: detailData.createdAt || undefined,
  };

  return (
    <section className="pt-24 pb-16 md:pt-36 md:pb-20">
      <div className="container max-w-7xl space-y-6">
        <div className="grid items-start gap-14 lg:gap-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="w-full max-w-[540px]">
            <div className="space-y-3">
              <div className="space-y-0">
                <h1 className="text-foreground text-center text-xl font-medium tracking-tight md:text-2xl">
                  {title}
                </h1>
                {publishedTime && (
                  <p className="text-muted-foreground text-center text-xs md:text-sm">
                    {locale.startsWith('zh')
                      ? `生成时间：${publishedTime}`
                      : `Created: ${publishedTime}`}
                  </p>
                )}
              </div>

              <div className="bg-card w-full overflow-hidden rounded-2xl border shadow-sm">
                <img
                  src={detailData.imageUrl}
                  alt={detailData.prompt || 'Printable coloring page'}
                  className="block h-auto w-full max-w-none"
                  loading="eager"
                />
              </div>

              <DetailPreviewActions
                imageUrl={detailData.imageUrl}
                imageAlt={detailData.prompt || 'Printable coloring page'}
                locale={locale}
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="p-2 text-center">
              <h2 className="text-foreground/60 text-lg font-medium tracking-tight">
                {locale.startsWith('zh')
                  ? '相似涂色图推荐'
                  : 'Similar Coloring Pages'}
              </h2>
            </div>

            {similarItems.length > 0 ? (
              <div className="columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3">
                {similarItems.map((item) => (
                  <Link
                    key={`${item.taskId}-${slugifyPrompt(item.prompt)}`}
                    href={item.detailPath}
                    className="group block w-full break-inside-avoid"
                  >
                    <div className="bg-muted/20 overflow-hidden rounded-xl border bg-card">
                      <img
                        src={item.imageUrl}
                        alt={item.prompt || 'Similar coloring page'}
                        className="block h-auto w-full transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                    <div className="px-2 pt-2 pb-1 text-center">
                      <p className="text-foreground line-clamp-2 text-xs font-medium">
                        {item.title}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
                {locale.startsWith('zh')
                  ? '暂无相似图纸，稍后再来看看。'
                  : 'No similar pages yet. Please check back later.'}
              </div>
            )}
          </aside>
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </div>
    </section>
  );
}
