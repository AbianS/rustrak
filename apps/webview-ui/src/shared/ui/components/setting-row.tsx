import { cn } from '@/shared/lib/utils';

/**
 * One setting: label and explanation on the left, control on the right.
 *
 * Settings pages are long lists of small controls, so each one being a Card
 * adds a border and a heading per field and turns a 10-field page into 10
 * boxes. Rows separated by a hairline read as one list and keep the emphasis
 * on the controls.
 */
export function SettingRow({
  title,
  description,
  htmlFor,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** Points the title at its control, so clicking the title focuses it. */
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border py-5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8',
        className,
      )}
    >
      <div className="sm:max-w-xs">
        {htmlFor ? (
          <label
            htmlFor={htmlFor}
            className="text-sm font-medium cursor-pointer"
          >
            {title}
          </label>
        ) : (
          <p className="text-sm font-medium">{title}</p>
        )}
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0 sm:w-72">{children}</div>
    </div>
  );
}

/** Groups related rows under a heading, e.g. "Danger Zone". */
export function SettingSection({
  title,
  description,
  destructive,
  children,
}: {
  title: string;
  description?: string;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2
        className={cn(
          'text-xs font-bold uppercase tracking-widest',
          destructive ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-2">{children}</div>
    </section>
  );
}
