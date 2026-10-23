import { Nav } from '@/components/Nav';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/lib/toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <Nav />
        <div className="mx-auto max-w-[1400px] px-4 py-8 pb-[calc(3.5rem+2rem+env(safe-area-inset-bottom))] md:px-6 md:pb-8">{children}</div>
      </ToastProvider>
    </AuthProvider>
  );
}
