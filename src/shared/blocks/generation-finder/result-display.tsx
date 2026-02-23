'use client';

/**
 * 结果显示组件
 * 显示世代分析结果，包括主要结论、解释、意义和来源透明度
 */

import { Mail, Smile, Sparkles } from 'lucide-react';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import type { AIGenerationResponse } from '@/lib/ai/generation-synthesizer';

interface ResultDisplayProps {
  result: AIGenerationResponse;
  locale: string;
}

export function ResultDisplay({ result, locale }: ResultDisplayProps) {
  const xUrl = 'https://x.com/HL19930219';
  const feedbackEmail = 'whl774148248@gmail.com';

  return (
    <div data-result-container className="space-y-6">
      {/* 主要结论 */}
      <div className="bg-secondary border border-secondary rounded-lg p-6 md:p-8 space-y-4 text-secondary-foreground">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <h3 className="text-sm font-medium text-secondary-foreground/80">
              {locale === 'zh' ? '你的世代' : 'Your Generation'}
            </h3>
            <p className="text-3xl md:text-4xl font-bold text-secondary-foreground">
              {result.primary_generation}
            </p>
            {result.transitional_label && (
              <p className="text-sm text-secondary-foreground/85">
                {locale === 'zh' ? '过渡世代：' : 'Transitional: '}
                {result.transitional_label}
              </p>
            )}
          </div>
          <img
            src="/logo.png"
            alt={
              locale === 'zh'
                ? 'ColorFun 品牌标志'
                : 'ColorFun logo'
            }
            className="h-20 w-20 rounded-lg object-contain flex-shrink-0"
          />
        </div>
      </div>

      {/* 解释 */}
      <div className="bg-card rounded-lg p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Smile className="h-6 w-6 text-primary" />
          <h4 className="text-xl font-semibold">
            {locale === 'zh' ? '为什么是这个世代？' : 'Why This Generation?'}
          </h4>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          {result.explanation}
        </p>
      </div>

      {/* 意义描述 */}
      <div className="bg-card rounded-lg p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h4 className="text-xl font-semibold">
            {locale === 'zh' ? '世代特征' : 'Generation Characteristics'}
          </h4>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          {result.significance}
        </p>
      </div>

      {/* 意见反馈 */}
      <div className="p-2">
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <p className="text-center text-sm leading-none text-muted-foreground">
            {locale === 'zh'
              ? '有建议或发现问题？欢迎反馈'
              : 'Have feedback or found an issue?'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <a
                href={xUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Feedback on X"
                className="border-border text-muted-foreground hover:bg-primary/10 hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors"
              >
                <SmartIcon name="RiTwitterXFill" size={16} />
              </a>
              <a
                href={`mailto:${feedbackEmail}`}
                aria-label="Feedback by email"
                className="border-border text-muted-foreground hover:bg-primary/10 hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
