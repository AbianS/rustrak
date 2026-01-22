import { Terminal, Zap } from 'lucide-react';

export function TerminalPreview() {
  return (
    <section className="py-12 px-6 md:px-12">
      <div className="max-w-5xl mx-auto relative group">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-transparent blur-2xl opacity-20 group-hover:opacity-30 transition-opacity" />

        {/* Terminal window */}
        <div className="relative bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
          {/* Terminal header */}
          <div className="h-10 border-b border-border bg-secondary/50 flex items-center px-4 gap-2">
            <div className="size-2.5 rounded-full bg-red-500/20 border border-red-500/40" />
            <div className="size-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/40" />
            <div className="size-2.5 rounded-full bg-green-500/20 border border-green-500/40" />
            <div className="ml-4 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
              <Terminal className="size-3" />
              app/services/auth_provider.js
            </div>
          </div>

          {/* Code content */}
          <div className="p-6 md:p-8 font-mono text-sm leading-relaxed overflow-x-auto">
            <div className="flex gap-6 opacity-40">
              <span className="text-muted-foreground select-none w-6 text-right">14</span>
              <span>
                <span className="text-blue-400">import</span>
                {' { validateSession } '}
                <span className="text-blue-400">from</span>
                <span className="text-primary"> &apos;@sentry/node&apos;</span>;
              </span>
            </div>
            <div className="flex gap-6 opacity-40">
              <span className="text-muted-foreground select-none w-6 text-right">15</span>
              <span> </span>
            </div>
            <div className="flex gap-6 bg-red-500/10 -mx-6 md:-mx-8 px-6 md:px-8 border-l-4 border-red-500">
              <span className="text-red-500/50 select-none w-6 text-right">16</span>
              <span>
                <span className="text-blue-400">const</span>
                {' user = '}
                <span className="text-blue-400">await</span>
                {' validateSession(req.token);'}
              </span>
            </div>
            <div className="flex gap-6 bg-red-500/10 -mx-6 md:-mx-8 px-6 md:px-8 border-l-4 border-red-500">
              <span className="text-red-500/50 select-none w-6 text-right">17</span>
              <span className="text-red-400">TypeError: Cannot read property &apos;id&apos; of undefined</span>
            </div>
            <div className="flex gap-6 opacity-40 mt-4">
              <span className="text-muted-foreground select-none w-6 text-right">18</span>
              <span>
                <span className="text-blue-400">return</span>
                {' { success: '}
                <span className="text-primary">true</span>
                {', user };'}
              </span>
            </div>
          </div>

          {/* Alert popup */}
          <div className="absolute bottom-6 right-6 p-4 md:p-6 bg-background/90 backdrop-blur border border-primary/20 rounded-xl shadow-2xl max-w-xs animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
                <Zap className="size-4 text-primary-foreground" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest">Real-time Alert</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Auth service error in <span className="text-foreground">production</span>. Grouped with 12 similar events.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
