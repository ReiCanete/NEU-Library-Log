"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function KioskLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [inactivityTimer, setInactivityTimer] = useState(30);

  useEffect(() => {
    const handleActivity = () => setInactivityTimer(30);
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const timer = setInterval(() => {
      setInactivityTimer((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (inactivityTimer === 0) {
      router.push('/');
    }
  }, [inactivityTimer, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-6 right-6 z-50">
        <Button 
          variant="outline" 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          Cancel / Logout
        </Button>
      </div>
      
      <main className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </main>

      <div className="absolute bottom-6 text-muted-foreground text-sm">
        Kiosk will reset in {inactivityTimer}s
      </div>
    </div>
  );
}
