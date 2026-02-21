import { NextRequest, NextResponse } from 'next/server';

import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { findAITaskById } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';

function isHttpUrl(url: URL) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase();

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local')
  ) {
    return true;
  }

  // block common private IPv4 ranges to reduce SSRF risk
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split('.').map(Number);
    const [a, b] = parts;

    if (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return true;
    }
  }

  return false;
}

function normalizeUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (!isHttpUrl(parsed)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function collectUrlsFromValue(value: unknown, urls: Set<string>) {
  if (!value) {
    return;
  }

  if (typeof value === 'string') {
    const normalized = normalizeUrl(value);
    if (normalized) {
      urls.add(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectUrlsFromValue(item, urls));
    return;
  }

  if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectUrlsFromValue(item, urls)
    );
  }
}

function parseTaskPayload(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url');
  const taskId = req.nextUrl.searchParams.get('taskId');

  if (!rawUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const parsedUrl = new URL(rawUrl);
    if (!isHttpUrl(parsedUrl)) {
      return new NextResponse('Invalid url protocol', { status: 400 });
    }

    if (taskId) {
      if (isBlockedHostname(parsedUrl.hostname)) {
        return new NextResponse('Forbidden url host', { status: 403 });
      }

      const rateLimitResponse = enforceMinIntervalRateLimit(req, {
        intervalMs: 800,
        keyPrefix: 'proxy-file',
        extraKey: taskId,
      });
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const user = await getUserInfo();
      if (!user) {
        return new NextResponse('Unauthorized', { status: 401 });
      }

      const task = await findAITaskById(taskId);
      if (!task) {
        return new NextResponse('Forbidden', { status: 403 });
      }

      if (task.userId !== user.id) {
        return new NextResponse('Forbidden', { status: 403 });
      }

      const taskInfo = parseTaskPayload(task.taskInfo);
      const taskResult = parseTaskPayload(task.taskResult);
      const taskUrls = new Set<string>();
      collectUrlsFromValue(taskInfo, taskUrls);
      collectUrlsFromValue(taskResult, taskUrls);

      const normalizedRequestUrl = parsedUrl.toString();
      if (!taskUrls.has(normalizedRequestUrl)) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    const response = await fetch(rawUrl);

    if (!response.ok) {
      return new NextResponse(`Failed to fetch file: ${response.statusText}`, {
        status: response.status,
      });
    }

    const contentType =
      response.headers.get('content-type') || 'application/octet-stream';

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
