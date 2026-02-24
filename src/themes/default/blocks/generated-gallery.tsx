import { Suspense } from 'react';
import { ArrowRight } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
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
const DEFAULT_MIN_SKELETON_MS = 0;
const MAX_MIN_SKELETON_MS = 3000;

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

function getGenerateLinkConfig(section: Section, locale?: string) {
  const isZh = locale?.startsWith('zh');
  return {
    show: Boolean((section as any).show_generate_link),
    title:
      ((section as any).generate_link_title as string) ||
      (isZh ? '生成图片' : 'Generate Image'),
    path: ((section as any).generate_link_path as string) || '/#coloring-page-generator',
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

function normalizeMinSkeletonMs(section: Section): number {
  const raw = Number((section as any).skeleton_min_ms ?? DEFAULT_MIN_SKELETON_MS);
  if (!Number.isFinite(raw)) {
    return DEFAULT_MIN_SKELETON_MS;
  }

  return Math.min(Math.max(Math.floor(raw), 0), MAX_MIN_SKELETON_MS);
}

async function waitMs(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
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
  const generateLink = getGenerateLinkConfig(section, locale);

  return (
    <Suspense
      fallback={
        <section
          id={section.id}
          className={cn('py-20', section.className, className)}
        >
          <div className="container">
            <div
              className={cn(
                'relative mx-auto max-w-5xl text-center',
                generateLink.show ? 'mb-5' : 'mb-12'
              )}
            >
              {section.title && (
                <h2 className="text-foreground mb-4 text-2xl font-medium tracking-tight md:text-3xl">
                  {section.title}
                </h2>
              )}
              {section.description && (
                <p className="text-muted-foreground text-md">{section.description}</p>
              )}
              {generateLink.show && (
                <Link
                  href={generateLink.path}
                  className="text-muted-foreground/70 hover:text-primary mt-4 inline-flex w-fit items-center gap-1 text-xs transition-colors md:absolute md:top-1/2 md:right-0 md:mt-0 md:-translate-y-1/2"
                >
                  <span>{generateLink.title}</span>
                  <ArrowRight className="size-3.5" />
                </Link>
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
                    <Skeleton
                      key={`gallery-filter-skeleton-${idx}`}
                      className="h-5 w-28"
                    />
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
  const generateLink = getGenerateLinkConfig(section, locale);
  const rawLimit = Number((section as any).limit || DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.floor(rawLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const minSkeletonMs = normalizeMinSkeletonMs(section);

  let images: PublicColoringGalleryItem[] = [];
  let hasError = false;

  try {
    const fetchPromise = getPublicColoringGalleryItems({ limit });
    await waitMs(minSkeletonMs);
    images = await fetchPromise;
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
          <div
            className={cn(
              'relative mx-auto max-w-5xl text-center',
              generateLink.show ? 'mb-5' : 'mb-12'
            )}
          >
            {section.title && (
              <h2 className="text-foreground mb-4 text-2xl font-medium tracking-tight md:text-3xl">
                {section.title}
              </h2>
            )}
            {section.description && (
              <p className="text-muted-foreground text-md">{section.description}</p>
            )}
            {generateLink.show && (
              <Link
                href={generateLink.path}
                className="text-muted-foreground/70 hover:text-primary mt-4 inline-flex w-fit items-center gap-1 text-xs transition-colors md:absolute md:top-1/2 md:right-0 md:mt-0 md:-translate-y-1/2"
              >
                <span>{generateLink.title}</span>
                <ArrowRight className="size-3.5" />
              </Link>
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
            const displayTitle = count > 1 ? `${baseTitle}-${count}` : baseTitle;

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
        show_generate_link: generateLink.show,
        generate_link_title: generateLink.title,
        generate_link_path: generateLink.path,
      }}
      className={className}
    />
  );
}

export default GeneratedGallery;
