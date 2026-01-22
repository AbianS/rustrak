import { FeaturesGrid } from './features-grid';
import { HeroSection } from './hero-section';
import { LandingNavbar } from './navbar';
import { TerminalPreview } from './terminal-preview';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <HeroSection />
      <TerminalPreview />
      <FeaturesGrid />
    </div>
  );
}
