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

  // Reduced ring size for 100px container
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (countdown / 8) * circumference;

  return (
    <div className="h-screen overflow-hidden flex flex-col items-center justify-center gap-3 bg-[#0d3d24] text-white text-center relative p-4">
      <div className="max-w-4xl w-full flex flex-col items-center gap-4 z-10 animate-in fade-in zoom-in duration-700">
        
        {/* Compact Circular Progress & Checkmark */}
        <div className="relative flex items-center justify-center w-[100px] h-[100px]">
          <svg className="w-full h-full -rotate-90">
            <circle
              className="text-white/5"
              strokeWidth="6"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="50"
              cy="50"
            />
            <circle
              className="text-[#c9a227] transition-all duration-1000 ease-linear"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="50"
              cy="50"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-[#c9a227] rounded-full p-2.5 shadow-[0_0_20px_rgba(201,162,39,0.3)] animate-in scale-in-0 duration-500 delay-200">
              <CheckCircle2 className="h-8 w-8 text-[#0a2a1a]" />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-2">
          <p className="text-sm font-black text-[#c9a227] tracking-widest uppercase flex items-center justify-center gap-2">
            <Sparkles className="h-3 w-3" /> Welcome to NEU Library!
          </p>
          <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
            {visitor.fullName}
          </h1>
          <div className="inline-block px-4 py-1 rounded-full bg-[#c9a227] text-[#0a2a1a] text-sm font-bold shadow-md">
            {visitor.college}
          </div>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
             Entry Successfully Logged
          </p>
        </div>

        {/* Compact Side-by-Side Cards */}
        <div className="flex gap-4 w-full max-w-[420px] pt-4 border-t border-white/10">
          <div className="glass-neu flex flex-1 items-center justify-center gap-3 p-3 rounded-2xl">
            <Calendar className="h-6 w-6 text-[#c9a227]" />
            <div className="text-left">
              <p className="text-white/30 text-[8px] font-black uppercase tracking-widest">Date</p>
              <p className="text-lg font-bold leading-none">
                {currentTime ? format(currentTime, 'MMM dd, yyyy') : '--'}
              </p>
            </div>
          </div>
          <div className="glass-neu flex flex-1 items-center justify-center gap-3 p-3 rounded-2xl">
            <Clock className="h-6 w-6 text-[#c9a227]" />
            <div className="text-left">
              <p className="text-white/30 text-[8px] font-black uppercase tracking-widest">Time</p>
              <p className="text-lg font-bold leading-none tabular-nums">
                {currentTime ? format(currentTime, 'hh:mm a') : '--:--'}
              </p>
            </div>
          </div>
        </div>

        {/* Reset Message */}
        <div className="pt-2">
          <p className="text-[#c9a227]/50 text-xs font-bold uppercase tracking-[0.2em]">
            Resetting in <span className="text-white font-black">{countdown}</span>...
          </p>
        </div>
      </div>

      {/* Background Dots */}
      <div className="absolute inset-0 pointer-events-none opacity-20" 
           style={{ backgroundImage: 'radial-gradient(#c9a227 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
    </div>
  );
}
