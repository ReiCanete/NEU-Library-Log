"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Search, Monitor, Users, GraduationCap, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { db as firestore } from '@/firebase/config';
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
      setProgress((prev) => {
        if (prev <= 0) {
          router.push('/');
          return 0;
        }
        return prev - (100 / 300); // 30 seconds total
      });
    }, 100);

    return () => clearInterval(timer);
  }, [router]);

  const handleSelect = async (purpose: string) => {
    if (!visitor || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'visits'), {
        studentId: visitor.studentId,
        fullName: visitor.fullName,
        college: visitor.college || 'Unspecified',
        program: visitor.program || 'N/A',
        purpose: purpose,
        loginMethod: visitor.loginMethod,
        timestamp: Timestamp.now(),
      });
      router.push('/kiosk/welcome');
    } catch (err: any) {
      toast({
        title: "Log Failed",
        description: err.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (!visitor) return null;

  return (
    <div className="min-h-screen neu-dark-bg flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-6 left-6">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/')}
          className="text-[#c9a227] hover:bg-white/5 gap-2 font-bold px-6 h-12 rounded-full border border-[#c9a227]/20"
        >
          <ArrowLeft className="h-5 w-5" /> Cancel
        </Button>
      </div>

      <div className="max-w-5xl w-full space-y-12 text-center z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="space-y-3">
          <h2 className="text-6xl font-black text-[#c9a227] drop-shadow-2xl tracking-tight">Visit Purpose</h2>
          <p className="text-xl text-white/50 font-bold">
            What brings you to the library today, <span className="text-white">{visitor.fullName.split(' ')[0]}</span>?
          </p>
        </div>

        {isSubmitting ? (
          <div className="py-20 flex flex-col items-center gap-6 glass-neu rounded-[2.5rem] p-12">
            <Loader2 className="h-16 w-16 animate-spin text-[#c9a227]" />
            <p className="text-2xl font-black text-white uppercase tracking-widest">Logging Entry...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {PURPOSES.map((item) => (
              <Card 
                key={item.id}
                className="group cursor-pointer glass-neu border-[#c9a227]/10 hover:bg-[#c9a227]/10 hover:border-[#c9a227] hover:scale-[1.02] active:scale-95 transition-all duration-300 rounded-[2rem] overflow-hidden shadow-2xl"
                onClick={() => handleSelect(item.label)}
              >
                <CardContent className="flex flex-col items-center justify-center p-10 gap-6">
                  <div className="p-6 rounded-2xl bg-[#c9a227]/10 group-hover:bg-[#c9a227] group-hover:shadow-[0_0_30px_rgba(201,162,39,0.4)] transition-all">
                    <item.icon className="h-14 w-14 text-[#c9a227] group-hover:text-[#0a2a1a] transition-colors" strokeWidth={1.5} />
                  </div>
                  <span className="text-xl font-black text-white tracking-tight">{item.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 w-full h-2 bg-black/20">
        <div 
          className="h-full bg-gradient-to-r from-[#c9a227] to-[#a07d1a] transition-all duration-100 ease-linear shadow-[0_0_15px_#c9a227]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}