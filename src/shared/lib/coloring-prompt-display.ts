import {
  COLORING_KEYWORD_FILTER_RULES,
  type ColoringKeywordFilterRule,
} from '@/shared/lib/coloring-keyword-filters';

function normalizeText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function findMatchedRule(text: string): ColoringKeywordFilterRule | null {
  const lowerText = text.toLowerCase();

  for (const rule of COLORING_KEYWORD_FILTER_RULES) {
    if (
      rule.keywords.some((keyword) =>
        lowerText.includes(keyword.toLowerCase())
      )
    ) {
      return rule;
    }
  }

  return null;
}

export function getLocalizedColoringPromptTitle({
  prompt,
  locale,
  fallbackZh = '涂色页',
  fallbackEn = 'Coloring Page',
}: {
  prompt: string | null | undefined;
  locale?: string;
  fallbackZh?: string;
  fallbackEn?: string;
}): string {
  const normalizedPrompt = normalizeText(prompt);
  const isZh = locale?.startsWith('zh');

  if (!normalizedPrompt) {
    return isZh ? fallbackZh : fallbackEn;
  }

  const matchedRule = findMatchedRule(normalizedPrompt);
  if (matchedRule) {
    return isZh
      ? matchedRule.titleZh || matchedRule.title
      : matchedRule.title;
  }

  return normalizedPrompt;
}
