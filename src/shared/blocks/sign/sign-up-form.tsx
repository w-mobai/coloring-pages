'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { authClient, signUp } from '@/core/auth/client';
import { Link, useRouter } from '@/core/i18n/navigation';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { PasswordInput } from '@/shared/components/ui/password-input';
import { Label } from '@/shared/components/ui/label';
import { useAppContext } from '@/shared/contexts/app';
import { User as UserType } from '@/shared/models/user';

import { SocialProviders } from './social-providers';

function extractSessionUser(data: any): UserType | null {
  const u = data?.user ?? data?.data?.user ?? null;
  return u && typeof u === 'object' ? (u as UserType) : null;
}

export function SignUpForm({
  callbackUrl = '/',
  className,
  onSwitchToSignIn,
}: {
  callbackUrl: string;
  className?: string;
  onSwitchToSignIn?: () => void;
}) {
  const t = useTranslations('common.sign');
  const router = useRouter();
  const locale = useLocale();
  const {
    configs,
    fetchConfigs,
    setUser,
    fetchUserInfo,
    setIsShowSignModal,
  } = useAppContext();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const didRequestConfigsRef = useRef(false);

  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const isGithubAuthEnabled = configs.github_auth_enabled === 'true';
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' ||
    (!isGoogleAuthEnabled && !isGithubAuthEnabled);
  const emailVerificationEnabled = configs.email_verification_enabled === 'true';

  useEffect(() => {
    if (
      !didRequestConfigsRef.current &&
      Object.keys(configs || {}).length === 0
    ) {
      didRequestConfigsRef.current = true;
      void fetchConfigs();
    }
  }, [configs, fetchConfigs]);

  if (callbackUrl) {
    if (
      locale !== defaultLocale &&
      callbackUrl.startsWith('/') &&
      !callbackUrl.startsWith(`/${locale}`)
    ) {
      callbackUrl = `/${locale}${callbackUrl}`;
    }
  }

  const base = locale !== defaultLocale ? `/${locale}` : '';
  const stripLocalePrefix = (path: string) => {
    if (!path?.startsWith('/')) return '/';
    if (locale === defaultLocale) return path;
    if (path === `/${locale}`) return '/';
    if (path.startsWith(`/${locale}/`))
      return path.slice(locale.length + 1) || '/';
    return path;
  };

  const navigateAfterAuthSuccess = (path: string) => {
    const normalizedPath = stripLocalePrefix(path || '/');
    if (typeof window !== 'undefined') {
      const localizedPath =
        locale !== defaultLocale
          ? normalizedPath === '/'
            ? `/${locale}`
            : `/${locale}${normalizedPath}`
          : normalizedPath;
      window.location.assign(localizedPath);
      return;
    }

    router.push(normalizedPath || '/');
  };

  const handleSignUp = async () => {
    if (loading) {
      return;
    }

    if (!email || !password || !name) {
      toast.error('email, password and name are required');
      return;
    }

    setLoading(true);

    try {
      await signUp.email(
        {
          email,
          password,
          name,
        },
        {
          onRequest: () => {
            // loading is already set above; keep as no-op for safety
          },
          onResponse: () => {
            // Do NOT reset loading here; navigation may not have completed yet.
          },
          onSuccess: async () => {
            const normalizedCallbackUrl = stripLocalePrefix(callbackUrl);

            if (emailVerificationEnabled) {
              const verifyPath = `/verify-email?sent=1&email=${encodeURIComponent(
                email
              )}&callbackUrl=${encodeURIComponent(normalizedCallbackUrl)}`;

              void authClient.sendVerificationEmail({
                email,
                callbackURL: `${base}${normalizedCallbackUrl || '/'}`,
              });

              setIsShowSignModal(false);
              router.push(verifyPath);
              return;
            }

            try {
              const res: any = await authClient.getSession();
              const fresh = extractSessionUser(res?.data ?? res);
              if (fresh?.id) {
                setUser(fresh);
                void fetchUserInfo();
              }
            } catch {
              // ignore and continue
            }

            setIsShowSignModal(false);
            setLoading(false);

            navigateAfterAuthSuccess(callbackUrl);
          },
          onError: (e: any) => {
            toast.error(e?.error?.message || 'sign up failed');
            setLoading(false);
          },
        }
      );
    } catch (e: any) {
      toast.error(e?.message || 'sign up failed');
      setLoading(false);
    }
  };

  return (
    <div className={`w-full md:max-w-md ${className}`}>
      <div className="grid gap-4">
        {isEmailAuthEnabled && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSignUp();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="name">{t('name_title')}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t('name_placeholder')}
                required
                className="auth-input !bg-transparent dark:!bg-transparent placeholder:text-muted-foreground/70 focus-visible:border-input focus-visible:ring-0"
                onChange={(e) => setName(e.target.value)}
                value={name}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">{t('email_title')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('email_placeholder')}
                required
                className="auth-input !bg-transparent dark:!bg-transparent placeholder:text-muted-foreground/70 focus-visible:border-input focus-visible:ring-0"
                onChange={(e) => setEmail(e.target.value)}
                value={email}
              />
              {emailVerificationEnabled && (
                <p className="text-amber-600 text-xs">
                  {t('email_verification_hint')}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">{t('password_title')}</Label>
              <PasswordInput
                id="password"
                placeholder={t('password_placeholder')}
                autoComplete="password"
                className="auth-input !bg-transparent dark:!bg-transparent placeholder:text-muted-foreground/70 focus-visible:border-input focus-visible:ring-0"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <p>{t('sign_up_title')}</p>
              )}
            </Button>
          </form>
        )}

        <SocialProviders
          configs={configs}
          callbackUrl={callbackUrl || '/'}
          loading={loading}
          setLoading={setLoading}
        />
      </div>

      {isEmailAuthEnabled && (
        <div className="flex w-full justify-center pt-4">
          <p className="text-center text-xs text-neutral-500">
            {t('already_have_account')}
            {onSwitchToSignIn ? (
              <button
                type="button"
                className="cursor-pointer underline dark:text-white/70"
                onClick={onSwitchToSignIn}
              >
                {t('sign_in_title')}
              </button>
            ) : (
              <Link href="/sign-in" className="underline">
                <span className="cursor-pointer dark:text-white/70">
                  {t('sign_in_title')}
                </span>
              </Link>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
