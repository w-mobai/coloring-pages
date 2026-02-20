/**
 * 世代分析 API 端点
 * POST /api/generation/analyze
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { generationRepository } from '@/lib/generation-definitions';
import { analyzeContext } from '@/lib/generation-analyzer';
import {
  buildAIPrompt,
  parseAIResponse,
  type AIGenerationResponse,
} from '@/lib/ai/generation-synthesizer';
import { getAllConfigs } from '@/shared/models/config';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60秒超时限制

interface AnalyzeRequest {
  birthYear: number;
  birthMonth?: number;
  locale?: string;
}

/**
 * 使用 OpenRouter 查询 AI
 * 支持多个模型，按优先级尝试
 */
async function queryAI(prompt: string): Promise<string> {
  const configs = await getAllConfigs();
  const openrouterApiKey = configs.openrouter_api_key;
  
  console.log('OpenRouter API Key status:', {
    isSet: !!openrouterApiKey,
    keyPrefix: openrouterApiKey ? openrouterApiKey.substring(0, 10) + '...' : 'NOT SET',
    keyLength: openrouterApiKey?.length || 0,
  });
  
  if (!openrouterApiKey) {
    throw new Error('OpenRouter API Key not configured. Please set it in admin settings at /admin/settings');
  }

  const openrouterBaseUrl = configs.openrouter_base_url;
  console.log('OpenRouter Base URL:', openrouterBaseUrl || 'default (https://openrouter.ai/api/v1)');

  const openrouter = createOpenRouter({
    apiKey: openrouterApiKey,
    baseURL: openrouterBaseUrl ? openrouterBaseUrl : undefined,
  });

  // 推荐的模型列表（按优先级排序）
  // 注意：根据你的 OpenRouter 配置，只有部分模型可能可用
  // 系统会自动尝试每个模型，直到成功
  const models = [
    'openai/gpt-5',                      // GPT-5 - 当前可用 ✅
    'openai/gpt-4o',                     // GPT-4o - 备用
    'anthropic/claude-3.5-sonnet',       // Claude 3.5 Sonnet - 备用
    'deepseek/deepseek-r1',              // DeepSeek R1 - 备用
    'anthropic/claude-4.5-sonnet',       // Claude 4.5 Sonnet - 备用
    'moonshotai/kimi-k2-thinking',       // Kimi K2 - 备用
  ];

  let lastError: Error | null = null;

  // 尝试每个模型，直到成功
  for (const modelName of models) {
    try {
      console.log(`[${new Date().toISOString()}] Trying model: ${modelName}`);
      
      const modelStartTime = Date.now();
      const result = await generateText({
        model: openrouter.chat(modelName),
        prompt: prompt,
      });
      const modelDuration = Date.now() - modelStartTime;

      if (result.text) {
        console.log(`[${new Date().toISOString()}] Model ${modelName} succeeded in ${modelDuration}ms`);
        console.log('Response length:', result.text.length);
        console.log('Response preview:', result.text.substring(0, 150));
        return result.text;
      }
    } catch (error: any) {
      const modelDuration = Date.now() - Date.now();
      console.error(`[${new Date().toISOString()}] Model ${modelName} failed after ${modelDuration}ms:`, {
        message: error.message,
        name: error.name,
        statusCode: error.statusCode,
        cause: error.cause?.message,
      });
      lastError = error;
      // 继续尝试下一个模型
      continue;
    }
  }

  // 所有模型都失败了
  const errorMessage = lastError?.message || 'All AI models failed';
  console.error('All models failed. Last error:', errorMessage);
  throw new Error(
    `AI 服务暂时不可用。请稍后再试。详情: ${errorMessage}`
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();

    // 验证输入
    if (!body.birthYear) {
      return NextResponse.json(
        { error: '出生年份是必填项' },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();
    if (body.birthYear < 1901 || body.birthYear > currentYear) {
      return NextResponse.json(
        { error: `请选择 1901 到 ${currentYear} 之间的年份` },
        { status: 400 }
      );
    }

    if (body.birthMonth && (body.birthMonth < 1 || body.birthMonth > 12)) {
      return NextResponse.json(
        { error: '月份必须在 1-12 之间' },
        { status: 400 }
      );
    }

    const locale = body.locale || 'zh';

    // 获取有效来源
    const sources = generationRepository.getValidSources();
    if (sources.length === 0) {
      return NextResponse.json(
        { error: '世代数据当前不可用。请稍后再试。' },
        { status: 503 }
      );
    }

    // 分析上下文
    const context = analyzeContext({
      birthYear: body.birthYear,
      birthMonth: body.birthMonth,
      sources,
    });

    // 构建 AI 提示
    const prompt = buildAIPrompt({
      birthYear: body.birthYear,
      birthMonth: body.birthMonth,
      context,
      locale,
    });

    // 调用 AI（带超时）
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Starting AI query...`);
    
    const aiResponse = await Promise.race([
      queryAI(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI timeout')), 50000)
      ),
    ]);

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] AI query completed in ${duration}ms`);

    // 性能监控
    if (duration > 10000) {
      console.warn(`AI 分析耗时 ${duration}ms，超过 10 秒目标`);
    }

    // 解析 AI 响应
    const parsedResponse = parseAIResponse(aiResponse);

    // 记录分析事件（脱敏）
    logAnalyticsEvent({
      birthYear: body.birthYear,
      birthMonth: body.birthMonth,
      result: parsedResponse,
      duration,
      locale,
    });

    return NextResponse.json(parsedResponse);
  } catch (error: any) {
    console.error('Generation analysis error:', error);
    console.error('Error stack:', error.stack);

    // 根据错误类型返回不同的错误消息
    if (error.message === 'AI timeout') {
      return NextResponse.json(
        { error: '分析时间超出预期。请重试。' },
        { status: 504 }
      );
    }

    if (error.message === 'No applicable sources') {
      return NextResponse.json(
        { error: '未找到适用的世代定义。' },
        { status: 404 }
      );
    }

    if (
      error.message.includes('Invalid AI response format') ||
      error.message.includes('AI 响应') ||
      error.message.includes('JSON')
    ) {
      return NextResponse.json(
        {
          error: 'AI 返回了无效的响应格式。请重试。',
          details: error.message,
        },
        { status: 500 }
      );
    }

    if (error.message.includes('API Key not configured')) {
      return NextResponse.json(
        {
          error: 'AI 服务未配置。请联系管理员在后台设置 OpenRouter API Key。',
        },
        { status: 503 }
      );
    }

    if (error.message.includes('All AI models failed')) {
      return NextResponse.json(
        {
          error: '所有 AI 模型都不可用。请检查 OpenRouter 配置或稍后再试。',
          details: error.message,
        },
        { status: 503 }
      );
    }

    // 通用错误
    return NextResponse.json(
      {
        error: '分析服务暂时不可用。请稍后再试。',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * 记录分析事件（脱敏）
 */
function logAnalyticsEvent(data: {
  birthYear: number;
  birthMonth?: number;
  result: AIGenerationResponse;
  duration: number;
  locale: string;
}) {
  const yearDecade = `${Math.floor(data.birthYear / 10) * 10}s`;

  console.log('Generation analysis completed:', {
    yearDecade, // 脱敏：只记录年代
    hasMonth: data.birthMonth !== undefined,
    primaryGeneration: data.result.primary_generation,
    isBoundary: data.result.is_boundary,
    confidence: data.result.confidence,
    responseTimeMs: data.duration,
    locale: data.locale,
  });
}
