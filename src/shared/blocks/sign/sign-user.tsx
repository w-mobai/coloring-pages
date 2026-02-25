'use client';

import { useEffect, useRef, useState } from 'react';
import { Fragment } from 'react/jsx-runtime';
import { Coins, LayoutDashboard, Loader2, LogOut, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTopLoader } from 'nextjs-toploader';
import { toast } from 'sonner';

import { authClient, signOut, useSession } from '@/core/auth/client';
import { Link, usePathname, useRouter } from '@/core/i18n/navigation';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useAppContext } from '@/shared/contexts/app';
import { cn } from '@/shared/lib/utils';
import { User as UserType } from '@/shared/models/user';
import { NavItem, UserNav } from '@/shared/types/blocks/common';

import { SmartIcon } from '../common/smart-icon';
import { SignModal } from './sign-modal';

function extractSessionUser(data: any): UserType | null {
  const u = data?.user ?? data?.data?.user ?? null;
  return u && typeof u === 'object' ? (u as UserType) : null;
}

export function SignUser({
  isScrolled,
  signButtonSize = 'sm',
  userNav,
}: {
  isScrolled?: boolean;
  signButtonSize?: 'default' | 'sm' | 'lg' | 'icon';
  userNav?: UserNav;
}) {
  const t = useTranslations('common.sign');
  const router = useRouter();
  const pathname = usePathname();
  const topLoader = useTopLoader();

  const [mounted, setMounted] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // get app context values
  const {
    configs,
    fetchConfigs,
    setIsShowSignModal,
    isCheckSign,
    setIsCheckSign,
    user,
    setUser,
    fetchUserInfo,
    showOneTap,
  } = useAppContext();

  // get session
  const { data: session, isPending } = useSession();
  const sessionUser = extractSessionUser(session);
  const displayUser = (user as UserType | null) ?? sessionUser;

  // Avoid parallel fallback sync attempts when session hydration is lagging.
  const fallbackSyncInProgressRef = useRef(false);

  // one tap initialized
  const oneTapInitialized = useRef(false);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  // set is check sign
  useEffect(() => {
    setIsCheckSign(isPending);
  }, [isPending]);

  // show one tap if not initialized
  useEffect(() => {
    if (
      configs &&
      configs.google_client_id &&
      configs.google_one_tap_enabled === 'true' &&
      !session &&
      !isPending &&
      !oneTapInitialized.current
    ) {
      oneTapInitialized.current = true;
      showOneTap(configs);
    }
  }, [configs, session, isPending]);

  // set user
  useEffect(() => {
    const currentUserId = user?.id;
    const sessionUserId = (sessionUser as any)?.id;

    if (sessionUser && sessionUserId !== currentUserId) {
      setUser(sessionUser as UserType);
      fetchUserInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser?.id, (sessionUser as any)?.email, user?.id]);

  // Fallback: if session hydration lags behind cookie persistence after sign-in,
  // retry getSession a few times to avoid requiring manual page refresh.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isPending) return;
    if (isSigningOut) return;

    // Session is already available, stop fallback loop.
    if (sessionUser || user) {
      fallbackSyncInProgressRef.current = false;
      return;
    }

    if (fallbackSyncInProgressRef.current) return;
    fallbackSyncInProgressRef.current = true;

    let canceled = false;
    const retryDelays = [0, 400, 900, 1600];

    void (async () => {
      for (const delay of retryDelays) {
        if (canceled) {
          return;
        }

        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (canceled) {
            return;
          }
        }

        try {
          const res: any = await authClient.getSession();
          const fresh = extractSessionUser(res?.data ?? res);
          if (fresh?.id) {
            setUser(fresh);
            void fetchUserInfo();
            break;
          }
        } catch {
          // ignore and continue retrying
        }
      }

      if (!canceled) {
        fallbackSyncInProgressRef.current = false;
      }
    })();

    return () => {
      canceled = true;
      fallbackSyncInProgressRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, isSigningOut, sessionUser?.id, user?.id]);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    topLoader.start();

    try {
      await signOut();
      setUser(null);
      router.refresh();
      if (typeof window !== 'undefined') {
        window.location.assign('/');
      }
    } catch {
      topLoader.done(true);
      toast.error('sign out failed');
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <SignModal callbackUrl={pathname || '/'} />
      {isCheckSign || !mounted ? (
        <div>
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : displayUser ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full border-transparent p-0 transition-none hover:border-transparent hover:bg-transparent hover:text-inherit dark:hover:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-inherit focus-visible:ring-0"
            >
              <Avatar>
                <AvatarImage
                  src={displayUser.image || ''}
                  alt={displayUser.name || 'User avatar'}
                />
                <AvatarFallback>{displayUser.name.charAt(0)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {userNav?.show_name && (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    className="w-full cursor-pointer"
                    href="/settings/profile"
                  >
                    <User />
                    {displayUser.name}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {userNav?.show_credits && (
              <>
                <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                  <div className="w-full cursor-default">
                    <Coins />
                    {t('credits_title', {
                      credits: displayUser.credits?.remainingCredits || 0,
                    })}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {userNav?.items?.map((item: NavItem, idx: number) => (
              <Fragment key={idx}>
                <DropdownMenuItem asChild>
                  <Link
                    className="w-full cursor-pointer"
                    href={item.url || ''}
                    target={item.target || '_self'}
                  >
                    {item.icon && (
                      <SmartIcon
                        name={item.icon as string}
                        className="h-4 w-4"
                      />
                    )}
                    {item.title}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </Fragment>
            ))}

            {displayUser.isAdmin && (
              <>
                <DropdownMenuItem asChild>
                  <Link className="w-full cursor-pointer" href="/admin">
                    <LayoutDashboard />
                    {t('admin_title')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {userNav?.show_sign_out && (
              <DropdownMenuItem
                className="w-full cursor-pointer"
                disabled={isSigningOut}
                onClick={() => void handleSignOut()}
              >
                {isSigningOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut />
                )}
                <span>{t('sign_out_title')}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
          <Button
            asChild
            size={signButtonSize}
            className={cn(
              'border-foreground/10 ml-4 cursor-pointer ring-0',
              isScrolled && 'lg:hidden'
            )}
            onClick={() => setIsShowSignModal(true)}
          >
            <span>{t('sign_in_title')}</span>
          </Button>
        </div>
      )}
    </>
  );
}
