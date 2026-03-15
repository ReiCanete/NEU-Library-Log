"use client";

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 w-full z-[999] bg-red-600 text-white p-3 flex items-center justify-center gap-3 font-black uppercase text-xs tracking-widest animate-in slide-in-from-top duration-300">
      <WifiOff className="h-4 w-4" />
      You are offline. Some features may not be available.
    </div>
  );
}
