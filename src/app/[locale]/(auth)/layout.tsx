import { envConfigs } from '@/config';
import {
  BrandLogo,
  LocaleSelector,
  ThemeToggler,
} from '@/shared/blocks/common';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_48%,hsl(var(--muted)/0.32)_100%)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -top-28 left-1/2 h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,oklch(0.97_0.02_240/0.65)_0%,transparent_72%)]" />
        <div className="absolute -bottom-48 left-1/2 h-[560px] w-[1200px] -translate-x-1/2 rounded-full border border-foreground/5" />
        <div className="absolute -bottom-36 left-1/2 h-[500px] w-[1060px] -translate-x-1/2 rounded-full border border-foreground/5" />
        <div className="absolute -bottom-20 left-1/2 h-[420px] w-[900px] -translate-x-1/2 rounded-full border border-foreground/5" />
      </div>

      <div className="absolute top-4 left-4 z-10">
        <BrandLogo
          brand={{
            title: envConfigs.app_name,
            logo: {
              src: envConfigs.app_logo,
              alt: envConfigs.app_name,
            },
            url: '/',
            target: '_self',
            className: '',
          }}
        />
      </div>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-4">
        <ThemeToggler />
        <LocaleSelector type="button" />
      </div>
      <div className="relative z-10 w-full px-4">{children}</div>
    </div>
  );
}
