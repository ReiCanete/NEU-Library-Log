"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, User, Megaphone, Info, ShieldX } from 'lucide-react';
import { useAuth, useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, limit, getDocs, doc, orderBy } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startOfDay } from 'date-fns';
import { validateStudentId, validateNEUEmail } from '@/lib/validation';
import { getErrorMessage, logAppError } from '@/lib/errorMessages';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function KioskEntryContent() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'user' | 'admin'>('user');
  const [blockedData, setBlockedData] = useState<{reason?: string} | null>(null);

  const todayDate = useMemo(() => startOfDay(new Date()), []);

  const visitsQuery = useMemo(() => {
    if (!todayDate || !db) return null;
    return query(collection(db, 'visits'), where('timestamp', '>=', todayDate));
  }, [todayDate, db]);

  const { data: todayVisits } = useCollection(visitsQuery);
  const settingsRef = useMemo(() => (db ? doc(db, 'settings', 'library') : null), [db]);
  const { data: settings } = useDoc(settingsRef);
  
  const announcementsQuery = useMemo(() => {
    if (!db) return null;
    return query(
      collection(db, 'announcements'), 
      where('isActive', '==', true),
      orderBy('startDate', 'desc')
    );
  }, [db]);
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
    if (loginMode === 'admin') {
      router.push('/admin/login');
    }
  }, [loginMode, router]);

  useEffect(() => {
    const handleRedirect = async () => {
      if (!auth || !db) return;
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;
          if (!validateNEUEmail(user.email || '')) {
            setError("Only NEU accounts (@neu.edu.ph) are allowed.");
            await signOut(auth);
            setLoading(false); 
            return;
          }
          const cleanId = user.email!.split('@')[0];
          const blockSnap = await getDocs(query(collection(db, 'blocklist'), where('studentId', '==', cleanId), limit(1)));
          if (!blockSnap.empty) {
            setBlockedData(blockSnap.docs[0].data());
            await signOut(auth); 
            setLoading(false); 
            return;
          }
          sessionStorage.setItem('kiosk_visitor', JSON.stringify({ 
            studentId: cleanId, 
            fullName: user.displayName, 
            college: 'Institutional Account', 
            loginMethod: 'google' 
          }));
          router.push('/kiosk/purpose'); 
          return;
        }
      } catch (err: any) { 
        if (err.code !== 'auth/popup-closed-by-user') {
          logAppError('KioskEntry', 'RedirectResult', err);
          toast({ title: "Sign-in Error", description: getErrorMessage(err), variant: "destructive" });
        }
      } finally {
        setLoading(false);
      }
    };
    handleRedirect();
  }, [router, toast, auth, db]);

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
      setError("Connection error. Please try again.");
      setLoading(false); 
    }
  };

  if (blockedData) {
    return (
      <div className="h-screen bg-[#0a2a1a] flex flex-col items-center justify-center p-8 text-center text-white z-[200]">
        <div className="bg-red-500/10 p-10 rounded-[3rem] border-2 border-red-500/30 flex flex-col items-center max-w-md">
          <ShieldX className="h-20 w-20 text-red-500 mb-6" />
          <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter leading-none">Access Restricted</h2>
          <p className="text-[#c9a227] font-bold mb-6 text-[10px] uppercase tracking-widest">Entry denied for this ID</p>
          <div className="bg-black/30 p-6 rounded-2xl w-full text-left mb-8 border border-white/10">
            <p className="text-white/40 text-[8px] font-black uppercase tracking-widest mb-1">Reason</p>
            <p className="font-bold text-sm italic">{blockedData.reason || 'Safety/Policy Violation'}</p>
          </div>
          <Button onClick={() => setBlockedData(null)} className="w-full h-14 bg-white text-[#0a2a1a] font-black rounded-xl hover:bg-white/90">Return</Button>
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
        </div>
      )}

      <div className="absolute top-12 right-6 z-50">
        <Tabs value={loginMode} onValueChange={(v) => setLoginMode(v as any)} className="w-[160px]">
          <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-[#c9a227]/30 h-9 p-1 rounded-xl">
            <TabsTrigger value="user" className="data-[state=active]:bg-[#c9a227] data-[state=active]:text-[#0a2a1a] font-black text-[9px] rounded-lg">Kiosk</TabsTrigger>
            <TabsTrigger value="admin" className="data-[state=active]:bg-[#c9a227] data-[state=active]:text-[#0a2a1a] font-black text-[9px] rounded-lg">Staff</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="max-w-md w-full flex flex-col items-center gap-6 z-10 animate-in fade-in duration-700">
        <div className="flex flex-col items-center gap-4">
          <img src="/neu-logo.png" alt="NEU Logo" width={80} height={80} className="rounded-full shadow-2xl border-2 border-[#c9a227]/30" />
          <div className="text-center space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-[#c9a227] drop-shadow-2xl leading-none">NEU Library</h1>
            <p className="text-[9px] text-white/50 font-black uppercase tracking-[0.3em]">Institutional Digital Log</p>
          </div>
        </div>

        {isAtCapacity ? (
          <Card className="bg-[#0a2a1a]/60 backdrop-blur-2xl w-full border-2 border-red-500/50 rounded-[2.5rem] p-10 text-center space-y-6">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Full Capacity</h2>
            <p className="text-white/60 text-xs font-bold leading-relaxed">The library has reached its maximum capacity ({dailyCapacity}).</p>
            <Button className="w-full h-12 rounded-xl bg-white/10 text-white font-black uppercase text-[10px]" onClick={() => window.location.reload()}>Retry</Button>
          </Card>
        ) : (
          <Card className="bg-[#0a2a1a]/40 backdrop-blur-2xl w-full border-none ring-1 ring-[#c9a227]/30 rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="bg-[#c9a227]/10 p-3 border-b border-[#c9a227]/20 flex justify-between items-center px-6">
               <span className="text-[8px] font-black text-[#c9a227] uppercase tracking-widest">Visitors Today</span>
               <span className="text-[8px] font-black text-white uppercase tabular-nums">{currentCount} / {dailyCapacity}</span>
            </div>
            <CardContent className="p-8 space-y-6">
              <form onSubmit={handleIdSubmit} className="space-y-6">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] ml-2">School ID Entry</Label>
                   <Input 
                    ref={inputRef} 
                    placeholder="e.g. 25-12946-343" 
                    className={`h-16 text-3xl text-center font-mono bg-black/30 border-[#c9a227]/20 text-white rounded-2xl focus:border-[#c9a227] ${error ? 'border-red-500' : ''}`} 
                    value={studentId} 
                    onChange={(e) => { setStudentId(e.target.value); setError(null); }} 
                    disabled={loading} 
                    autoFocus 
                  />
                  {error && <p className="text-red-400 text-[9px] font-black uppercase tracking-widest text-center mt-2">{error}</p>}
                </div>
                <Button className="w-full h-16 text-xl font-black rounded-2xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-2xl transition-all" disabled={loading} type="submit">
                  {loading && studentId.trim() ? "Verifying..." : "Continue with ID"}
                </Button>
              </form>
              <div className="relative flex items-center gap-4 py-1"><div className="flex-grow border-t border-white/5"></div><span className="text-white/20 text-[8px] font-black tracking-widest uppercase">OR</span><div className="flex-grow border-t border-white/5"></div></div>
              <Button 
                variant="outline" 
                className="w-full h-12 text-[10px] font-black border-white/10 bg-white text-[#0a2a1a] hover:bg-white/90 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3" 
                onClick={() => { if (!auth) return; setLoading(true); signInWithRedirect(auth, new GoogleAuthProvider().setCustomParameters({ hd: 'neu.edu.ph' })); }} 
                disabled={loading}
              >
                Institutional Google Access
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
