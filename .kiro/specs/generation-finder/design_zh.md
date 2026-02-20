# 设计文档：世代查找器

## 概述

世代查找器是一个 Next.js 应用功能，通过分析用户的出生日期与多个权威来源的对比，帮助用户确定他们的世代分类。系统使用 AI 来综合冲突的定义并提供清晰、可信的解释。

该功能包括：
1. 简单的出生日期输入界面（年份 + 月份）
2. 具有来源级优先级的世代定义数据层
3. 综合来源并检测边界年份的 AI 分析引擎
4. 带有主要结论、解释、置信度和来源透明度的结果显示

## 架构

### 高层架构

```
┌─────────────────┐
│   用户输入      │
│  (出生日期)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  输入处理器     │
│   和验证器      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  世代分析器     │◄─────┤  数据仓库        │
│                 │      │  (来源+优先级)   │
└────────┬────────┘      └──────────────────┘
         │
         ▼
┌─────────────────┐
│  AI 综合器      │
│  (LLM)          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  结果格式化器   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  UI 显示        │
└─────────────────┘
```

### 组件职责

**输入处理器**：验证出生年份（必填）和月份（可选），防止无效提交

**数据仓库**：存储和检索来自多个来源的世代定义，每个来源配置唯一优先级

**世代分析器**：确定哪些来源适用于出生日期，识别边界年份，应用 tie-breaker 规则

**AI 综合器**：使用包含出生日期和所有适用定义的结构化提示调用 LLM，接收结构化响应

**结果格式化器**：将 AI 响应转换为支持 i18n 的显示就绪格式

**映射层**：在内部 camelCase 和 API snake_case 之间转换
- 内部实现使用 TypeScript camelCase 约定
- API 响应使用 snake_case 约定（符合需求）
- 提供 `toAPIFormat()` 和 `toAPIResponse()` 转换函数

**UI 显示**：渲染带有可展开来源透明度部分的结果


## 组件和接口

### 1. 出生日期输入组件

**位置**：`src/app/[locale]/generation-finder/page.tsx`

**接口**：
```typescript
interface BirthDateInput {
  year: number;        // 必填：1901 到当前年份
  month?: number;      // 可选：1-12
}

interface BirthDateFormProps {
  onSubmit: (input: BirthDateInput) => Promise<void>;
  isLoading: boolean;
  locale: string;
}
```

**行为**：
- 年份选择器：下拉菜单，年份从 1901 到当前年份
- 月份选择器：下拉菜单，12 个月（可选）
- 提交按钮："使用 AI 分析"（加载时禁用）
- 验证：年份必填，月份可选
- 无需身份验证或个人数据收集


### 2. 世代定义数据层

**位置**：`src/data/generation-definitions.ts`

**接口**：
```typescript
interface Generation {
  name: string;           // 例如 "Millennials"、"Gen Z"
  startYear: number;      // 闭区间起始年份
  endYear: number | null; // 闭区间结束年份，null 表示开放区间（至今）
}

interface Source {
  name: string;           // 例如 "Parents.com"、"IACET"
  priority: number;       // 唯一优先级，数字越小优先级越高
  generations: Generation[];
  sourceUrl?: string;     // 可选的参考 URL
}

interface GenerationDataRepository {
  getAllSources(): Source[];
  getSourcesForYear(year: number): Source[];
  getSourceByName(name: string): Source | undefined;
  validateSourcePriorities(): ValidationResult;
  getValidSources(): Source[]; // 返回优先级有效的来源
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  invalidSources: string[]; // 优先级冲突或缺失的来源
}
```

**数据验证和过滤策略**：
```typescript
// 启动时验证
function validateAndFilterSources(sources: Source[]): {
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
      errors.push(`来源 "${source.name}" 的优先级 ${source.priority} 与 "${existingSource}" 冲突`);
      continue;
    }
    
    // 验证通过
    priorities.set(source.priority, source.name);
    validSources.push(source);
  }
  
  return { validSources, invalidSources, errors };
}

// 分析时只使用有效来源
function analyzeGeneration(input: BirthDateInput): AnalysisResult {
  const { validSources, invalidSources, errors } = validateAndFilterSources(ALL_SOURCES);
  
  // 记录警告但不阻止分析
  if (invalidSources.length > 0) {
    console.warn('以下来源因优先级问题被排除:', invalidSources.map(s => s.name));
    console.warn('错误详情:', errors);
  }
  
  // 使用有效来源继续分析
  return performAnalysis(input, validSources);
}
```

**数据结构**：
```typescript
const GENERATION_SOURCES: Source[] = [
  {
    name: "Parents.com",
    priority: 1,  // 最高优先级
    generations: [
      { name: "Greatest Generation", startYear: 1901, endYear: 1927 },
      { name: "Silent Generation", startYear: 1928, endYear: 1945 },
      { name: "Baby Boomers", startYear: 1946, endYear: 1964 },
      { name: "Gen X", startYear: 1965, endYear: 1980 },
      { name: "Millennials", startYear: 1981, endYear: 1996 },
      { name: "Gen Z", startYear: 1997, endYear: 2009 },
      { name: "Gen Alpha", startYear: 2010, endYear: 2024 },
      { name: "Gen Beta", startYear: 2025, endYear: 2039 }
    ]
  },
  {
    name: "IACET",
    priority: 2,
    generations: [
      { name: "Gen X", startYear: 1965, endYear: 1976 },
      { name: "Millennials", startYear: 1977, endYear: 1995 },
      { name: "Gen Z", startYear: 1996, endYear: null }  // 开放区间
    ]
  }
];
```

**区间处理规则**：
- 默认使用闭区间 [start, end]，包含起始和结束年份
- 当 endYear 为 null 时，表示开放区间，包含起始年份及之后所有年份
- 同一来源内不应有重叠年份


### 3. 世代分析器

**位置**：`src/lib/generation-analyzer.ts`

**接口**：
```typescript
interface AnalysisInput {
  birthYear: number;
  birthMonth?: number;
  sources: Source[];
}

interface SourceClassification {
  sourceName: string;
  sourceUrl?: string;
  generationName: string;
  yearRange: string;      // 例如 "1965-1980" 或 "1996-至今"
  priority: number;
}

interface AnalysisContext {
  applicableSources: SourceClassification[];
  isBoundaryYear: boolean;
  primaryGeneration: string;  // 基于 tie-breaker 规则确定
  confidence: "high" | "medium" | "low";
}

interface GenerationAnalyzer {
  analyzeContext(input: AnalysisInput): AnalysisContext;
  isBoundaryYear(classifications: SourceClassification[]): boolean;
  determinePrimaryGeneration(classifications: SourceClassification[]): string;
  calculateConfidence(classifications: SourceClassification[]): "high" | "medium" | "low";
}
```

**逻辑**：

**1. 过滤适用来源**：
```typescript
function getApplicableSources(year: number, sources: Source[]): SourceClassification[] {
  const applicable: SourceClassification[] = [];
  
  for (const source of sources) {
    for (const gen of source.generations) {
      // 闭区间检查
      if (gen.endYear !== null) {
        if (year >= gen.startYear && year <= gen.endYear) {
          applicable.push({
            sourceName: source.name,
            generationName: gen.name,
            yearRange: `${gen.startYear}-${gen.endYear}`,
            priority: source.priority
          });
        }
      }
      // 开放区间检查
      else {
        if (year >= gen.startYear) {
          applicable.push({
            sourceName: source.name,
            generationName: gen.name,
            yearRange: `${gen.startYear}-至今`,
            priority: source.priority
          });
        }
      }
    }
  }
  
  return applicable;
}
```

**2. 边界年份检测**：
```typescript
function isBoundaryYear(classifications: SourceClassification[]): boolean {
  // 至少需要2个来源
  if (classifications.length < 2) return false;
  
  // 检查是否有不同的世代名称
  const uniqueGenerations = new Set(classifications.map(c => c.generationName));
  return uniqueGenerations.size > 1;
}
```

**3. Tie-breaker 规则（确定主要世代）**：
```typescript
function determinePrimaryGeneration(classifications: SourceClassification[]): string {
  if (classifications.length === 0) {
    throw new Error("No applicable sources");
  }
  
  if (classifications.length === 1) {
    return classifications[0].generationName;
  }
  
  // 按优先级排序（数字越小优先级越高）
  const sorted = [...classifications].sort((a, b) => a.priority - b.priority);
  
  // 返回优先级最高的来源的世代
  return sorted[0].generationName;
}
```

**4. 置信度计算**：
```typescript
function calculateConfidence(classifications: SourceClassification[]): "high" | "medium" | "low" {
  if (classifications.length === 0) {
    throw new Error("No applicable sources");
  }
  
  // 只有单一来源
  if (classifications.length === 1) {
    return "low";
  }
  
  // 检查所有来源是否一致
  const uniqueGenerations = new Set(classifications.map(c => c.generationName));
  
  if (uniqueGenerations.size === 1) {
    // 所有来源一致
    return "high";
  } else {
    // 来源不一致（边界年份）
    return "medium";
  }
}
```


### 4. AI 综合器

**位置**：`src/lib/ai/generation-synthesizer.ts`

**命名约定**：
- **内部代码**：使用 TypeScript camelCase 约定（`sourceName`, `generationName`, `yearRange`）
- **API 响应**：使用 snake_case 约定（`source_name`, `generation_name`, `year_range`）
- **映射层**：在 AI 响应格式化时进行转换

**接口**：
```typescript
interface AIPromptData {
  birthYear: number;
  birthMonth?: number;
  context: AnalysisContext;
  locale: string;
}

interface AIGenerationResponse {
  primary_generation: string;        // 主要世代名称（snake_case 用于 API）
  transitional_label?: string;       // 可选的过渡世代标签（如 "Zillennial"）
  is_boundary: boolean;              // 是否为边界年份
  explanation: string;               // 2-3 行解释
  significance: string;              // 世代意义描述
  sources: Array<{                   // 各来源的分类结果（snake_case 用于 API）
    source_name: string;
    generation_name: string;
    year_range: string;
  }>;
  confidence: "high" | "medium" | "low";
}

// 内部使用的 TypeScript 接口（camelCase）
interface SourceClassification {
  sourceName: string;
  sourceUrl?: string;
  generationName: string;
  yearRange: string;
  priority: number;
}

// 映射函数：内部 camelCase → API snake_case
function toAPIFormat(classification: SourceClassification) {
  return {
    source_name: classification.sourceName,
    generation_name: classification.generationName,
    year_range: classification.yearRange
  };
}

// 完整响应映射函数
function toAPIResponse(internalResult: GenerationAnalysisResult): AIGenerationResponse {
  return {
    primary_generation: internalResult.primaryGeneration,
    transitional_label: internalResult.transitionalLabel,
    is_boundary: internalResult.isBoundary,
    explanation: internalResult.explanation,
    significance: internalResult.significance,
    sources: internalResult.applicableSources.map(toAPIFormat),
    confidence: internalResult.confidence
  };
}

interface GenerationSynthesizer {
  // 内部函数：返回 camelCase
  synthesizeInternal(promptData: AIPromptData): Promise<GenerationAnalysisResult>;
  
  // API 函数：返回 snake_case
  synthesizeAPI(promptData: AIPromptData): Promise<AIGenerationResponse>;
}
```

**提示结构**：
```
你是一位世代分类专家。分析以下出生日期和世代定义，提供清晰、可信的分类。

出生日期：{year}年{month}月（如果提供）

世代定义（按优先级排序）：
{列出适用的来源，包括来源名称、优先级、世代名称、年份范围}

分析上下文：
- 边界年份：{是/否}
- 主要世代（基于优先级）：{primaryGeneration}
- 置信度：{confidence}

任务：
1. 使用提供的主要世代作为结论
2. 如果这是边界年份：
   - 识别是否属于过渡世代（例如 Zillennial、Xennial）
   - 如果提供了出生月份：
     * 上半年（1-6月）：在解释中提及可能更接近前一个世代
     * 下半年（7-12月）：在解释中提及可能更接近后一个世代
   - 但月份不应改变主要世代分类
3. 解释为什么不同来源可能给出不同结果
4. 描述该世代的共同背景特征（避免刻板印象）

以 {locale} 语言响应，使用以下 JSON 结构：
{
  "primary_generation": "string",
  "transitional_label": "string (optional)",
  "is_boundary": boolean,
  "explanation": "string (2-3行)",
  "significance": "string (1段)",
  "sources": [已提供的来源分类],
  "confidence": "high" | "medium" | "low"
}

重要规则：
- primary_generation 必须与提供的主要世代一致
- 世代名称必须保持英文
- 解释和意义描述使用 {locale} 语言
- 不要改变 sources 数组的内容
```

**集成**：
- 使用 `src/extensions/ai/` 中现有的 AI 基础设施
- 利用现有的聊天/查询功能
- 结构化 JSON 响应以实现可靠的解析
- **性能要求**：
  - 超时设置：15秒（硬性限制）
  - 目标响应时间：正常网络条件下（延迟 < 100ms）10秒内完成
  - P95 目标：5秒内返回响应
  - 如果超过10秒但未达到15秒，记录性能警告
  - 超过15秒则触发超时错误


### 5. 结果显示组件

**位置**：`src/app/[locale]/generation-finder/components/ResultDisplay.tsx`

**接口**：
```typescript
interface GenerationResult {
  primaryGeneration: string;
  transitionalLabel?: string;
  isBoundary: boolean;
  explanation: string;
  significance: string;
  sources: SourceClassification[];
  confidence: "high" | "medium" | "low";
}

interface ResultDisplayProps {
  result: GenerationResult;
  locale: string;
}
```

**布局**：
```
┌─────────────────────────────────────┐
│  主要结论                           │
│  "你的世代：Gen X"                  │
│  [可选] "过渡世代：Xennial"         │
│  置信度：Medium                     │
├─────────────────────────────────────┤
│  简要解释                           │
│  (2-3 行解释原因，                  │
│   如果是边界年份且有月份，          │
│   提及月份上下文)                   │
├─────────────────────────────────────┤
│  意义描述                           │
│  (1 段关于共同背景，                │
│   无刻板印象)                       │
├─────────────────────────────────────┤
│  ▼ 查看不同来源如何看待我           │
│  ┌───────────────────────────────┐  │
│  │ Parents.com (优先级1):        │  │
│  │   Gen X (1965-1980)           │  │
│  │                               │  │
│  │ IACET (优先级2):              │  │
│  │   Millennials (1977-1995)     │  │
│  │                               │  │
│  │ 注意：不同的研究使用不同的    │  │
│  │ 分类标准。我们优先使用更新、  │  │
│  │ 更细分的定义。                │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**置信度显示**：
- High: 绿色徽章 "高置信度 - 所有来源一致"
- Medium: 黄色徽章 "中等置信度 - 边界年份"
- Low: 灰色徽章 "低置信度 - 单一来源"


## 数据模型

### 来源模型（Source-Level）

```typescript
interface Source {
  id: string;              // 唯一标识符
  name: string;            // 来源名称（如 "Parents.com"）
  priority: number;        // 唯一优先级，数字越小优先级越高
  generations: Generation[];
  sourceUrl?: string;      // 参考 URL
  createdAt: Date;
  updatedAt: Date;
}
```

### 世代定义模型（Generation-Level）

```typescript
interface Generation {
  name: string;            // 世代标签（如 "Millennials"）
  startYear: number;       // 闭区间起始年份
  endYear: number | null;  // 闭区间结束年份，null 表示开放区间
}
```

### 分析结果模型（临时对象，不持久化）

```typescript
// 注意：此模型仅用于请求内临时对象（non-persistent DTO）
// 不应持久化到数据库，以符合隐私要求
interface GenerationAnalysisResult {
  id: string;              // 请求 ID（用于追踪，不持久化）
  birthYear: number;       // 临时存储，分析后立即清除
  birthMonth?: number;     // 临时存储，分析后立即清除
  primaryGeneration: string;
  transitionalLabel?: string;
  isBoundary: boolean;
  explanation: string;
  significance: string;
  applicableSources: SourceClassification[];
  confidence: "high" | "medium" | "low";
  locale: string;
  analyzedAt: Date;        // 分析时间戳（不持久化）
}
```

### 日志和监控模型（可持久化）

```typescript
// 用于日志和监控的脱敏模型
interface AnalyticsEvent {
  eventId: string;
  eventType: "analysis_requested" | "analysis_completed" | "analysis_failed";
  yearDecade: string;      // 脱敏：如 "1970s"、"1980s"
  hasMonth: boolean;       // 是否提供了月份（不记录具体月份）
  primaryGeneration?: string;
  isBoundary?: boolean;
  confidence?: "high" | "medium" | "low";
  responseTimeMs?: number;
  errorType?: string;
  locale: string;
  timestamp: Date;
}

// 转换函数：临时对象 → 日志对象
function toAnalyticsEvent(result: GenerationAnalysisResult): AnalyticsEvent {
  return {
    eventId: result.id,
    eventType: "analysis_completed",
    yearDecade: `${Math.floor(result.birthYear / 10) * 10}s`, // 1979 → "1970s"
    hasMonth: result.birthMonth !== undefined,
    primaryGeneration: result.primaryGeneration,
    isBoundary: result.isBoundary,
    confidence: result.confidence,
    locale: result.locale,
    timestamp: result.analyzedAt
  };
}
```

### 来源分类模型

```typescript
interface SourceClassification {
  sourceName: string;
  sourceUrl?: string;
  generationName: string;
  yearRange: string;       // 例如 "1965-1980" 或 "1996-至今"
  priority: number;
}
```

### 数据验证规则

```typescript
interface SourceValidationRules {
  // 1. 优先级唯一性
  validateUniquePriorities(sources: Source[]): boolean;
  
  // 2. 同一来源内无重叠
  validateNoOverlap(generations: Generation[]): boolean;
  
  // 3. 年份范围有效性
  validateYearRange(gen: Generation): boolean;
  
  // 4. 来源级优先级一致性
  validateSourceLevelPriority(source: Source): boolean;
}
```


## 正确性属性

*属性是在系统的所有有效执行中应该保持为真的特征或行为——本质上是关于系统应该做什么的正式陈述。属性充当人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1：来源优先级唯一性
*对于任何*数据仓库中的来源集合，所有来源的优先级数值必须唯一。
**验证：需求 2.4**

### 属性 2：优先级是来源级属性
*对于任何*来源，其所有世代定义必须共享相同的优先级（隐式满足，因为优先级在 Source 级）。
**验证：需求 2.3**

### 属性 3：出生日期输入验证
*对于任何*表单提交，如果未提供出生年份，则必须拒绝提交并显示验证错误；如果未提供出生月份，则必须接受提交。
**验证：需求 1.3、1.4**

### 属性 4：AI 响应结构完整性
*对于任何* AI 分析响应，它必须包含所有必填字段：primary_generation、is_boundary、explanation、significance、sources、confidence。
**验证：需求 3.7**

### 属性 5：边界年份检测
*对于任何*在至少两个来源中出现在不同世代的出生年份，分析器必须将其分类为边界年份。
**验证：需求 3.2、6.1**

### 属性 6：单一来源不是边界
*对于任何*只有单一来源覆盖的出生年份，分析器不应将其判定为边界年份。
**验证：需求 6.8**

### 属性 7：Tie-breaker 确定性
*对于任何*边界年份，主要世代必须根据来源优先级确定（优先级数值最小的来源）。
**验证：需求 3.5**

### 属性 8：置信度判定正确性
*对于任何*分析结果：
- 所有来源一致 → confidence = "high"
- 来源不一致但都有定义 → confidence = "medium"
- 只有单一来源 → confidence = "low"
**验证：需求 3.7**

### 属性 9：来源过滤正确性
*对于任何*出生年份，只有覆盖该年份的来源才应出现在 sources 数组中。
**验证：需求 3.7、5.5**

### 属性 10：闭区间和开放区间处理
*对于任何*世代定义：
- 如果 endYear 不为 null，则年份 y 在范围内当且仅当 startYear ≤ y ≤ endYear
- 如果 endYear 为 null，则年份 y 在范围内当且仅当 y ≥ startYear
**验证：需求 2.12、2.13**

### 属性 11：月份上下文不改变主分类
*对于任何*边界年份分析，出生月份可能影响解释文本，但不应改变 primary_generation。
**验证：需求 6.3**

### 属性 12：国际化一致性
*对于任何*支持的语言环境（英语或中文），所有 UI 元素和 AI 生成内容必须以该语言环境显示，但世代名称必须保持英文。
**验证：需求 4.7、4.8**

### 属性 13：加载状态管理
*对于任何*正在进行的分析，系统必须显示加载指示器并禁用提交按钮直到完成。
**验证：需求 9.1、9.5**

### 属性 14：性能要求
*对于任何* AI 分析请求，在正常网络条件下（延迟 < 100ms）：
- 必须在 10 秒内完成分析（硬性要求）
- 95% 的请求（P95）必须在 5 秒内返回响应
- 超过 15 秒未响应必须显示超时错误
**验证：需求 9.2、9.3、9.4**


## 错误处理

### 输入验证错误

**缺少出生年份**：
- 错误："出生年份是必填项"
- 操作：显示内联验证错误，阻止提交
- 用户恢复：选择出生年份

**无效年份范围**：
- 错误："请选择 1901 到 {当前年份} 之间的年份"
- 操作：通过 UI 约束防止无效年份选择
- 用户恢复：选择有效年份

### 数据层错误

**缺少世代定义**：
- 错误："世代数据当前不可用。请稍后再试。"
- 操作：禁用表单提交，记录错误
- 用户恢复：刷新页面或稍后再试

**优先级冲突**：
- 错误："系统配置错误：来源优先级冲突"
- 操作：记录详细错误，排除冲突来源，使用有效来源继续分析
- 日志：记录被排除的来源名称和冲突详情
- 用户影响：分析继续进行，但可能缺少某些来源的数据
- 监控：触发告警通知管理员修复配置

**优先级缺失**：
- 错误："系统配置警告：来源缺少优先级"
- 操作：记录警告，排除该来源，使用有效来源继续分析
- 日志：记录被排除的来源名称
- 用户影响：分析继续进行，但可能缺少某些来源的数据
- 监控：触发告警通知管理员修复配置

**数据完整性问题**：
- 错误："系统配置错误"
- 操作：记录详细错误（如重叠年份、无效区间），向用户显示通用消息
- 用户恢复：联系支持

### AI 分析错误

**AI 服务不可用**：
- 错误："分析服务暂时不可用。请稍后再试。"
- 操作：显示错误消息，启用重试
- 用户恢复：点击"重试"按钮

**AI 超时**（>15 秒）：
- 错误："分析时间超出预期。请重试。"
- 操作：取消请求，显示错误，启用重试
- 用户恢复：点击"重试"按钮

**格式错误的 AI 响应**：
- 错误："我们在分析您的世代时遇到问题。请重试。"
- 操作：记录脱敏后的响应元数据以进行调试（响应长度、结构校验结果、错误码、哈希），显示后备消息
- 后备：根据 tie-breaker 规则显示基本世代匹配
- 用户恢复：点击"重试"按钮

**AI 响应解析错误**：
- 错误："无法处理分析结果。请重试。"
- 操作：记录脱敏后的响应元数据（使用 `sanitizeAIResponseForLogging()`），显示错误消息
- 用户恢复：点击"重试"按钮

### 网络错误

**连接丢失**：
- 错误："连接丢失。请检查您的互联网连接。"
- 操作：显示错误消息，启用重试
- 用户恢复：检查连接，点击"重试"

**请求失败**：
- 错误："请求失败。请重试。"
- 操作：显示错误消息，启用重试
- 用户恢复：点击"重试"

### 错误日志记录

所有错误必须记录以下内容：
- 时间戳
- 错误类型和消息
- 用户输入的脱敏版本（仅记录年份范围段，如 "1970s"、"1980s"，不记录具体年份和月份）
- 语言环境
- 堆栈跟踪（对于系统错误）
- AI 响应的脱敏版本（对于 AI 相关错误）

**AI 响应日志脱敏规则**：
```typescript
interface SanitizedAIResponse {
  responseLength: number;
  hasRequiredFields: boolean;
  errorCode?: string;
  responseHash: string; // SHA-256 哈希用于调试
}

function sanitizeAIResponseForLogging(response: string): SanitizedAIResponse {
  // 方案1：完全脱敏，只记录元数据
  return {
    responseLength: response.length,
    hasRequiredFields: checkRequiredFields(response),
    errorCode: extractErrorCode(response),
    responseHash: hashResponse(response) // SHA-256 哈希用于调试
  };
  
  // 方案2（备选）：如果需要记录部分文本，先脱敏
  // let sanitized = response.replace(/\b(19|20)\d{2}\b/g, '[YEAR]');
  // sanitized = sanitized.replace(/\b([1-9]|1[0-2])月\b/g, '[MONTH]');
  // sanitized = sanitized.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, '[MONTH]');
  // return { sanitizedText: sanitized, ...metadata };
}
```

**隐私保护规则**：
- 不应记录完整的出生日期（年份+月份）
- 不应记录具体的出生年份
- 可以记录年份范围段用于统计分析（如 "1970-1979"）
- 日志中的出生日期信息必须脱敏
- AI 响应入日志前必须脱敏或只记录结构化元数据
- 对于调试需求，使用响应哈希而非原文


## 测试策略

### 双重测试方法

世代查找器将使用单元测试和基于属性的测试来确保全面覆盖：

**单元测试**：验证特定示例、边缘情况和错误条件
- 特定出生年份（例如 1979、1996、2015）
- UI 组件渲染
- 错误处理场景
- 组件之间的集成

**属性测试**：验证所有输入的通用属性
- 所有可能输入的表单验证规则
- 所有定义的数据结构完整性
- 所有有效输入的 AI 响应结构
- 所有年份的边界年份检测
- 所有语言环境的 i18n 一致性
- Tie-breaker 规则的确定性

### 基于属性的测试配置

**库**：我们将使用 `fast-check` 进行 TypeScript 基于属性的测试

**配置**：
- 每个属性测试最少 100 次迭代
- 每个测试必须引用其设计文档属性
- 标签格式：`// Feature: generation-finder, Property {number}: {property_text}`

**示例属性测试结构**：

```typescript
// Feature: generation-finder, Property 1: 来源优先级唯一性
test('所有来源的优先级必须唯一', () => {
  const sources = getAllSources();
  const priorities = sources.map(s => s.priority);
  const uniquePriorities = new Set(priorities);
  expect(priorities.length).toBe(uniquePriorities.size);
});

// Feature: generation-finder, Property 7: Tie-breaker 确定性
test('边界年份的主要世代必须基于优先级确定', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1977, max: 1980 }), // 已知边界年份
      (year) => {
        const context = analyzeContext({ birthYear: year, sources: getAllSources() });
        const highestPrioritySource = context.applicableSources
          .sort((a, b) => a.priority - b.priority)[0];
        expect(context.primaryGeneration).toBe(highestPrioritySource.generationName);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: generation-finder, Property 8: 置信度判定正确性
test('置信度必须根据来源一致性正确判定', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1901, max: new Date().getFullYear() }), // 动态当前年份
      (year) => {
        const context = analyzeContext({ birthYear: year, sources: getAllSources() });
        const uniqueGenerations = new Set(context.applicableSources.map(s => s.generationName));
        
        if (context.applicableSources.length === 1) {
          expect(context.confidence).toBe("low");
        } else if (uniqueGenerations.size === 1) {
          expect(context.confidence).toBe("high");
        } else {
          expect(context.confidence).toBe("medium");
        }
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: generation-finder, Property 1: 来源优先级唯一性（改进版）
test('任意来源子集的优先级也必须唯一', () => {
  fc.assert(
    fc.property(
      fc.array(fc.constantFrom(...getAllSources()), { minLength: 2 }),
      (sourcesSubset) => {
        const priorities = sourcesSubset.map(s => s.priority);
        const uniquePriorities = new Set(priorities);
        // 如果有重复，验证系统会正确排除
        if (priorities.length !== uniquePriorities.size) {
          const { validSources } = validateAndFilterSources(sourcesSubset);
          const validPriorities = validSources.map(s => s.priority);
          const uniqueValidPriorities = new Set(validPriorities);
          expect(validPriorities.length).toBe(uniqueValidPriorities.size);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```


### 单元测试重点领域

**组件测试**：
- 出生日期输入表单正确渲染
- 年份选择器包含 1901 到当前年份
- 月份选择器包含 12 个月
- 提交按钮存在且功能正常
- 加载状态正确显示
- 错误消息正确显示
- 置信度徽章正确显示

**数据层测试**：
- 来源优先级唯一性验证
- 同一来源内无重叠年份
- 闭区间和开放区间正确处理
- 年份范围边界测试

**分析器测试**：
- 边界年份正确检测
- Tie-breaker 规则正确应用
- 置信度正确计算
- 来源过滤正确执行

**集成测试**：
- 表单提交触发 AI 分析
- AI 响应被格式化并显示
- 来源透明度部分展开/折叠
- i18n 切换在所有组件中工作

**边缘情况测试**（基于需求文档验收样例）：

**注意**：以下测试使用内部函数 `analyzeGenerationInternal()`，返回 camelCase 格式。
API 层会通过 `toAPIResponse()` 转换为 snake_case 格式。

**样例 1：边界年份 + 上半年（1979年3月）**
```typescript
test('1979年3月应返回 Gen X 作为主要世代', async () => {
  // 内部函数返回 camelCase
  const result = await analyzeGenerationInternal({ year: 1979, month: 3 });
  expect(result.primaryGeneration).toBe("Gen X");
  expect(result.isBoundary).toBe(true);
  expect(result.confidence).toBe("medium");
  expect(result.explanation).toContain("更接近 Gen X");
  expect(result.sources).toHaveLength(2);
  
  // API 响应应该是 snake_case
  const apiResponse = toAPIResponse(result);
  expect(apiResponse.primary_generation).toBe("Gen X");
  expect(apiResponse.is_boundary).toBe(true);
});
```

**样例 2：边界年份 + 下半年（1979年10月）**
```typescript
test('1979年10月应返回 Gen X 作为主要世代', async () => {
  const result = await analyzeGenerationInternal({ year: 1979, month: 10 });
  expect(result.primaryGeneration).toBe("Gen X");
  expect(result.isBoundary).toBe(true);
  expect(result.confidence).toBe("medium");
  expect(result.explanation).toContain("更接近 Millennials");
  expect(result.sources).toHaveLength(2);
});
```

**样例 3：非边界年份（1990年6月）**
```typescript
test('1990年6月应返回 Millennials，高置信度', async () => {
  const result = await analyzeGenerationInternal({ year: 1990, month: 6 });
  expect(result.primaryGeneration).toBe("Millennials");
  expect(result.isBoundary).toBe(false);
  expect(result.confidence).toBe("high");
  expect(result.sources).toHaveLength(2);
});
```

**样例 4：单一来源覆盖 - 后端测试（2045年1月）**
```typescript
test('2045年1月应返回 Gen Z，低置信度（仅 IACET）', async () => {
  const result = await analyzeGenerationInternal({ year: 2045, month: 1 });
  expect(result.primaryGeneration).toBe("Gen Z");
  expect(result.isBoundary).toBe(false);
  expect(result.confidence).toBe("low");
  expect(result.sources).toHaveLength(1);
  expect(result.sources[0].sourceName).toBe("IACET");
});
```

**样例 5：单一来源覆盖 - E2E 测试（1905年6月）**
```typescript
test('1905年6月应返回 Greatest Generation，低置信度（仅 Parents）', async () => {
  const result = await analyzeGenerationInternal({ year: 1905, month: 6 });
  expect(result.primaryGeneration).toBe("Greatest Generation");
  expect(result.isBoundary).toBe(false);
  expect(result.confidence).toBe("low");
  expect(result.sources).toHaveLength(1);
  expect(result.sources[0].sourceName).toBe("Parents.com");
});
```

**其他边界年份测试**：
- 1977-1980（Parents=Gen X, IACET=Millennials）
- 1996（Parents=Millennials, IACET=Gen Z）
- 2010-2024（Parents=Gen Alpha, IACET=Gen Z）
- 2025-2026（Parents=Gen Beta, IACET=Gen Z）

**错误处理测试**：
- 缺少出生年份验证
- AI 服务不可用
- 网络错误
- 格式错误的 AI 响应
- 缺少世代数据
- 优先级冲突检测

**隐私和安全测试**：
```typescript
// 测试：AI 响应日志脱敏
test('AI 响应日志必须不含具体年份和月份', () => {
  const testResponses = [
    '你出生于1979年3月，属于 Gen X',
    'Born in March 1979, you are Gen X',
    '1990年代的人属于 Millennials',
    'People born in December 2010 are Gen Alpha'
  ];
  
  testResponses.forEach(response => {
    const sanitized = sanitizeAIResponseForLogging(response);
    const sanitizedStr = JSON.stringify(sanitized);
    
    // 断言：不含4位年份
    expect(sanitizedStr).not.toMatch(/\b(19|20)\d{2}\b/);
    
    // 断言：不含中文月份（修正正则，避免误判）
    expect(sanitizedStr).not.toMatch(/\b([1-9]|1[0-2])月\b/);
    
    // 断言：不含英文月份
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    months.forEach(month => {
      expect(sanitizedStr.toLowerCase()).not.toContain(month.toLowerCase());
    });
    
    // 断言：必须包含元数据字段
    expect(sanitized).toHaveProperty('responseLength');
    expect(sanitized).toHaveProperty('responseHash');
  });
});

// 测试：分析结果不持久化
test('GenerationAnalysisResult 不应写入数据库', async () => {
  const result = await analyzeGeneration({ year: 1990, month: 6 });
  
  // 模拟尝试持久化
  const attemptPersist = () => saveToDatabase(result);
  
  // 应该抛出错误或被阻止
  expect(attemptPersist).toThrow('不允许持久化包含出生日期的结果');
});

// 测试：AnalyticsEvent 只包含脱敏数据
test('AnalyticsEvent 必须只包含脱敏数据', () => {
  const result: GenerationAnalysisResult = {
    id: 'test-123',
    birthYear: 1979,
    birthMonth: 3,
    primaryGeneration: 'Gen X',
    isBoundary: true,
    explanation: 'Test',
    significance: 'Test',
    applicableSources: [],
    confidence: 'medium',
    locale: 'zh',
    analyzedAt: new Date()
  };
  
  const event = toAnalyticsEvent(result);
  
  // 断言：不含具体年份
  expect(event).not.toHaveProperty('birthYear');
  expect(event).not.toHaveProperty('birthMonth');
  
  // 断言：只有脱敏数据
  expect(event.yearDecade).toBe('1970s');
  expect(event.hasMonth).toBe(true);
  
  // 断言：转换为字符串后不含具体年份
  const eventStr = JSON.stringify(event);
  expect(eventStr).not.toMatch(/\b1979\b/);
  expect(eventStr).not.toMatch(/\b3月\b/);
});
```

**API 契约测试**：
```typescript
// 注意：这些测试验证 API 层（对外接口），使用 snake_case
// 内部实现使用 camelCase，通过映射层转换

// 测试：API 响应必须使用 snake_case
test('API 响应的 sources 字段必须使用 snake_case', async () => {
  // 调用 API 端点或 API 层函数
  const apiResult = await analyzeGenerationAPI({ year: 1979, month: 3 });
  
  // 断言：sources 数组存在
  expect(apiResult.sources).toBeDefined();
  expect(Array.isArray(apiResult.sources)).toBe(true);
  
  // 断言：每个 source 必须有 snake_case 字段
  apiResult.sources.forEach(source => {
    expect(source).toHaveProperty('source_name');
    expect(source).toHaveProperty('generation_name');
    expect(source).toHaveProperty('year_range');
    
    // 断言：不应有 camelCase 字段
    expect(source).not.toHaveProperty('sourceName');
    expect(source).not.toHaveProperty('generationName');
    expect(source).not.toHaveProperty('yearRange');
    
    // 断言：字段类型正确
    expect(typeof source.source_name).toBe('string');
    expect(typeof source.generation_name).toBe('string');
    expect(typeof source.year_range).toBe('string');
  });
});

// 测试：toAPIFormat 映射函数正确性
test('toAPIFormat 必须正确转换 camelCase 到 snake_case', () => {
  const internal: SourceClassification = {
    sourceName: 'Parents.com',
    generationName: 'Gen X',
    yearRange: '1965-1980',
    priority: 1
  };
  
  const api = toAPIFormat(internal);
  
  // 断言：转换后的字段
  expect(api.source_name).toBe('Parents.com');
  expect(api.generation_name).toBe('Gen X');
  expect(api.year_range).toBe('1965-1980');
  
  // 断言：不包含内部字段
  expect(api).not.toHaveProperty('sourceName');
  expect(api).not.toHaveProperty('priority');
});

// 测试：toAPIResponse 完整响应映射
test('toAPIResponse 必须正确转换完整响应', () => {
  const internalResult: GenerationAnalysisResult = {
    id: 'test-123',
    birthYear: 1979,
    birthMonth: 3,
    primaryGeneration: 'Gen X',
    transitionalLabel: 'Xennial',
    isBoundary: true,
    explanation: 'Test explanation',
    significance: 'Test significance',
    applicableSources: [
      { sourceName: 'Parents.com', generationName: 'Gen X', yearRange: '1965-1980', priority: 1 },
      { sourceName: 'IACET', generationName: 'Millennials', yearRange: '1977-1995', priority: 2 }
    ],
    confidence: 'medium',
    locale: 'zh',
    analyzedAt: new Date()
  };
  
  const apiResponse = toAPIResponse(internalResult);
  
  // 断言：顶层字段转换
  expect(apiResponse.primary_generation).toBe('Gen X');
  expect(apiResponse.transitional_label).toBe('Xennial');
  expect(apiResponse.is_boundary).toBe(true);
  expect(apiResponse.confidence).toBe('medium');
  
  // 断言：sources 数组转换
  expect(apiResponse.sources).toHaveLength(2);
  expect(apiResponse.sources[0].source_name).toBe('Parents.com');
  expect(apiResponse.sources[0].generation_name).toBe('Gen X');
  expect(apiResponse.sources[0].year_range).toBe('1965-1980');
  
  // 断言：不含 camelCase 字段
  expect(apiResponse).not.toHaveProperty('primaryGeneration');
  expect(apiResponse).not.toHaveProperty('isBoundary');
  expect(apiResponse.sources[0]).not.toHaveProperty('sourceName');
});

// 测试：完整的 API 响应结构
test('API 端点必须返回符合需求定义的 JSON 结构', async () => {
  // 调用实际的 API 端点
  const apiResult = await analyzeGenerationAPI({ year: 1979, month: 3 });
  
  // 断言：必填字段（snake_case）
  expect(apiResult).toHaveProperty('primary_generation');
  expect(apiResult).toHaveProperty('is_boundary');
  expect(apiResult).toHaveProperty('explanation');
  expect(apiResult).toHaveProperty('significance');
  expect(apiResult).toHaveProperty('sources');
  expect(apiResult).toHaveProperty('confidence');
  
  // 断言：可选字段
  if (apiResult.is_boundary) {
    // 边界年份可能有 transitional_label
    expect(apiResult.transitional_label === undefined || typeof apiResult.transitional_label === 'string').toBe(true);
  }
  
  // 断言：不应有 camelCase 版本
  expect(apiResult).not.toHaveProperty('primaryGeneration');
  expect(apiResult).not.toHaveProperty('isBoundary');
});
```

**性能测试**：
```typescript
// 测试：正常网络条件下 10 秒内完成
test('AI 分析必须在 10 秒内完成（正常网络）', async () => {
  const startTime = Date.now();
  const result = await analyzeGeneration({ year: 1990 });
  const duration = Date.now() - startTime;
  
  expect(duration).toBeLessThan(10000); // 10秒硬性要求
  expect(result).toBeDefined();
});

// 测试：P95 < 5 秒
test('95% 的请求必须在 5 秒内完成', async () => {
  const durations: number[] = [];
  
  // 运行 100 次请求
  for (let i = 0; i < 100; i++) {
    const startTime = Date.now();
    await analyzeGeneration({ year: 1980 + i % 20 });
    durations.push(Date.now() - startTime);
  }
  
  // 计算 P95
  durations.sort((a, b) => a - b);
  const p95Index = Math.floor(durations.length * 0.95);
  const p95 = durations[p95Index];
  
  expect(p95).toBeLessThan(5000);
});

// 测试：15 秒超时
test('超过 15 秒应触发超时错误', async () => {
  // 模拟慢速 AI 响应
  mockSlowAIResponse(20000); // 20秒
  
  await expect(analyzeGeneration({ year: 1990 }))
    .rejects
    .toThrow('分析时间超出预期');
});

// 测试：10 个并发请求
test('10 个并发请求下保持 P95 <= 5秒', async () => {
  const promises = Array.from({ length: 10 }, (_, i) =>
    measureResponseTime(() => analyzeGeneration({ year: 1980 + i }))
  );
  
  const durations = await Promise.all(promises);
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.floor(durations.length * 0.95)];
  
  expect(p95).toBeLessThanOrEqual(5000);
});
```

### 测试覆盖率目标

- 单元测试覆盖率：所有组件 >80%
- 属性测试覆盖率：实现所有 14 个正确性属性
- 集成测试覆盖率：从输入到结果显示的所有用户流程
- 错误处理覆盖率：测试所有错误场景
- 边缘情况覆盖率：测试所有验收样例
- **隐私测试覆盖率**：
  - AI 响应日志脱敏测试
  - 分析结果不持久化测试
  - AnalyticsEvent 脱敏测试
- **API 契约测试覆盖率**：
  - snake_case 字段命名测试
  - toAPIFormat 映射函数测试
  - 完整 API 响应结构测试

### 测试工具

- **测试框架**：Jest（Next.js 中已有）
- **属性测试**：fast-check
- **组件测试**：React Testing Library
- **E2E 测试**：Playwright（可选，未来使用）


## 实现说明

### 现有基础设施集成

**AI 集成**：
- 利用 `src/extensions/ai/` 中现有的 AI 基础设施
- 使用现有的聊天/查询功能进行 AI 综合
- 遵循现有的 AI 错误处理模式
- **性能要求**：
  - 硬性要求：正常网络条件下（延迟 < 100ms）10秒内完成分析
  - P95 目标：5秒内返回响应
  - 超时限制：15秒（硬性限制）
  - 10-15秒之间记录性能警告
  - 超过15秒触发超时错误

**i18n 集成**：
- 使用现有的 i18n 设置和语言环境消息
- 在 `src/config/locale/messages/{locale}/` 中添加新的翻译键
- 遵循现有的语言环境切换模式
- 世代名称保持英文，UI 和解释使用本地语言

**路由**：
- 创建新路由：`/[locale]/generation-finder`
- 遵循现有的 Next.js App Router 模式
- 使用现有的语言环境参数处理

### 性能考虑

**数据加载**：
- 世代定义是静态的，可以打包
- MVP 不需要数据库查询
- 在应用启动时验证来源优先级唯一性
- 考虑为相同输入缓存 AI 响应（未来增强）

**AI 响应时间**：
- **硬性要求**：正常网络条件下（延迟 < 100ms）10秒内完成分析
- **P95 目标**：5秒内返回响应
- **超时限制**：最多 15秒
- **性能监控**：
  - 10-15秒之间记录性能警告
  - 超过15秒触发超时错误
  - 记录所有请求的响应时间用于 P95 计算
- 10 个并发用户请求下保持 P95 <= 5秒
- 考虑流式响应以获得更好的 UX（未来增强）

**包大小**：
- 世代定义增加的大小很小（~3KB，包含优先级）
- fast-check 仅是开发依赖
- 不需要额外的运行时依赖

### 安全考虑

**输入验证**：
- 验证年份范围（1901 到当前年份）
- 验证月份范围（1-12）
- 在 AI 提示之前清理所有用户输入

**数据隐私**：
- **不持久化存储出生日期**：
  - `GenerationAnalysisResult` 仅为请求内临时对象（DTO）
  - 不应写入数据库或持久化存储
  - 分析完成后立即从内存清除
- **仅在分析期间在内存中临时保存**：
  - 请求处理期间保存在内存
  - 响应发送后立即清除
  - 不缓存包含出生日期的结果
- **分析完成后立即清除**：
  - 实现 `clearSensitiveData()` 函数
  - 在响应发送后调用
  - 确保垃圾回收
- **日志中脱敏出生日期信息**：
  - 使用 `AnalyticsEvent` 模型记录日志
  - 只记录年份范围段（如 "1970s"）
  - 不记录具体年份和月份
  - AI 响应入日志前必须脱敏
- **单独使用时出生日期不是 PII**：
  - 但仍需保护以符合最佳实践
  - 采用最小化数据收集原则
- **可选：仅使用匿名数据添加分析**：
  - 使用 `AnalyticsEvent` 模型
  - 只记录脱敏的统计数据
  - 不关联用户身份

**AI 提示注入**：
- 用户输入仅限于数值
- 没有可用于提示注入的自由文本输入
- AI 提示是结构化和受控的

### 可访问性

**键盘导航**：
- 所有表单控件必须可通过键盘访问
- Tab 顺序必须合乎逻辑
- 提交按钮必须可通过 Enter 键激活
- 可展开部分必须可通过键盘操作

**屏幕阅读器**：
- 所有表单标签必须正确关联
- 必须宣布加载状态
- 必须宣布错误消息
- 结果必须使用标题正确结构化
- 置信度徽章必须有适当的 aria-label

**视觉设计**：
- 所有文本的颜色对比度足够（WCAG AA）
- 所有交互元素的焦点指示器
- 加载指示器必须可见
- 错误消息必须在视觉上有所区别
- 置信度徽章使用颜色和文本双重编码


### 数据扩展性

**添加新来源的步骤**：

1. **在数据层添加新来源**：
```typescript
const NEW_SOURCE: Source = {
  name: "Pew Research",
  priority: 3,  // 必须唯一，不能与现有优先级冲突
  generations: [
    { name: "Gen X", startYear: 1965, endYear: 1980 },
    { name: "Millennials", startYear: 1981, endYear: 1996 },
    { name: "Gen Z", startYear: 1997, endYear: 2012 }
  ],
  sourceUrl: "https://www.pewresearch.org/..."
};

GENERATION_SOURCES.push(NEW_SOURCE);
```

2. **系统行为**：
```typescript
// 启动时自动验证
const { validSources, invalidSources, errors } = validateAndFilterSources(GENERATION_SOURCES);

if (invalidSources.length > 0) {
  // 记录警告，但不阻止应用启动
  console.warn('以下来源被排除:', invalidSources);
  console.warn('原因:', errors);
  
  // 触发监控告警
  alertAdmins('来源配置问题', errors);
}

// 使用有效来源继续运行
useValidSources(validSources);
```

3. **验证数据完整性**：
```typescript
// 自动验证会检查：
// - 优先级唯一性（冲突的来源会被排除）
// - 优先级存在性（缺失的来源会被排除）
// - 同一来源内无重叠
// - 年份范围有效性
```

4. **更新测试**：
- 添加新来源的单元测试
- 更新边界年份测试（如果新来源引入新边界）
- 验证 tie-breaker 规则仍然正确
- 测试优先级冲突场景

5. **更新文档**：
- 在需求文档中记录新来源
- 更新边界年份列表
- 更新验收样例（如果需要）

**优先级冲突处理策略**：
- **设计哲学**：排除问题来源，继续提供服务（Fail-Safe）
- **不阻止分析**：即使有优先级冲突，系统仍使用有效来源继续工作
- **监控和告警**：记录详细日志，触发告警通知管理员
- **用户体验**：用户不会看到配置错误，但可能缺少某些来源的数据
- **管理员修复**：管理员收到告警后修复配置，系统自动恢复

**优先级管理最佳实践**：
- 保持优先级连续（1, 2, 3, ...）
- 更权威/更新的来源使用更小的数字
- 在配置文件中明确记录优先级决策理由

### 未来增强

**额外来源**：
- Pew Research Center 定义
- Strauss-Howe 世代理论
- 区域/文化变体（中国世代定义）
- 学术研究来源

**增强分析**：
- 文化背景考虑
- 区域世代差异
- 塑造每个世代的历史事件
- 世代内的微世代（如 Zillennial、Xennial）

**用户功能**：
- 分享结果功能
- 与朋友/家人比较
- 世代兼容性分析
- 历史时间线可视化
- 世代特征测验

**技术改进**：
- 为相同输入缓存响应（Redis）
- 流式 AI 响应以改善 UX
- 慢速连接的渐进增强
- 使用缓存定义的离线支持
- A/B 测试不同的 AI 提示策略

**分析和监控**：
- 匿名使用统计
- AI 响应时间监控
- 错误率跟踪
- 用户满意度反馈
- 边界年份分布分析

## 实现检查清单

### 阶段 1：数据层和核心逻辑
- [ ] 创建 Source 和 Generation 接口
- [ ] 实现 GENERATION_SOURCES 数据结构
- [ ] 实现来源优先级验证
- [ ] 实现世代分析器（过滤、边界检测、tie-breaker）
- [ ] 实现置信度计算逻辑
- [ ] 编写数据层单元测试
- [ ] 编写分析器单元测试

### 阶段 2：UI 组件
- [ ] 创建出生日期输入表单
- [ ] 实现年份和月份选择器
- [ ] 实现表单验证
- [ ] 创建结果显示组件
- [ ] 实现来源透明度可展开部分
- [ ] 实现置信度徽章显示
- [ ] 实现加载状态
- [ ] 实现错误消息显示
- [ ] 编写组件单元测试

### 阶段 3：AI 集成
- [ ] 创建 AI 综合器接口
- [ ] 实现 AI 提示构建逻辑
- [ ] 集成现有 AI 基础设施
- [ ] 实现 AI 响应解析
- [ ] 实现超时处理
- [ ] 实现错误处理和重试
- [ ] 编写 AI 集成测试

### 阶段 4：国际化
- [ ] 添加英语翻译键
- [ ] 添加中文翻译键
- [ ] 实现语言环境切换
- [ ] 确保世代名称保持英文
- [ ] 编写 i18n 测试

### 阶段 5：属性测试
- [ ] 设置 fast-check
- [ ] 实现属性 1-14 的测试
- [ ] 验证所有属性测试通过
- [ ] 达到 100+ 迭代覆盖率

### 阶段 6：集成和 E2E 测试
- [ ] 实现端到端用户流程测试
- [ ] 测试所有验收样例
- [ ] 测试所有边界年份
- [ ] 测试所有错误场景
- [ ] 性能测试：10秒内完成（硬性要求）
- [ ] 性能测试：P95 < 5秒
- [ ] 性能测试：15秒超时
- [ ] 性能测试：10并发下 P95 <= 5秒
- [ ] 隐私测试：验证出生日期不持久化
- [ ] 隐私测试：验证日志脱敏（AI 响应）
- [ ] 隐私测试：验证日志脱敏（AnalyticsEvent）
- [ ] 隐私测试：断言日志不含年份和月份
- [ ] API 契约测试：验证 snake_case 字段
- [ ] API 契约测试：验证 toAPIFormat 映射
- [ ] API 契约测试：验证完整响应结构

### 阶段 7：可访问性和优化
- [ ] 键盘导航测试
- [ ] 屏幕阅读器测试
- [ ] 颜色对比度验证
- [ ] 性能优化
- [ ] 包大小优化

### 阶段 8：文档和部署
- [ ] 更新 README
- [ ] 编写用户文档
- [ ] 编写开发者文档
- [ ] 部署到测试环境
- [ ] 用户验收测试
- [ ] 部署到生产环境

## 总结

世代查找器设计遵循以下核心原则：

1. **确定性**：通过来源级优先级和 tie-breaker 规则确保一致的结果
2. **透明度**：向用户展示所有来源的分类，解释差异
3. **可扩展性**：支持添加新来源，只需配置唯一优先级
4. **可测试性**：使用属性测试和单元测试确保正确性
5. **用户体验**：清晰的置信度指示，快速响应，友好的错误处理
6. **隐私保护**：不存储个人数据，内存临时处理，日志脱敏
7. **国际化**：支持多语言，世代名称保持英文
8. **可访问性**：键盘导航，屏幕阅读器支持，足够的颜色对比度

该设计完全符合需求文档，并提供了清晰的实现路径。
