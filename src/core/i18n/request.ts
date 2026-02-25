import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';

import {
  defaultLocale,
  localeMessagesPaths,
  localeMessagesRootPath,
} from '@/config/locale';

import { routing } from './config';

const adminMessagePaths = localeMessagesPaths.filter((path) =>
  path.startsWith('admin/')
);
const settingsMessagePaths = localeMessagesPaths.filter((path) =>
  path.startsWith('settings/')
);
const activityMessagePaths = localeMessagesPaths.filter((path) =>
  path.startsWith('activity/')
);
const alwaysLoadedMessagePaths = localeMessagesPaths.filter(
  (path) =>
    !path.startsWith('admin/') &&
    !path.startsWith('settings/') &&
    !path.startsWith('activity/')
);

function stripLocalePrefix(pathname: string) {
  if (!pathname) {
    return '/';
  }

  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) {
      return '/';
    }
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || '/';
    }
  }

  return pathname;
}

function getMessagePathsForPathname(pathname: string) {
  const normalizedPathname = stripLocalePrefix(pathname);
  const scopedPaths = new Set<string>(alwaysLoadedMessagePaths);

  if (normalizedPathname.startsWith('/admin')) {
    adminMessagePaths.forEach((path) => scopedPaths.add(path));
  }

  if (normalizedPathname.startsWith('/settings')) {
    settingsMessagePaths.forEach((path) => scopedPaths.add(path));
  }

  if (
    normalizedPathname.startsWith('/activity') ||
    normalizedPathname.startsWith('/history')
  ) {
    activityMessagePaths.forEach((path) => scopedPaths.add(path));
  }

  return Array.from(scopedPaths);
}

export async function loadMessages(
  path: string,
  locale: string = defaultLocale
) {
  try {
    // try to load locale messages
    const messages = await import(
      `@/config/locale/messages/${locale}/${path}.json`
    );
    return messages.default;
  } catch (e) {
    try {
      // try to load default locale messages
      const messages = await import(
        `@/config/locale/messages/${defaultLocale}/${path}.json`
      );
      return messages.default;
    } catch (err) {
      // if default locale is not found, return empty object
      return {};
    }
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as string)) {
    locale = routing.defaultLocale;
  }

  if (['zh-CN'].includes(locale)) {
    locale = 'zh';
  }

  const requestHeaders = await headers();
  const requestPathname = requestHeaders.get('x-pathname');
  const messagePaths = requestPathname
    ? getMessagePathsForPathname(requestPathname)
    : localeMessagesPaths;

  try {
    // load all local messages
    const allMessages = await Promise.all(
      messagePaths.map((path) => loadMessages(path, locale))
    );

    // merge all local messages
    const messages: any = {};

    messagePaths.forEach((path, index) => {
      const localMessages = allMessages[index];

      const keys = path.split('/');
      let current = messages;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = localMessages;
    });

    return {
      locale,
      messages,
    };
  } catch (e) {
    return {
      locale: defaultLocale,
      messages: await loadMessages(localeMessagesRootPath, defaultLocale),
    };
  }
});
