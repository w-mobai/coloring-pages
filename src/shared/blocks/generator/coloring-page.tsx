'use client';

import {
  type ChangeEvent,
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Baby,
  CreditCard,
  Download,
  ImageIcon,
  Loader2,
  Sparkles,
  X,
  Users,
} from 'lucide-react';
import Script from 'next/script';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';
import { AIMediaType, AITaskStatus } from '@/extensions/ai/types';
import { LazyImage } from '@/shared/blocks/common';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
} from '@/shared/components/ui/card';
import { useAppContext } from '@/shared/contexts/app';
import { cn } from '@/shared/lib/utils';

interface ColoringPageGeneratorProps {
  srOnlyTitle?: string;
  className?: string;
}

interface GeneratedImage {
  id: string;
  url: string;
  provider?: string;
  model?: string;
  prompt?: string;
}

interface BackendTask {
  id: string;
  status: string;
  provider: string;
  model: string;
  prompt: string | null;
  options: string | null;
  taskInfo: string | null;
  taskResult: string | null;
}

type ReferenceImageSource = 'remote' | 'inline';
type AgeGroup = 'toddler' | 'child';
type AspectRatio = 'auto' | 'portrait' | 'landscape' | 'square';
type ApiAspectRatio = '3:4' | '4:3' | '1:1';

const POLL_INTERVAL = 5000;
const GENERATION_TIMEOUT = 180000;
const COST_CREDITS = 2;
const IMAGE_TO_IMAGE_COST_CREDITS = 4;
const MAX_THEME_LENGTH = 30;
const MAX_REFERENCE_IMAGE_SIZE_MB = 10;
const DEFAULT_FREE_TRIALS = 3;
const FREE_TRIALS_STORAGE_KEY = 'freeColoringTrials';

const PROMPT_MISSING_PATTERNS = [
  'prompt is required',
  'prompt required',
  'missing prompt',
  'empty prompt',
];

const AGE_PROMPT_DESCRIPTIONS: Record<AgeGroup, string> = {
  toddler:
    'simple coloring page for toddlers, very thick bold black outlines, minimal details, large simple shapes, lots of white space, black and white line art only, no shading, no colors, clean lines, plain white background only, keep full subject visible with margins, no black background, no gray background, no colored background, no page border, no frame, no rectangular border, no paper edges, no photo background, no table texture, no wood texture, no watermark, suitable for 3-5 year olds',
  child:
    'coloring page for children, medium thickness black outlines, moderate details, clear defined areas, black and white line art only, no shading, no colors, clean lines, plain white background only, keep full subject visible with margins, no black background, no gray background, no colored background, no page border, no frame, no rectangular border, no paper edges, no photo background, no table texture, no wood texture, no watermark, suitable for 6-10 year olds',
};

function safeParseJSON(value: unknown): any {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeErrorMessage(error: string): string {
  return error
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, '');
}

function parseTaskResult(taskResult: string | null): any {
  if (!taskResult) {
    return null;
  }

  try {
    return JSON.parse(taskResult);
  } catch (error) {
    console.warn('Failed to parse taskResult:', error);
    return null;
  }
}

function extractImageUrls(result: any): string[] {
  if (!result) {
    return [];
  }

  const output =
    result.output ??
    result.images ??
    result.data ??
    result.resultUrls ??
    result.urls;

  if (!output && result.resultJson) {
    const parsedResultJson = safeParseJSON(result.resultJson);
    if (parsedResultJson) {
      return extractImageUrls(parsedResultJson);
    }
  }

  if (!output) {
    return [];
  }

  if (typeof output === 'string') {
    return [output];
  }

  if (Array.isArray(output)) {
    return output
      .flatMap((item) => {
        if (!item) return [];
        if (typeof item === 'string') return [item];
        if (typeof item === 'object') {
          const candidate =
            item.url ??
            item.uri ??
            item.image ??
            item.src ??
            item.imageUrl ??
            item.originalUrl;
          return typeof candidate === 'string' ? [candidate] : [];
        }
        return [];
      })
      .filter(Boolean);
  }

  if (typeof output === 'object') {
    const candidate =
      output.url ??
      output.uri ??
      output.image ??
      output.src ??
      output.imageUrl ??
      output.originalUrl;
    if (typeof candidate === 'string') {
      return [candidate];
    }
  }

  return [];
}

function buildColoringPrompt(theme: string, ageGroup: AgeGroup): string {
  return `${theme}, ${AGE_PROMPT_DESCRIPTIONS[ageGroup]}`;
}

function buildImageToImagePrompt(theme: string, ageGroup: AgeGroup): string {
  const basePrompt =
    'convert the uploaded reference image into a printable black and white coloring page, keep the main subject and composition';

  if (!theme.trim()) {
    return `${basePrompt}, ${AGE_PROMPT_DESCRIPTIONS[ageGroup]}`;
  }

  return `${basePrompt}, ${theme.trim()}, ${AGE_PROMPT_DESCRIPTIONS[ageGroup]}`;
}

function isAspectRatioError(error: any): boolean {
  if (!error) {
    return false;
  }

  const taskInfo = safeParseJSON(error.taskInfo);

  const structuredCodes = [
    error.errorCode,
    taskInfo?.errorCode,
    error.error?.code,
    error.error?.type,
    error.type,
  ]
    .filter((value) => typeof value === 'string')
    .map((value: string) => value.toLowerCase());

  if (
    structuredCodes.some(
      (value) => value.includes('aspect') || value.includes('ratio')
    )
  ) {
    return true;
  }

  const textCandidates = [
    error.message,
    error.errorMessage,
    taskInfo?.message,
    taskInfo?.errorMessage,
    typeof error === 'string' ? error : null,
  ]
    .filter((value) => typeof value === 'string')
    .map((value: string) => value.toLowerCase());

  const keywords = [
    'aspect_ratio',
    'aspect ratio',
    'invalid ratio',
    'unsupported ratio',
  ];

  return textCandidates.some((text) =>
    keywords.some((keyword) => text.includes(keyword))
  );
}

function getNextAspectRatio(
  currentRatio: string | null | undefined
): ApiAspectRatio | null {
  if (currentRatio === 'square') {
    return '1:1';
  }

  if (currentRatio === '1:1') {
    return '3:4';
  }

  if (currentRatio === 'portrait') {
    return '3:4';
  }

  return null;
}

function toApiAspectRatio(ratio: AspectRatio): ApiAspectRatio | null {
  if (ratio === 'auto') {
    return null;
  }

  if (ratio === 'landscape') {
    return '4:3';
  }

  if (ratio === 'square') {
    return '1:1';
  }

  return '3:4';
}

function getTaskAspectRatio(options: string | null): string | null {
  const parsedOptions = safeParseJSON(options);
  if (!parsedOptions || typeof parsedOptions !== 'object') {
    return null;
  }

  const ratio = parsedOptions?.aspect_ratio;
  return typeof ratio === 'string' ? ratio : null;
}

function getTaskReferenceImage(options: string | null): string | null {
  const parsedOptions = safeParseJSON(options);
  if (!parsedOptions || typeof parsedOptions !== 'object') {
    return null;
  }

  const imageInput = parsedOptions?.image_input;
  if (Array.isArray(imageInput) && typeof imageInput[0] === 'string') {
    return imageInput[0];
  }

  return null;
}

async function uploadReferenceImage(
  file: File
): Promise<{ url: string; source: ReferenceImageSource }> {
  const fileAsDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () =>
        reject(reader.error || new Error('failed to read image'));
      reader.readAsDataURL(file);
    });

  const formData = new FormData();
  formData.append('files', file);

  try {
    const response = await fetch('/api/storage/upload-image', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || result.code !== 0 || !result.data?.urls?.length) {
      throw new Error(
        result.message || `upload failed with status ${response.status}`
      );
    }

    return {
      url: result.data.urls[0] as string,
      source: 'remote',
    };
  } catch (error) {
    console.warn('Upload via storage failed, fallback to inline data URL', error);
    return {
      url: await fileAsDataUrl(),
      source: 'inline',
    };
  }
}

function buildThemePrefix(theme: string): string {
  const normalized = theme
    .slice(0, 10)
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'theme';
}

export function ColoringPageGenerator({
  srOnlyTitle,
  className,
}: ColoringPageGeneratorProps) {
  const t = useTranslations('ai.coloring.generator');

  const [theme, setTheme] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('toddler');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('portrait');
  const [showAspectRatioDropdown, setShowAspectRatioDropdown] = useState(false);
  const [showAgeGroupDropdown, setShowAgeGroupDropdown] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(
    null
  );
  const [taskStatus, setTaskStatus] = useState<AITaskStatus | null>(null);
  const [fallbackAttempts, setFallbackAttempts] = useState(0);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(
    null
  );
  const [isMounted, setIsMounted] = useState(false);
  const [freeTrialsRemaining, setFreeTrialsRemaining] =
    useState(DEFAULT_FREE_TRIALS);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(
    null
  );
  const [referenceImagePreview, setReferenceImagePreview] = useState<
    string | null
  >(null);
  const [referenceImageName, setReferenceImageName] = useState('');
  const [isReferenceUploading, setIsReferenceUploading] = useState(false);
  const [referenceImageSource, setReferenceImageSource] =
    useState<ReferenceImageSource>('remote');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fallbackAttemptsRef = useRef(0);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handledTerminalTaskIdRef = useRef<string | null>(null);
  const aspectRatioDropdownRef = useRef<HTMLDivElement>(null);
  const ageGroupDropdownRef = useRef<HTMLDivElement>(null);
  const referenceImageInputRef = useRef<HTMLInputElement>(null);

  const { user, isCheckSign, setIsShowSignModal, fetchUserCredits } =
    useAppContext();
  const resultCardWidthClass = 'mx-auto w-full md:max-w-[40%]';

  const remainingCredits = user?.credits?.remainingCredits ?? 0;
  const themeLength = theme.length;
  const hasUploadedReferenceImage = Boolean(referenceImageUrl);
  const referencePreviewSource = referenceImagePreview || referenceImageUrl;
  const requiredCredits = hasUploadedReferenceImage
    ? IMAGE_TO_IMAGE_COST_CREDITS
    : COST_CREDITS;

  useEffect(() => {
    setIsMounted(true);
    const storedTrials = localStorage.getItem(FREE_TRIALS_STORAGE_KEY);
    if (storedTrials !== null) {
      const parsed = Number.parseInt(storedTrials, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        setFreeTrialsRemaining(parsed);
      }
    }

    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (referenceImagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(referenceImagePreview);
      }
    };
  }, [referenceImagePreview]);

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        aspectRatioDropdownRef.current &&
        !aspectRatioDropdownRef.current.contains(event.target as Node)
      ) {
        setShowAspectRatioDropdown(false);
      }
      if (
        ageGroupDropdownRef.current &&
        !ageGroupDropdownRef.current.contains(event.target as Node)
      ) {
        setShowAgeGroupDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const clearReferenceImage = useCallback(() => {
    setReferenceImageUrl(null);
    setReferenceImageName('');
    setIsReferenceUploading(false);
    setReferenceImageSource('remote');
    setAspectRatio((prev) => (prev === 'auto' ? 'portrait' : prev));
    setReferenceImagePreview((prev) => {
      if (prev?.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });

    if (referenceImageInputRef.current) {
      referenceImageInputRef.current.value = '';
    }
  }, []);

  const handleOpenReferenceImagePicker = useCallback(() => {
    if (isReferenceUploading) {
      return;
    }

    referenceImageInputRef.current?.click();
  }, [isReferenceUploading]);

  const handleReferenceImageChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error(t('error_invalid_image'));
        event.target.value = '';
        return;
      }

      const maxBytes = MAX_REFERENCE_IMAGE_SIZE_MB * 1024 * 1024;
      if (file.size > maxBytes) {
        toast.error(
          t('error_image_too_large', { size: MAX_REFERENCE_IMAGE_SIZE_MB })
        );
        event.target.value = '';
        return;
      }

      const localPreview = URL.createObjectURL(file);
      setReferenceImagePreview((prev) => {
        if (prev?.startsWith('blob:')) {
          URL.revokeObjectURL(prev);
        }
        return localPreview;
      });
      setReferenceImageName(file.name);
      setReferenceImageUrl(null);
      setIsReferenceUploading(true);
      setReferenceImageSource('remote');

      try {
        const uploadResult = await uploadReferenceImage(file);
        setReferenceImageUrl(uploadResult.url);
        setReferenceImageSource(uploadResult.source);
        if (uploadResult.source === 'remote') {
          toast.success(t('success_image_uploaded'));
          setAspectRatio('auto');
        } else {
          toast.warning(t('warning_image_uploaded_inline_only'));
        }
      } catch (error) {
        console.error('Failed to upload reference image:', error);
        clearReferenceImage();
        toast.error(t('error_image_upload_failed'));
      } finally {
        setIsReferenceUploading(false);
        event.target.value = '';
      }
    },
    [clearReferenceImage, t]
  );

  const resetTaskState = useCallback((resetFallback = true) => {
    setIsGenerating(false);
    setProgress(0);
    setTaskId(null);
    setGenerationStartTime(null);
    setTaskStatus(null);

    if (resetFallback) {
      fallbackAttemptsRef.current = 0;
      setFallbackAttempts(0);
    }
  }, []);

  const mapErrorMessage = useCallback(
    (error: string) => {
      if (!error) {
        return t('error_generation_failed');
      }

      const normalized = normalizeErrorMessage(error);
      if (PROMPT_MISSING_PATTERNS.includes(normalized)) {
        return t('error_empty_theme');
      }

      return t('error_generation_failed');
    },
    [t]
  );

  const isNetworkError = useCallback((errorMessage: string) => {
    const normalized = errorMessage.toLowerCase();
    return normalized.includes('fetch') || normalized.includes('network');
  }, []);

  const taskStatusLabel = useMemo(() => {
    if (!taskStatus) {
      return '';
    }

    switch (taskStatus) {
      case AITaskStatus.PENDING:
        return t('status_pending');
      case AITaskStatus.PROCESSING:
        return t('status_processing');
      case AITaskStatus.SUCCESS:
        return t('status_success');
      case AITaskStatus.FAILED:
        return t('status_failed');
      default:
        return '';
    }
  }, [taskStatus, t]);

  const estimatedSeconds = useMemo(() => {
    if (!isGenerating) {
      return 20;
    }

    if (!generationStartTime || progress <= 0) {
      return 20;
    }

    const elapsedSeconds = Math.max(
      1,
      Math.floor((Date.now() - generationStartTime) / 1000)
    );
    const normalizedProgress = Math.min(Math.max(progress, 5), 95);
    const estimatedTotalSeconds = Math.max(
      12,
      Math.min(60, Math.round((elapsedSeconds * 100) / normalizedProgress))
    );
    const remainingSeconds = Math.max(1, estimatedTotalSeconds - elapsedSeconds);

    return remainingSeconds;
  }, [generationStartTime, isGenerating, progress]);

  const startGenerateTask = useCallback(
    async (
      prompt: string,
      requestAspectRatio: ApiAspectRatio | null,
      referenceImageInput: string | null,
      resetFallbackAttempts = false
    ) => {
      if (resetFallbackAttempts) {
        fallbackAttemptsRef.current = 0;
        setFallbackAttempts(0);
      }
      handledTerminalTaskIdRef.current = null;

      setIsGenerating(true);
      setProgress(15);
      setTaskStatus(AITaskStatus.PENDING);
      setGeneratedImage(null);
      setGenerationStartTime(Date.now());

      const resp = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaType: AIMediaType.IMAGE,
          scene: referenceImageInput ? 'image-to-image' : 'text-to-image',
          provider: 'kie',
          model: 'nano-banana-pro',
          prompt,
          options: {
            resolution: '1K',
            ...(requestAspectRatio ? { aspect_ratio: requestAspectRatio } : {}),
            ...(referenceImageInput
              ? { image_input: [referenceImageInput] }
              : {}),
          },
        }),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }

      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message || t('error_generation_failed'));
      }

      const newTaskId = data?.id;
      if (!newTaskId) {
        throw new Error(t('error_missing_task_id'));
      }

      setTaskId(newTaskId);
      setProgress(25);
      if (user) {
        await fetchUserCredits();
      }
    },
    [fetchUserCredits, t, user]
  );

  const generateWithFallback = useCallback(
    async (
      prompt: string,
      initialRatio: ApiAspectRatio | null,
      referenceImageInput: string | null,
      resetFallbackAttempts = false
    ) => {
      let currentRatio: ApiAspectRatio | null = initialRatio;
      let shouldResetFallback = resetFallbackAttempts;

      while (true) {
        try {
          await startGenerateTask(
            prompt,
            currentRatio,
            referenceImageInput,
            shouldResetFallback
          );
          return;
        } catch (error: any) {
          const errorMessage = error?.message || String(error || '');
          const nextRatio = isAspectRatioError({
            ...error,
            message: errorMessage,
          })
            ? getNextAspectRatio(currentRatio)
            : null;

          if (nextRatio && fallbackAttemptsRef.current < 2) {
            fallbackAttemptsRef.current += 1;
            setFallbackAttempts(fallbackAttemptsRef.current);

            if (nextRatio === '3:4') {
              toast.info(t('error_aspect_ratio_fallback'));
            }

            currentRatio = nextRatio;
            shouldResetFallback = false;
            continue;
          }

          throw error;
        }
      }
    },
    [startGenerateTask, t]
  );

  const pollTaskStatus = useCallback(
    async (id: string) => {
      try {
        if (
          generationStartTime &&
          Date.now() - generationStartTime > GENERATION_TIMEOUT
        ) {
          resetTaskState();
          toast.error(t('error_timeout'));
          return true;
        }

        const resp = await fetch('/api/ai/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taskId: id }),
        });

        if (!resp.ok) {
          throw new Error(`request failed with status: ${resp.status}`);
        }

        const { code, message, data } = await resp.json();
        if (code !== 0) {
          throw new Error(message || 'Query task failed');
        }

        const task = data as BackendTask;
        const currentStatus = task.status as AITaskStatus;
        setTaskStatus(currentStatus);

        if (
          [AITaskStatus.SUCCESS, AITaskStatus.FAILED, AITaskStatus.CANCELED].includes(
            currentStatus
          ) &&
          handledTerminalTaskIdRef.current === task.id
        ) {
          return true;
        }

        const parsedTaskInfo = parseTaskResult(task.taskInfo);
        const parsedTaskResult = parseTaskResult(task.taskResult);
        const imageUrls = [
          ...extractImageUrls(parsedTaskInfo),
          ...extractImageUrls(parsedTaskResult),
        ];

        if (currentStatus === AITaskStatus.PENDING) {
          setProgress((prev) => Math.max(prev, 25));
          return false;
        }

        if (currentStatus === AITaskStatus.PROCESSING) {
          if (imageUrls.length > 0) {
            setGeneratedImage({
              id: task.id,
              url: imageUrls[0],
              provider: task.provider,
              model: task.model,
              prompt: task.prompt ?? undefined,
            });
            setProgress((prev) => Math.max(prev, 85));
          } else {
            setProgress((prev) => Math.min(prev + 10, 80));
          }

          return false;
        }

        if (currentStatus === AITaskStatus.SUCCESS) {
          handledTerminalTaskIdRef.current = task.id;
          if (imageUrls.length === 0) {
            toast.error(t('error_no_images'));
          } else {
            setGeneratedImage({
              id: task.id,
              url: imageUrls[0],
              provider: task.provider,
              model: task.model,
              prompt: task.prompt ?? undefined,
            });
            toast.success(t('success_generated'));
            if (!user) {
              setFreeTrialsRemaining((prev) => {
                const next = Math.max(prev - 1, 0);
                localStorage.setItem(FREE_TRIALS_STORAGE_KEY, String(next));
                return next;
              });
            }
          }

          setProgress(100);

          if (successTimeoutRef.current) {
            clearTimeout(successTimeoutRef.current);
          }

          successTimeoutRef.current = setTimeout(() => {
            resetTaskState();
            successTimeoutRef.current = null;
          }, 1000);

          return true;
        }

        if (currentStatus === AITaskStatus.FAILED) {
          handledTerminalTaskIdRef.current = task.id;
          const taskAspectRatio = getTaskAspectRatio(task.options);
          const taskInfo = safeParseJSON(task.taskInfo);
          const isRatioError = isAspectRatioError(
            taskInfo || { message: task.taskInfo }
          );

          if (isRatioError) {
            const nextRatio = getNextAspectRatio(taskAspectRatio);
            if (nextRatio && fallbackAttemptsRef.current < 2) {
              fallbackAttemptsRef.current += 1;
              setFallbackAttempts(fallbackAttemptsRef.current);

              if (nextRatio === '3:4') {
                toast.info(t('error_aspect_ratio_fallback'));
              }

              const promptForFallback =
                task.prompt || buildColoringPrompt(theme.trim(), ageGroup);
              const referenceImageForFallback =
                getTaskReferenceImage(task.options) || referenceImageUrl;

              resetTaskState(false);
              try {
                await generateWithFallback(
                  promptForFallback,
                  nextRatio,
                  referenceImageForFallback,
                  false
                );
              } catch (error: any) {
                const fallbackErrorMessage =
                  error?.message || String(error || '');
                if (isNetworkError(fallbackErrorMessage)) {
                  toast.error(t('error_network'));
                } else {
                  toast.error(mapErrorMessage(fallbackErrorMessage));
                }
                resetTaskState();
                if (user) {
                  fetchUserCredits();
                }
              }
              return true;
            }
          }

          const errorMessage =
            parsedTaskInfo?.errorMessage ||
            parsedTaskResult?.errorMessage ||
            t('error_generation_failed');
          toast.error(mapErrorMessage(String(errorMessage)));
          resetTaskState();
          if (user) {
            fetchUserCredits();
          }
          return true;
        }

        setProgress((prev) => Math.min(prev + 5, 95));
        return false;
      } catch (error: any) {
        console.error('Error polling coloring task:', error);
        toast.error(t('error_network'));
        resetTaskState();
        if (user) {
          fetchUserCredits();
        }
        return true;
      }
    },
    [
      ageGroup,
      fetchUserCredits,
      generateWithFallback,
      generationStartTime,
      isNetworkError,
      mapErrorMessage,
      resetTaskState,
      t,
      theme,
      referenceImageUrl,
      user,
    ]
  );

  useEffect(() => {
    if (!taskId || !isGenerating) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (!taskId) {
        return;
      }
      const completed = await pollTaskStatus(taskId);
      if (completed) {
        cancelled = true;
      }
    };

    tick();

    const interval = setInterval(async () => {
      if (cancelled || !taskId) {
        clearInterval(interval);
        return;
      }

      const completed = await pollTaskStatus(taskId);
      if (completed) {
        clearInterval(interval);
      }
    }, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskId, isGenerating, pollTaskStatus]);

  const handleGenerate = async () => {
    if (!user && hasUploadedReferenceImage) {
      toast.error(t('error_sign_in_for_image_to_image'));
      setIsShowSignModal(true);
      return;
    }

    if (hasUploadedReferenceImage && referenceImageSource === 'inline') {
      toast.error(t('error_reference_image_needs_public_url'));
      return;
    }

    if (!user) {
      if (freeTrialsRemaining <= 0) {
        toast.error(t('free_trials_exhausted'));
        setIsShowSignModal(true);
        return;
      }
    } else if (remainingCredits < requiredCredits) {
      toast.error(t('error_insufficient_credits'));
      return;
    }

    const trimmedTheme = theme.trim();
    if (!trimmedTheme && !hasUploadedReferenceImage) {
      toast.error(t('error_empty_theme'));
      return;
    }

    const prompt = hasUploadedReferenceImage
      ? buildImageToImagePrompt(trimmedTheme, ageGroup)
      : buildColoringPrompt(trimmedTheme, ageGroup);
    const requestAspectRatio =
      hasUploadedReferenceImage && aspectRatio === 'auto'
        ? null
        : toApiAspectRatio(aspectRatio);

    try {
      await generateWithFallback(
        prompt,
        requestAspectRatio,
        referenceImageUrl,
        true
      );
    } catch (error: any) {
      console.error('Failed to generate coloring page:', error);
      const errorMessage = error?.message || '';
      if (isNetworkError(errorMessage)) {
        toast.error(t('error_network'));
      } else {
        toast.error(mapErrorMessage(errorMessage));
      }
      resetTaskState();
    }
  };

  const handleDownloadImage = async (image: GeneratedImage) => {
    if (!image.url) {
      return;
    }

    try {
      setIsDownloading(true);
      const themePrefix = buildThemePrefix(theme.trim() || image.prompt || '');
      const filename = `coloring-page-${themePrefix}-${Date.now()}.jpg`;
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      const triggerDownload = (href: string) => {
        const link = document.createElement('a');
        link.href = href;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      const fetchBlobFromProxy = async (withTaskId: boolean) => {
        const proxyUrl = withTaskId
          ? `/api/proxy/file?url=${encodeURIComponent(image.url)}&taskId=${encodeURIComponent(image.id)}`
          : `/api/proxy/file?url=${encodeURIComponent(image.url)}`;

        const resp = await fetch(proxyUrl);
        if (resp.ok) {
          return resp.blob();
        }

        // /api/proxy/file has per-task interval limit when taskId is present.
        if (withTaskId && resp.status === 429) {
          await sleep(900);
          const retryResp = await fetch(proxyUrl);
          if (retryResp.ok) {
            return retryResp.blob();
          }
        }

        return null;
      };

      let blob: Blob | null = null;

      if (user) {
        blob = await fetchBlobFromProxy(true);
      }

      if (!blob) {
        blob = await fetchBlobFromProxy(false);
      }

      if (!blob) {
        const directResp = await fetch(image.url);
        if (directResp.ok) {
          blob = await directResp.blob();
        }
      }

      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        triggerDownload(blobUrl);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        toast.success(t('success_downloaded'));
        return;
      }

      // Final fallback: open source URL directly.
      triggerDownload(image.url);
      toast.success(t('success_downloaded'));
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error(t('error_download_failed'));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClear = () => {
    setTheme('');
    setGeneratedImage(null);
    clearReferenceImage();
  };

  const handleRandom = () => {
    const examples = [
      t('examples.dinosaur'),
      t('examples.cat_garden'),
      t('examples.fire_truck'),
      t('examples.princess_castle'),
      t('examples.space_rocket'),
      t('examples.butterfly_flowers'),
      t('examples.unicorn'),
      t('examples.ocean_fish'),
      t('examples.teddy_bear'),
      t('examples.robot'),
      t('examples.tree_house'),
      t('examples.ice_cream'),
      t('examples.superhero'),
      t('examples.mermaid'),
      t('examples.dragon'),
      t('examples.farm_animals'),
      t('examples.pirate_ship'),
      t('examples.fairy'),
      t('examples.train'),
      t('examples.elephant'),
    ];

    setTheme(examples[Math.floor(Math.random() * examples.length)]);
  };

  return (
    <section className={cn('', className)}>
      <Script
        src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.8.11/dist/dotlottie-wc.js"
        type="module"
        strategy="afterInteractive"
      />
      <div className="container">
        <div className="mx-auto max-w-5xl space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-medium">{t('title')}</h2>
            {srOnlyTitle && <span className="sr-only">{srOnlyTitle}</span>}

            {/* Add Image Button - Top Right outside card */}
            <div className="relative">
              <Button
                variant="outline"
                onClick={handleOpenReferenceImagePicker}
                disabled={isReferenceUploading || isGenerating}
                title={
                  isReferenceUploading
                    ? t('form.uploading_image')
                    : t('form.add_image')
                }
                className="h-10 w-10 p-0"
              >
                {isReferenceUploading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <ImageIcon className="size-6" />
                )}
                <span className="sr-only">{t('form.add_image')}</span>
              </Button>
              <input
                ref={referenceImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleReferenceImageChange}
                className="hidden"
              />
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-1 py-0 text-[9px] text-white">
                {hasUploadedReferenceImage
                  ? t('form.image_ready')
                  : t('form.add_image')}
              </span>
            </div>
          </div>

          {/* Main Input Card */}
          <Card
            className="backdrop-blur-md border shadow-none"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
          >
            <CardContent className="p-0" style={{ backgroundColor: 'transparent' }}>
              {/* Textarea Container */}
              <div className="relative" style={{ backgroundColor: 'transparent' }}>
                {/* Label */}
                <div className="px-6 pt-2 pb-2">
                  <label
                    htmlFor="coloring-theme"
                    className="text-sm text-muted-foreground text-left block"
                  >
                    Description prompt
                  </label>
                </div>

                <div
                  className={cn(
                    'grid gap-4 px-6 pb-4',
                    referencePreviewSource && 'md:grid-cols-[minmax(0,1fr)_180px]'
                  )}
                >
                  {/* Main Textarea */}
                  <div className="relative">
                    <textarea
                      id="coloring-theme"
                      value={theme}
                      onChange={(event) => setTheme(event.target.value)}
                      placeholder={t('form.theme_placeholder')}
                      maxLength={MAX_THEME_LENGTH}
                      className="min-h-[120px] w-full resize-none border-0 bg-transparent p-0 text-xl placeholder:text-muted-foreground/40 placeholder:font-normal focus-visible:outline-none"
                      style={{ backgroundColor: 'transparent' }}
                      data-testid="theme-input"
                    />
                  </div>

                  {referencePreviewSource && (
                    <div className="relative overflow-hidden rounded-xl border border-white/20 bg-black/10">
                      <LazyImage
                        src={referencePreviewSource}
                        alt={referenceImageName || t('form.add_image')}
                        className="h-[180px] w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearReferenceImage}
                        className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
                        aria-label={t('form.remove_image')}
                        title={t('form.remove_image')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {isReferenceUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                      {referenceImageName && (
                        <div className="absolute right-0 bottom-0 left-0 truncate bg-black/65 px-2 py-1 text-xs text-white">
                          {referenceImageName}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-4 pb-2 sm:hidden">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-muted-foreground h-7 px-1 text-xs font-normal transition-colors hover:text-foreground"
                    >
                      {t('form.clear')}
                    </button>
                    <button
                      type="button"
                      onClick={handleRandom}
                      className="bg-primary/20 text-primary h-7 rounded-full px-3 text-xs font-normal transition-colors hover:bg-primary/30"
                    >
                      {t('form.random')}
                    </button>
                  </div>
                </div>

                {/* Bottom Controls Bar */}
                <div className="relative px-4" style={{ backgroundColor: 'transparent' }}>
                  <div className="flex items-center justify-between gap-4">
                    {/* Left Side - Options */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">

                      {/* Aspect Ratio Dropdown */}
                      <div className="relative" ref={aspectRatioDropdownRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAspectRatioDropdown(!showAspectRatioDropdown);
                            setShowAgeGroupDropdown(false);
                          }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-all hover:scale-105",
                            showAspectRatioDropdown 
                              ? "bg-muted text-foreground" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          {aspectRatio === 'auto' ? (
                            <span className="text-xs font-medium">
                              {t('aspect_ratio.auto_short')}
                            </span>
                          ) : (
                            <>
                              <span className="inline-flex items-center justify-center h-4 w-4">
                                <span
                                  className={cn(
                                    'inline-block rounded-[1px] border border-current',
                                    aspectRatio === 'portrait' && 'h-3 w-2',
                                    aspectRatio === 'landscape' && 'h-2 w-3',
                                    aspectRatio === 'square' && 'h-2.5 w-2.5'
                                  )}
                                />
                              </span>
                              {aspectRatio === 'portrait' && '3:4'}
                              {aspectRatio === 'landscape' && '4:3'}
                              {aspectRatio === 'square' && '1:1'}
                            </>
                          )}
                        </button>
                        
                        {/* Dropdown Menu */}
                        {showAspectRatioDropdown && (
                          <div
                            className="bg-popover absolute top-full left-0 z-50 mt-2 rounded-md border shadow-lg"
                            style={{ width: '168px' }}
                          >
                            <div className="grid grid-cols-2 gap-2 p-2">
                              {[
                                ...(hasUploadedReferenceImage
                                  ? [
                                      {
                                        value: 'auto' as AspectRatio,
                                        label: t('aspect_ratio.auto_short'),
                                        icon: 'auto' as const,
                                      },
                                    ]
                                  : []),
                                {
                                  value: 'portrait' as AspectRatio,
                                  label: '3:4',
                                  icon: 'h-5 w-3' as const,
                                },
                                {
                                  value: 'landscape' as AspectRatio,
                                  label: '4:3',
                                  icon: 'h-3 w-5' as const,
                                },
                                {
                                  value: 'square' as AspectRatio,
                                  label: '1:1',
                                  icon: 'h-4 w-4' as const,
                                },
                              ].map((ratio) => (
                                <button
                                  key={ratio.value}
                                  type="button"
                                  onClick={() => {
                                    setAspectRatio(ratio.value);
                                    setShowAspectRatioDropdown(false);
                                  }}
                                  className={cn(
                                    'flex flex-col items-center justify-center gap-2 rounded p-2 transition-colors aspect-square',
                                    aspectRatio === ratio.value ? 'bg-accent text-white [&_span]:border-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                  )}
                                >
                                  {ratio.icon === 'auto' ? (
                                    <span className="text-xs font-semibold">
                                      {t('aspect_ratio.auto_short')}
                                    </span>
                                  ) : (
                                    <span
                                      className={cn(
                                        'inline-block rounded-[1px] border-2 border-current',
                                        ratio.icon
                                      )}
                                    />
                                  )}
                                  <span className="text-xs font-medium">{ratio.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Age Group Dropdown */}
                      <div className="relative" ref={ageGroupDropdownRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAgeGroupDropdown(!showAgeGroupDropdown);
                            setShowAspectRatioDropdown(false);
                          }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-all hover:scale-105",
                            showAgeGroupDropdown 
                              ? "bg-muted text-foreground" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          {ageGroup === 'toddler' ? <Baby className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                          {ageGroup === 'toddler' ? t('age.toddler_short') : t('age.child_short')}
                        </button>
                        
                        {/* Dropdown Menu */}
                        {showAgeGroupDropdown && (
                          <div className="bg-popover absolute top-full left-0 z-50 mt-2 w-40 rounded-md border shadow-lg">
                            <div className="p-2">
                              {[
                                { value: 'toddler', label: t('age.toddler_short'), icon: Baby },
                                { value: 'child', label: t('age.child_short'), icon: Users },
                              ].map((age) => (
                                <button
                                  key={age.value}
                                  type="button"
                                  onClick={() => {
                                    setAgeGroup(age.value as AgeGroup);
                                    setShowAgeGroupDropdown(false);
                                  }}
                                  className={cn(
                                    'w-full rounded px-3 py-2 text-left transition-colors mb-1 last:mb-0',
                                    ageGroup === age.value ? 'bg-accent text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <age.icon className="h-4 w-4 flex-shrink-0" />
                                    <div className="text-sm font-medium">{age.label}</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Character Count - Right Side */}
                    <div className="text-gray-400 text-xs flex-shrink-0">
                      {themeLength} / {MAX_THEME_LENGTH}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons - Outside Card at Bottom Right */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Credits/Trials Info - Left Side */}
            {user ? (
              remainingCredits > 0 ? (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {t('credits_remaining', { credits: remainingCredits })}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Link href="/#pricing">
                    <Button variant="outline" size="sm">
                      <CreditCard className="mr-2 h-4 w-4" />
                      {t('buy_credits')}
                    </Button>
                  </Link>
                </div>
              )
            ) : (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  {t('tries_remaining', { count: freeTrialsRemaining })}
                </span>
              </div>
            )}

            {/* Action Buttons - Right Side */}
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="hidden items-center justify-end gap-2 sm:flex">
                {/* Clear Button */}
                <Button
                  variant="ghost"
                  size="default"
                  onClick={handleClear}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted transition-all hover:scale-105 font-normal"
                >
                  {t('form.clear')}
                </Button>

                {/* Random Button */}
                <Button
                  variant="ghost"
                  size="default"
                  onClick={handleRandom}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted transition-all hover:scale-105 font-normal"
                >
                  {t('form.random')}
                </Button>
              </div>

              {/* Generate Button */}
              {!isMounted ? (
                <Button
                  disabled
                  size="lg"
                  className="generate-glow w-full sm:w-auto"
                >
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('loading')}
                </Button>
              ) : isCheckSign ? (
                <Button
                  disabled
                  size="lg"
                  className="generate-glow w-full sm:w-auto"
                >
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('checking_account')}
                </Button>
              ) : user ? (
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={
                    isGenerating ||
                    isReferenceUploading ||
                    (!theme.trim() && !hasUploadedReferenceImage)
                  }
                  className="generate-glow w-full sm:w-auto disabled:opacity-100 [&:disabled]:!cursor-not-allowed [&:disabled]:pointer-events-auto"
                  data-testid="generate-button"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="sr-only">{t('generating')}</span>
                    </>
                  ) : (
                    <span
                      className={cn(
                        !theme.trim() && !hasUploadedReferenceImage && 'opacity-60',
                        'flex items-center'
                      )}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t('generate')}
                    </span>
                  )}
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={
                    freeTrialsRemaining > 0
                      ? handleGenerate
                      : () => setIsShowSignModal(true)
                  }
                  disabled={
                    isGenerating ||
                    isReferenceUploading ||
                    (freeTrialsRemaining > 0 &&
                      !theme.trim() &&
                      !hasUploadedReferenceImage)
                  }
                  className="generate-glow w-full sm:w-auto disabled:opacity-100 [&:disabled]:!cursor-not-allowed [&:disabled]:pointer-events-auto"
                  data-testid="generate-button"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="sr-only">{t('generating')}</span>
                    </>
                  ) : (
                    <span
                      className={cn(
                        freeTrialsRemaining > 0 &&
                          !theme.trim() &&
                          !hasUploadedReferenceImage &&
                          'opacity-60',
                        'flex items-center'
                      )}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t('generate')}
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Credits/Trials Info */}

          {/* Generating Overlay Card */}
          {isGenerating && (
            <Card className={cn(resultCardWidthClass, 'overflow-hidden border-transparent bg-card/95 py-0 shadow-none backdrop-blur-sm')}>
              <CardContent className="relative aspect-square p-0">
                <div className="from-primary/5 to-primary/5 absolute inset-0 rounded-xl bg-gradient-to-b via-transparent" />
                <div className="relative flex h-full flex-col items-center justify-center gap-6 text-center">
                  <Loader2 className="text-primary h-10 w-10 animate-spin" />
                  <p className="text-muted-foreground text-sm">
                    {t('estimated_time', { seconds: estimatedSeconds })}
                  </p>
                </div>
                {taskStatusLabel && (
                  <p className="text-muted-foreground/80 absolute right-5 bottom-4 left-5 text-center text-xs">
                    {taskStatusLabel}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Generated Result */}
          {generatedImage && (
            <Card className={cn(resultCardWidthClass, 'gap-2')}>
              <div className="text-muted-foreground flex items-center justify-center px-6 text-center text-sm font-normal">
                {t('result_title')}
              </div>
              <CardContent className="space-y-4">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="mx-auto block w-fit max-w-full cursor-zoom-in"
                  aria-label="Preview generated image"
                >
                  <img
                    src={generatedImage.url}
                    alt={generatedImage.prompt || theme || 'Coloring page'}
                    className="block h-auto max-w-full rounded-lg border"
                    data-testid="generated-image"
                    loading="lazy"
                  />
                </button>

                {isDownloading ? (
                  <div
                    className="mx-auto flex h-9 w-1/2 items-center justify-center overflow-hidden"
                    data-testid="download-animation"
                  >
                    <div className="h-6 w-16 overflow-hidden leading-none">
                      {createElement('dotlottie-wc', {
                        src: 'https://lottie.host/e4210039-94a2-4ff7-9401-2d7fa9b51468/gNQwldGPzW.lottie',
                        style: {
                          width: '100%',
                          height: '100%',
                          maxHeight: '100%',
                          display: 'block',
                          // Recolor lottie content itself (not container bg)
                          filter:
                            'invert(62%) sepia(58%) saturate(1850%) hue-rotate(304deg) brightness(99%) contrast(98%)',
                        },
                        autoplay: true,
                        loop: true,
                      })}
                    </div>
                  </div>
                ) : (
                  <Button
                    className="text-foreground border-border mx-auto w-1/2 bg-transparent hover:bg-transparent hover:text-foreground"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadImage(generatedImage)}
                    data-testid="download-button"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {t('download')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {generatedImage && isPreviewOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm md:p-8"
              onClick={() => setIsPreviewOpen(false)}
            >
              <button
                className="absolute top-4 right-4 z-50 text-white/70 transition-colors hover:text-white"
                onClick={() => setIsPreviewOpen(false)}
                aria-label="Close preview"
                type="button"
              >
                <X className="size-8" />
              </button>

              <div
                className="relative flex h-full w-full items-center justify-center"
              >
                <div
                  className="flex items-start gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="relative max-h-full max-w-full overflow-hidden rounded-lg">
                    <img
                      src={generatedImage.url}
                      alt={generatedImage.prompt || theme || 'Coloring page preview'}
                      className="h-auto max-h-[90vh] w-auto max-w-[85vw] object-contain"
                      loading="lazy"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-1 bg-black/30 text-white hover:bg-black/50 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadImage(generatedImage);
                    }}
                    aria-label={t('download')}
                    title={t('download')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
