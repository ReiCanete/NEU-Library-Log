"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Calendar } from 'lucide-react';
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

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (countdown / 8) * circumference;

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center p-6 text-white text-center relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-float" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-float" style={{ animationDelay: '2s' }} />

      <div className="max-w-4xl w-full space-y-16 z-10 animate-in fade-in zoom-in duration-1000">
        <div className="flex justify-center relative">
          <svg className="w-48 h-48">
            <circle
              className="text-white/10"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="96"
              cy="96"
            />
            <circle
              className="text-blue-500 progress-ring"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="96"
              cy="96"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <CheckCircle2 className="h-24 w-24 text-blue-400 animate-in scale-in-0 duration-500" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-blue-400 tracking-wider uppercase">Welcome to NEU Library!</h1>
          <h2 className="text-8xl font-black text-white leading-tight">
            {visitor.fullName}
          </h2>
          <div className="inline-block mt-6 px-10 py-3 rounded-full bg-blue-600 text-white text-2xl font-bold shadow-[0_0_30px_rgba(37,99,235,0.4)]">
            {visitor.college}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto pt-12 border-t border-white/10">
          <div className="glass flex items-center justify-center gap-6 p-8 rounded-[2rem]">
            <Calendar className="h-12 w-12 text-blue-400" />
            <div className="text-left">
              <p className="text-blue-200/40 text-sm font-black uppercase tracking-widest">Today&apos;s Date</p>
              <p className="text-3xl font-bold">
                {currentTime ? format(currentTime, 'MMM dd, yyyy') : '--'}
              </p>
            </div>
          </div>
          <div className="glass flex items-center justify-center gap-6 p-8 rounded-[2rem]">
            <Clock className="h-12 w-12 text-blue-400" />
            <div className="text-left">
              <p className="text-blue-200/40 text-sm font-black uppercase tracking-widest">Entry Time</p>
              <p className="text-3xl font-bold tabular-nums">
                {currentTime ? format(currentTime, 'hh:mm:ss a') : '--:--:--'}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-12">
          <p className="text-blue-200/40 text-xl font-medium tracking-wide">
            Returning to home screen in <span className="text-white font-bold">{countdown}</span> seconds...
          </p>
        </div>
      </div>
    </div>
  );
}
