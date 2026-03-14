"use client";

import { useState, Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KioskLayout } from '@/components/kiosk/kiosk-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db as firestore } from '@/firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const studentId = searchParams.get('id') || '';
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  const [fullName, setFullName] = useState('');
  const [college, setCollege] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !college) return;

    setLoading(true);
    try {
      const userId = `std_${studentId.replace(/[^a-zA-Z0-9]/g, '')}`;
      await setDoc(doc(firestore, 'users', userId), {
        uid: userId,
        displayName: fullName,
        college: college,
        studentId: studentId,
        role: 'user',
        blocked: false
      });

      sessionStorage.setItem('kiosk_visitor', JSON.stringify({
        studentId: studentId,
        fullName: fullName,
        college: college,
        loginMethod: 'id'
      }));
      router.push('/kiosk/purpose');
    } catch (err: any) {
      toast({
        title: "Registration Failed",
        description: err.message || "Could not register your profile. Please check with staff.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 text-center max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-2">
        <h2 className="text-4xl font-bold text-primary">First-Time Registration</h2>
        <p className="text-xl text-muted-foreground">Please tell us a bit about yourself</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-left bg-white p-8 rounded-xl shadow-lg">
        <div className="space-y-2">
          <Label htmlFor="id" className="text-lg">School ID</Label>
          <Input id="id" value={studentId} readOnly className="bg-slate-50 h-14 text-xl font-mono" suppressHydrationWarning />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-lg">Full Name</Label>
          <Input 
            ref={nameInputRef}
            id="name" 
            placeholder="Juan Dela Cruz" 
            className="h-14 text-xl"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            suppressHydrationWarning
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="college" className="text-lg">College / Office</Label>
          <Select onValueChange={setCollege} required>
            <SelectTrigger className="h-14 text-xl">
              <SelectValue placeholder="Select College/Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CAS">College of Arts and Sciences</SelectItem>
              <SelectItem value="CED">College of Education</SelectItem>
              <SelectItem value="CBA">College of Business Administration</SelectItem>
              <SelectItem value="COE">College of Engineering</SelectItem>
              <SelectItem value="CS">College of Criminology</SelectItem>
              <SelectItem value="CIT">College of Information Technology</SelectItem>
              <SelectItem value="NURSING">College of Nursing</SelectItem>
              <SelectItem value="GS">Graduate School</SelectItem>
              <SelectItem value="FACULTY">Faculty / Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button className="w-full h-16 text-xl mt-4" disabled={loading} suppressHydrationWarning>
          {loading ? "Registering..." : "Complete Registration"}
        </Button>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <KioskLayout>
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>}>
        <RegisterForm />
      </Suspense>
    </KioskLayout>
  );
}
