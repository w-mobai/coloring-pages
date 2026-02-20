/**
 * 世代分析器
 * 确定哪些来源适用于出生日期，识别边界年份，应用 tie-breaker 规则
 */

import { Source, Generation } from '@/lib/generation-definitions';

export interface AnalysisInput {
  birthYear: number;
  birthMonth?: number;
  sources: Source[];
}

export interface SourceClassification {
  sourceName: string;
  sourceUrl?: string;
  generationName: string;
  yearRange: string; // 例如 "1965-1980" 或 "1996-至今"
  priority: number;
}

export interface AnalysisContext {
  applicableSources: SourceClassification[];
  isBoundaryYear: boolean;
  primaryGeneration: string; // 基于 tie-breaker 规则确定
  confidence: 'high' | 'medium' | 'low';
}

/**
 * 获取适用于指定年份的来源分类
 */
export function getApplicableSources(
  year: number,
  sources: Source[]
): SourceClassification[] {
  const applicable: SourceClassification[] = [];

  for (const source of sources) {
    for (const gen of source.generations) {
      // 闭区间检查
      if (gen.endYear !== null) {
        if (year >= gen.startYear && year <= gen.endYear) {
          applicable.push({
            sourceName: source.name,
            sourceUrl: source.sourceUrl,
            generationName: gen.name,
            yearRange: `${gen.startYear}-${gen.endYear}`,
            priority: source.priority,
          });
        }
      }
      // 开放区间检查
      else {
        if (year >= gen.startYear) {
          applicable.push({
            sourceName: source.name,
            sourceUrl: source.sourceUrl,
            generationName: gen.name,
            yearRange: `${gen.startYear}-至今`,
            priority: source.priority,
          });
        }
      }
    }
  }

  return applicable;
}

/**
 * 判断是否为边界年份
 * 至少需要2个来源，且有不同的世代名称
 */
export function isBoundaryYear(
  classifications: SourceClassification[]
): boolean {
  // 至少需要2个来源
  if (classifications.length < 2) return false;

  // 检查是否有不同的世代名称
  const uniqueGenerations = new Set(
    classifications.map((c) => c.generationName)
  );
  return uniqueGenerations.size > 1;
}

/**
 * 确定主要世代（Tie-breaker 规则）
 * 按优先级排序，返回优先级最高的来源的世代
 */
export function determinePrimaryGeneration(
  classifications: SourceClassification[]
): string {
  if (classifications.length === 0) {
    throw new Error('No applicable sources');
  }

  if (classifications.length === 1) {
    return classifications[0].generationName;
  }

  // 按优先级排序（数字越小优先级越高）
  const sorted = [...classifications].sort((a, b) => a.priority - b.priority);

  // 返回优先级最高的来源的世代
  return sorted[0].generationName;
}

/**
 * 计算置信度
 */
export function calculateConfidence(
  classifications: SourceClassification[]
): 'high' | 'medium' | 'low' {
  if (classifications.length === 0) {
    throw new Error('No applicable sources');
  }

  // 只有单一来源
  if (classifications.length === 1) {
    return 'low';
  }

  // 检查所有来源是否一致
  const uniqueGenerations = new Set(
    classifications.map((c) => c.generationName)
  );

  if (uniqueGenerations.size === 1) {
    // 所有来源一致
    return 'high';
  } else {
    // 来源不一致（边界年份）
    return 'medium';
  }
}

/**
 * 分析世代上下文
 */
export function analyzeContext(input: AnalysisInput): AnalysisContext {
  const applicableSources = getApplicableSources(
    input.birthYear,
    input.sources
  );

  if (applicableSources.length === 0) {
    throw new Error(`No sources found for year ${input.birthYear}`);
  }

  const isBoundary = isBoundaryYear(applicableSources);
  const primaryGeneration = determinePrimaryGeneration(applicableSources);
  const confidence = calculateConfidence(applicableSources);

  return {
    applicableSources,
    isBoundaryYear: isBoundary,
    primaryGeneration,
    confidence,
  };
}
