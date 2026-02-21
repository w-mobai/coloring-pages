'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

import { ShowcasesFlow } from './showcases-flow';

interface GalleryImage {
  id: string;
  taskId: string;
  url: string;
  createdAt: string | null;
  categoryKey?: string;
  prompt?: string | null;
}

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 120;
const IMAGE_CHECK_TIMEOUT_MS = 6000;

function canLoadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };

    const timeout = setTimeout(() => {
      finish(false);
    }, IMAGE_CHECK_TIMEOUT_MS);

    img.onload = () => {
      clearTimeout(timeout);
      finish(true);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      finish(false);
    };
    img.src = url;
  });
}

function getUiText(locale?: string) {
  const isZh = locale?.startsWith('zh');

  return {
    loading: isZh ? '正在加载生成图片...' : 'Loading generated images...',
    empty: isZh ? '暂时还没有可展示的生成图片。' : 'No generated images yet.',
    error: isZh ? '加载图片失败，请稍后重试。' : 'Failed to load images. Please try again.',
    titlePrefix: isZh ? '涂色页 #' : 'Coloring Page #',
    imageAlt: isZh ? '用户生成涂色页' : 'User generated coloring page',
    allGroup: isZh ? '全部' : 'All',
    groupLabels: {
      cat: isZh ? '猫咪' : 'Cats',
      dog: isZh ? '狗狗' : 'Dogs',
      bird: isZh ? '鸟类' : 'Birds',
      dinosaur: isZh ? '恐龙' : 'Dinosaurs',
      vehicle: isZh ? '交通工具' : 'Vehicles',
      princess: isZh ? '公主童话' : 'Princess',
      unicorn: isZh ? '独角兽' : 'Unicorn',
      nature: isZh ? '自然植物' : 'Nature',
      food: isZh ? '食物' : 'Food',
      other: isZh ? '其他' : 'Other',
    } as Record<string, string>,
    promptLabel: isZh ? '提示词：' : 'Prompt: ',
    dateLabel: isZh ? '生成时间：' : 'Created: ',
    noPrompt: isZh ? '（无提示词记录）' : '(No prompt record)',
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
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const uiText = useMemo(() => getUiText(locale), [locale]);

  const limit = useMemo(() => {
    const value = Number((section as any).limit || DEFAULT_LIMIT);
    if (!Number.isFinite(value)) {
      return DEFAULT_LIMIT;
    }
    return Math.min(Math.max(Math.floor(value), 1), MAX_LIMIT);
  }, [section]);

  useEffect(() => {
    let cancelled = false;

    const fetchGallery = async () => {
      setLoading(true);
      setError(false);

      try {
        const resp = await fetch(`/api/ai/gallery?limit=${limit}`, {
          method: 'GET',
          cache: 'no-store',
        });

        if (!resp.ok) {
          throw new Error(`request failed with status: ${resp.status}`);
        }

        const json = await resp.json();
        if (json?.code !== 0) {
          throw new Error(json?.message || 'fetch failed');
        }

        const rawImages = (json?.data?.list || []) as GalleryImage[];
        const checks = await Promise.all(
          rawImages.map(async (item) => ({
            item,
            ok: await canLoadImage(item.url),
          }))
        );
        const validImages = checks.filter((entry) => entry.ok).map((entry) => entry.item);

        if (!cancelled) {
          setImages(validImages);
        }
      } catch (fetchError) {
        console.error('fetch gallery failed:', fetchError);
        if (!cancelled) {
          setImages([]);
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchGallery();

    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (loading && images.length === 0) {
    return (
      <section
        id={section.id}
        className={cn('py-24 md:py-36', section.className, className)}
      >
        <div className="container">
          <div className="mx-auto mb-12 max-w-5xl text-center">
            {section.title && (
              <h2 className="mb-6 text-3xl font-bold text-pretty lg:text-4xl">
                {section.title}
              </h2>
            )}
            {section.description && (
              <p className="text-muted-foreground text-md">{section.description}</p>
            )}
          </div>
          <div className="text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            <span>{uiText.loading}</span>
          </div>
        </div>
      </section>
    );
  }

  if ((error || images.length === 0) && !loading) {
    return (
      <section
        id={section.id}
        className={cn('py-24 md:py-36', section.className, className)}
      >
        <div className="container">
          <div className="mx-auto mb-12 max-w-5xl text-center">
            {section.title && (
              <h2 className="mb-6 text-3xl font-bold text-pretty lg:text-4xl">
                {section.title}
              </h2>
            )}
            {section.description && (
              <p className="text-muted-foreground text-md">{section.description}</p>
            )}
          </div>
          <div className="text-muted-foreground text-center">
            {error ? uiText.error : uiText.empty}
          </div>
        </div>
      </section>
    );
  }

  return (
    <ShowcasesFlow
      section={{
        ...section,
        groups: [
          { name: 'all', title: uiText.allGroup },
          ...Array.from(
            new Set(images.map((item) => item.categoryKey || 'other'))
          ).map((key) => ({
            name: key,
            title: uiText.groupLabels[key] || uiText.groupLabels.other,
          })),
        ],
        items: images.map((item, index) => {
          const promptText = item.prompt?.trim()
            ? `${uiText.promptLabel}${item.prompt}`
            : `${uiText.promptLabel}${uiText.noPrompt}`;
          const dateText = formatDate(item.createdAt, locale);

          return {
            title: `${uiText.titlePrefix}${index + 1}`,
            description: dateText
              ? `${promptText}\n${uiText.dateLabel}${dateText}`
              : promptText,
            group: item.categoryKey || 'other',
            image: {
              src: item.url,
              alt: `${uiText.imageAlt} ${index + 1}`,
            },
          };
        }),
        show_full_description_in_modal: true,
        show_download_in_modal: true,
      }}
      className={className}
    />
  );
}

export default GeneratedGallery;
