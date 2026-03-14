"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Search, Monitor, Users, MoreHorizontal, GraduationCap, Loader2, ArrowLeft } from 'lucide-react';
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
  { id: 'others', label: 'Other Purpose', icon: MoreHorizontal },
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
        purpose: purpose,
        loginMethod: visitor.loginMethod,
        timestamp: Timestamp.now(),
      });
      router.push('/kiosk/welcome');
    } catch (err: any) {
      toast({
        title: "Logging Failed",
        description: err.message || "Could not save your visit.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (!visitor) return null;

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-float" />
      
      <div className="absolute top-8 left-8">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/')}
          className="text-white hover:bg-white/10 gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          Cancel
        </Button>
      </div>

      <div className="max-w-5xl w-full space-y-12 text-center z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="space-y-4">
          <h2 className="text-6xl font-black text-white drop-shadow-lg">Purpose of Visit</h2>
          <p className="text-2xl text-blue-200/80 font-medium">
            What brings you to the library today, <span className="text-blue-400">{visitor.fullName.split(' ')[0]}</span>?
          </p>
        </div>

        {isSubmitting ? (
          <div className="py-20 flex flex-col items-center gap-6 glass rounded-3xl p-12">
            <Loader2 className="h-20 w-20 animate-spin text-blue-400" />
            <p className="text-2xl font-bold text-white">Recording your visit...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
            {PURPOSES.map((item) => (
              <Card 
                key={item.id}
                className="group cursor-pointer glass-dark border-white/5 hover:bg-blue-600/20 hover:border-blue-500/50 hover:scale-105 active:scale-95 transition-all duration-300 rounded-[2rem] overflow-hidden"
                onClick={() => handleSelect(item.label)}
              >
                <CardContent className="flex flex-col items-center justify-center p-14 gap-8">
                  <div className="p-6 rounded-3xl bg-white/5 group-hover:bg-blue-500 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all duration-300">
                    <item.icon className="h-16 w-16 text-blue-300 group-hover:text-white transition-colors" strokeWidth={1.5} />
                  </div>
                  <span className="text-2xl font-black text-white tracking-tight">{item.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Progress Bar Timer */}
      <div className="fixed bottom-0 left-0 w-full h-2 bg-white/5">
        <div 
          className="h-full bg-blue-500 transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(59,130,246,0.8)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
