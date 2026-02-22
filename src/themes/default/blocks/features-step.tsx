'use client';

import React from 'react';
import { ArrowBigRight } from 'lucide-react';

import { SmartIcon } from '@/shared/blocks/common';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function FeaturesStep({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={cn('py-16 md:py-24', section.className, className)}
    >
      <div className="m-4 rounded-[2rem]">
        <div className="@container relative container">
          <ScrollAnimation>
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-primary">{section.label}</span>
              <h2 className="text-foreground mt-4 mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
                {section.title}
              </h2>
              <p className="text-muted-foreground mt-4 text-lg text-balance">
                {section.description}
              </p>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={0.2}>
            {/* 使用flex布局，让板块和箭头交替排列 */}
            <div className="mt-12 flex items-start justify-center gap-4">
              {section.items?.map((item, idx) => (
                <React.Fragment key={idx}>
                  {/* 内容板块 */}
                  <div className="w-full max-w-[280px] space-y-6">
                    {/* 步骤编号 */}
                    <div className="flex items-center justify-center gap-4">
                      <span className="flex size-6 items-center justify-center rounded-full bg-zinc-500/15 text-sm font-medium">
                        {idx + 1}
                      </span>
                    </div>
                    {/* 内容 */}
                    <div className="text-center">
                      <h3 className="text-foreground mb-4 text-lg font-semibold">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground text-balance text-sm">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* 箭头列 */}
                  {idx < (section.items?.length ?? 0) - 1 && (
                    <div className="hidden @3xl:flex items-center pt-8 -mx-2">
                      <ArrowBigRight className="fill-muted stroke-primary flex-shrink-0" size={32} />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}
