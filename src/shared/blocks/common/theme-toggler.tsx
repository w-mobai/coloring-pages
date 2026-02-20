'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, SunDim } from 'lucide-react';
import { useTheme } from 'next-themes';

import { AnimatedThemeToggler } from '@/shared/components/magicui/animated-theme-toggler';
import { Button } from '@/shared/components/ui/button';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/shared/components/ui/toggle-group';

export function ThemeToggler({
  type = 'icon',
  className,
}: {
  type?: 'icon' | 'button' | 'toggle';
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const handleThemeChange = (value: string) => {
    setTheme(value);
  };

  if (!mounted) {
    return null;
  }

  const itemClassName =
    'hover:bg-primary/10 hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:[&_svg]:text-primary-foreground';

  if (type === 'button') {
    return (
      <Button variant="outline" size="sm" className="hover:bg-primary/10">
        <SunDim />
      </Button>
    );
  } else if (type === 'toggle') {
    return (
      <ToggleGroup
        type="single"
        className={` ${className}`}
        value={theme}
        onValueChange={handleThemeChange}
        variant="outline"
      >
        <ToggleGroupItem
          value="light"
          onClick={() => setTheme('light')}
          aria-label="Switch to light mode"
          className={itemClassName}
        >
          <SunDim />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="dark"
          onClick={() => setTheme('dark')}
          aria-label="Switch to dark mode"
          className={itemClassName}
        >
          <Moon />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="system"
          onClick={() => setTheme('system')}
          aria-label="Switch to system mode"
          className={itemClassName}
        >
          <Monitor />
        </ToggleGroupItem>
      </ToggleGroup>
    );
  }

  return <AnimatedThemeToggler className={className} />;
}
