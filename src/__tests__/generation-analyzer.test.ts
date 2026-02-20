/**
 * 世代分析器单元测试
 * 
 * 注意：此文件需要 Jest 测试环境
 * 运行测试: npm test 或 pnpm test
 */

// @ts-nocheck
/* eslint-disable */

import {
  getApplicableSources,
  isBoundaryYear,
  determinePrimaryGeneration,
  calculateConfidence,
  analyzeContext,
} from '@/lib/generation-analyzer';
import { GENERATION_SOURCES } from '@/lib/generation-definitions';

describe('Generation Analyzer', () => {
  describe('getApplicableSources', () => {
    it('应该为1990年返回两个来源（Parents和IACET）', () => {
      const sources = getApplicableSources(1990, GENERATION_SOURCES);
      expect(sources).toHaveLength(2);
      expect(sources.map((s) => s.sourceName)).toContain('Parents.com');
      expect(sources.map((s) => s.sourceName)).toContain('IACET');
      expect(sources.every((s) => s.generationName === 'Millennials')).toBe(
        true
      );
    });

    it('应该为1979年返回两个来源但不同世代', () => {
      const sources = getApplicableSources(1979, GENERATION_SOURCES);
      expect(sources).toHaveLength(2);

      const parentsSource = sources.find((s) => s.sourceName === 'Parents.com');
      const iacetSource = sources.find((s) => s.sourceName === 'IACET');

      expect(parentsSource?.generationName).toBe('Gen X');
      expect(iacetSource?.generationName).toBe('Millennials');
    });

    it('应该为1905年只返回Parents来源', () => {
      const sources = getApplicableSources(1905, GENERATION_SOURCES);
      expect(sources).toHaveLength(1);
      expect(sources[0].sourceName).toBe('Parents.com');
      expect(sources[0].generationName).toBe('Greatest Generation');
    });

    it('应该为2045年只返回IACET来源（开放区间）', () => {
      const sources = getApplicableSources(2045, GENERATION_SOURCES);
      expect(sources).toHaveLength(1);
      expect(sources[0].sourceName).toBe('IACET');
      expect(sources[0].generationName).toBe('Gen Z');
      expect(sources[0].yearRange).toBe('1996-至今');
    });
  });

  describe('isBoundaryYear', () => {
    it('应该识别1979年为边界年份', () => {
      const sources = getApplicableSources(1979, GENERATION_SOURCES);
      expect(isBoundaryYear(sources)).toBe(true);
    });

    it('应该识别1990年不是边界年份', () => {
      const sources = getApplicableSources(1990, GENERATION_SOURCES);
      expect(isBoundaryYear(sources)).toBe(false);
    });

    it('应该识别单一来源不是边界年份', () => {
      const sources = getApplicableSources(1905, GENERATION_SOURCES);
      expect(isBoundaryYear(sources)).toBe(false);
    });
  });

  describe('determinePrimaryGeneration', () => {
    it('应该根据优先级选择Gen X（1979年）', () => {
      const sources = getApplicableSources(1979, GENERATION_SOURCES);
      const primary = determinePrimaryGeneration(sources);
      expect(primary).toBe('Gen X'); // Parents.com 优先级1 > IACET 优先级2
    });

    it('应该为单一来源返回该来源的世代', () => {
      const sources = getApplicableSources(1905, GENERATION_SOURCES);
      const primary = determinePrimaryGeneration(sources);
      expect(primary).toBe('Greatest Generation');
    });
  });

  describe('calculateConfidence', () => {
    it('应该为一致的来源返回high', () => {
      const sources = getApplicableSources(1990, GENERATION_SOURCES);
      const confidence = calculateConfidence(sources);
      expect(confidence).toBe('high');
    });

    it('应该为边界年份返回medium', () => {
      const sources = getApplicableSources(1979, GENERATION_SOURCES);
      const confidence = calculateConfidence(sources);
      expect(confidence).toBe('medium');
    });

    it('应该为单一来源返回low', () => {
      const sources = getApplicableSources(1905, GENERATION_SOURCES);
      const confidence = calculateConfidence(sources);
      expect(confidence).toBe('low');
    });
  });

  describe('analyzeContext', () => {
    it('应该正确分析1990年（非边界年份）', () => {
      const context = analyzeContext({
        birthYear: 1990,
        sources: GENERATION_SOURCES,
      });

      expect(context.primaryGeneration).toBe('Millennials');
      expect(context.isBoundaryYear).toBe(false);
      expect(context.confidence).toBe('high');
      expect(context.applicableSources).toHaveLength(2);
    });

    it('应该正确分析1979年（边界年份）', () => {
      const context = analyzeContext({
        birthYear: 1979,
        birthMonth: 3,
        sources: GENERATION_SOURCES,
      });

      expect(context.primaryGeneration).toBe('Gen X');
      expect(context.isBoundaryYear).toBe(true);
      expect(context.confidence).toBe('medium');
      expect(context.applicableSources).toHaveLength(2);
    });

    it('应该正确分析1905年（单一来源）', () => {
      const context = analyzeContext({
        birthYear: 1905,
        sources: GENERATION_SOURCES,
      });

      expect(context.primaryGeneration).toBe('Greatest Generation');
      expect(context.isBoundaryYear).toBe(false);
      expect(context.confidence).toBe('low');
      expect(context.applicableSources).toHaveLength(1);
    });
  });
});
