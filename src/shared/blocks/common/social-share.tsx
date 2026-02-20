'use client';

import { useState, useEffect } from 'react';
import { Share2, Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { SmartIcon } from '@/shared/blocks/common';
import { cn } from '@/shared/lib/utils';

interface SocialShareProps {
  url?: string;
  title?: string;
  description?: string;
  className?: string;
}

export function SocialShare({
  url,
  title = 'What Generation Am I',
  description = 'Find your generation by birth year.',
  className,
}: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shareUrl, setShareUrl] = useState(url || '');
  
  // Only run on client side
  useEffect(() => {
    setMounted(true);
    if (!url && typeof window !== 'undefined') {
      setShareUrl(window.location.href);
    }
  }, [url]);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }
  
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const shareLinks = [
    {
      name: 'Facebook',
      icon: 'RiFacebookFill',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: 'hover:bg-[#1877F2] hover:text-white',
    },
    {
      name: 'Twitter',
      icon: 'RiTwitterXFill',
      url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      color: 'hover:bg-[#000000] hover:text-white',
    },
    {
      name: 'WhatsApp',
      icon: 'RiWhatsappFill',
      url: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      color: 'hover:bg-[#25D366] hover:text-white',
    },
    {
      name: 'Telegram',
      icon: 'RiTelegramFill',
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      color: 'hover:bg-[#0088cc] hover:text-white',
    },
    {
      name: 'LinkedIn',
      icon: 'RiLinkedinFill',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: 'hover:bg-[#0A66C2] hover:text-white',
    },
    {
      name: 'Reddit',
      icon: 'RiRedditFill',
      url: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      color: 'hover:bg-[#FF4500] hover:text-white',
    },
  ];

  const handleShare = (url: string) => {
    window.open(url, '_blank', 'width=600,height=400');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    }
  };

  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center gap-2">
        <Share2 className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Share this page:</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {shareLinks.map((link) => (
          <Button
            key={link.name}
            variant="outline"
            size="sm"
            onClick={() => handleShare(link.url)}
            className={cn(
              'transition-colors duration-200',
              link.color
            )}
            title={`Share on ${link.name}`}
          >
            <SmartIcon name={link.icon} className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">{link.name}</span>
          </Button>
        ))}
        
        {/* Copy Link Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="transition-colors duration-200 hover:bg-muted"
          title="Copy link"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Copied!</span>
            </>
          ) : (
            <>
              <SmartIcon name="RiLinkM" className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Copy Link</span>
            </>
          )}
        </Button>

        {/* Native Share (Mobile) */}
        {hasNativeShare && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleNativeShare}
            className="transition-colors duration-200 hover:bg-muted lg:hidden"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
            <span className="ml-2">Share</span>
          </Button>
        )}
      </div>
    </div>
  );
}
