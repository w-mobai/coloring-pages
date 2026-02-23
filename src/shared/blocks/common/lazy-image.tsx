'use client';

import Image from 'next/image';

export function LazyImage({
  src,
  alt,
  className,
  width,
  height,
  placeholderSrc,
  title,
  fill,
  priority,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  placeholderSrc?: string;
  title?: string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
}) {
  const resolvedSrc = src || placeholderSrc || '';
  const isRemoteUrl =
    resolvedSrc.startsWith('http://') ||
    resolvedSrc.startsWith('https://') ||
    resolvedSrc.startsWith('//');
  const isLocalWithQuery =
    resolvedSrc.startsWith('/') && resolvedSrc.includes('?');
  const useNativeImg =
    !resolvedSrc ||
    isRemoteUrl ||
    resolvedSrc.startsWith('blob:') ||
    resolvedSrc.startsWith('data:') ||
    isLocalWithQuery;

  if (useNativeImg) {
    return (
      <img
        src={resolvedSrc}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        sizes={sizes}
        title={title}
        className={className}
        style={
          fill
            ? {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
              }
            : undefined
        }
      />
    );
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={fill ? undefined : (width ?? 1200)}
      height={fill ? undefined : (height ?? 900)}
      fill={fill}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      sizes={sizes}
      title={title}
      className={className}
      style={
        fill
          ? undefined
          : {
              height: 'auto',
            }
      }
    />
  );
}
