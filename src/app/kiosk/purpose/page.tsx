"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Search, Monitor, Users, GraduationCap, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import AnnouncementToast from '@/components/kiosk/AnnouncementToast';

const PURPOSES = [
  { id: 'reading', label: 'Reading Books', icon: BookOpen },
  { id: 'research', label: 'Research / Study', icon: Search },
  { id: 'computer', label: 'Computer / Internet', icon: Monitor },
  { id: 'group', label: 'Group Discussion', icon: Users },
  { id: 'thesis', label: 'Thesis / Archival', icon: GraduationCap },
  { id: 'others', label: 'Other Purpose', icon: Sparkles },
];

export default function PurposePage() {
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const [visitor, setVisitor] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const data = sessionStorage.getItem('kiosk_visitor');
    if (!data) {
      router.push('/');
      return;
    }
    setVisitor(JSON.parse(data));

    const interval = setInterval(() => {
      setProgress((prev) => Math.max(0, prev - (100 / 300)));
    }, 100);

    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    if (progress <= 0) {
      sessionStorage.removeItem('kiosk_visitor');
      router.push('/');
    }
  }, [progress, router]);

  const handleSelect = async (purpose: string) => {
    if (!visitor || isSubmitting || !db) return;
    setIsSubmitting(true);
    try {
      const updatedVisitor = { ...visitor, purpose };
      sessionStorage.setItem('kiosk_visitor', JSON.stringify(updatedVisitor));

      await addDoc(collection(db, 'visits'), {
        studentId: updatedVisitor.studentId || updatedVisitor.email || `GUEST-${Date.now()}`,
        fullName: updatedVisitor.fullName,
        college: updatedVisitor.college || '',
        program: updatedVisitor.program || '',
        visitorType: updatedVisitor.visitorType || 'Student',
        email: updatedVisitor.email || '',
        purpose: purpose,
        loginMethod: updatedVisitor.loginMethod || 'id',
        timestamp: Timestamp.now(),
      });
      router.push('/kiosk/welcome');
    } catch (err: any) {
      toast({ title: "Log Failed", description: err.message, variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  if (!visitor) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0a2a1a] to-[#0d3d24]">
      <AnnouncementToast />
      
      <div className="absolute top-16 left-6">
        <Button variant="ghost" onClick={() => router.push('/')} className="text-[#c9a227] hover:bg-white/10 gap-2 font-black px-4 h-10 rounded-full border border-[#c9a227]/30 text-xs">
          <ArrowLeft className="h-4 w-4" /> Cancel Entry
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="max-w-4xl w-full flex flex-col gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-[#c9a227] drop-shadow-2xl tracking-tight uppercase">Visit Purpose</h2>
            <p className="text-sm text-white/50 font-bold uppercase tracking-widest">
              Hi <span className="text-[#c9a227] font-black">{visitor?.fullName?.split(' ')[0] || 'Visitor'}</span>, why are you visiting today?
            </p>
          </div>

          {isSubmitting ? (
            <div className="h-[360px] flex flex-col items-center justify-center gap-6 bg-black/20 rounded-[3rem] backdrop-blur-xl border border-[#c9a227]/20">
              <Loader2 className="h-16 w-16 animate-spin text-[#c9a227]" />
              <p className="text-2xl font-black text-white uppercase tracking-widest">Logging Entry...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-3xl mx-auto">
              {PURPOSES.map((item) => (
                <Card 
                  key={item.id} 
                  className="group cursor-pointer bg-black/30 backdrop-blur-xl border-[#c9a227]/20 hover:border-[#c9a227] hover:scale-105 transition-all duration-300 rounded-[1.5rem] shadow-xl overflow-hidden active:bg-[#c9a227]/20" 
                  onClick={() => handleSelect(item.label)}
                >
                  <CardContent className="flex flex-col items-center justify-center p-4 gap-3 h-[140px]">
                    <div className="p-3 rounded-xl bg-[#c9a227]/10 group-hover:bg-[#c9a227] transition-all">
                      <item.icon className="h-8 w-8 text-[#c9a227] group-hover:text-[#0a2a1a]" />
                    </div>
                    <span className="text-xs font-black text-white uppercase tracking-tight text-center leading-tight">{item.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full h-1 bg-black/40">
        <div className="h-full bg-[#c9a227] transition-all duration-100 ease-linear shadow-[0_0_10px_#c9a227]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
