'use client';

import { DialogPortal } from '@radix-ui/react-dialog';
import { useDocsSearch } from 'fumadocs-core/search/client';
import { useOnChange } from 'fumadocs-core/utils/use-on-change';
import { useMemo, useState } from 'react';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  TagsList,
  TagsListItem,
} from 'fumadocs-ui/components/dialog/search';
import type { DefaultSearchDialogProps } from 'fumadocs-ui/components/dialog/search-default';

export default function CenteredSearchDialog({
  defaultTag,
  tags = [],
  api,
  delayMs,
  type = 'fetch',
  allowClear = false,
  links = [],
  footer,
  ...props
}: DefaultSearchDialogProps) {
  const { locale } = useI18n();
  const [tag, setTag] = useState(defaultTag);
  const { search, setSearch, query } = useDocsSearch(
    type === 'fetch'
      ? {
          type: 'fetch',
          api,
          locale,
          tag,
          delayMs,
        }
      : {
          type: 'static',
          from: api,
          locale,
          tag,
          delayMs,
        }
  );

  const defaultItems = useMemo(() => {
    if (links.length === 0) return null;

    return links.map(([name, link]) => ({
      type: 'page' as const,
      id: name,
      content: name,
      url: link,
    }));
  }, [links]);

  useOnChange(defaultTag, (value) => {
    setTag(value);
  });

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      {...props}
    >
      <DialogPortal>
        <SearchDialogOverlay />
        <SearchDialogContent className="top-1/2 -translate-y-1/2 md:top-1/2">
          <SearchDialogHeader>
            <SearchDialogIcon />
            <SearchDialogInput />
            <SearchDialogClose />
          </SearchDialogHeader>
          <SearchDialogList
            items={query.data !== 'empty' ? query.data : defaultItems}
          />
          <SearchDialogFooter>
            {tags.length > 0 && (
              <TagsList tag={tag} onTagChange={setTag} allowClear={allowClear}>
                {tags.map((tag) => (
                  <TagsListItem key={tag.value} value={tag.value}>
                    {tag.name}
                  </TagsListItem>
                ))}
              </TagsList>
            )}
            {footer}
          </SearchDialogFooter>
        </SearchDialogContent>
      </DialogPortal>
    </SearchDialog>
  );
}
