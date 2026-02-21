'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { LazyImage } from '@/shared/blocks/common';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function ShowcasesFlow({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const groups = (section as any).groups || [];
  const showFullDescriptionInModal = Boolean(
    (section as any).show_full_description_in_modal
  );
  const showDownloadInModal = Boolean((section as any).show_download_in_modal);
  const [selectedGroup, setSelectedGroup] = useState<string>(
    groups.length > 0 ? groups[0].name : ''
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const filteredItems = useMemo(() => {
    if (!section.items) return [];
    if (!selectedGroup || !groups.length) return section.items;
    if (selectedGroup === 'all') return section.items;
    return section.items.filter((item) => item.group === selectedGroup);
  }, [section.items, selectedGroup, groups.length]);

  const handlePrevious = useCallback(() => {
    setSelectedIndex((prev) =>
      prev !== null
        ? prev === 0
          ? (filteredItems.length ?? 1) - 1
          : prev - 1
        : null
    );
  }, [filteredItems.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) =>
      prev !== null
        ? prev === (filteredItems.length ?? 1) - 1
          ? 0
          : prev + 1
        : null
    );
  }, [filteredItems.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === 'Escape') setSelectedIndex(null);
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, handlePrevious, handleNext]);

  const handleDownload = useCallback(async () => {
    if (selectedIndex === null || !filteredItems[selectedIndex]?.image?.src) {
      return;
    }

    const src = filteredItems[selectedIndex].image?.src as string;
    const title = filteredItems[selectedIndex].title || 'image';
    const safeTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    const filename = `${safeTitle || 'image'}-${Date.now()}.jpg`;

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
        // ignore and try next source
      }
      return null;
    };

    const proxyUrl = `/api/proxy/file?url=${encodeURIComponent(src)}`;
    let blob = await fetchBlob(proxyUrl);
    if (!blob) {
      blob = await fetchBlob(src);
    }

    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      triggerDownload(blobUrl);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      return;
    }

    triggerDownload(src);
  }, [filteredItems, selectedIndex]);

  return (
    <section
      id={section.id || section.name}
      className={cn('py-24 md:py-36', section.className, className)}
    >
      <motion.div
        className="container mb-12 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1] as const,
        }}
      >
        {section.sr_only_title && (
          <h1 className="sr-only">{section.sr_only_title}</h1>
        )}
        <h2 className="mx-auto mb-6 max-w-full text-3xl font-bold text-pretty md:max-w-5xl lg:text-4xl">
          {section.title}
        </h2>
        <p className="text-muted-foreground text-md mx-auto mb-4 line-clamp-3 max-w-full md:max-w-5xl">
          {section.description}
        </p>
        {section.buttons && section.buttons.length > 0 && (
          <div className="container mx-auto mt-8 mb-12 flex flex-wrap justify-center gap-4">
            {section.buttons.map((button) => (
              <Button
                key={button.title}
                variant={button.variant || 'default'}
                size={button.size || 'sm'}
                asChild
              >
                <Link href={button.url || ''} target={button.target || '_self'}>
                  {button.icon && <SmartIcon name={button.icon as string} />}
                  {button.title}
                </Link>
              </Button>
            ))}
          </div>
        )}
      </motion.div>

      {groups.length > 0 && (
        <motion.div
          className="container mb-12 flex flex-wrap justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.6,
            delay: 0.15,
            ease: [0.22, 1, 0.36, 1] as const,
          }}
        >
          {groups.map(
            (group: { name: string; title: string }, index: number) => {
              const isSelected = selectedGroup === group.name;
              return (
                <motion.button
                  key={group.name}
                  onClick={() => setSelectedGroup(group.name)}
                  className={cn(
                    'relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'ring-border bg-background text-foreground ring-1 ring-inset hover:bg-muted hover:text-foreground hover:ring-border/80'
                  )}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.4,
                    delay: 0.2 + index * 0.1,
                    ease: [0.22, 1, 0.36, 1] as const,
                  }}
                >
                  <span>{group.title}</span>
                </motion.button>
              );
            }
          )}
        </motion.div>
      )}

      {filteredItems.length > 0 ? (
        <div className="container mx-auto columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {filteredItems.map((item, index) => (
            <motion.div
              key={index}
              className="group relative cursor-zoom-in break-inside-avoid overflow-hidden rounded-xl"
              onClick={() => setSelectedIndex(index)}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: [0.22, 1, 0.36, 1] as const,
              }}
            >
              <LazyImage
                src={item.image?.src ?? ''}
                alt={item.image?.alt ?? ''}
                className="h-auto w-full"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              />
              <div className="absolute inset-0 flex flex-col justify-end bg-black/60 p-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <h3 className="mb-2 translate-y-4 text-sm font-medium text-white transition-transform duration-300 group-hover:translate-y-0">
                  {item.title}
                </h3>
                {/* {item.description && (
                  <p className="line-clamp-2 translate-y-4 text-sm text-white/80 transition-transform delay-75 duration-300 group-hover:translate-y-0">
                    {item.description}
                  </p>
                )} */}
                {(item as any).button && (
                  <div
                    className="mt-3 translate-y-4 transition-transform delay-100 duration-300 group-hover:translate-y-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      asChild
                      variant={(item as any).button.variant || 'default'}
                      size={(item as any).button.size || 'sm'}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 w-full border-0 px-1 py-1.5 text-sm font-medium"
                    >
                      <Link
                        href={(item as any).button.url || ''}
                        target={(item as any).button.target || '_self'}
                      >
                        {(item as any).button.icon && (
                          <SmartIcon
                            name={(item as any).button.icon as string}
                          />
                        )}
                        {(item as any).button.title}
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          className="text-muted-foreground container text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          No items found in this category.
        </motion.div>
      )}

      <AnimatePresence>
        {selectedIndex !== null &&
          filteredItems &&
          filteredItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm md:p-8"
              onClick={() => setSelectedIndex(null)}
            >
              <button
                className="absolute top-4 right-4 z-50 text-white/70 transition-colors hover:text-white"
                onClick={() => setSelectedIndex(null)}
              >
                <X className="size-8" />
              </button>

              <button
                className="absolute top-1/2 left-4 z-50 -translate-y-1/2 rounded-full bg-black/20 p-2 text-white/70 transition-colors hover:bg-black/40 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
              >
                <ChevronLeft className="size-8 md:size-12" />
              </button>

              <button
                className="absolute top-1/2 right-4 z-50 -translate-y-1/2 rounded-full bg-black/20 p-2 text-white/70 transition-colors hover:bg-black/40 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
              >
                <ChevronRight className="size-8 md:size-12" />
              </button>

              <motion.div
                key={selectedIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative flex h-full w-full items-center justify-center"
              >
                <div
                  className="flex items-start gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="relative max-h-full max-w-full overflow-hidden rounded-lg">
                    <LazyImage
                      src={filteredItems[selectedIndex].image?.src ?? ''}
                      alt={filteredItems[selectedIndex].image?.alt ?? ''}
                      className="h-auto max-h-[90vh] w-auto max-w-full object-contain"
                    />
                    <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-6 text-white">
                      <h3 className="mb-2 text-2xl font-bold">
                        {filteredItems[selectedIndex].title}
                      </h3>
                      {filteredItems[selectedIndex].description && (
                        <p
                          className={cn(
                            'text-base text-white/90',
                            showFullDescriptionInModal
                              ? 'max-h-56 overflow-y-auto whitespace-pre-line break-words'
                              : 'line-clamp-3'
                          )}
                        >
                          {filteredItems[selectedIndex].description}
                        </p>
                      )}
                      {(filteredItems[selectedIndex] as any).button && (
                        <div className="mt-4">
                          <Button
                            asChild
                            variant={
                              (filteredItems[selectedIndex] as any).button
                                .variant || 'default'
                            }
                            size={
                              (filteredItems[selectedIndex] as any).button.size ||
                              'default'
                            }
                            className="bg-primary hover:bg-primary/90 h-8 border-0 px-3 py-1.5 text-sm font-medium text-white"
                          >
                            <Link
                              href={
                                (filteredItems[selectedIndex] as any).button
                                  .url || ''
                              }
                              target={
                                (filteredItems[selectedIndex] as any).button
                                  .target || '_self'
                              }
                            >
                              {(filteredItems[selectedIndex] as any).button
                                .icon && (
                                <SmartIcon
                                  name={
                                    (filteredItems[selectedIndex] as any).button
                                      .icon as string
                                  }
                                  className="text-white"
                                />
                              )}
                              {(filteredItems[selectedIndex] as any).button.title}
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  {showDownloadInModal && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="mt-1 bg-black/30 text-white hover:bg-black/50 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload();
                      }}
                      aria-label="Download image"
                      title="Download image"
                    >
                      <Download className="size-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>
    </section>
  );
}
