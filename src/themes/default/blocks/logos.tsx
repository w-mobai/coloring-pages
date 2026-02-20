'use client';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { Marquee } from '@/shared/components/ui/marquee';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';
import { GENERATION_SOURCES } from '@/lib/generation-definitions';
import { SocialAvatars } from './social-avatars';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/shared/components/ui/hover-card';

export function Logos({
  section,
  className,
  locale,
}: {
  section: Section;
  className?: string;
  locale?: string;
}) {
  // 使用优先级最高的来源（Parents.com）
  const primarySource = GENERATION_SOURCES[0];
  const generations = primarySource.generations;

  // 获取世代简介
  const getGenerationDescription = (genName: string): string => {
    const descriptions = section.generations as Record<string, { description: string }>;
    return descriptions?.[genName]?.description || '';
  };

  return (
    <section
      id={section.id}
      className={cn('py-16 md:py-24', section.className, className)}
    >
      <div className={`mx-auto max-w-7xl px-6`}>
        <ScrollAnimation>
          <div className="text-center mb-8">
            <h2 className="text-foreground mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
              {section.title}
            </h2>
            {section.description && (
              <p className="text-muted-foreground max-w-3xl mx-auto">
                {section.description}
              </p>
            )}
          </div>
        </ScrollAnimation>
        <ScrollAnimation delay={0.2}>
          <div className="mt-4 relative">
            {/* 左侧渐变遮罩 - 增加不透明度 */}
            <div className="absolute left-0 top-0 bottom-0 w-48 bg-gradient-to-r from-background via-background/60 to-transparent z-10 pointer-events-none" />
            
            {/* 右侧渐变遮罩 - 增加不透明度 */}
            <div className="absolute right-0 top-0 bottom-0 w-48 bg-gradient-to-l from-background via-background/60 to-transparent z-10 pointer-events-none" />
            
            <Marquee pauseOnHover className="[--duration:60s] [--gap:1rem]">
              {generations.map((gen, idx) => {
                const description = getGenerationDescription(gen.name);
                
                return (
                  <HoverCard key={idx} openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <div
                        className="group/card flex flex-col items-center justify-center rounded-xl border p-4 min-w-[180px] transition-all border-border/50 backdrop-blur-md bg-card/80 hover:backdrop-blur-none hover:!bg-primary hover:!border-primary [&:hover_h3]:!text-white [&:hover_p]:!text-white/90 cursor-pointer"
                      >
                        <h3 className="text-base font-medium mb-1 text-foreground transition-colors">
                          {gen.name}
                        </h3>
                        <p className="text-xs text-muted-foreground transition-colors">
                          {gen.startYear} - {gen.endYear || (locale === 'zh' ? '至今' : 'Present')}
                        </p>
                      </div>
                    </HoverCardTrigger>
                    {description && (
                      <HoverCardContent 
                        className="w-80 z-50 rounded-xl" 
                        side="bottom"
                        align="center"
                      >
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {description}
                        </p>
                      </HoverCardContent>
                    )}
                  </HoverCard>
                );
              })}
            </Marquee>
          </div>
        </ScrollAnimation>
        
        {/* 添加头像和评分 */}
        <ScrollAnimation delay={0.4}>
          <SocialAvatars tip={locale === 'zh' ? '999+ 用户正在发现他们的世代' : '999+ users discovering their generation'} />
        </ScrollAnimation>
      </div>
    </section>
  );
}
