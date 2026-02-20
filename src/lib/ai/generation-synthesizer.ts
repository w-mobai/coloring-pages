/**
 * AI 综合器
 * 使用 AI 综合多个来源的世代定义，提供清晰、可信的分类
 */

import { AnalysisContext, SourceClassification } from '../generation-analyzer';

export interface AIPromptData {
  birthYear: number;
  birthMonth?: number;
  context: AnalysisContext;
  locale: string;
}

// API 响应格式（snake_case）
export interface AIGenerationResponse {
  primary_generation: string;
  transitional_label?: string;
  is_boundary: boolean;
  explanation: string;
  significance: string;
  sources: Array<{
    source_name: string;
    generation_name: string;
    year_range: string;
  }>;
  confidence: 'high' | 'medium' | 'low';
}

// 内部使用的 TypeScript 接口（camelCase）
export interface GenerationAnalysisResult {
  primaryGeneration: string;
  transitionalLabel?: string;
  isBoundary: boolean;
  explanation: string;
  significance: string;
  applicableSources: SourceClassification[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * 映射函数：内部 camelCase → API snake_case
 */
export function toAPIFormat(classification: SourceClassification) {
  return {
    source_name: classification.sourceName,
    generation_name: classification.generationName,
    year_range: classification.yearRange,
  };
}

/**
 * 完整响应映射函数
 */
export function toAPIResponse(
  internalResult: GenerationAnalysisResult
): AIGenerationResponse {
  return {
    primary_generation: internalResult.primaryGeneration,
    transitional_label: internalResult.transitionalLabel,
    is_boundary: internalResult.isBoundary,
    explanation: internalResult.explanation,
    significance: internalResult.significance,
    sources: internalResult.applicableSources.map(toAPIFormat),
    confidence: internalResult.confidence,
  };
}

/**
 * 构建 AI 提示
 */
export function buildAIPrompt(promptData: AIPromptData): string {
  const { birthYear, birthMonth, context, locale } = promptData;

  const monthText = birthMonth ? `${birthMonth}` : '';
  const birthDateText = monthText
    ? `${birthYear}, Month ${monthText}`
    : `${birthYear}`;

  // Sort sources by priority
  const sortedSources = [...context.applicableSources].sort(
    (a, b) => a.priority - b.priority
  );

  const sourcesText = sortedSources
    .map(
      (s) =>
        `- ${s.sourceName} (Priority ${s.priority}): ${s.generationName} (${s.yearRange})`
    )
    .join('\n');

  const confidenceText =
    context.confidence === 'high'
      ? 'High - All sources agree'
      : context.confidence === 'medium'
        ? 'Medium - Boundary year, sources disagree'
        : 'Low - Single source only';

  const monthGuidance = birthMonth
    ? birthMonth <= 6
      ? `\n   - Born in first half of year (Month ${birthMonth}), may lean toward earlier generation`
      : `\n   - Born in second half of year (Month ${birthMonth}), may lean toward later generation`
    : '';

  const prompt = `You are a generational classification expert. Analyze the birth date and generation definitions below to provide a clear, credible classification.

Birth Date: ${birthDateText}

Generation Definitions (sorted by priority):
${sourcesText}

Analysis Context:
- Boundary Year: ${context.isBoundaryYear ? 'Yes' : 'No'}
- Primary Generation (based on priority): ${context.primaryGeneration}
- Confidence: ${confidenceText}

Tasks:
1. Use the provided primary generation as your conclusion: ${context.primaryGeneration}
2. If this is a boundary year:
   - Identify if they belong to a transitional generation (e.g., Zillennial, Xennial)${monthGuidance}
   - However, birth month should NOT change the primary generation classification
3. Explain why this person belongs to this generation based on their birth year and the defining characteristics of the generation (DO NOT mention sources like "Parents.com" or "IACET" in the explanation)
4. Describe the common characteristics of this generation (avoid stereotypes)

Respond in ${locale === 'zh' ? 'Chinese' : 'English'} using the following JSON structure:
{
  "primary_generation": "${context.primaryGeneration}",
  "transitional_label": "string (optional, e.g., Zillennial)",
  "is_boundary": ${context.isBoundaryYear},
  "explanation": "string (2-3 sentences explaining why they belong to this generation based on birth year and generation characteristics, WITHOUT mentioning source names)",
  "significance": "string (1 paragraph describing generational significance)",
  "sources": ${JSON.stringify(context.applicableSources.map(toAPIFormat))},
  "confidence": "${context.confidence}"
}

Important Rules:
- primary_generation MUST be "${context.primaryGeneration}"
- Generation names must remain in English
- Explanation and significance should be in ${locale === 'zh' ? 'Chinese' : 'English'}
- In the explanation field, DO NOT mention source names (like "Parents.com", "IACET", etc.)
- Focus on birth year and generation characteristics in the explanation
- Do NOT modify the sources array
- Return ONLY JSON, no other text`;

  return prompt;
}

/**
 * 解析 AI 响应
 */
export function parseAIResponse(response: string): AIGenerationResponse {
  try {
    // 清理响应文本
    let cleanedResponse = response.trim();
    
    // 如果响应包含 HTML 标签，说明出错了
    if (cleanedResponse.includes('<!DOCTYPE') || cleanedResponse.includes('<html')) {
      console.error('AI returned HTML instead of JSON:', cleanedResponse.substring(0, 200));
      throw new Error('AI 返回了无效的响应格式（HTML）');
    }
    
    // 尝试提取 JSON（可能被包裹在 markdown 代码块中）
    // 移除可能的 markdown 代码块标记
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // 尝试提取 JSON 对象
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', cleanedResponse.substring(0, 200));
      throw new Error('AI 响应中未找到 JSON 数据');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // 验证必填字段
    const requiredFields = [
      'primary_generation',
      'is_boundary',
      'explanation',
      'significance',
      'sources',
      'confidence',
    ];

    const missingFields = requiredFields.filter(
      (field) => !(field in parsed)
    );

    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      console.error('Parsed response:', parsed);
      throw new Error(`AI 响应缺少必填字段: ${missingFields.join(', ')}`);
    }

    // 验证字段类型
    if (typeof parsed.primary_generation !== 'string') {
      throw new Error('primary_generation 必须是字符串');
    }

    if (typeof parsed.is_boundary !== 'boolean') {
      throw new Error('is_boundary 必须是布尔值');
    }

    if (!Array.isArray(parsed.sources)) {
      throw new Error('sources 必须是数组');
    }

    if (!['high', 'medium', 'low'].includes(parsed.confidence)) {
      throw new Error('confidence 必须是 high、medium 或 low');
    }

    return parsed as AIGenerationResponse;
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Response preview:', response.substring(0, 500));
    
    if (error instanceof SyntaxError) {
      throw new Error('AI 响应的 JSON 格式无效');
    }
    
    throw error;
  }
}

/**
 * 脱敏 AI 响应用于日志
 */
export interface SanitizedAIResponse {
  responseLength: number;
  hasRequiredFields: boolean;
  errorCode?: string;
}

export function sanitizeAIResponseForLogging(
  response: string
): SanitizedAIResponse {
  return {
    responseLength: response.length,
    hasRequiredFields: checkRequiredFields(response),
  };
}

function checkRequiredFields(response: string): boolean {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return false;

    const parsed = JSON.parse(jsonMatch[0]);
    return !!(
      parsed.primary_generation &&
      typeof parsed.is_boundary === 'boolean' &&
      parsed.explanation &&
      parsed.significance &&
      Array.isArray(parsed.sources) &&
      parsed.confidence
    );
  } catch {
    return false;
  }
}
