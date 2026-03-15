"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Search, Monitor, Users, GraduationCap, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { db } from '@/firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

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

    const timer = setInterval(() => {
      setProgress((prev) => Math.max(0, prev - (100 / 300)));
    }, 100);

    return () => clearInterval(timer);
  }, [router]);

  // Handle inactivity timeout separately from progress updates
  useEffect(() => {
    if (progress === 0) {
      router.push('/');
    }
  }, [progress, router]);

  const handleSelect = async (purpose: string) => {
    if (!visitor || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'visits'), {
        studentId: visitor.studentId,
        fullName: visitor.fullName,
        college: visitor.college || '—',
        program: visitor.program || '—',
        purpose: purpose,
        loginMethod: visitor.loginMethod,
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
    <div className="h-screen bg-gradient-to-br from-[#0a2a1a] to-[#0d3d24] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-8 left-8">
        <Button variant="ghost" onClick={() => router.push('/')} className="text-[#c9a227] hover:bg-white/10 gap-2 font-black px-8 h-14 rounded-full border border-[#c9a227]/30">
          <ArrowLeft className="h-5 w-5" /> Cancel Entry
        </Button>
      </div>

      <div className="max-w-5xl w-full space-y-12 text-center z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="space-y-3">
          <h2 className="text-6xl font-black text-[#c9a227] drop-shadow-2xl tracking-tight">Visit Purpose</h2>
          <p className="text-xl text-white/50 font-bold uppercase tracking-widest">Select the reason for your visit, <span className="text-white">{visitor.fullName.split(' ')[0]}</span></p>
        </div>

        {isSubmitting ? (
          <div className="py-24 flex flex-col items-center gap-8 bg-black/20 rounded-[3rem] backdrop-blur-xl border border-[#c9a227]/20">
            <Loader2 className="h-20 w-20 animate-spin text-[#c9a227]" />
            <p className="text-3xl font-black text-white uppercase tracking-widest">Logging Your Visit...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
            {PURPOSES.map((item) => (
              <Card key={item.id} className="group cursor-pointer bg-black/30 backdrop-blur-xl border-[#c9a227]/20 hover:bg-[#c9a227]/10 hover:border-[#c9a227] hover:scale-105 active:scale-95 transition-all duration-300 rounded-[2.5rem] shadow-2xl" onClick={() => handleSelect(item.label)}>
                <CardContent className="flex flex-col items-center justify-center p-12 gap-8">
                  <div className="p-8 rounded-3xl bg-[#c9a227]/10 group-hover:bg-[#c9a227] transition-all"><item.icon className="h-16 w-16 text-[#c9a227] group-hover:text-[#0a2a1a]" strokeWidth={2} /></div>
                  <span className="text-2xl font-black text-white uppercase tracking-tight">{item.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 w-full h-3 bg-black/40">
        <div className="h-full bg-gradient-to-r from-[#c9a227] to-[#a07d1a] transition-all duration-100 ease-linear shadow-[0_0_20px_#c9a227]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
