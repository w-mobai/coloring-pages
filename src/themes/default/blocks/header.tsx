'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';

import { Link, usePathname } from '@/core/i18n/navigation';
import { locales } from '@/config/locale';
import {
  BrandLogo,
  LocaleSelector,
  SignUser,
  SmartIcon,
  ThemeToggler,
} from '@/shared/blocks/common';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger as RawNavigationMenuTrigger,
} from '@/shared/components/ui/navigation-menu';
import { useMedia } from '@/shared/hooks/use-media';
import { cn } from '@/shared/lib/utils';
import { NavItem } from '@/shared/types/blocks/common';
import { Header as HeaderType } from '@/shared/types/blocks/landing';

// For Next.js hydration mismatch warning, conditionally render NavigationMenuTrigger only after mount to avoid inconsistency between server/client render
function NavigationMenuTrigger(
  props: React.ComponentProps<typeof RawNavigationMenuTrigger>
) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  // Only render after client has mounted, to avoid SSR/client render id mismatch
  if (!mounted) return null;
  return <RawNavigationMenuTrigger {...props} />;
}

export function Header({ header }: { header: HeaderType }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const isScrolledRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);
  const isLarge = useMedia('(min-width: 64rem)');
  const pathname = usePathname();
  const normalizePath = (value?: string) => {
    if (!value) return '/';
    return value !== '/' ? value.replace(/\/+$/, '') : value;
  };
  const stripLocalePrefix = (path: string) => {
    const localePattern = new RegExp(`^/(?:${locales.join('|')})(?=/|$)`);
    return path.replace(localePattern, '') || '/';
  };
  const pathForMatch = stripLocalePrefix(normalizePath(pathname || '/'));

  useEffect(() => {
    // Listen to scroll event to enable header styles on scroll
    const handleScroll = () => {
      // Coalesce high-frequency scroll events & only update state when value changes.
      if (scrollRafRef.current != null) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        const next = window.scrollY > 25;
        if (next === isScrolledRef.current) return;
        isScrolledRef.current = next;
        setIsScrolled(next);
      });
    };

    // Initialize once on mount.
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollRafRef.current != null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

  // 阻止在导航菜单下拉内容上滚动时页面滚动
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      // 检查是否在导航菜单内容区域
      if (target.closest('[data-slot="navigation-menu-content"]')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 使用 capture 阶段和 passive: false 来确保可以阻止默认行为
    document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    
    return () => {
      document.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  // Navigation menu for large screens
  const NavMenu = () => {
    return (
      <NavigationMenu
        viewport={false}
        className="**:data-[slot=navigation-menu-content]:top-10 max-lg:hidden"
      >
        <NavigationMenuList className="gap-2">
          {header.nav?.items?.filter((item: any) => !item.hidden).map((item, idx) => {
            if (!item.children || item.children.length === 0) {
              const itemUrl = normalizePath(item.url || '/');
              const isActive =
                item.is_active ||
                (itemUrl === '/'
                  ? pathForMatch === '/'
                  : pathForMatch === itemUrl ||
                    pathForMatch.startsWith(`${itemUrl}/`));
              return (
                <NavigationMenuItem key={idx}>
                  <Link
                    href={item.url || ''}
                    target={item.target || '_self'}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 px-4 py-1 text-sm rounded-md h-8 font-medium transition-colors outline-none",
                      "hover:bg-foreground/5 hover:text-foreground",
                      "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-1",
                      "active:bg-foreground/5",
                      isActive
                        ? 'bg-muted/60 text-muted-foreground hover:bg-muted/60 active:bg-muted/60 hover:text-muted-foreground'
                        : ''
                    )}
                    onClick={(e) => {
                      // 如果已经在当前页面，阻止导航
                      if (isActive) {
                        e.preventDefault();
                      }
                    }}
                  >
                    {item.icon && <SmartIcon name={item.icon as string} className="h-4 w-4" />}
                    {item.title}
                  </Link>
                </NavigationMenuItem>
              );
            }

            // 检查是否有子菜单的任何一项是当前页面
            const isChildActive = item.children?.some((child: NavItem) => 
              (() => {
                const childUrl = normalizePath(child.url || '');
                if (!childUrl) return false;
                return (
                  pathForMatch === childUrl ||
                  pathForMatch.startsWith(`${childUrl}/`)
                );
              })()
            );

            return (
              <NavigationMenuItem key={idx}>
                <NavigationMenuTrigger 
                  className={cn(
                    "flex flex-row items-center gap-2 text-sm",
                    // 移除 data-[state=open] 的默认背景色，只在 hover 时显示
                    "data-[state=open]:bg-transparent hover:bg-foreground/5",
                    isChildActive && "bg-muted/60 text-muted-foreground hover:bg-muted/60"
                  )}
                  onClick={(e) => {
                    // 阻止点击时关闭已打开的下拉菜单
                    const trigger = e.currentTarget;
                    if (trigger.getAttribute('data-state') === 'open') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onPointerDown={(e) => {
                    // 也在 pointerDown 阶段阻止
                    const trigger = e.currentTarget;
                    if (trigger.getAttribute('data-state') === 'open') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                >
                  {item.icon && (
                    <SmartIcon name={item.icon as string} className="h-4 w-4" />
                  )}
                  {item.title}
                </NavigationMenuTrigger>
                <NavigationMenuContent 
                  className="min-w-2xs origin-top p-2"
                  onWheelCapture={(e) => {
                    // 使用 capture 阶段捕获事件并阻止冒泡
                    e.stopPropagation();
                  }}
                >
                  <ul className="mt-1 space-y-2">
                    {item.children?.map((subItem: NavItem, index: number) => (
                      <ListItem
                        key={index}
                        href={subItem.url || ''}
                        target={subItem.target || '_self'}
                        title={subItem.title || ''}
                        description={subItem.description || ''}
                      >
                        {subItem.icon && (
                          <SmartIcon name={subItem.icon as string} />
                        )}
                      </ListItem>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
    );
  };

  // Mobile menu using Accordion, shown on small screens
  const MobileMenu = ({ closeMenu }: { closeMenu: () => void }) => {
    return (
      <nav
        role="navigation"
        className="w-full [--color-border:--alpha(var(--color-foreground)/5%)] [--color-muted:--alpha(var(--color-foreground)/5%)]"
      >
        <Accordion
          type="single"
          collapsible
          className="-mx-4 mt-0.5 space-y-0.5 **:hover:no-underline"
        >
          {header.nav?.items?.filter((item: any) => !item.hidden).map((item, idx) => {
            // 检查当前项是否激活
            const itemUrl = normalizePath(item.url || '/');
            const isItemActive = item.is_active ||
              (itemUrl === '/'
                ? pathForMatch === '/'
                : pathForMatch === itemUrl ||
                  pathForMatch.startsWith(`${itemUrl}/`));
            
            // 检查子项是否有激活的
            const hasActiveChild = item.children?.some((child: NavItem) => {
              const childUrl = normalizePath(child.url || '');
              if (!childUrl) return false;
              return pathForMatch === childUrl || pathForMatch.startsWith(`${childUrl}/`);
            });

            return (
              <AccordionItem
                key={idx}
                value={item.title || ''}
                className="group relative border-b-0 before:pointer-events-none before:absolute before:inset-x-4 before:bottom-0 before:border-b"
              >
                {item.children && item.children.length > 0 ? (
                  <>
                    <AccordionTrigger 
                      className={cn(
                        "flex items-center justify-between px-4 py-3 text-lg **:!font-normal",
                        "data-[state=open]:bg-muted",
                        hasActiveChild && "bg-muted/60 text-muted-foreground"
                      )}
                    >
                      {item.title}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5">
                      <ul>
                        {item.children?.map((subItem: NavItem, iidx) => {
                          const subItemUrl = normalizePath(subItem.url || '');
                          const isSubItemActive = pathForMatch === subItemUrl || 
                            pathForMatch.startsWith(`${subItemUrl}/`);
                          
                          return (
                            <li key={iidx}>
                              <Link
                                href={subItem.url || ''}
                                onClick={closeMenu}
                                className={cn(
                                  "grid grid-cols-[auto_1fr] items-center gap-2.5 px-4 py-2 rounded-md transition-colors",
                                  isSubItemActive && "bg-muted/60 text-muted-foreground"
                                )}
                              >
                                <div
                                  aria-hidden
                                  className="flex items-center justify-center *:size-4"
                                >
                                  {subItem.icon && (
                                    <SmartIcon name={subItem.icon as string} />
                                  )}
                                </div>
                                <div className="text-base">{subItem.title}</div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </AccordionContent>
                  </>
                ) : (
                  <Link
                    href={item.url || ''}
                    onClick={closeMenu}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 text-lg **:!font-normal",
                      "data-[state=open]:bg-muted",
                      isItemActive && "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    {item.title}
                  </Link>
                )}
              </AccordionItem>
            );
          })}
        </Accordion>
      </nav>
    );
  };

  // List item for submenus in NavigationMenu
  function ListItem({
    title,
    description,
    children,
    href,
    target,
    ...props
  }: React.ComponentPropsWithoutRef<'li'> & {
    href: string;
    title: string;
    description?: string;
    target?: string;
  }) {
    return (
      <li {...props}>
        <NavigationMenuLink asChild>
          <Link
            href={href}
            target={target || '_self'}
            className="grid grid-cols-[auto_1fr] gap-3.5"
          >
            <div className="bg-background relative flex size-9 items-center justify-center rounded border border-transparent">
              {children}
            </div>
            <div className="space-y-0.5">
              <div className="text-foreground text-sm font-medium">{title}</div>
              <p className="text-muted-foreground line-clamp-1 text-xs">
                {description}
              </p>
            </div>
          </Link>
        </NavigationMenuLink>
      </li>
    );
  }

  return (
    <>
      <header
        data-state={isMobileMenuOpen ? 'active' : 'inactive'}
        {...(isScrolled && { 'data-scrolled': true })}
        className="has-data-[state=open]:bg-background/50 fixed inset-x-0 top-0 z-50 has-data-[state=open]:h-screen has-data-[state=open]:backdrop-blur"
      >
        <div
          className={cn(
            'absolute inset-x-0 top-0 z-50 h-18 border-transparent ring-1 ring-transparent transition-all duration-300',
            'in-data-scrolled:border-foreground/5 in-data-scrolled:bg-background/75 in-data-scrolled:border-b in-data-scrolled:backdrop-blur',
            'has-data-[state=open]:ring-foreground/5 has-data-[state=open]:bg-card/75 has-data-[state=open]:border-b has-data-[state=open]:shadow-lg has-data-[state=open]:shadow-black/10 has-data-[state=open]:backdrop-blur',
            'max-lg:in-data-[state=active]:bg-background/75 max-lg:h-14 max-lg:overflow-hidden max-lg:border-b max-lg:in-data-[state=active]:h-screen max-lg:in-data-[state=active]:backdrop-blur'
          )}
        >
          <div className="container">
            <div className="relative flex flex-wrap items-center justify-between lg:py-5">
              <div className="flex justify-between gap-8 max-lg:h-14 max-lg:w-full max-lg:border-b">
                {/* Brand Logo */}
                {header.brand && <BrandLogo brand={header.brand} />}

                {/* Desktop Navigation Menu */}
                {isLarge && <NavMenu />}
                {/* Hamburger menu button for mobile navigation */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  aria-label={
                    isMobileMenuOpen == true ? 'Close Menu' : 'Open Menu'
                  }
                  className="relative z-20 -m-2.5 -mr-3 block cursor-pointer p-2.5 lg:hidden"
                >
                  <Menu className="m-auto size-5 duration-200 in-data-[state=active]:scale-0 in-data-[state=active]:rotate-180 in-data-[state=active]:opacity-0" />
                  <X className="absolute inset-0 m-auto size-5 scale-0 -rotate-180 opacity-0 duration-200 in-data-[state=active]:scale-100 in-data-[state=active]:rotate-0 in-data-[state=active]:opacity-100" />
                </button>
              </div>

              {/* Show mobile menu if needed */}
              {!isLarge && isMobileMenuOpen && (
                <MobileMenu closeMenu={() => setIsMobileMenuOpen(false)} />
              )}

              {/* Header right section: theme toggler, locale selector, sign, buttons */}
              <div className="mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 in-data-[state=active]:flex max-lg:in-data-[state=active]:mt-6 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
                <div className="flex w-full flex-row items-center gap-4 sm:flex-row sm:gap-6 sm:space-y-0 md:w-fit">
                  {header.buttons &&
                    header.buttons.map((button, idx) => (
                      <Link
                        key={idx}
                        href={button.url || ''}
                        target={button.target || '_self'}
                        className={cn(
                          'focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
                          'h-7 px-3 ring-0',
                          button.variant === 'outline'
                            ? 'bg-background border-primary ring-foreground/10 hover:bg-muted/50 dark:ring-foreground/15 dark:hover:bg-muted/50 border border-transparent shadow-sm ring-1 shadow-black/15 duration-200'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 border-[0.5px] border-white/25 shadow-md ring-1 shadow-black/20 ring-(--ring-color) [--ring-color:color-mix(in_oklab,var(--color-foreground)15%,var(--color-primary))]'
                        )}
                      >
                        {button.icon && (
                          <SmartIcon
                            name={button.icon as string}
                            className="size-4"
                          />
                        )}
                        <span>{button.title}</span>
                      </Link>
                    ))}

                  {header.show_theme ? <ThemeToggler /> : null}
                  {header.show_locale ? <LocaleSelector /> : null}
                  <div className="flex-1 md:hidden"></div>
                  {header.show_sign ? (
                    <SignUser userNav={header.user_nav} />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
