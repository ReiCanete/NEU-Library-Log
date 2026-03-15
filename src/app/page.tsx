"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Megaphone, ShieldX } from 'lucide-react';
import { useAuth, useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, limit, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { getRedirectResult, GoogleAuthProvider, signInWithRedirect, signOut } from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startOfDay } from 'date-fns';
import { validateStudentId } from '@/lib/validation';
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

  const [activeAnnouncements, setActiveAnnouncements] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const todayDate = useMemo(() => startOfDay(new Date()), []);
  const visitsQuery = useMemo(() => (db ? query(collection(db, 'visits'), where('timestamp', '>=', todayDate)) : null), [db, todayDate]);
  const { data: todayVisits } = useCollection(visitsQuery);
  const settingsRef = useMemo(() => (db ? doc(db, 'settings', 'library') : null), [db]);
  const { data: settings } = useDoc(settingsRef);

  const dailyCapacity = settings?.dailyCapacity || 200;
  const currentCount = todayVisits?.length || 0;
  const isAtCapacity = currentCount >= dailyCapacity;

  // Real-time Announcements Listener
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const docs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((a: any) => {
          const start = (a.startDate as any)?.toDate ? a.startDate.toDate() : new Date(a.startDate);
          const end = (a.endDate as any)?.toDate ? a.endDate.toDate() : new Date(a.endDate);
          return start <= now && end >= now;
        });
      setActiveAnnouncements(docs);
      setCurrentIndex(0);
    });

    return () => unsubscribe();
  }, []);

  // Cycle Announcements
  useEffect(() => {
    if (activeAnnouncements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeAnnouncements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeAnnouncements]);

  // Handle Google Redirect Result on Mount
  useEffect(() => {
    const handleGoogleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!result?.user) {
          setLoading(false);
          return;
        }
        
        const user = result.user;
        
        // 1. Check domain
        if (!user.email?.endsWith('@neu.edu.ph')) {
          await signOut(auth);
          setError('Only @neu.edu.ph Google accounts are allowed.');
          setLoading(false);
          return;
        }
        
        // 2. Check blocklist
        const blockSnap = await getDocs(
          query(collection(db, 'blocklist'), where('studentId', '==', user.email))
        );
        if (!blockSnap.empty) {
          await signOut(auth);
          setError('Your account has been restricted. Please contact library staff.');
          setLoading(false);
          return;
        }
        
        // 3. Check if user exists in users collection
        const userSnap = await getDocs(
          query(collection(db, 'users'), where('email', '==', user.email))
        );
        
        if (userSnap.empty) {
          // First time — go to registration
          sessionStorage.setItem('kiosk_visitor', JSON.stringify({
            studentId: user.email,
            fullName: user.displayName || '',
            email: user.email,
            loginMethod: 'google',
            isNew: true
          }));
          router.push('/kiosk/register?id=' + encodeURIComponent(user.email));
        } else {
          // Existing user — go to purpose selection
          const userData = userSnap.docs[0].data();
          sessionStorage.setItem('kiosk_visitor', JSON.stringify({
            studentId: userData.studentId || user.email,
            fullName: userData.fullName || userData.displayName,
            college: userData.college || userData.College || '',
            email: user.email,
            loginMethod: 'google'
          }));
          router.push('/kiosk/purpose');
        }
      } catch (err: any) {
        if (err.code !== 'auth/popup-closed-by-user') {
          console.error('[NEU Library Log] Google redirect error:', err);
          setError('Sign-in failed. Please try again.');
        }
        setLoading(false);
      }
    };
    
    handleGoogleRedirect();
  }, [router]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ hd: 'neu.edu.ph' });
      await signInWithRedirect(auth, provider);
    } catch (err) {
      console.error('Google sign-in error:', err);
      setLoading(false);
    }
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
    <div className="h-screen overflow-hidden bg-gradient-to-br from-[#0a2a1a] to-[#0d3d24] flex flex-col relative">
      <div className="w-full h-[48px] shrink-0">
        {activeAnnouncements[currentIndex] && (
          <div className={`w-full py-2 px-6 flex items-center justify-center gap-3 transition-all duration-1000 animate-in slide-in-from-top ${
            activeAnnouncements[currentIndex].priority === 'urgent' 
              ? 'bg-[#dc2626] text-white animate-pulse' 
              : 'bg-[#c9a227] text-[#0a2a1a]'
          } shadow-xl`}>
            <Megaphone className="h-4 w-4 shrink-0" />
            <p className="text-sm font-black uppercase tracking-widest text-center truncate max-w-4xl">
              {activeAnnouncements[currentIndex].priority === 'urgent' && "⚠ URGENT: "}{activeAnnouncements[currentIndex].message}
            </p>
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4 z-50">
        <Tabs value={loginMode} onValueChange={(v) => {
          if (v === 'admin') router.push('/admin/login');
          else setLoginMode(v as any);
        }} className="w-[160px]">
          <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-[#c9a227]/30 h-10 p-1 rounded-xl">
            <TabsTrigger value="user" className="data-[state=active]:bg-[#c9a227] data-[state=active]:text-[#0a2a1a] font-black text-xs">Kiosk</TabsTrigger>
            <TabsTrigger value="admin" className="data-[state=active]:bg-[#c9a227] data-[state=active]:text-[#0a2a1a] font-black text-xs">Staff</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <img src="/neu-logo.png" alt="NEU Logo" width={80} height={80} className="mx-auto rounded-full shadow-2xl border-2 border-[#c9a227]/30" loading="lazy" />
            <div className="space-y-1">
              <h1 className="text-4xl font-black tracking-tight text-[#c9a227] drop-shadow-2xl leading-none">NEU Library</h1>
              <p className="text-[10px] text-white/50 font-black uppercase tracking-[0.4em]">Digital Visitor Log</p>
            </div>
          </div>

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
                <form onSubmit={handleIdSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] ml-2">School ID Entry</Label>
                    <Input 
                      ref={inputRef} 
                      placeholder="e.g. 25-12946-343" 
                      className={`h-16 text-3xl text-center font-mono bg-black/30 border-[#c9a227]/20 text-white rounded-xl focus:border-[#c9a227] ${error ? 'border-red-500' : ''}`} 
                      value={studentId} 
                      onChange={(e) => { setStudentId(e.target.value); setError(null); }} 
                      disabled={loading} 
                      autoFocus 
                    />
                    {error && <p className="text-red-400 text-[10px] font-black uppercase tracking-widest text-center mt-2">{error}</p>}
                  </div>
                  <Button className="w-full h-14 text-xl font-black rounded-xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90" disabled={loading} type="submit">
                    {loading && studentId.trim() ? "Verifying..." : "Continue"}
                  </Button>
                </form>
                <div className="relative flex items-center gap-3">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="text-white/20 text-[8px] font-black uppercase tracking-widest">OR</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>
                
                <button 
                  onClick={handleGoogleSignIn} 
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-bold py-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all shadow-md active:scale-[0.98] text-xs"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google (@neu.edu.ph)
                </button>
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
