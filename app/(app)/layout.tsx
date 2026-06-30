import { Navbar } from '@/components/layout/navbar';
import { MobileNav } from '@/components/layout/mobile-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="pt-14 pb-20 md:pb-8 max-w-6xl mx-auto">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
