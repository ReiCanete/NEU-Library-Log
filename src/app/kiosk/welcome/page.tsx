"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Calendar, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

export default function WelcomePage() {
  const router = useRouter();
  const [visitor, setVisitor] = useState<any>(null);
  const [countdown, setCountdown] = useState(8);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const data = sessionStorage.getItem('kiosk_visitor');
    if (!data) {
      router.push('/');
      return;
    }
    setVisitor(JSON.parse(data));

    const timeTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    const countTimer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(timeTimer);
      clearInterval(countTimer);
    };
  }, [router]);

  // Handle navigation side effect separately from state updates
  useEffect(() => {
    if (countdown === 0) {
      sessionStorage.removeItem('kiosk_visitor');
      router.push('/');
    }
  }, [countdown, router]);

  if (!visitor) return null;

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (countdown / 8) * circumference;

  return (
    <div className="h-screen overflow-hidden flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-[#0a2a1a] to-[#0d3d24] text-white text-center relative p-8">
      <div className="max-w-4xl w-full flex flex-col items-center gap-8 z-10 animate-in fade-in zoom-in duration-700">
        <img src="/neu-logo.png" alt="NEU Logo" width={80} height={80} className="rounded-full shadow-2xl border-2 border-[#c9a227]/30 mb-4" />
        
        <div className="relative flex items-center justify-center w-[120px] h-[120px]">
          <svg className="w-full h-full -rotate-90">
            <circle className="text-white/10" strokeWidth="8" stroke="currentColor" fill="transparent" r={radius} cx="60" cy="60" />
            <circle className="text-[#c9a227] transition-all duration-1000 ease-linear" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx="60" cy="60" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-[#c9a227] rounded-full p-4 shadow-[0_0_40px_rgba(201,162,39,0.5)]"><CheckCircle2 className="h-10 w-10 text-[#0a2a1a]" /></div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-black text-[#c9a227] tracking-[0.4em] uppercase flex items-center justify-center gap-3"><Sparkles className="h-4 w-4" /> Entry Successful <Sparkles className="h-4 w-4" /></p>
          <h1 className="text-6xl font-black text-white tracking-tight">{visitor.fullName}</h1>
          <div className="inline-block px-8 py-2 rounded-full bg-[#c9a227] text-[#0a2a1a] text-lg font-black shadow-xl">{visitor.college}</div>
        </div>

        <div className="flex gap-6 w-full max-w-[500px] pt-10 border-t border-white/10">
          <div className="bg-black/30 backdrop-blur-xl flex flex-1 items-center justify-center gap-4 p-6 rounded-3xl border border-white/5">
            <Calendar className="h-8 w-8 text-[#c9a227]" />
            <div className="text-left">
              <p className="text-white/30 text-[9px] font-black uppercase tracking-widest">Date</p>
              <p className="text-2xl font-black">{currentTime ? format(currentTime, 'MMM dd, yyyy') : '--'}</p>
            </div>
          </div>
          <div className="bg-black/30 backdrop-blur-xl flex flex-1 items-center justify-center gap-4 p-6 rounded-3xl border border-white/5">
            <Clock className="h-8 w-8 text-[#c9a227]" />
            <div className="text-left">
              <p className="text-white/30 text-[9px] font-black uppercase tracking-widest">Time</p>
              <p className="text-2xl font-black tabular-nums">{currentTime ? format(currentTime, 'hh:mm a') : '--:--'}</p>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <p className="text-[#c9a227]/50 text-xs font-black uppercase tracking-[0.5em]">Resetting kiosk in <span className="text-white">{countdown}</span>...</p>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 w-full h-3 bg-black/40">
        <div className="h-full bg-gradient-to-r from-[#c9a227] to-[#a07d1a] transition-all duration-100 ease-linear shadow-[0_0_20px_#c9a227]" style={{ width: `${(countdown/8)*100}%` }} />
      </div>
    </div>
  );
}
