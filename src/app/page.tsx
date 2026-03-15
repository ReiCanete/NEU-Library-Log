"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, ShieldCheck, User, Megaphone, Info, ShieldX } from 'lucide-react';
import { auth, db } from '@/firebase/config';
import { collection, query, where, limit, getDocs, doc, orderBy } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useDoc } from '@/firebase';
import { format, startOfDay } from 'date-fns';
import { validateStudentId, validateNEUEmail } from '@/lib/validation';
import { getErrorMessage, logAppError } from '@/lib/errorMessages';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function KioskEntryContent() {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'user' | 'admin'>('user');
  const [blockedData, setBlockedData] = useState<{reason?: string} | null>(null);

  const [todayDate, setTodayDate] = useState<Date | null>(null);

  useEffect(() => {
    setTodayDate(startOfDay(new Date()));
  }, []);

  const visitsQuery = useMemo(() => {
    if (!todayDate) return null;
    return query(collection(db, 'visits'), where('timestamp', '>=', todayDate));
  }, [todayDate]);

  const { data: todayVisits } = useCollection(visitsQuery);
  const { data: settings } = useDoc(doc(db, 'settings', 'library'));
  
  const announcementsQuery = useMemo(() => query(
    collection(db, 'announcements'), 
    where('isActive', '==', true),
    orderBy('startDate', 'desc')
  ), []);
  const { data: activeAnnouncements } = useCollection(announcementsQuery);

  const dailyCapacity = settings?.dailyCapacity || 200;
  const currentCount = todayVisits?.length || 0;
  const isAtCapacity = currentCount >= dailyCapacity;

  const latestAnnouncement = useMemo(() => {
    if (!activeAnnouncements) return null;
    const now = new Date();
    return activeAnnouncements.find(a => 
      now >= a.startDate.toDate() && now <= a.endDate.toDate()
    );
  }, [activeAnnouncements]);

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;
          if (!validateNEUEmail(user.email || '')) {
            setError("Only NEU institutional email accounts (@neu.edu.ph) are allowed.");
            await signOut(auth);
            setLoading(false); return;
          }
          const cleanId = user.email!.split('@')[0];
          const blockSnap = await getDocs(query(collection(db, 'blocklist'), where('studentId', '==', cleanId), limit(1)));
          if (!blockSnap.empty) {
            setBlockedData(blockSnap.docs[0].data());
            await signOut(auth); setLoading(false); return;
          }
          sessionStorage.setItem('kiosk_visitor', JSON.stringify({ 
            studentId: cleanId, 
            fullName: user.displayName, 
            college: 'Institutional Google Account', 
            loginMethod: 'google' 
          }));
          router.push('/kiosk/purpose'); return;
        }
        setLoading(false);
      } catch (err: any) { 
        if (err.code !== 'auth/popup-closed-by-user') {
          logAppError('KioskEntry', 'RedirectResult', err);
          toast({ title: "Sign-in Error", description: getErrorMessage(err), variant: "destructive" });
        }
        setLoading(false); 
      }
    };
    handleRedirect();
  }, [router, toast]);

  useEffect(() => {
    if (loginMode === 'admin') {
      router.push('/admin/login');
    }
  }, [loginMode, router]);

  const handleIdSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading || isAtCapacity) return;

    if (!studentId.trim()) {
      setError("Please enter your School ID to continue.");
      inputRef.current?.focus();
      return;
    }

    if (!validateStudentId(studentId)) {
      setError("Invalid ID format. Please check your School ID and try again.");
      return;
    }

    setLoading(true); 
    setError(null);
    const cleanId = studentId.trim();

    try {
      const blockSnap = await getDocs(query(collection(db, 'blocklist'), where('studentId', '==', cleanId), limit(1)));
      if (!blockSnap.empty) {
        setBlockedData(blockSnap.docs[0].data());
        setStudentId(''); 
        setLoading(false); 
        return;
      }

      const userSnap = await getDocs(query(collection(db, 'users'), where('studentId', '==', cleanId), limit(1)));
      if (!userSnap.empty) {
        const d = userSnap.docs[0].data();
        sessionStorage.setItem('kiosk_visitor', JSON.stringify({ 
          studentId: d.studentId, 
          fullName: d.displayName, 
          college: d.college, 
          program: d.program, 
          loginMethod: 'id' 
        }));
        router.push('/kiosk/purpose');
      } else { 
        router.push(`/kiosk/register?id=${encodeURIComponent(cleanId)}`); 
      }
    } catch (err: any) { 
      logAppError('KioskEntry', 'IdSubmit', err);
      setError("Unable to connect to the system. Please check your connection or contact library staff.");
      setLoading(false); 
    }
  };

  if (blockedData) {
    return (
      <div className="h-screen bg-[#0a2a1a] flex flex-col items-center justify-center p-8 text-center text-white z-[200]">
        <div className="bg-red-500/10 p-10 rounded-[3rem] border-2 border-red-500/30 flex flex-col items-center max-w-md animate-in zoom-in duration-500">
          <ShieldX className="h-20 w-20 text-red-500 mb-6" />
          <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter">Access Restricted</h2>
          <p className="text-[#c9a227] font-bold mb-6 text-[10px] uppercase tracking-widest">Entry denied for this ID</p>
          <div className="bg-black/30 p-6 rounded-2xl w-full text-left mb-8 border border-white/10">
            <p className="text-white/40 text-[8px] font-black uppercase tracking-widest mb-1">Reason</p>
            <p className="font-bold text-sm italic">{blockedData.reason || 'Safety/Policy Violation'}</p>
          </div>
          <p className="text-white/60 text-xs font-medium mb-10">Please contact the library administrator for assistance.</p>
          <Button 
            onClick={() => setBlockedData(null)} 
            className="w-full h-14 bg-white text-[#0a2a1a] font-black rounded-xl hover:bg-white/90"
          >
            Return to Entry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-[#0a2a1a] to-[#0d3d24] flex flex-col items-center justify-center p-4 relative">
      {latestAnnouncement && (
        <div className={`fixed top-0 left-0 w-full z-[100] p-3 flex items-center justify-center gap-4 transition-all ${latestAnnouncement.priority === 'urgent' ? 'bg-red-600 text-white animate-pulse' : 'bg-[#c9a227] text-[#0a2a1a]'} font-black uppercase text-[10px] tracking-widest shadow-2xl`}>
          <Megaphone className="h-4 w-4" />
          {latestAnnouncement.message}
          <Info className="h-4 w-4 opacity-50" />
        </div>
      )}

      <div className="absolute top-12 right-6 z-50">
        <Tabs value={loginMode} onValueChange={(v) => setLoginMode(v as any)} className="w-[160px]">
          <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-[#c9a227]/30 backdrop-blur-xl h-9 p-1 rounded-xl">
            <TabsTrigger value="user" className="data-[state=active]:bg-[#c9a227] data-[state=active]:text-[#0a2a1a] font-black text-[9px] rounded-lg">Kiosk</TabsTrigger>
            <TabsTrigger value="admin" className="data-[state=active]:bg-[#c9a227] data-[state=active]:text-[#0a2a1a] font-black text-[9px] rounded-lg">Staff</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="max-w-md w-full flex flex-col items-center gap-6 z-10 animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center gap-4">
          <img src="/neu-logo.png" alt="NEU Logo" width={80} height={80} className="rounded-full shadow-2xl border-2 border-[#c9a227]/30" />
          <div className="text-center space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-[#c9a227] drop-shadow-2xl">NEU Library</h1>
            <p className="text-[9px] text-white/50 font-black uppercase tracking-[0.3em]">Institutional Digital Log</p>
          </div>
        </div>

        {isAtCapacity ? (
          <Card className="bg-[#0a2a1a]/60 backdrop-blur-2xl w-full border-2 border-red-500/50 rounded-[2.5rem] shadow-2xl p-10 text-center space-y-6 animate-pulse">
            <div className="h-16 w-16 bg-red-500/10 rounded-[1.5rem] flex items-center justify-center mx-auto border border-red-500/30">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Library at Full Capacity</h2>
              <p className="text-white/60 text-xs font-bold leading-relaxed px-4">The library has reached its maximum capacity for today ({dailyCapacity}). Please come back tomorrow or contact library staff.</p>
            </div>
            <Button className="w-full h-12 rounded-xl bg-white/10 text-white font-black uppercase text-[10px] hover:bg-white/20" onClick={() => window.location.reload()}>Retry Check</Button>
          </Card>
        ) : (
          <Card className="bg-[#0a2a1a]/40 backdrop-blur-2xl w-full border-none ring-1 ring-[#c9a227]/30 rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="bg-[#c9a227]/10 p-3 border-b border-[#c9a227]/20 flex justify-between items-center px-6">
               <span className="text-[8px] font-black text-[#c9a227] uppercase tracking-widest">Entry Availability</span>
               <span className="text-[8px] font-black text-white uppercase tabular-nums">{currentCount} / {dailyCapacity} Visitors Today</span>
            </div>
            <CardContent className="p-8 space-y-6">
              <form onSubmit={handleIdSubmit} className="space-y-6">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] ml-2">School ID Entry</Label>
                   <Input 
                    ref={inputRef} 
                    placeholder="e.g. 25-12946-343" 
                    className={`h-16 text-3xl text-center font-mono bg-black/30 border-[#c9a227]/20 text-white rounded-2xl focus:ring-4 focus:ring-[#c9a227]/10 focus:border-[#c9a227] transition-all ${error ? 'border-red-500 focus:ring-red-500/20' : ''}`} 
                    value={studentId} 
                    onChange={(e) => {
                      setStudentId(e.target.value);
                      setError(null);
                    }} 
                    disabled={loading} 
                    autoFocus 
                  />
                  {error && (
                    <p className="text-red-400 text-[9px] font-black uppercase tracking-widest text-center mt-2 animate-in slide-in-from-top-1 duration-200">
                      {error}
                    </p>
                  )}
                </div>
                <Button className="w-full h-16 text-xl font-black rounded-2xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-2xl transition-all" disabled={loading} type="submit">
                  {loading && studentId.trim() ? (
                    <><Loader2 className="animate-spin mr-2 h-6 w-6" /> Verifying...</>
                  ) : (
                    "Continue with ID"
                  )}
                </Button>
              </form>
              <div className="relative flex items-center gap-4 py-1"><div className="flex-grow border-t border-white/5"></div><span className="text-white/20 text-[8px] font-black tracking-widest uppercase">OR</span><div className="flex-grow border-t border-white/5"></div></div>
              <Button 
                variant="outline" 
                className="w-full h-12 text-[10px] font-black border-white/10 bg-white text-[#0a2a1a] hover:bg-white/90 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3" 
                onClick={() => {
                  setLoading(true);
                  signInWithRedirect(auth, new GoogleAuthProvider().setCustomParameters({ hd: 'neu.edu.ph' }));
                }} 
                disabled={loading}
              >
                {loading && !studentId.trim() ? (
                  <><Loader2 className="animate-spin h-4 w-4" /> Connecting...</>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                    Institutional Google Access
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function KioskEntry() {
  return (
    <ErrorBoundary fallbackType="kiosk">
      <KioskEntryContent />
    </ErrorBoundary>
  );
}
