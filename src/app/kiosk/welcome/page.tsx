"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function WelcomePage() {
  const router = useRouter();
  const [visitor, setVisitor] = useState<any>(null);
  const [countdown, setCountdown] = useState(8);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const data = sessionStorage.getItem('kiosk_visitor');
    if (!data) {
      router.push('/');
      return;
    }
    setVisitor(JSON.parse(data));

    const timeTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const countTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          sessionStorage.removeItem('kiosk_visitor');
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timeTimer);
      clearInterval(countTimer);
    };
  }, [router]);

  if (!visitor) return null;

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="max-w-4xl w-full space-y-12 animate-in fade-in zoom-in duration-700">
        <div className="flex justify-center">
          <div className="bg-white/20 rounded-full p-8 mb-4">
            <CheckCircle2 className="h-32 w-32 text-white" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-7xl font-bold">Welcome,</h1>
          <h2 className="text-5xl font-light opacity-90">{visitor.fullName}</h2>
          <p className="text-3xl font-medium mt-4 bg-white/10 py-2 px-6 rounded-full inline-block">
            {visitor.college}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 max-w-2xl mx-auto pt-8 border-t border-white/20">
          <div className="flex items-center justify-center gap-4 bg-white/5 p-6 rounded-2xl">
            <Calendar className="h-10 w-10 text-white/60" />
            <div className="text-left">
              <p className="text-white/60 text-lg uppercase tracking-wider">Date</p>
              <p className="text-3xl font-semibold">{format(currentTime, 'MMM dd, yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 bg-white/5 p-6 rounded-2xl">
            <Clock className="h-10 w-10 text-white/60" />
            <div className="text-left">
              <p className="text-white/60 text-lg uppercase tracking-wider">Time</p>
              <p className="text-3xl font-semibold tabular-nums">{format(currentTime, 'hh:mm:ss a')}</p>
            </div>
          </div>
        </div>

        <div className="pt-12">
          <p className="text-white/60 text-xl">Returning to home screen in {countdown} seconds...</p>
        </div>
      </div>
    </div>
  );
}
