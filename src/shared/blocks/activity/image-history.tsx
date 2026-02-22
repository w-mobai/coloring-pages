'use client';

import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { LazyImage } from '@/shared/blocks/common';
import { Pagination } from '@/shared/blocks/common/pagination';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

export interface HistoryImageItem {
  id: string;
  taskId: string;
  imageUrl: string;
}

export interface HistoryTaskGroup {
  taskId: string;
  prompt: string | null;
  createdAt: string | null;
  images: HistoryImageItem[];
}

interface HistoryPagination {
  total: number;
  page: number;
  limit: number;
}

export function ImageHistory({
  initialGroups,
  pagination,
}: {
  initialGroups: HistoryTaskGroup[];
  pagination: HistoryPagination;
}) {
  const t = useTranslations('activity.ai-tasks');
  const [groups, setGroups] = useState<HistoryTaskGroup[]>(initialGroups);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    taskId: string;
    image: HistoryImageItem;
  } | null>(null);
  const images = groups.flatMap((group) =>
    group.images.map((image) => ({
      ...image,
      prompt: group.prompt,
    }))
  );
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewImage =
    previewIndex !== null ? (images[previewIndex] ?? null) : null;

  useEffect(() => {
    if (previewIndex === null) {
      return;
    }

    if (images.length === 0) {
      setPreviewIndex(null);
      return;
    }

    if (previewIndex >= images.length) {
      setPreviewIndex(images.length - 1);
    }
  }, [images.length, previewIndex]);

  useEffect(() => {
    if (previewIndex === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewIndex(null);
        return;
      }

      if (images.length < 2) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        setPreviewIndex((prev) => {
          if (prev === null) return prev;
          return prev === 0 ? images.length - 1 : prev - 1;
        });
      }

      if (event.key === 'ArrowRight') {
        setPreviewIndex((prev) => {
          if (prev === null) return prev;
          return prev === images.length - 1 ? 0 : prev + 1;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [images.length, previewIndex]);

  const requestDeleteImage = (taskId: string, image: HistoryImageItem) => {
    if (deletingImageId) {
      return;
    }

    setPendingDelete({ taskId, image });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    const { taskId, image } = pendingDelete;
    setDeletingImageId(image.id);

    try {
      const resp = await fetch('/api/ai/history/images', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          imageUrl: image.imageUrl,
        }),
      });

      const json = await resp.json();
      if (!resp.ok || json?.code !== 0) {
        throw new Error(json?.message || t('history.delete_failed'));
      }

      setGroups((prev) =>
        prev
          .map((group) => {
            if (group.taskId !== taskId) {
              return group;
            }

            return {
              ...group,
              images: group.images.filter((item) => item.id !== image.id),
            };
          })
          .filter((group) => group.images.length > 0)
      );

      toast.success(t('history.delete_success'));
      setPendingDelete(null);
    } catch (error: any) {
      toast.error(error?.message || t('history.delete_failed'));
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleDownloadImage = async (
    image: HistoryImageItem & { prompt: string | null }
  ) => {
    if (!image.imageUrl) {
      return;
    }

    const toastId = toast.loading(t('history.downloading'));

    try {
      const prefix = (image.prompt || 'history')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30);
      const filename = `history-${prefix || 'image'}-${Date.now()}.jpg`;

      const triggerDownload = (href: string) => {
        const link = document.createElement('a');
        link.href = href;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      const fetchBlobFromProxy = async (withTaskId: boolean) => {
        const proxyUrl = withTaskId
          ? `/api/proxy/file?url=${encodeURIComponent(image.imageUrl)}&taskId=${encodeURIComponent(image.taskId)}`
          : `/api/proxy/file?url=${encodeURIComponent(image.imageUrl)}`;

        const resp = await fetch(proxyUrl);
        if (resp.ok) {
          return resp.blob();
        }
        return null;
      };

      let blob: Blob | null = await fetchBlobFromProxy(true);

      if (!blob) {
        blob = await fetchBlobFromProxy(false);
      }

      if (!blob) {
        const directResp = await fetch(image.imageUrl);
        if (directResp.ok) {
          blob = await directResp.blob();
        }
      }

      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        triggerDownload(blobUrl);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        toast.success(t('history.download_success'), { id: toastId });
        return;
      }

      triggerDownload(image.imageUrl);
      toast.success(t('history.download_success'), { id: toastId });
    } catch (error) {
      console.error('download history image failed:', error);
      toast.error(t('history.download_failed'), { id: toastId });
    }
  };

  const showNav = images.length > 1;

  const goPrevImage = () => {
    setPreviewIndex((prev) => {
      if (prev === null) return prev;
      return prev === 0 ? images.length - 1 : prev - 1;
    });
  };

  const goNextImage = () => {
    setPreviewIndex((prev) => {
      if (prev === null) return prev;
      return prev === images.length - 1 ? 0 : prev + 1;
    });
  };

  return (
    <section className="pt-24 pb-10 md:pt-28 md:pb-12">
      <div className="container mx-auto">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold md:text-3xl">
              {t('history.title')}
            </h2>
          </div>

          {images.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {t('history.empty')}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3 xl:columns-4">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className="group relative cursor-zoom-in break-inside-avoid overflow-hidden rounded-xl ring-1 ring-black/5"
                  >
                    <button
                      type="button"
                      className="block w-full cursor-zoom-in bg-card"
                      onClick={() => setPreviewIndex(index)}
                    >
                      <LazyImage
                        src={image.imageUrl}
                        alt={image.prompt?.trim() || 'History image'}
                        className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.01]"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                    </button>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute top-2 right-2 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8"
                        onClick={() => requestDeleteImage(image.taskId, image)}
                        disabled={deletingImageId === image.id}
                        aria-label={t('history.delete')}
                      >
                        {deletingImageId === image.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <Pagination
            total={pagination.total}
            limit={pagination.limit}
            page={pagination.page}
            className="pt-2"
          />

          {previewImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm md:p-8"
              onClick={() => setPreviewIndex(null)}
            >
              <button
                className="absolute top-4 right-4 z-50 text-white/70 transition-colors hover:text-white"
                onClick={() => setPreviewIndex(null)}
                aria-label="Close preview"
                type="button"
              >
                <X className="size-8" />
              </button>

              <div
                className="relative flex h-full w-full items-center justify-center"
              >
                <div
                  className="flex items-start gap-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="relative max-h-full max-w-full overflow-hidden rounded-lg">
                    <img
                      src={previewImage.imageUrl}
                      alt={previewImage.prompt?.trim() || 'History image preview'}
                      className="h-auto max-h-[82vh] w-auto max-w-[78vw] object-contain"
                      loading="lazy"
                    />
                    {showNav && (
                      <>
                        <button
                          className="absolute top-1/2 left-2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white/80 transition-colors hover:bg-black/50 hover:text-white md:left-3 md:p-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            goPrevImage();
                          }}
                          aria-label="Previous image"
                          type="button"
                        >
                          <ChevronLeft className="size-6 md:size-8" />
                        </button>

                        <button
                          className="absolute top-1/2 right-2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white/80 transition-colors hover:bg-black/50 hover:text-white md:right-3 md:p-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            goNextImage();
                          }}
                          aria-label="Next image"
                          type="button"
                        >
                          <ChevronRight className="size-6 md:size-8" />
                        </button>
                      </>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="mt-1 self-auto bg-black/30 text-white hover:bg-black/50 hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDownloadImage(previewImage);
                    }}
                    aria-label={t('history.download')}
                    title={t('history.download')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Dialog
            open={Boolean(pendingDelete)}
            onOpenChange={(open) => {
              if (!open) {
                setPendingDelete(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t('history.delete_confirm_title')}</DialogTitle>
                <DialogDescription>{t('history.delete_confirm')}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPendingDelete(null)}
                  disabled={Boolean(deletingImageId)}
                >
                  {t('history.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={Boolean(deletingImageId)}
                >
                  {deletingImageId ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {t('history.delete')}
                    </>
                  ) : (
                    t('history.delete')
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}
