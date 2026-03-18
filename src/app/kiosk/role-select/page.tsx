'use client';
/**
 * @fileOverview A page for administrative users logging in via the kiosk.
 * Allows them to choose between logging a visit or entering the staff portal.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Users, ShieldCheck, ArrowLeft } from 'lucide-react';
import AnnouncementToast from '@/components/kiosk/AnnouncementToast';

export default function RoleSelectPage() {
  const router = useRouter();
  const [visitorData, setVisitorData] = useState<any>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('kiosk_visitor');
    if (!stored) {
      router.push('/');
      return;
    }
    setVisitorData(JSON.parse(stored));
  }, [router]);

  const handleVisitor = () => {
    router.push('/kiosk/purpose');
  };

  const handleAdmin = () => {
    router.push('/admin');
  };

  if (!visitorData) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#071a0f] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a5c2e33_0%,_transparent_60%)] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#c9a22711_0%,_transparent_50%)] pointer-events-none z-0" />
      <AnnouncementToast />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 pb-12 relative z-10">
        <img src="/neu-library-logo.png" alt="NEU Logo" className="w-20 h-20 rounded-full mb-4 shadow-2xl border-2 border-[#c9a227]/40 ring-4 ring-[#c9a227]/10" />
        <h1 className="text-4xl font-black text-[#c9a227] text-center drop-shadow-lg uppercase tracking-tight leading-none">NEU LIBRARY</h1>
        <p className="text-[10px] font-black tracking-[0.3em] text-white/30 uppercase mt-1 mb-10">Digital Visitor Log</p>

        <div className="w-full max-w-[480px] space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center shadow-2xl ring-1 ring-[#c9a227]/10">
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Welcome back,</p>
            <p className="text-white font-black text-2xl uppercase tracking-tight drop-shadow-lg">{visitorData.fullName}</p>
            <div className="mt-4 px-4 py-1.5 bg-[#c9a227]/10 rounded-full inline-block border border-[#c9a227]/20">
              <p className="text-[#c9a227] text-[10px] font-black uppercase tracking-widest">{visitorData.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-white/30 text-[10px] font-black text-center uppercase tracking-[0.3em]">How would you like to proceed?</p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleVisitor}
                className="flex flex-col items-center justify-center gap-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 hover:border-[#c9a227]/60 hover:bg-[#c9a227]/10 transition-all group shadow-xl hover:shadow-2xl hover:shadow-[#c9a227]/10 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#c9a227]/10 border border-[#c9a227]/20 flex items-center justify-center group-hover:bg-[#c9a227] group-hover:border-transparent transition-all duration-300 group-hover:shadow-lg group-hover:shadow-[#c9a227]/30">
                  <Users className="w-8 h-8 text-[#c9a227] group-hover:text-[#0a2a1a] transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-xs uppercase tracking-widest">Visitor Entry</p>
                  <p className="text-white/30 text-[9px] mt-1 font-bold">Log visit log</p>
                </div>
              </button>

              <button
                onClick={handleAdmin}
                className="flex flex-col items-center justify-center gap-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 hover:border-[#c9a227]/60 hover:bg-[#c9a227]/10 transition-all group shadow-xl hover:shadow-2xl hover:shadow-[#c9a227]/10 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#c9a227]/10 border border-[#c9a227]/20 flex items-center justify-center group-hover:bg-[#c9a227] group-hover:border-transparent transition-all duration-300 group-hover:shadow-lg group-hover:shadow-[#c9a227]/30">
                  <ShieldCheck className="w-8 h-8 text-[#c9a227] group-hover:text-[#0a2a1a] transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-xs uppercase tracking-widest">Staff Portal</p>
                  <p className="text-white/30 text-[9px] mt-1 font-bold">Manage system</p>
                </div>
              </button>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center justify-center gap-2 text-white/20 hover:text-white/50 text-[10px] font-black uppercase tracking-[0.3em] transition-colors py-2"
          >
            <ArrowLeft className="w-3 h-3" /> Cancel and Return
          </button>
        </div>
      </div>
    </div>
  );
}
