/**
 * 世代定义数据层
 * 存储来自多个权威来源的世代定义，每个来源配置唯一优先级
 */

export interface Generation {
  name: string; // 世代名称，如 "Millennials"、"Gen Z"
  startYear: number; // 闭区间起始年份
  endYear: number | null; // 闭区间结束年份，null 表示开放区间（至今）
}

export interface Source {
  name: string; // 来源名称，如 "Parents.com"、"IACET"
  priority: number; // 唯一优先级，数字越小优先级越高
  generations: Generation[];
  sourceUrl?: string; // 可选的参考 URL
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  invalidSources: string[]; // 优先级冲突或缺失的来源
}

/**
 * 世代定义数据源
 * 包含 Parents.com 和 IACET 的定义
 */
export const GENERATION_SOURCES: Source[] = [
  {
    name: 'Parents.com',
    priority: 1, // 最高优先级
    sourceUrl: 'https://www.parents.com/parenting/better-parenting/what-are-the-different-generations/',
    generations: [
      { name: 'Greatest Generation', startYear: 1901, endYear: 1927 },
      { name: 'Silent Generation', startYear: 1928, endYear: 1945 },
      { name: 'Baby Boomers', startYear: 1946, endYear: 1964 },
      { name: 'Gen X', startYear: 1965, endYear: 1980 },
      { name: 'Millennials', startYear: 1981, endYear: 1996 },
      { name: 'Gen Z', startYear: 1997, endYear: 2009 },
      { name: 'Gen Alpha', startYear: 2010, endYear: 2024 },
      { name: 'Gen Beta', startYear: 2025, endYear: 2039 },
    ],
  },
  {
    name: 'IACET',
    priority: 2,
    sourceUrl: 'https://www.iacet.org/',
    generations: [
      { name: 'Gen X', startYear: 1965, endYear: 1976 },
      { name: 'Millennials', startYear: 1977, endYear: 1995 },
      { name: 'Gen Z', startYear: 1996, endYear: null }, // 开放区间
    ],
  },
];

/**
 * 验证并过滤来源
 * 检查优先级唯一性和存在性
 */
export function validateAndFilterSources(sources: Source[]): {
  validSources: Source[];
  invalidSources: Source[];
  errors: string[];
} {
  const priorities = new Map<number, string>();
  const validSources: Source[] = [];
  const invalidSources: Source[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    // 检查优先级是否存在
    if (source.priority === undefined || source.priority === null) {
      invalidSources.push(source);
      errors.push(`来源 "${source.name}" 缺少优先级配置`);
      continue;
    }

    // 检查优先级是否冲突
    const existingSource = priorities.get(source.priority);
    if (existingSource) {
      invalidSources.push(source);
      errors.push(
        `来源 "${source.name}" 的优先级 ${source.priority} 与 "${existingSource}" 冲突`
      );
      continue;
    }

    // 验证通过
    priorities.set(source.priority, source.name);
    validSources.push(source);
  }

  return { validSources, invalidSources, errors };
}

/**
 * 世代定义数据仓库
 */
export class GenerationDataRepository {
  private sources: Source[];

  constructor(sources: Source[] = GENERATION_SOURCES) {
    const { validSources, invalidSources, errors } =
      validateAndFilterSources(sources);

    // 记录警告但不阻止初始化
    if (invalidSources.length > 0) {
      console.warn(
        '以下来源因优先级问题被排除:',
        invalidSources.map((s) => s.name)
      );
      console.warn('错误详情:', errors);
    }

    this.sources = validSources;
  }

  /**
   * 获取所有有效来源
   */
  getAllSources(): Source[] {
    return this.sources;
  }

  /**
   * 获取覆盖指定年份的来源
   */
  getSourcesForYear(year: number): Source[] {
    return this.sources.filter((source) =>
      source.generations.some((gen) => {
        if (gen.endYear !== null) {
          return year >= gen.startYear && year <= gen.endYear;
        } else {
          return year >= gen.startYear;
        }
      })
    );
  }

  /**
   * 根据名称获取来源
   */
  getSourceByName(name: string): Source | undefined {
    return this.sources.find((s) => s.name === name);
  }

  /**
   * 验证来源优先级
   */
  validateSourcePriorities(): ValidationResult {
    const { validSources, errors } = validateAndFilterSources(this.sources);
    return {
      isValid: errors.length === 0,
      errors,
      invalidSources: this.sources
        .filter((s) => !validSources.includes(s))
        .map((s) => s.name),
    };
  }

  /**
   * 获取有效来源
   */
  getValidSources(): Source[] {
    return this.sources;
  }
}

// 导出单例实例
export const generationRepository = new GenerationDataRepository();
