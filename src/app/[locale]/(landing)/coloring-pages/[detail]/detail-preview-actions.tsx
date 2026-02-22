'use client';

import { useEffect, useState } from 'react';
import { Download, Search, X } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

export function DetailPreviewActions({
  imageUrl,
  imageAlt,
  locale,
}: {
  imageUrl: string;
  imageAlt: string;
  locale: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const isZh = locale.startsWith('zh');

  useEffect(() => {
    if (!previewOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewOpen]);

  return (
    <>
      <div className="flex justify-center gap-2 pt-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-12 w-12"
          onClick={() => setPreviewOpen(true)}
          aria-label={isZh ? '放大预览' : 'Preview Image'}
          title={isZh ? '放大预览' : 'Preview Image'}
        >
          <Search className="size-5" />
        </Button>

        <Button asChild size="icon" variant="outline" className="h-12 w-12">
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={isZh ? '下载图片' : 'Download Image'}
            title={isZh ? '下载图片' : 'Download Image'}
          >
            <Download className="size-5" />
          </a>
        </Button>
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm md:p-8"
          onClick={() => setPreviewOpen(false)}
        >
          <button
            className="absolute top-4 right-4 z-50 text-white/70 transition-colors hover:text-white"
            onClick={() => setPreviewOpen(false)}
            aria-label={isZh ? '关闭预览' : 'Close preview'}
            type="button"
          >
            <X className="size-8" />
          </button>

          <div className="relative flex h-full w-full items-center justify-center">
            <div
              className="flex items-start gap-3"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative max-h-full max-w-full overflow-hidden rounded-lg">
                <img
                  src={imageUrl}
                  alt={imageAlt}
                  className="h-auto max-h-[82vh] w-auto max-w-[78vw] object-contain"
                  loading="eager"
                />
              </div>
              <Button
                asChild
                variant="outline"
                size="icon"
                className="mt-1 self-auto bg-black/30 text-white hover:bg-black/50 hover:text-white"
              >
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={isZh ? '下载图片' : 'Download Image'}
                  title={isZh ? '下载图片' : 'Download Image'}
                >
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
