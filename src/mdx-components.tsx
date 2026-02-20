import React from 'react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { cn } from '@/shared/lib/utils';

// Custom link component with nofollow for external links
const CustomLink = ({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  // Check if the link is external
  const isExternal = href?.startsWith('http') || href?.startsWith('//');

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="nofollow noopener noreferrer"
        className="text-primary"
        {...props}
      >
        {children}
      </a>
    );
  }

  // Internal links
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
};

// Higher-order component to wrap any link component with nofollow logic
export function withNoFollow(
  LinkComponent: React.ComponentType<
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  >
) {
  return ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    // Check if the link is external
    const isExternal = href?.startsWith('http') || href?.startsWith('//');

    if (isExternal) {
      // For external links, add nofollow and pass through to the wrapped component
      return (
        <LinkComponent
          href={href}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="text-primary"
          {...props}
        >
          {children}
        </LinkComponent>
      );
    }

    // For internal links, just use the wrapped component as-is
    return (
      <LinkComponent href={href} {...props}>
        {children}
      </LinkComponent>
    );
  };
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  const mergedComponents = {
    ...defaultMdxComponents,
    a: CustomLink,
    h1: (props: React.ComponentProps<'h1'>) => (
      <h1
        {...props}
        className={cn(
          'text-3xl font-bold tracking-tight mt-8 mb-4 text-foreground',
          props.className
        )}
      />
    ),
    h2: (props: React.ComponentProps<'h2'>) => (
      <h2
        {...props}
        className={cn(
          'text-2xl font-semibold tracking-tight mt-8 mb-4 text-foreground',
          props.className
        )}
      />
    ),
    h3: (props: React.ComponentProps<'h3'>) => (
      <h3
        {...props}
        className={cn(
          'text-xl font-semibold tracking-tight mt-6 mb-3 text-foreground',
          props.className
        )}
      />
    ),
    h4: (props: React.ComponentProps<'h4'>) => (
      <h4
        {...props}
        className={cn(
          'text-lg font-semibold tracking-tight mt-6 mb-3 text-foreground',
          props.className
        )}
      />
    ),
    h5: (props: React.ComponentProps<'h5'>) => (
      <h5
        {...props}
        className={cn(
          'text-base font-semibold tracking-tight mt-4 mb-2 text-foreground',
          props.className
        )}
      />
    ),
    h6: (props: React.ComponentProps<'h6'>) => (
      <h6
        {...props}
        className={cn(
          'text-sm font-semibold tracking-tight mt-4 mb-2 text-foreground',
          props.className
        )}
      />
    ),
    p: (props: React.ComponentProps<'p'>) => (
      <p
        {...props}
        className={cn('text-base leading-7 mb-4 text-foreground', props.className)}
      />
    ),
    img: (props: React.ComponentProps<'img'>) => {
      const { src } = props;
      // If src is an object (imported image), use its src property
      const imageSrc =
        typeof src === 'object' && src !== null && 'src' in src
          ? (src as any).src
          : src;

      return (
        <img
          {...props}
          src={imageSrc}
          className={cn('rounded-lg border', props.className)}
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      );
    },
    Video: ({ className, ...props }: React.ComponentProps<'video'>) => (
      <video
        className={cn('rounded-md border', className)}
        controls
        loop
        {...props}
      />
    ),
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
    ...components,
  };

  // If a custom 'a' component is provided, wrap it with nofollow logic
  if (components?.a && components.a !== CustomLink) {
    mergedComponents.a = withNoFollow(
      components.a as React.ComponentType<
        React.AnchorHTMLAttributes<HTMLAnchorElement>
      >
    );
  }

  return mergedComponents;
}

export const useMDXComponents = getMDXComponents;
