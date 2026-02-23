'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Calendar, Loader2, Sparkles, X } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  DialogClose,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { Highlighter } from '@/shared/components/ui/highlighter';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';
import type { AIGenerationResponse } from '@/lib/ai/generation-synthesizer';

const ColoringPageGenerator = dynamic(
  () =>
    import('@/shared/blocks/generator/coloring-page').then(
      (mod) => mod.ColoringPageGenerator
    ),
  {
    loading: () => <div className="min-h-[220px] w-full" />,
  }
);

const ResultDisplay = dynamic(
  () =>
    import('@/shared/blocks/generation-finder/result-display').then(
      (mod) => mod.ResultDisplay
    ),
  {
    loading: () => <div className="min-h-[160px] w-full" />,
  }
);

export function Hero({
  section,
  locale,
  className,
}: {
  section: Section;
  locale?: string;
  className?: string;
}) {
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [birthMonth, setBirthMonth] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AIGenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 1901 + 1 },
    (_, i) => currentYear - i
  );

  const months = [
    { value: 1, label: locale === 'zh' ? '1月' : 'January' },
    { value: 2, label: locale === 'zh' ? '2月' : 'February' },
    { value: 3, label: locale === 'zh' ? '3月' : 'March' },
    { value: 4, label: locale === 'zh' ? '4月' : 'April' },
    { value: 5, label: locale === 'zh' ? '5月' : 'May' },
    { value: 6, label: locale === 'zh' ? '6月' : 'June' },
    { value: 7, label: locale === 'zh' ? '7月' : 'July' },
    { value: 8, label: locale === 'zh' ? '8月' : 'August' },
    { value: 9, label: locale === 'zh' ? '9月' : 'September' },
    { value: 10, label: locale === 'zh' ? '10月' : 'October' },
    { value: 11, label: locale === 'zh' ? '11月' : 'November' },
    { value: 12, label: locale === 'zh' ? '12月' : 'December' },
  ];

  const handleAnalyze = async () => {
    if (!birthYear) {
      setError(
        locale === 'zh' ? '出生年份是必填项' : 'Birth year is required'
      );
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setError(null);
    setResult(null);

    // 模拟进度更新 - 更平滑的进度增长
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev; // 在90%停止，等待实际响应
        // 使用更小的增量，让进度更平滑
        const increment = (90 - prev) * 0.1; // 每次增加剩余进度的10%
        return Math.min(prev + increment, 90);
      });
    }, 300);

    try {
      const response = await fetch('/api/generation/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          birthYear,
          birthMonth: birthMonth || undefined,
          locale,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.details 
          ? `${data.error}\n\n${locale === 'zh' ? '详情' : 'Details'}: ${data.details}`
          : data.error || 'Analysis failed';
        throw new Error(errorMessage);
      }

      const result: AIGenerationResponse = data;
      setProgress(100); // 完成时设置为100%
      setResult(result);
      
      // 短暂延迟后打开弹框，让用户看到100%
      setTimeout(() => {
        setShowResultDialog(true);
      }, 300);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(
        err.message ||
          (locale === 'zh'
            ? '分析服务暂时不可用。请稍后再试。'
            : 'Analysis service is temporarily unavailable. Please try again later.')
      );
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  const handleButtonClick = () => {
    if (!birthYear) {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000); // 3秒后自动隐藏
      return;
    }
    setShowTooltip(false);
    handleAnalyze();
  };

  const highlightText = section.highlight_text ?? '';
  const rawTitle = section.title ?? '';
  const [mainTitle, ...hintTitleParts] = rawTitle.split('\n');
  const hintTitle = hintTitleParts.join('\n').trim();
  const canHighlightMainTitle =
    !!highlightText && !!mainTitle && mainTitle.includes(highlightText);
  const highlightedMainTitleParts = canHighlightMainTitle
    ? mainTitle.split(highlightText, 2)
    : null;

  const translations = section.generation_finder || {};
  const announcementHref = section.announcement?.url;
  const announcementTarget = section.announcement?.target || '_self';
  const announcementRel =
    announcementTarget === '_blank' ? 'noopener noreferrer' : undefined;

  return (
    <section
      id={section.id}
      className={cn(
        `pt-24 pb-8 md:pt-24 md:pb-8`,
        section.className,
        className
      )}
    >
      {section.background_image?.src && (
        <div className="absolute top-0 left-0 right-0 h-[80%] -z-10 hidden w-full overflow-hidden md:block">
          <div className="from-background/80 via-background/60 to-background absolute inset-0 z-10 bg-gradient-to-b" />
          <Image
            src={section.background_image.src}
            alt={section.background_image.alt || 'Background decoration'}
            className="object-cover opacity-10 blur-[0px]"
            style={{ filter: 'grayscale(50%)' }}
            fill
            loading="lazy"
            sizes="(max-width: 768px) 0vw, 100vw"
            quality={70}
            unoptimized={section.background_image.src.startsWith('http')}
          />
        </div>
      )}

      {section.announcement && announcementHref && (
        <Link
          href={announcementHref}
          target={announcementTarget}
          rel={announcementRel}
          className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto mb-6 sm:mb-10 flex w-fit cursor-pointer items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-zinc-950/5 transition-colors duration-300 dark:border-t-white/5 dark:shadow-zinc-950"
        >
          <span className="text-foreground text-sm">
            {section.announcement.title}
          </span>
          <span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700"></span>

          <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
            <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
              <span className="flex size-6">
                <ArrowRight className="m-auto size-3" />
              </span>
              <span className="flex size-6">
                <ArrowRight className="m-auto size-3" />
              </span>
            </div>
          </div>
        </Link>
      )}

      <div className="relative mx-auto max-w-full px-4 text-center md:max-w-5xl">
        {/* Logo + Title */}
        <div className="flex flex-col items-center justify-center gap-0">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-28 w-auto -mb-4"
          />
          <h1 className="text-foreground text-3xl font-semibold leading-none text-balance sm:text-5xl">
            {highlightedMainTitleParts ? (
              <>
                {highlightedMainTitleParts[0]}
                <Highlighter action="underline" color="#FE8A9D">
                  {highlightText}
                </Highlighter>
                {highlightedMainTitleParts[1]}
              </>
            ) : (
              mainTitle
            )}
            {hintTitle && (
              <span className="text-muted-foreground/60 mt-1 block text-sm font-normal tracking-[0.12em] sm:text-base">
                {hintTitle}
              </span>
            )}
          </h1>
        </div>

        <p
          className="text-muted-foreground mt-3 mb-6 text-base text-balance"
          dangerouslySetInnerHTML={{ __html: section.description ?? '' }}
        />

        {/* Feature Tags */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <span className="px-3 py-1.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: '#fbbf24' }}>
            Free to Use
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: '#f97316' }}>
            Print-Ready
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: '#14b8a6' }}>
            Kid-Safe Styles
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: '#3b82f6' }}>
            Instant Download
          </span>
        </div>

        {section.show_coloring_generator && (
          <div className="mt-12 max-w-5xl mx-auto">
            <ColoringPageGenerator />
          </div>
        )}

        {section.show_generation_finder && (
          <div className="mt-12 max-w-3xl mx-auto space-y-8">
            {/* 输入表单 - 聊天样式 */}
            <div className="backdrop-blur-md bg-background/60 border border-white/20 rounded-2xl p-2">
              <div className="flex flex-col sm:flex-row gap-2 items-center">
                {/* 文本提示 + 年份月份选择 */}
                <div className="flex-1 w-full flex items-center gap-3 px-3">
                  <span className="text-muted-foreground whitespace-nowrap">
                    {locale === 'zh' ? '我的出生日期是' : 'I was born in'}
                  </span>
                  
                  {/* 年份选择 */}
                  <Select
                    value={birthYear?.toString() || ''}
                    onValueChange={(value) => setBirthYear(parseInt(value))}
                  >
                    <SelectTrigger className="h-10 w-32 border border-input bg-transparent text-foreground font-medium hover:bg-primary/10 hover:text-foreground [&>svg]:hidden justify-center data-[placeholder]:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-foreground" />
                        <SelectValue placeholder={locale === 'zh' ? '年份' : 'Year'} />
                      </div>
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[300px] w-32">
                      {years.map((year) => (
                        <SelectItem 
                          key={year} 
                          value={year.toString()} 
                          className="pr-2 justify-center text-muted-foreground [&>span:first-child]:hidden data-[state=checked]:text-foreground data-[state=checked]:font-medium focus:bg-muted focus:text-foreground"
                        >
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {locale === 'zh' && (
                    <span className="text-muted-foreground">年</span>
                  )}

                  {/* 月份选择 */}
                  <Select
                    value={birthMonth?.toString() || ''}
                    onValueChange={(value) =>
                      setBirthMonth(value ? parseInt(value) : null)
                    }
                  >
                    <SelectTrigger className="h-10 w-32 border border-input bg-transparent text-foreground font-medium hover:bg-primary/10 hover:text-foreground [&>svg]:hidden justify-center data-[placeholder]:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-foreground" />
                        <SelectValue placeholder={locale === 'zh' ? '月份' : 'Month'} />
                      </div>
                    </SelectTrigger>
                    <SelectContent position="popper" className="w-32">
                      {months.map((month) => (
                        <SelectItem 
                          key={month.value} 
                          value={month.value.toString()} 
                          className="pr-2 justify-center text-muted-foreground [&>span:first-child]:hidden data-[state=checked]:text-foreground data-[state=checked]:font-medium focus:bg-muted focus:text-foreground"
                        >
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {locale === 'zh' && (
                    <span className="text-muted-foreground whitespace-nowrap">
                      月，请帮我分析
                    </span>
                  )}
                </div>

                {/* 提交按钮 */}
                <TooltipProvider>
                  <Tooltip 
                    open={!birthYear && showTooltip ? true : (!birthYear ? undefined : false)}
                  >
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          onClick={handleButtonClick}
                          disabled={isLoading}
                          className={cn(
                            "h-12 px-8 rounded-xl shadow-lg text-white transition-colors",
                            birthYear 
                              ? "bg-primary hover:bg-primary/90" 
                              : "bg-primary/60 hover:bg-primary/70"
                          )}
                          size="lg"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {translations.analyzing || 'Analyzing...'} {Math.round(progress)}%
                            </>
                          ) : (
                            <>
                              {translations.analyzeButton || 'Analyze'}
                              <Sparkles className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!birthYear && (
                      <TooltipContent side="top" sideOffset={10} hideArrow className="bg-white text-gray-400 border border-gray-200">
                        <p>
                          {locale === 'zh' ? (
                            <>请先选择<span className="text-black">出生年份</span></>
                          ) : (
                            <>Please select your <span className="text-black">birth year</span> first</>
                          )}
                        </p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* 错误显示 */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-destructive">
                      {translations.errorTitle || 'Analysis Error'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{error}</p>
                  </div>
                </div>
                <Button onClick={handleAnalyze} variant="outline" size="sm">
                  {translations.retryButton || 'Retry'}
                </Button>
              </div>
            )}

            {/* 结果弹框 */}
            <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
              <DialogContent
                showCloseButton={false}
                className="!max-w-3xl w-full max-h-[85vh] overflow-y-auto"
              >
                <DialogHeader className="relative items-center">
                  <DialogTitle className="text-sm text-muted-foreground/70 font-normal">
                    {locale === 'zh' ? '世代分析结果' : 'Generation Analysis Result'}
                  </DialogTitle>
                  <DialogClose className="text-black absolute top-1/2 right-0 -translate-y-1/2 rounded-md p-1 opacity-100 focus:outline-none focus-visible:outline-none focus-visible:ring-0">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                  </DialogClose>
                </DialogHeader>
                {result && <ResultDisplay result={result} locale={locale || 'en'} />}
              </DialogContent>
            </Dialog>
          </div>
        )}

        {section.tip && (
          <p
            className="text-muted-foreground mt-6 block text-center text-sm"
            dangerouslySetInnerHTML={{ __html: section.tip ?? '' }}
          />
        )}
      </div>
    </section>
  );
}
