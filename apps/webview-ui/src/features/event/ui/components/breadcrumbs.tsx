import { getTranslations } from 'next-intl/server';
import {
  type Breadcrumb,
  getSummaryBreadcrumbs,
} from '@/features/event/lib/breadcrumbs';
import { BreadcrumbsExpand } from './breadcrumbs-expand';

interface BreadcrumbsProps {
  breadcrumbs?: Breadcrumb[] | { values?: Breadcrumb[] };
}

function normalizeBreadcrumbs(
  breadcrumbs?: Breadcrumb[] | { values?: Breadcrumb[] },
): Breadcrumb[] {
  if (!breadcrumbs) return [];
  if (Array.isArray(breadcrumbs)) return breadcrumbs;
  if ('values' in breadcrumbs && Array.isArray(breadcrumbs.values)) {
    return breadcrumbs.values;
  }
  return [];
}

export async function Breadcrumbs({ breadcrumbs }: BreadcrumbsProps) {
  const t = await getTranslations('events');
  const items = normalizeBreadcrumbs(breadcrumbs);

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {t('breadcrumbs.empty')}
      </div>
    );
  }

  const summaryItems = getSummaryBreadcrumbs(items);

  return <BreadcrumbsExpand items={items} summaryItems={summaryItems} />;
}
