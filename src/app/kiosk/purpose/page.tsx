"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KioskLayout } from '@/components/kiosk/kiosk-layout';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Search, Monitor, Users, MoreHorizontal, GraduationCap } from 'lucide-react';
import { firebaseService } from '@/lib/firebase-mock';

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
  const [visitor, setVisitor] = useState<any>(null);

  useEffect(() => {
    const data = sessionStorage.getItem('kiosk_visitor');
    if (!data) {
      router.push('/');
      return;
    }
    setVisitor(JSON.parse(data));
  }, [router]);

  const handleSelect = async (purpose: string) => {
    if (!visitor) return;

    try {
      await firebaseService.logVisit({
        studentId: visitor.studentId,
        fullName: visitor.fullName,
        college: visitor.college,
        purpose: purpose,
        loginMethod: visitor.loginMethod,
      });
      router.push('/kiosk/welcome');
    } catch (err) {
      console.error(err);
    }
  };

  if (!visitor) return null;

  return (
    <KioskLayout>
      <div className="space-y-10 text-center">
        <div className="space-y-4">
          <h2 className="text-5xl font-bold text-primary">Purpose of Visit</h2>
          <p className="text-2xl text-muted-foreground">What brings you to the library today, {visitor.fullName.split(' ')[0]}?</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {PURPOSES.map((item) => (
            <Card 
              key={item.id}
              className="cursor-pointer hover:bg-slate-50 transition-all hover:scale-105 active:scale-95 border-2 hover:border-primary shadow-lg"
              onClick={() => handleSelect(item.label)}
            >
              <CardContent className="flex flex-col items-center justify-center p-12 gap-6">
                <item.icon className="h-20 w-20 text-primary" strokeWidth={1.5} />
                <span className="text-2xl font-bold text-slate-800">{item.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </KioskLayout>
  );
}
