'use client';

import { ImageGenerator as ImageGen } from '@/shared/blocks/generator/image';

export function ImageGenerator({ section }: { section: any }) {
  return (
    <section id={section.id} className={section.className}>
      <div className="container py-16">
        <div className="mx-auto max-w-6xl space-y-8">
          {/* Section Header */}
          {(section.title || section.description) && (
            <div className="text-center space-y-4">
              {section.title && (
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {section.title}
                </h2>
              )}
              {section.description && (
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  {section.description}
                </p>
              )}
            </div>
          )}

          {/* Image Generator Component */}
          <ImageGen
            srOnlyTitle={section.srOnlyTitle || 'AI Image Generator'}
            allowMultipleImages={section.allowMultipleImages ?? true}
            maxImages={section.maxImages ?? 9}
            maxSizeMB={section.maxSizeMB ?? 5}
          />
        </div>
      </div>
    </section>
  );
}

export default ImageGenerator;
