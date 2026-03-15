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
    <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center p-12 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px] animate-orb" />
      
      <div className="absolute top-8 left-8">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/')}
          className="text-white hover:bg-white/10 gap-2 font-bold px-6 h-12 rounded-full"
        >
          <ArrowLeft className="h-5 w-5" /> Cancel
        </Button>
      </div>

      <div className="max-w-6xl w-full space-y-16 text-center z-10 animate-in fade-in slide-in-from-bottom-12 duration-1000">
        <div className="space-y-4">
          <h2 className="text-7xl font-black text-white drop-shadow-2xl tracking-tight">Visit Purpose</h2>
          <p className="text-2xl text-blue-200/50 font-bold">
            What brings you to the library today, <span className="text-blue-400">{visitor.fullName.split(' ')[0]}</span>?
          </p>
        </div>

        {isSubmitting ? (
          <div className="py-24 flex flex-col items-center gap-8 glass rounded-[3rem] p-16">
            <Loader2 className="h-24 w-24 animate-spin text-blue-400" />
            <p className="text-3xl font-black text-white uppercase tracking-widest">Logging your entry...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-10">
            {PURPOSES.map((item) => (
              <Card 
                key={item.id}
                className="group cursor-pointer glass-dark border-white/5 hover:bg-blue-600/30 hover:border-blue-500/50 hover:scale-[1.03] active:scale-95 transition-all duration-500 rounded-[3rem] overflow-hidden shadow-2xl"
                onClick={() => handleSelect(item.label)}
              >
                <CardContent className="flex flex-col items-center justify-center p-20 gap-10">
                  <div className="p-8 rounded-[2rem] bg-white/5 group-hover:bg-blue-500 group-hover:shadow-[0_0_50px_rgba(59,130,246,0.6)] transition-all duration-500">
                    <item.icon className="h-20 w-20 text-blue-300 group-hover:text-white transition-colors" strokeWidth={1.5} />
                  </div>
                  <span className="text-3xl font-black text-white tracking-tight">{item.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Progress Bar Countdown */}
      <div className="fixed bottom-0 left-0 w-full h-3 bg-white/5">
        <div 
          className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-100 ease-linear shadow-[0_0_20px_rgba(37,99,235,1)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}