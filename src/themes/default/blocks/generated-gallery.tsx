import { Suspense } from 'react';

import {
  buildColoringPageDetailPath,
  normalizePrompt,
  truncateText,
} from '@/shared/lib/coloring-page-seo';
import { COLORING_KEYWORD_FILTER_RULES } from '@/shared/lib/coloring-keyword-filters';
import { getLocalizedColoringPromptTitle } from '@/shared/lib/coloring-prompt-display';
import {
  type PublicColoringGalleryItem,
  getPublicColoringGalleryItems,
} from '@/shared/lib/public-coloring-gallery';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

import { ShowcasesFlow } from './showcases-flow';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 120;

function normalizeFilterText(value?: string | null): string {
  return (value || '').toLowerCase().trim();
}

function matchPromptKeywordGroups(prompt?: string | null): string[] {
  const text = normalizeFilterText(prompt);
  if (!text) {
    return ['other'];
  }

  const groups = COLORING_KEYWORD_FILTER_RULES.filter((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword))
  ).map((rule) => rule.name);

  return groups.length > 0 ? groups : ['other'];
}

function buildGalleryCardTitle(prompt: string | null | undefined, locale?: string): string {
  const localizedTitle = getLocalizedColoringPromptTitle({
    prompt,
    locale,
    fallbackZh: '涂色页',
    fallbackEn: 'Coloring Page',
  });
  return truncateText(normalizePrompt(localizedTitle), 52);
}

function getUiText(locale?: string) {
  const isZh = locale?.startsWith('zh');

  return {
    loading: isZh ? '图片加载中...' : 'Loading images...',
    empty: isZh ? '暂时还没有可展示的生成图片。' : 'No generated images yet.',
    error: isZh ? '加载图片失败，请稍后重试。' : 'Failed to load images. Please try again.',
    imageAltPrefix: isZh ? '涂色页' : 'Coloring page',
    allGroup: isZh ? '全部' : 'All',
    keywordFiltersTitle: isZh ? '筛选器' : 'Filters',
    groupLabels: {
      other: isZh ? '其他' : 'Other',
    } as Record<string, string>,
    promptLabel: isZh ? '提示词：' : 'Prompt: ',
    dateLabel: isZh ? '生成时间：' : 'Created: ',
    noPrompt: isZh ? '（无提示词记录）' : '(No prompt record)',
    viewMoreTitle: isZh ? '查看更多' : 'See More',
    viewMoreDescription: isZh ? '查看全部涂色页' : 'View full gallery',
  };
}

function formatDate(value: string | null, locale?: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale || 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function GeneratedGallery({
  section,
  locale,
  className,
}: {
  section: Section;
  locale?: string;
  className?: string;
}) {
  const uiText = getUiText(locale);

  return (
    <Suspense
      fallback={
        <section
          id={section.id}
          className={cn('py-20', section.className, className)}
        >
          <div className="container">
            <div className="mx-auto mb-12 max-w-5xl text-center">
              {section.title && (
                <h2 className="text-foreground mb-4 text-2xl font-medium tracking-tight md:text-3xl">
                  {section.title}
                </h2>
              )}
            {section.description && (
              <p className="text-muted-foreground text-md">{section.description}</p>
            )}
          </div>
          <div className="text-muted-foreground mb-6 text-center text-sm">
            {uiText.loading}
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="hidden lg:block lg:sticky lg:top-24">
              <Skeleton className="mb-3 h-3 w-16" />
              <div className="flex flex-col gap-2">
                {Array.from({ length: 7 }).map((_, idx) => (
                  <Skeleton key={`gallery-filter-skeleton-${idx}`} className="h-5 w-28" />
                ))}
              </div>
            </aside>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, idx) => (
                <div key={`gallery-card-skeleton-${idx}`} className="space-y-2">
                  <Skeleton className="aspect-square w-full rounded-xl" />
                  <Skeleton className="mx-auto h-4 w-4/5" />
                </div>
              ))}
            </div>
          </div>
          </div>
        </section>
      }
    >
      <GeneratedGalleryContent
        section={section}
        locale={locale}
        className={className}
      />
    </Suspense>
  );
}

async function GeneratedGalleryContent({
  section,
  locale,
  className,
}: {
  section: Section;
  locale?: string;
  className?: string;
}) {
  const uiText = getUiText(locale);
  const rawLimit = Number((section as any).limit || DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.floor(rawLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  let images: PublicColoringGalleryItem[] = [];
  let hasError = false;

  try {
    images = await getPublicColoringGalleryItems({ limit });
  } catch (error) {
    console.error('fetch gallery failed:', error);
    hasError = true;
  }

  if (hasError || images.length === 0) {
    return (
      <section
        id={section.id}
        className={cn('py-20', section.className, className)}
      >
        <div className="container">
          <div className="mx-auto mb-12 max-w-5xl text-center">
            {section.title && (
              <h2 className="text-foreground mb-4 text-2xl font-medium tracking-tight md:text-3xl">
                {section.title}
              </h2>
            )}
            {section.description && (
              <p className="text-muted-foreground text-md">{section.description}</p>
            )}
          </div>
          <div className="text-muted-foreground text-center">
            {hasError ? uiText.error : uiText.empty}
          </div>
        </div>
      </section>
    );
  }

  return (
    <ShowcasesFlow
      section={{
        ...section,
        group_layout: 'sidebar-left',
        group_sidebar_title: uiText.keywordFiltersTitle,
        view_more_title: (section as any).view_more_title || uiText.viewMoreTitle,
        view_more_description:
          (section as any).view_more_description || uiText.viewMoreDescription,
        groups: [
          { name: 'all', title: uiText.allGroup },
          ...COLORING_KEYWORD_FILTER_RULES.map((rule) => ({
            name: rule.name,
            title: locale?.startsWith('zh') ? rule.titleZh || rule.title : rule.title,
          })),
          { name: 'other', title: uiText.groupLabels.other },
        ],
        items: (() => {
          const titleCounter = new Map<string, number>();

          return images.map((item, index) => {
            const localizedPrompt = getLocalizedColoringPromptTitle({
              prompt: item.prompt,
              locale,
              fallbackZh: uiText.noPrompt,
              fallbackEn: uiText.noPrompt,
            });
            const promptText = item.prompt?.trim()
              ? `${uiText.promptLabel}${localizedPrompt}`
              : `${uiText.promptLabel}${uiText.noPrompt}`;
            const dateText = formatDate(item.createdAt, locale);
            const detailPath = buildColoringPageDetailPath({
              locale,
              taskId: item.taskId,
              prompt: item.prompt,
            });
            const keywordGroups = matchPromptKeywordGroups(item.prompt);

            const baseTitle = buildGalleryCardTitle(item.prompt, locale);
            const titleKey = baseTitle.toLowerCase();
            const count = (titleCounter.get(titleKey) || 0) + 1;
            titleCounter.set(titleKey, count);
            const displayTitle = count > 1 ? `${baseTitle} (${count})` : baseTitle;

            return {
              title: displayTitle,
              description: dateText
                ? `${promptText}\n${uiText.dateLabel}${dateText}`
                : promptText,
              group: keywordGroups[0] || 'other',
              groups: keywordGroups,
              detailUrl: detailPath,
              image: {
                src: item.url,
                alt: item.prompt?.trim()
                  ? `${uiText.imageAltPrefix}: ${item.prompt}`
                  : `${uiText.imageAltPrefix} ${index + 1}`,
              },
            };
          });
        })(),
        show_full_description_in_modal: true,
        show_download_in_modal: true,
      }}
      className={className}
    />
  );
}

export default GeneratedGallery;
