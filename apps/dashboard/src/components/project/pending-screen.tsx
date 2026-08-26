import type { MessageKey, Translator } from '@rustrak/i18n';
import { EmptyIcon, Page, PageHeader, Text } from '@rustrak/ui';

/**
 * A screen the sidebar can reach but the rebuild has not got to.
 *
 * It exists so the sidebar can be honest. Seven routes are what a project has,
 * and a navigation column that lists one of them is not the design; one that
 * lists seven and silently does nothing for six is worse. This says which
 * screen you asked for and that it is not here yet, which is the whole truth
 * and takes one sentence.
 */
export function PendingScreen({
  t,
  title,
}: {
  t: Translator;
  title: MessageKey;
}) {
  return (
    <Page>
      <PageHeader title={t.t(title)} />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <EmptyIcon className="text-fg-ghost" size="xl" aria-hidden="true" />
        <Text tone="secondary" variant="section">
          {t.t('projectOverview.pendingTitle')}
        </Text>
        <Text className="max-w-md" tone="muted" variant="body">
          {t.t('projectOverview.pendingDescription')}
        </Text>
      </div>
    </Page>
  );
}
