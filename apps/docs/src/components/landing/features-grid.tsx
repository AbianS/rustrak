import { ArrowRight, Code2, Database, Plug, Server, Shield, Zap } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    icon: Zap,
    title: 'Ultra-Lightweight',
    description: 'Server uses only ~50MB RAM. Run on a 512MB VPS with room to spare.',
    stat: '~50MB',
    statLabel: 'RAM',
  },
  {
    icon: Server,
    title: 'Server-Only Mode',
    description: 'Deploy just the server. Access the dashboard from your laptop or Vercel—zero overhead on your server.',
  },
  {
    icon: Plug,
    title: 'Sentry Compatible',
    description: 'Works with any Sentry SDK. Just change your DSN and you\'re done.',
  },
  {
    icon: Shield,
    title: 'Your Data, Your Server',
    description: 'Self-hosted by design. No data leaves your infrastructure. GDPR-friendly.',
  },
  {
    icon: Database,
    title: 'PostgreSQL',
    description: 'Simple, reliable storage. Easy backups with pg_dump.',
  },
  {
    icon: Code2,
    title: 'Any SDK',
    description: 'JavaScript, Python, Go, Rust, Java, .NET—use what you know.',
    badge: 'ALL SDKS',
  },
];

export function FeaturesGrid() {
  return (
    <section className="py-20 md:py-24 px-6 md:px-12 bg-secondary/30">
      <div className="max-w-[1400px] mx-auto">
        {/* Section header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16">
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-primary mb-4">
              Core Capabilities
            </h2>
            <h3 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tighter">
              Everything you need,
              <br />
              <span className="text-muted-foreground">nothing you don&apos;t.</span>
            </h3>
          </div>
          <p className="text-muted-foreground text-sm max-w-sm">
            Built for teams who need reliable error tracking without the complexity.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="bg-card/50 backdrop-blur border-border hover:border-primary/50 transition-all group py-8"
            >
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="size-12 bg-secondary border border-border rounded-xl flex items-center justify-center group-hover:border-primary/30 transition-colors">
                    <feature.icon className="size-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  {feature.badge && (
                    <div className="px-2 py-0.5 bg-secondary border border-border text-muted-foreground text-[10px] font-mono rounded">
                      {feature.badge}
                    </div>
                  )}
                  {feature.stat && (
                    <div className="text-right">
                      <p className="text-xl font-black">{feature.stat}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        {feature.statLabel}
                      </p>
                    </div>
                  )}
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}

          {/* CTA Card */}
          <Card className="bg-primary border-primary hover:brightness-110 transition-all group py-8 cursor-pointer">
            <Link href="/getting-started/installation" className="h-full flex flex-col">
              <CardHeader className="pb-0 flex-1">
                <div className="size-10 bg-black/10 rounded-lg flex items-center justify-center mb-4">
                  <ArrowRight className="size-5 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl font-black text-primary-foreground">
                  Start Building Now
                </CardTitle>
                <p className="text-sm text-primary-foreground/70 font-medium mt-2">
                  Deploy in under 5 minutes with Docker.
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/60">
                  No Credit Card Required
                </span>
              </CardContent>
            </Link>
          </Card>
        </div>
      </div>
    </section>
  );
}
