'use client';

import { useAuth } from '@/context/AuthContext';
import { LoginPage, Dashboard } from '@/components/cook';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-10 h-10 border-3 border-border border-t-foreground rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Yuklanmoqda...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <Dashboard />;
}
