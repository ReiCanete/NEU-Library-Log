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

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (countdown / 8) * circumference;

  return (
    <div className="min-h-screen neu-dark-bg flex flex-col items-center justify-center p-8 text-white text-center relative overflow-hidden">
      <div className="max-w-4xl w-full space-y-12 z-10 animate-in fade-in zoom-in duration-1000">
        <div className="flex justify-center relative">
          <svg className="w-56 h-56">
            <circle
              className="text-white/5"
              strokeWidth="10"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="112"
              cy="112"
            />
            <circle
              className="text-[#c9a227] progress-ring"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="112"
              cy="112"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-[#c9a227] rounded-full p-6 shadow-[0_0_40px_rgba(201,162,39,0.5)] animate-in scale-in-0 duration-700 delay-300">
              <CheckCircle2 className="h-20 w-20 text-[#0a2a1a]" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xl font-black text-[#c9a227] tracking-widest uppercase flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5" /> Welcome to NEU Library!
          </p>
          <h1 className="text-7xl font-black text-white leading-none tracking-tight">
            {visitor.fullName}
          </h1>
          <div className="inline-block px-8 py-3 rounded-full bg-[#c9a227] text-[#0a2a1a] text-2xl font-black shadow-[0_0_30px_rgba(201,162,39,0.3)]">
            {visitor.college}
          </div>
          <p className="text-lg text-white/40 font-bold uppercase tracking-widest mt-2">
             Entry Successfully Logged
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto pt-12 border-t border-white/10">
          <div className="glass-neu flex items-center justify-center gap-6 p-8 rounded-[2rem]">
            <Calendar className="h-12 w-12 text-[#c9a227]" />
            <div className="text-left">
              <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">Entry Date</p>
              <p className="text-3xl font-black">
                {currentTime ? format(currentTime, 'MMM dd, yyyy') : '--'}
              </p>
            </div>
          </div>
          <div className="glass-neu flex items-center justify-center gap-6 p-8 rounded-[2rem]">
            <Clock className="h-12 w-12 text-[#c9a227]" />
            <div className="text-left">
              <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">Login Time</p>
              <p className="text-3xl font-black tabular-nums">
                {currentTime ? format(currentTime, 'hh:mm:ss a') : '--:--:--'}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8">
          <p className="text-[#c9a227]/50 text-lg font-bold uppercase tracking-[0.2em]">
            Resetting in <span className="text-white font-black">{countdown}</span>...
          </p>
        </div>
      </div>
    </div>
  );
}