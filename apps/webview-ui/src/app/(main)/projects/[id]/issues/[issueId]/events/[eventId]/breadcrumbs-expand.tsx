'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  type Breadcrumb,
  BreadcrumbTimeline,
  groupConsecutiveBreadcrumbs,
} from './breadcrumbs';

interface BreadcrumbsExpandProps {
  items: Breadcrumb[];
  summaryItems: Breadcrumb[];
}

/** Renders the collapsed summary timeline with a "view N more" toggle that
 *  swaps in the full timeline, in place — no drawer/sheet, nothing opens
 *  elsewhere. Owns the expand state, since `Breadcrumbs` (its caller) is a
 *  Server Component and can't hold it. */
export function BreadcrumbsExpand({
  items,
  summaryItems,
}: BreadcrumbsExpandProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hiddenCount = items.length - summaryItems.length;
  const grouped = groupConsecutiveBreadcrumbs(
    isExpanded ? items : summaryItems,
  );

  return (
    <div>
      <BreadcrumbTimeline grouped={grouped} />
      {hiddenCount > 0 && !isExpanded && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={() => setIsExpanded(true)}
        >
          View {hiddenCount} more
        </Button>
      )}
    </div>
  );
}
