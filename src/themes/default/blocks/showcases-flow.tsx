'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { Link, useRouter } from '@/core/i18n/navigation';
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
  const isGeneratedGallerySection = section.id === 'generated-gallery';
  const shouldAnimateGallery = !isGeneratedGallerySection;
  const router = useRouter();
  const groups = (section as any).groups || [];
  const useSidebarGroups =
    isGeneratedGallerySection && (section as any).group_layout === 'sidebar-left';
  const groupSidebarTitle = (section as any).group_sidebar_title as
    | string
    | undefined;
  const showFullDescriptionInModal = Boolean(
    (section as any).show_full_description_in_modal
  );
  const showDownloadInModal = Boolean((section as any).show_download_in_modal);
  const showGenerateLink = Boolean((section as any).show_generate_link);
  const generateLinkTitle = ((section as any).generate_link_title as string) || 'Generate Image';
  const generateLinkPath =
    ((section as any).generate_link_path as string) || '/#coloring-page-generator';
  const showViewMoreCard = Boolean(
    isGeneratedGallerySection && (section as any).show_view_more_card
  );
  const maxVisibleItems = Number((section as any).max_visible_items || 0);
  const viewMorePath = ((section as any).view_more_path as string) || '/coloring-pages';
  const viewMoreTitle = ((section as any).view_more_title as string) || 'See More';
  const viewMoreDescription = (section as any).view_more_description as
    | string
    | undefined;
  const searchParams = useSearchParams();
  const [selectedGroup, setSelectedGroup] = useState<string>(
    groups.length > 0 ? groups[0].name : ''
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const groupNameSet = useMemo(
    () => new Set(groups.map((group: { name: string }) => group.name)),
    [groups]
  );

  useEffect(() => {
    if (!isGeneratedGallerySection || groups.length === 0) {
      return;
    }

    const filter = searchParams.get('filter');
    if (!filter) {
      return;
    }

    if (groupNameSet.has(filter)) {
      setSelectedGroup(filter);
    }
  }, [groupNameSet, groups.length, isGeneratedGallerySection, searchParams]);

  const filteredItems = useMemo(() => {
    if (!section.items) return [];

    const baseItems =
      !selectedGroup || !groups.length || selectedGroup === 'all'
        ? section.items
        : section.items.filter((item) => {
            const itemGroups = Array.isArray((item as any).groups)
              ? ((item as any).groups as string[])
              : [item.group as string];
            return itemGroups.includes(selectedGroup);
          });

    let visibleItems = baseItems;
    if (showViewMoreCard && Number.isFinite(maxVisibleItems) && maxVisibleItems > 0) {
      visibleItems = baseItems.slice(0, maxVisibleItems);
    }

    if (showViewMoreCard) {
      return [
        ...visibleItems,
        {
          isViewMoreCard: true,
          title: viewMoreTitle,
          description: viewMoreDescription,
          viewMorePath,
          groups: groups.map((group: { name: string }) => group.name),
        },
      ];
    }

    return visibleItems;
  }, [
    groups,
    maxVisibleItems,
    section.items,
    selectedGroup,
    showViewMoreCard,
    viewMoreDescription,
    viewMorePath,
    viewMoreTitle,
  ]);

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

    const toastId = toast.loading('Downloading...');
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

    try {
      const proxyUrl = `/api/proxy/file?url=${encodeURIComponent(src)}`;
      let blob = await fetchBlob(proxyUrl);
      if (!blob) {
        blob = await fetchBlob(src);
      }

      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        triggerDownload(blobUrl);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        toast.success('Image downloaded', { id: toastId });
        return;
      }

      triggerDownload(src);
      toast.success('Image downloaded', { id: toastId });
    } catch {
      toast.error('Download failed', { id: toastId });
    }
  }, [filteredItems, selectedIndex]);

  const handleCardClick = useCallback(
    (item: any, index: number) => {
      if (item?.isViewMoreCard) {
        const query =
          selectedGroup && selectedGroup !== 'all'
            ? `?filter=${encodeURIComponent(selectedGroup)}`
            : '';
        router.push(`${(item.viewMorePath as string) || viewMorePath}${query}`);
        return;
      }

      if (isGeneratedGallerySection) {
        const detailUrl = item?.detailUrl || item?.button?.url;
        if (typeof detailUrl === 'string' && detailUrl) {
          router.push(detailUrl);
          return;
        }
      }

      setSelectedIndex(index);
    },
    [isGeneratedGallerySection, router, selectedGroup, viewMorePath]
  );

  const groupButtons = groups.map(
    (group: { name: string; title: string }, index: number) => {
      const isSelected = selectedGroup === group.name;
      const buttonClassName = cn(
        'transition-colors',
        useSidebarGroups
          ? cn(
              'w-full bg-transparent px-0 py-1.5 text-left text-xs leading-snug hover:bg-transparent',
              isSelected
                ? 'text-foreground font-semibold'
                : 'text-foreground/55 font-medium hover:text-foreground'
            )
          : cn(
              'relative rounded-lg px-3 py-1.5 text-sm font-medium',
              isSelected
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'ring-border bg-background text-foreground/60 ring-1 ring-inset hover:bg-muted hover:text-foreground hover:ring-border/80'
            )
      );

      if (!shouldAnimateGallery) {
        return (
          <button
            key={group.name}
            type="button"
            onClick={() => setSelectedGroup(group.name)}
            className={buttonClassName}
          >
            <span>{group.title}</span>
          </button>
        );
      }

      return (
        <button
          key={group.name}
          type="button"
          onClick={() => setSelectedGroup(group.name)}
          className={buttonClassName}
        >
          <span>{group.title}</span>
        </button>
      );
    }
  );

  const renderCardBody = (item: any) => {
    if (isGeneratedGallerySection) {
      return (
        <>
          <div
            className={cn(
              'overflow-hidden rounded-xl border',
              !item?.isViewMoreCard && 'bg-card'
            )}
          >
            {item?.isViewMoreCard ? (
              <div className="flex aspect-square w-full items-center justify-center p-4">
                <div className="space-y-1 text-center">
                  <h3 className="text-foreground text-base font-semibold">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-muted-foreground text-xs">{item.description}</p>
                  )}
                </div>
              </div>
            ) : (
              <LazyImage
                src={item.image?.src ?? ''}
                alt={item.image?.alt ?? ''}
                className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              />
            )}
          </div>
          {!item?.isViewMoreCard && (
            <div className="px-2 pt-2 pb-1">
              <h3 className="text-foreground line-clamp-2 text-center text-sm font-medium">
                {item.title}
              </h3>
            </div>
          )}
        </>
      );
    }

    return (
      <>
        <LazyImage
          src={item.image?.src ?? ''}
          alt={item.image?.alt ?? ''}
          className="h-auto w-full"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />
        <div className="absolute inset-0 flex flex-col justify-end bg-black/60 p-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <p className="mb-2 translate-y-4 text-sm font-medium text-white transition-transform duration-300 group-hover:translate-y-0">
            {item.title}
          </p>
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
                    <SmartIcon name={(item as any).button.icon as string} />
                  )}
                  {(item as any).button.title}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </>
    );
  };

  const itemsContent =
    filteredItems.length > 0 ? (
      <div
        className={cn(
          useSidebarGroups
            ? 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:block lg:[column-count:4] lg:[column-gap:1rem] lg:space-y-4'
            : 'columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3 xl:columns-4',
          !useSidebarGroups && 'container mx-auto'
        )}
      >
        {filteredItems.map((item, index) => {
          const cardClassName = cn(
            'group relative break-inside-avoid rounded-xl',
            !isGeneratedGallerySection &&
              '[content-visibility:auto] [contain-intrinsic-size:360px_480px]',
            isGeneratedGallerySection
              ? 'cursor-pointer'
              : 'cursor-zoom-in overflow-hidden'
          );

          if (!shouldAnimateGallery) {
            return (
              <div
                key={index}
                className={cardClassName}
                onClick={() => handleCardClick(item, index)}
              >
                {renderCardBody(item)}
              </div>
            );
          }

          return (
            <div
              key={index}
              className={cardClassName}
              onClick={() => handleCardClick(item, index)}
            >
              {renderCardBody(item)}
            </div>
          );
        })}
      </div>
    ) : (
      shouldAnimateGallery ? (
        <div
          className={cn(
            'text-muted-foreground text-center',
            !useSidebarGroups && 'container'
          )}
        >
          No items found in this category.
        </div>
      ) : (
        <div
          className={cn(
            'text-muted-foreground text-center',
            !useSidebarGroups && 'container'
          )}
        >
          No items found in this category.
        </div>
      )
    );

  return (
    <section
      id={section.id || section.name}
      className={cn('py-20', section.className, className)}
    >
      {shouldAnimateGallery ? (
        <div className="container mb-4">
          {section.sr_only_title && (
            <h1 className="sr-only">{section.sr_only_title}</h1>
          )}
          <div
            className={cn(
              isGeneratedGallerySection
                ? cn('relative w-full', showGenerateLink ? 'mb-8' : 'mb-12')
                : 'mx-auto max-w-full text-center md:max-w-5xl'
            )}
          >
            {isGeneratedGallerySection ? (
              <div className="mx-auto max-w-5xl text-center">
                <h2
                  className={cn(
                    'text-foreground tracking-tight',
                    'mb-4 text-2xl font-medium md:text-3xl'
                  )}
                >
                  {section.title}
                </h2>
                {section.description && (
                  <p className="text-muted-foreground text-md">
                    {section.description}
                  </p>
                )}
              </div>
            ) : (
              <>
                <h2
                  className={cn(
                    'text-foreground tracking-tight',
                    'mb-12 text-3xl font-semibold md:text-4xl'
                  )}
                >
                  {section.title}
                </h2>
                {section.description && (
                  <p className="text-muted-foreground text-md mb-4 line-clamp-3">
                    {section.description}
                  </p>
                )}
              </>
            )}
            {isGeneratedGallerySection && showGenerateLink && (
              <Link
                href={generateLinkPath}
                className="text-muted-foreground/70 hover:text-primary mt-4 ml-auto flex w-fit items-center gap-1 text-xs transition-colors md:absolute md:top-1/2 md:right-0 md:mt-0 md:-translate-y-1/2"
              >
                <span>{generateLinkTitle}</span>
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
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
        </div>
      ) : (
        <div className="container mb-4">
          {section.sr_only_title && (
            <h1 className="sr-only">{section.sr_only_title}</h1>
          )}
          <div
            className={cn(
              isGeneratedGallerySection
                ? cn('relative w-full', showGenerateLink ? 'mb-8' : 'mb-12')
                : 'mx-auto max-w-full text-center md:max-w-5xl'
            )}
          >
            {isGeneratedGallerySection ? (
              <div className="mx-auto max-w-5xl text-center">
                <h2
                  className={cn(
                    'text-foreground tracking-tight',
                    'mb-4 text-2xl font-medium md:text-3xl'
                  )}
                >
                  {section.title}
                </h2>
                {section.description && (
                  <p className="text-muted-foreground text-md">
                    {section.description}
                  </p>
                )}
              </div>
            ) : (
              <>
                <h2
                  className={cn(
                    'text-foreground tracking-tight',
                    'mb-12 text-3xl font-semibold md:text-4xl'
                  )}
                >
                  {section.title}
                </h2>
                {section.description && (
                  <p className="text-muted-foreground text-md mb-4 line-clamp-3">
                    {section.description}
                  </p>
                )}
              </>
            )}
            {isGeneratedGallerySection && showGenerateLink && (
              <Link
                href={generateLinkPath}
                className="text-muted-foreground/70 hover:text-primary mt-4 ml-auto flex w-fit items-center gap-1 text-xs transition-colors md:absolute md:top-1/2 md:right-0 md:mt-0 md:-translate-y-1/2"
              >
                <span>{generateLinkTitle}</span>
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
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
        </div>
      )}

      {groups.length > 0 && !useSidebarGroups && (
        shouldAnimateGallery ? (
          <div
            className="container mb-8 flex flex-wrap justify-center gap-4"
          >
            {groupButtons}
          </div>
        ) : (
          <div className="container mb-8 flex flex-wrap justify-center gap-4">
            {groupButtons}
          </div>
        )
      )}

      {useSidebarGroups ? (
        <div className="container">
          <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            {shouldAnimateGallery ? (
              <aside
                className="lg:sticky lg:top-24"
              >
                {groupSidebarTitle && (
                  <h3 className="text-foreground/50 mb-3 text-xs font-normal leading-tight tracking-wide">
                    {groupSidebarTitle}
                  </h3>
                )}
                <div className="flex flex-col gap-1">
                  {groupButtons}
                </div>
              </aside>
            ) : (
              <aside className="lg:sticky lg:top-24">
                {groupSidebarTitle && (
                  <h3 className="text-foreground/50 mb-3 text-xs font-normal leading-tight tracking-wide">
                    {groupSidebarTitle}
                  </h3>
                )}
                <div className="flex flex-col gap-1">
                  {groupButtons}
                </div>
              </aside>
            )}
            <div>{itemsContent}</div>
          </div>
        </div>
      ) : (
        itemsContent
      )}

      <>
        {selectedIndex !== null &&
          filteredItems &&
          filteredItems.length > 0 && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm md:p-8"
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

              <div
                key={selectedIndex}
                className="relative flex h-full w-full items-center justify-center"
              >
                <div
                  className="flex items-start gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="relative max-h-full max-w-full overflow-hidden rounded-lg bg-white leading-none">
                    <img
                      src={filteredItems[selectedIndex].image?.src ?? ''}
                      alt={filteredItems[selectedIndex].image?.alt ?? ''}
                      className="block h-auto max-h-[90vh] w-auto max-w-full object-contain align-top"
                      loading="eager"
                    />
                    <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-6 text-white">
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
                      className="mt-1 self-auto bg-black/30 text-white hover:bg-black/50 hover:text-white"
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
              </div>
            </div>
          )}
      </>
    </section>
  );
}
