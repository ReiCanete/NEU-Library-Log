"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, ShieldX, Mail, CreditCard } from 'lucide-react';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, limit, getDocs, doc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { startOfDay } from 'date-fns';
import { validateStudentId, validateNEUEmail } from '@/lib/validation';
import { logAppError } from '@/lib/errorMessages';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useToast } from '@/hooks/use-toast';
import AnnouncementTicker from '@/components/kiosk/AnnouncementTicker';

function KioskEntryContent() {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [studentId, setStudentId] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'user' | 'admin'>('user');
  const [blockedData, setBlockedData] = useState<{reason?: string} | null>(null);
  const [mounted, setMounted] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const todayDate = useMemo(() => startOfDay(new Date()), []);
  const visitsQuery = useMemo(() => (db ? query(collection(db, 'visits'), where('timestamp', '>=', todayDate)) : null), [db, todayDate]);
  const { data: todayVisits } = useCollection(visitsQuery);
  const settingsRef = useMemo(() => (db ? doc(db, 'settings', 'library') : null), [db]);
  const { data: settings } = useDoc(settingsRef);

  const dailyCapacity = settings?.dailyCapacity || 200;
  const currentCount = todayVisits?.length || 0;
  const isAtCapacity = currentCount >= dailyCapacity;

  const switchMode = (newMode: 'user' | 'admin') => {
    if (newMode === loginMode) return;
    setTransitioning(true);
    setTimeout(() => {
      if (newMode === 'admin') {
        router.push('/admin/login');
      } else {
        setLoginMode(newMode);
      }
      setTransitioning(false);
    }, 100);
  };

  const handleIdSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading || isAtCapacity || !db) return;

    if (!studentId.trim()) {
      setError("Please enter your School ID.");
      inputRef.current?.focus();
      return;
    }

    if (!validateStudentId(studentId)) {
      setError("Invalid ID format (XX-XXXXX-XXX).");
      return;
    }

    setLoading(true);
    setError(null);
    const cleanId = studentId.trim();

    try {
      const blockSnap = await getDocs(query(collection(db, 'blocklist'), where('studentId', '==', cleanId), limit(1)));
      if (!blockSnap.empty) {
        setBlockedData(blockSnap.docs[0].data());
        setLoading(false);
        return;
      }

      const userSnap = await getDocs(query(collection(db, 'users'), where('studentId', '==', cleanId), limit(1)));
      if (!userSnap.empty) {
        const d = userSnap.docs[0].data();
        sessionStorage.setItem('kiosk_visitor', JSON.stringify({ 
          studentId: d.studentId, 
          fullName: d.displayName || d.fullName, 
          college: d.college, 
          program: d.program, 
          email: d.email || '',
          visitorType: d.visitorType || 'Student',
          loginMethod: 'id' 
        }));
        router.push('/kiosk/purpose');
      } else { 
        router.push(`/kiosk/register?id=${encodeURIComponent(cleanId)}`); 
      }
    } catch (err: any) { 
      logAppError('KioskEntry', 'IdSubmit', err);
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading || isAtCapacity || !db) return;

    if (!emailInput.trim()) {
      setError("Please enter your NEU email.");
      return;
    }

    if (!validateNEUEmail(emailInput.trim())) {
      setError("Invalid email. Must end with @neu.edu.ph");
      return;
    }

    setLoading(true);
    setError(null);
    const cleanEmail = emailInput.trim().toLowerCase();

    try {
      const blockSnap = await getDocs(query(collection(db, 'blocklist'), where('studentId', '==', cleanEmail), limit(1)));
      if (!blockSnap.empty) {
        setBlockedData(blockSnap.docs[0].data());
        setLoading(false);
        return;
      }

      const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1)));
      if (!userSnap.empty) {
        const d = userSnap.docs[0].data();
        sessionStorage.setItem('kiosk_visitor', JSON.stringify({ 
          studentId: d.studentId, 
          fullName: d.displayName || d.fullName, 
          college: d.college, 
          program: d.program, 
          email: d.email,
          visitorType: d.visitorType || 'Student',
          loginMethod: 'email' 
        }));
        toast({ title: `Welcome back, ${d.fullName.split(' ')[0]}!`, description: "Redirecting to selection...", className: "bg-[#1a3a2a] text-white border-[#c9a227]" });
        setTimeout(() => router.push('/kiosk/purpose'), 1500);
      } else { 
        router.push(`/kiosk/register?method=email&email=${encodeURIComponent(cleanEmail)}`); 
      }
    } catch (err: any) { 
      logAppError('KioskEntry', 'EmailSubmit', err);
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  };

  if (!mounted) return null;

  if (blockedData) {
    return (
      <div className="h-screen bg-[#0a2a1a] flex flex-col items-center justify-center p-8 text-center text-white z-[200]">
        <div className="bg-red-500/10 p-10 rounded-[3rem] border-2 border-red-500/30 flex flex-col items-center max-w-md animate-in zoom-in duration-300">
          <ShieldX className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-black mb-2 uppercase tracking-tighter">Access Restricted</h2>
          <div className="bg-black/30 p-6 rounded-2xl w-full text-left mb-6 border border-white/10">
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Reason</p>
            <p className="font-bold text-sm italic">{blockedData.reason || 'Safety/Policy Violation'}</p>
          </div>
          <Button onClick={() => setBlockedData(null)} className="w-full h-12 bg-white text-[#0a2a1a] font-black rounded-xl">Return</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#0a2a1a] to-[#0d3d24]">
      <AnnouncementTicker />
      
      {/* Mode Toggle - Absolute positioned so it doesn't affect centering */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-[#0d3d24]/80 backdrop-blur-sm border border-[#c9a227]/20 rounded-full p-1">
        <button 
          onClick={() => switchMode('user')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-100 ${
            loginMode === 'user' 
              ? 'bg-[#c9a227] text-[#0a2a1a] font-bold shadow-sm' 
              : 'text-white/60 hover:text-white'
          }`}
          suppressHydrationWarning
        >
          Kiosk
        </button>
        <button 
          onClick={() => switchMode('admin')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-100 ${
            loginMode === 'admin' 
              ? 'bg-[#c9a227] text-[#0a2a1a] font-bold shadow-sm' 
              : 'text-white/60 hover:text-white'
          }`}
          suppressHydrationWarning
        >
          Staff
        </button>
      </div>

      {/* Main Content Area - Center of the remaining space */}
      <div className={`flex-1 flex flex-col items-center justify-center px-4 py-6 transition-opacity duration-100 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>
        <img src="/neu-logo.png" alt="NEU Logo" className="w-20 h-20 rounded-full mb-3 shadow-2xl border-2 border-[#c9a227]/30" />
        
        <h1 className="text-4xl font-bold text-[#c9a227] text-center drop-shadow-2xl uppercase">NEU LIBRARY</h1>
        <p className="text-xs tracking-widest text-white/50 uppercase mt-1 mb-6">Digital Visitor Log</p>

        <div className="w-full max-w-[480px]">
          {isAtCapacity ? (
            <Card className="bg-[#0a2a1a]/60 backdrop-blur-2xl w-full border-2 border-red-500/50 rounded-[2rem] p-8 text-center space-y-4">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Full Capacity</h2>
              <p className="text-white/60 text-xs font-bold">The library is at maximum capacity ({dailyCapacity}).</p>
              <Button className="w-full h-12 rounded-xl bg-white/10 text-white font-black" onClick={() => window.location.reload()}>Retry</Button>
            </Card>
          ) : (
            <Card className="bg-[#0a2a1a]/40 backdrop-blur-2xl w-full border-none ring-1 ring-[#c9a227]/30 rounded-[2rem] shadow-2xl overflow-hidden">
              <div className="bg-[#c9a227]/10 p-3 border-b border-[#c9a227]/20 flex justify-between items-center px-8">
                <span className="text-[9px] font-black text-[#c9a227] uppercase tracking-widest">Entry Count</span>
                <span className="text-[9px] font-black text-white uppercase tabular-nums">{currentCount} / {dailyCapacity}</span>
              </div>
              <CardContent className="p-8 space-y-6">
                <form onSubmit={handleIdSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] ml-2 flex items-center gap-2">
                      <CreditCard className="h-3 w-3" /> School ID Entry
                    </Label>
                    <Input 
                      ref={inputRef} 
                      placeholder="e.g. 25-12946-343" 
                      className={`h-14 text-2xl text-center font-mono bg-black/30 border-[#c9a227]/20 text-white rounded-xl focus:border-[#c9a227] ${error ? 'border-red-500' : ''}`} 
                      value={studentId} 
                      onChange={(e) => { setStudentId(e.target.value); setError(null); }} 
                      disabled={loading} 
                      suppressHydrationWarning
                    />
                  </div>
                  <Button className="w-full h-12 text-sm font-black rounded-xl bg-[#c9a227] text-[#0a2a1a] hover:opacity-90 shadow-lg" disabled={loading} type="submit" suppressHydrationWarning>
                    {loading && studentId.trim() ? <Loader2 className="animate-spin h-4 w-4" /> : "Continue with ID"}
                  </Button>
                </form>

                <div className="relative flex items-center gap-3 py-1">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="text-white/20 text-[8px] font-black uppercase tracking-widest">OR</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] ml-2 flex items-center gap-2">
                      <Mail className="h-3 w-3" /> Institutional Email
                    </Label>
                    <Input 
                      type="email"
                      placeholder="e.g. juan@neu.edu.ph" 
                      className={`h-14 text-lg text-center font-bold bg-black/30 border-[#c9a227]/20 text-white rounded-xl focus:border-[#c9a227] ${error ? 'border-red-500' : ''}`} 
                      value={emailInput} 
                      onChange={(e) => { setEmailInput(e.target.value); setError(null); }} 
                      disabled={loading} 
                      suppressHydrationWarning
                    />
                  </div>
                  {error && <p className="text-red-400 text-[9px] font-black uppercase tracking-widest text-center mt-2">{error}</p>}
                  <Button className="w-full h-12 text-sm font-black rounded-xl border-2 border-[#c9a227] bg-transparent text-[#c9a227] hover:bg-[#c9a227] hover:text-[#0a2a1a] shadow-lg transition-all" disabled={loading} type="submit" suppressHydrationWarning>
                    {loading && emailInput.trim() ? <Loader2 className="animate-spin h-4 w-4" /> : "Continue with Email"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KioskEntry() {
  return (
    <ErrorBoundary fallbackType="kiosk">
      <title>NEU Library Log — Visitor Entry</title>
      <KioskEntryContent />
    </ErrorBoundary>
  );
}