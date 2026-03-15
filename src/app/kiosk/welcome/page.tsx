"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Calendar, PartyPopper } from 'lucide-react';
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
    <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center p-8 text-white text-center relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px] animate-orb" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[150px] animate-orb" style={{ animationDelay: '3s' }} />

      <div className="max-w-5xl w-full space-y-16 z-10 animate-in fade-in zoom-in duration-1000">
        <div className="flex justify-center relative">
          <svg className="w-64 h-64">
            <circle
              className="text-white/5"
              strokeWidth="12"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="128"
              cy="128"
            />
            <circle
              className="text-blue-500 progress-ring"
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="128"
              cy="128"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-blue-500 rounded-full p-8 shadow-[0_0_50px_rgba(59,130,246,0.5)] animate-in scale-in-0 duration-700 delay-300">
              <CheckCircle2 className="h-24 w-24 text-white" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <p className="text-2xl font-black text-blue-400 tracking-widest uppercase flex items-center justify-center gap-3">
            <PartyPopper className="h-6 w-6" /> Successful Entry
          </p>
          <h1 className="text-8xl font-black text-white leading-none tracking-tight">
            {visitor.fullName}
          </h1>
          <div className="inline-block px-12 py-4 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 text-3xl font-black shadow-[0_0_40px_rgba(37,99,235,0.3)]">
            {visitor.college}
          </div>
          <p className="text-xl text-blue-200/40 font-bold uppercase tracking-widest mt-4">
             Welcome to NEU Library!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl mx-auto pt-16 border-t border-white/10">
          <div className="glass flex items-center justify-center gap-8 p-10 rounded-[2.5rem]">
            <Calendar className="h-16 w-16 text-blue-400" />
            <div className="text-left">
              <p className="text-blue-200/40 text-xs font-black uppercase tracking-widest">Entry Date</p>
              <p className="text-4xl font-black">
                {currentTime ? format(currentTime, 'MMM dd, yyyy') : '--'}
              </p>
            </div>
          </div>
          <div className="glass flex items-center justify-center gap-8 p-10 rounded-[2.5rem]">
            <Clock className="h-16 w-16 text-blue-400" />
            <div className="text-left">
              <p className="text-blue-200/40 text-xs font-black uppercase tracking-widest">Login Time</p>
              <p className="text-4xl font-black tabular-nums">
                {currentTime ? format(currentTime, 'hh:mm:ss a') : '--:--:--'}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-12">
          <p className="text-blue-200/30 text-xl font-bold uppercase tracking-[0.3em]">
            Resetting in <span className="text-white">{countdown}</span>...
          </p>
        </div>
      </div>
    </div>
  );
}