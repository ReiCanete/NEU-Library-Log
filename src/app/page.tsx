"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, ShieldCheck, User, Megaphone, Info } from 'lucide-react';
import { auth, db } from '@/firebase/config';
import { collection, query, where, limit, getDocs, doc, orderBy } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useDoc } from '@/firebase';
import { format, startOfDay } from 'date-fns';

export default function KioskEntry() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'user' | 'admin'>('user');

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
          if (!user.email?.endsWith('@neu.edu.ph')) {
            setError("Unauthorized: Only @neu.edu.ph accounts are allowed.");
            await signOut(auth);
            setLoading(false); return;
          }
          const cleanId = user.email.split('@')[0];
          const blockSnap = await getDocs(query(collection(db, 'blocklist'), where('studentId', '==', cleanId), limit(1)));
          if (!blockSnap.empty) {
            setError(`Entry Restricted: ${blockSnap.docs[0].data().reason}`);
            await signOut(auth); setLoading(false); return;
          }
          sessionStorage.setItem('kiosk_visitor', JSON.stringify({ studentId: cleanId, fullName: user.displayName, college: 'Institutional Google Account', loginMethod: 'google' }));
          router.push('/kiosk/purpose'); return;
        }
        setLoading(false);
      } catch (err: any) { setError(err.message); setLoading(false); }
    };
    handleRedirect();
  }, [router]);

  useEffect(() => {
    if (loginMode === 'admin') {
      router.push('/admin/login');
    }
  }, [loginMode, router]);

  const handleIdSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!studentId.trim() || loading || isAtCapacity) return;
    setLoading(true); setError(null);
    const cleanId = studentId.trim();
    try {
      const blockSnap = await getDocs(query(collection(db, 'blocklist'), where('studentId', '==', cleanId), limit(1)));
      if (!blockSnap.empty) {
        setError(`Entry Denied: ${blockSnap.docs[0].data().reason}`);
        setStudentId(''); setLoading(false); return;
      }
      const userSnap = await getDocs(query(collection(db, 'users'), where('studentId', '==', cleanId), limit(1)));
      if (!userSnap.empty) {
        const d = userSnap.docs[0].data();
        sessionStorage.setItem('kiosk_visitor', JSON.stringify({ studentId: d.studentId, fullName: d.displayName, college: d.college, program: d.program, loginMethod: 'id' }));
        router.push('/kiosk/purpose');
      } else { router.push(`/kiosk/register?id=${encodeURIComponent(cleanId)}`); }
    } catch (err: any) { setError(err.message); setLoading(false); }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-[#0a2a1a] to-[#0d3d24] flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {latestAnnouncement && (
        <div className={`fixed top-0 left-0 w-full z-[100] p-4 flex items-center justify-center gap-4 transition-all ${latestAnnouncement.priority === 'urgent' ? 'bg-red-600 text-white animate-pulse' : 'bg-[#c9a227] text-[#0a2a1a]'} font-black uppercase text-sm tracking-widest shadow-2xl`}>
          <Megaphone className="h-6 w-6" />
          {latestAnnouncement.message}
          <Info className="h-5 w-5 opacity-50" />
        </div>
      )}

      <div className="absolute top-12 right-6 z-50">
        <Tabs value={loginMode} onValueChange={(v) => setLoginMode(v as any)} className="w-[180px]">
          <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-[#c9a227]/30 backdrop-blur-xl h-10 p-1 rounded-xl">
            <TabsTrigger value="user" className="data-[state=active]:bg-[#c9a227] data-[state=active]:text-[#0a2a1a] font-black text-[10px] rounded-lg">Kiosk</TabsTrigger>
            <TabsTrigger value="admin" className="data-[state=active]:bg-[#c9a227] data-[state=active]:text-[#0a2a1a] font-black text-[10px] rounded-lg">Staff</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="max-w-md w-full flex flex-col items-center gap-8 z-10 animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center gap-6">
          <img src="/neu-logo.png" alt="NEU Logo" width={80} height={80} className="rounded-full shadow-2xl border-2 border-[#c9a227]/30" />
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-black tracking-tight text-[#c9a227] drop-shadow-2xl">NEU Library</h1>
            <p className="text-[10px] text-white/50 font-black uppercase tracking-[0.3em]">Institutional Digital Log</p>
          </div>
        </div>

        {isAtCapacity ? (
          <Card className="bg-[#0a2a1a]/60 backdrop-blur-2xl w-full border-2 border-red-500/50 rounded-[2.5rem] shadow-2xl p-12 text-center space-y-8 animate-pulse">
            <div className="h-24 w-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center mx-auto border border-red-500/30">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Library at Full Capacity</h2>
              <p className="text-white/60 font-bold leading-relaxed">The library has reached its maximum capacity for today ({dailyCapacity}). Please come back tomorrow or contact library staff.</p>
            </div>
            <Button className="w-full h-14 rounded-2xl bg-white/10 text-white font-black uppercase text-xs hover:bg-white/20" onClick={() => window.location.reload()}>Retry Check</Button>
          </Card>
        ) : (
          <Card className="bg-[#0a2a1a]/40 backdrop-blur-2xl w-full border-none ring-1 ring-[#c9a227]/30 rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="bg-[#c9a227]/10 p-4 border-b border-[#c9a227]/20 flex justify-between items-center">
               <span className="text-[9px] font-black text-[#c9a227] uppercase tracking-widest">Entry Availability</span>
               <span className="text-[9px] font-black text-white uppercase tabular-nums">{currentCount} / {dailyCapacity} Visitors Today</span>
            </div>
            <CardContent className="p-8 space-y-6">
              <form onSubmit={handleIdSubmit} className="space-y-6">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] ml-2">School ID Entry</Label>
                   <Input ref={inputRef} placeholder="e.g. 25-12946-343" className="h-16 text-3xl text-center font-mono bg-black/30 border-[#c9a227]/20 text-white rounded-2xl focus:ring-4 focus:ring-[#c9a227]/10 focus:border-[#c9a227] transition-all" value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={loading} autoFocus />
                </div>
                <Button className="w-full h-16 text-xl font-black rounded-2xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-2xl transition-all" disabled={loading || !studentId.trim()} type="submit">
                  {loading && studentId.trim() ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : "Continue with ID"}
                </Button>
              </form>
              <div className="relative flex items-center gap-4 py-2"><div className="flex-grow border-t border-white/5"></div><span className="text-white/20 text-[9px] font-black tracking-widest uppercase">OR</span><div className="flex-grow border-t border-white/5"></div></div>
              <Button variant="outline" className="w-full h-14 text-xs font-black border-white/10 bg-white text-[#0a2a1a] hover:bg-white/90 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3" onClick={() => signInWithRedirect(auth, new GoogleAuthProvider().setCustomParameters({ hd: 'neu.edu.ph' }))} disabled={loading}>
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                Institutional Google Access
              </Button>
              {error && <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200 rounded-2xl py-3"><AlertCircle className="h-4 w-4" /><AlertDescription className="text-[10px] font-black">{error}</AlertDescription></Alert>}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
