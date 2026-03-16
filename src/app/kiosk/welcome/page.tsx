"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Calendar, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import AnnouncementTicker from '@/components/kiosk/AnnouncementTicker';

export default function WelcomePage() {
  const router = useRouter();
  const [visitorData, setVisitorData] = useState<any>(null);
  const [countdown, setCountdown] = useState(8);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const stored = sessionStorage.getItem('kiosk_visitor');
    if (!stored) {
      router.push('/');
      return;
    }
    
    const visitor = JSON.parse(stored);
    setVisitorData({
      fullName: visitor.fullName || 'Visitor',
      college: visitor.college || '',
      program: visitor.program || '',
      visitorType: visitor.visitorType || 'Student',
      studentId: visitor.studentId || '',
      loginMethod: visitor.loginMethod || 'id'
    });

    const timeTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    const countTimer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(timeTimer);
      clearInterval(countTimer);
    };
  }, [router]);

  useEffect(() => {
    if (countdown === 0) {
      sessionStorage.removeItem('kiosk_visitor');
      router.push('/');
    }
  }, [countdown, router]);

  if (!visitorData) return null;

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (countdown / 8) * circumference;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0a2a1a] to-[#0d3d24]">
      <AnnouncementTicker />
      
      <title>NEU Library Log — Welcome</title>
      
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-700">
        <div className="max-w-4xl w-full flex flex-col items-center gap-6 z-10">
          <img src="/neu-logo.png" alt="NEU Logo" width={80} height={80} className="rounded-full shadow-2xl border-2 border-[#c9a227]/30" loading="lazy" />
          
          <div className="relative flex items-center justify-center w-[100px] h-[100px]">
            <svg className="w-full h-full -rotate-90">
              <circle className="text-white/10" strokeWidth="8" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" />
              <circle className="text-[#c9a227] transition-all duration-1000 ease-linear" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-[#c9a227] rounded-full p-3 shadow-[0_0_30px_rgba(201,162,39,0.5)]"><CheckCircle2 className="h-8 w-8 text-[#0a2a1a]" /></div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black text-[#c9a227] tracking-[0.4em] uppercase flex items-center justify-center gap-3">
              <Sparkles className="h-3 w-3" /> Entry Successful <Sparkles className="h-3 w-3" />
            </p>
            <h1 className="text-5xl font-black text-white tracking-tight">{visitorData.fullName}</h1>
            <p className="text-[#c9a227] text-base font-black uppercase tracking-widest drop-shadow-lg">Welcome to NEU Library!</p>
            
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Badge className="bg-[#c9a227] text-[#0a2a1a] text-sm font-black px-6 py-1.5 rounded-xl shadow-lg border-none uppercase">
                {visitorData.visitorType}
              </Badge>
              {visitorData.college && (
                <Badge variant="outline" className="border-[#c9a227] text-[#c9a227] text-sm font-black px-6 py-1.5 rounded-xl uppercase">
                  {visitorData.college}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-4 w-full max-w-[500px] pt-8 border-t border-white/10 mt-4">
            <div className="bg-black/30 backdrop-blur-xl flex flex-1 items-center justify-center gap-4 p-6 rounded-[1.5rem] border border-white/5">
              <Calendar className="h-8 w-8 text-[#c9a227]" />
              <div className="text-left">
                <p className="text-white/30 text-[8px] font-black uppercase tracking-widest">Date</p>
                <p className="text-base font-bold whitespace-nowrap">{currentTime ? format(currentTime, 'MMMM dd, yyyy') : '--'}</p>
              </div>
            </div>
            <div className="bg-black/30 backdrop-blur-xl flex flex-1 items-center justify-center gap-4 p-6 rounded-[1.5rem] border border-white/5">
              <Clock className="h-8 w-8 text-[#c9a227]" />
              <div className="text-left">
                <p className="text-white/30 text-[8px] font-black uppercase tracking-widest">Time</p>
                <p className="text-base font-bold tabular-nums whitespace-nowrap">{currentTime ? format(currentTime, 'hh:mm a') : '--:--'}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4">
            <p className="text-[#c9a227] text-[10px] font-black uppercase tracking-[0.6em]">
              Resetting kiosk in <span className="text-white font-mono">{countdown}</span>...
            </p>
          </div>
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 w-full h-3 bg-black/40">
        <div className="h-full bg-gradient-to-r from-[#c9a227] to-[#a07d1a] transition-all duration-100 ease-linear shadow-[0_0_20px_#c9a227]" style={{ width: `${(countdown/8)*100}%` }} />
      </div>
    </div>
  );
}
