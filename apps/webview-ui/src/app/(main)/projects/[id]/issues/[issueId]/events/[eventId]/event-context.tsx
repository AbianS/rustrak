interface EventContextProps {
  contexts?: Record<string, Record<string, unknown>>;
  user?: {
    id?: string;
    email?: string;
    ip_address?: string;
  };
}

export function EventContext({ contexts, user }: EventContextProps) {
  const hasContexts = contexts && Object.keys(contexts).length > 0;
  const hasUser = user && (user.id || user.email || user.ip_address);

  if (!hasContexts && !hasUser) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No context data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Context */}
      {hasUser && (
        <ContextSection title="User">
          <div className="grid grid-cols-2 gap-4">
            {user.id && <ContextItem label="ID" value={user.id} />}
            {user.email && <ContextItem label="Email" value={user.email} />}
            {user.ip_address && (
              <ContextItem label="IP Address" value={user.ip_address} />
            )}
          </div>
        </ContextSection>
      )}

      {/* Other Contexts */}
      {contexts &&
        Object.entries(contexts).map(([key, value]) => (
          <ContextSection key={key} title={formatContextName(key)}>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(value).map(([k, v]) => (
                <ContextItem
                  key={k}
                  label={formatLabel(k)}
                  value={formatValue(v)}
                />
              ))}
            </div>
          </ContextSection>
        ))}
    </div>
  );
}

function ContextSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded-lg p-6 space-y-4">
      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground font-bold uppercase">
        {label}
      </p>
      <p className="text-sm font-mono truncate">{value}</p>
    </div>
  );
}

function formatContextName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
