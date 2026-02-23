'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';

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
  const [isDownloading, setIsDownloading] = useState(false);
  const isZh = locale.startsWith('zh');

  const handleDownload = useCallback(async () => {
    if (!imageUrl || isDownloading) {
      return;
    }

    setIsDownloading(true);

    const baseName = (imageAlt || 'coloring-page')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    const filename = `${baseName || 'coloring-page'}-${Date.now()}.jpg`;

    const triggerDownload = (href: string) => {
      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const fetchBlob = async (url: string) => {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          return await resp.blob();
        }
      } catch {
        // ignore and fallback
      }
      return null;
    };

    try {
      let blob =
        (await fetchBlob(
          `/api/proxy/file?url=${encodeURIComponent(imageUrl)}`
        )) || (await fetchBlob(imageUrl));

      if (!blob) {
        throw new Error('download failed');
      }

      const blobUrl = URL.createObjectURL(blob);
      triggerDownload(blobUrl);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch {
      toast.error(isZh ? '下载失败，请重试' : 'Download failed, please retry');
    } finally {
      setIsDownloading(false);
    }
  }, [imageAlt, imageUrl, isDownloading, isZh]);

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

        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-12 w-12"
          onClick={handleDownload}
          disabled={isDownloading}
          aria-label={isZh ? '下载图片' : 'Download Image'}
          title={isZh ? '下载图片' : 'Download Image'}
        >
          {isDownloading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Download className="size-5" />
          )}
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
                type="button"
                variant="outline"
                size="icon"
                className="mt-1 self-auto bg-black/30 text-white hover:bg-black/50 hover:text-white"
                onClick={handleDownload}
                disabled={isDownloading}
                aria-label={isZh ? '下载图片' : 'Download Image'}
                title={isZh ? '下载图片' : 'Download Image'}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
