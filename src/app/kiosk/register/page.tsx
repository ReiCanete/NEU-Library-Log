"use client";

import { useState, Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, limit, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Check, ChevronDown, UserPlus, ArrowLeft, Lock, Sparkles, CheckCircle2 } from 'lucide-react';
import { validateFullName, validateStudentId } from '@/lib/validation';
import { logAppError } from '@/lib/errorMessages';
import { ScrollArea } from '@/components/ui/scroll-area';

const COLLEGES = [
  { name: "College of Accountancy", programs: ["BS Accountancy", "BS Accounting Information System"] },
  { name: "College of Agriculture", programs: ["BS Agriculture"] },
  { name: "College of Arts and Sciences", programs: ["BA Economics", "BA Political Science", "BS Biology", "BS Psychology", "BS Public Administration"] },
  { name: "College of Business Administration", programs: ["BS Business Administration Major in Financial Management", "BS Business Administration Major in Human Resource Development Management", "BS Business Administration Major in Legal Management", "BS Business Administration Major in Marketing Management", "BS Entrepreneurship", "BS Real Estate Management"] },
  { name: "College of Communication", programs: ["BA Broadcasting", "BA Communication", "BA Journalism"] },
  { name: "College of Informatics and Computing Studies", programs: ["BS Library and Information Science", "BS Computer Science", "BS Entertainment and Multimedia Computing (Digital Animation Technology)", "BS Entertainment and Multimedia Computing (Game Development)", "BS Information Technology", "BS Information System"] },
  { name: "College of Criminology", programs: ["BS Criminology"] },
  { name: "College of Education", programs: ["BS Elementary Education", "BS Elementary Education (Preschool Education)", "BS Elementary Education (Special Education)", "BS Secondary Education Major in Music Arts and Physical Education", "BS Secondary Education Major in English", "BS Secondary Education Major in Filipino", "BS Secondary Education Major in Mathematics", "BS Secondary Education Major in Science", "BS Secondary Education Major in Social Studies", "BS Secondary Education Major in Technology and Livelihood Education"] },
  { name: "College of Engineering and Architecture", programs: ["BS Architecture", "BS Astronomy", "BS Civil Engineering", "BS Electrical Engineering", "BS Electronics Engineering", "BS Industrial Engineering", "BS Mechanical Engineering"] },
  { name: "College of Medical Technology", programs: ["BS Medical Technology"] },
  { name: "College of Midwifery", programs: ["Diploma in Midwifery"] },
  { name: "College of Music", programs: ["BM Choral Conducting", "BM Music Education", "BM Piano", "BM Voice"] },
  { name: "College of Nursing", programs: ["BS Nursing"] },
  { name: "College of Physical Therapy", programs: ["BS Physical Therapy"] },
  { name: "College of Respiratory Therapy", programs: ["BS Respiratory Therapy"] },
  { name: "School of International Relations", programs: ["BA Foreign Service"] }
];

const NON_STUDENT_OPTIONS = ["Faculty", "Administrative Staff", "Library Staff", "Guest / Visitor"];

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const db = useFirestore();
  
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [email, setEmail] = useState('');
  const [loginMethod, setLoginMethod] = useState<'id' | 'google'>('id');
  
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [existingUser, setExistingUser] = useState<any>(null);

  const method = searchParams.get('method');
  const idFromUrl = searchParams.get('id');

  useEffect(() => {
    if (!db) return;

    const initialize = async () => {
      setLoading(true);
      
      if (method === 'google') {
        const googleDataJson = sessionStorage.getItem('kiosk_google_user');
        if (!googleDataJson) {
          router.push('/');
          return;
        }
        
        const googleUser = JSON.parse(googleDataJson);
        setEmail(googleUser.email);
        setFullName(googleUser.fullName);
        setLoginMethod('google');
        
        // Check if email already registered
        const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', googleUser.email), limit(1)));
        if (!userSnap.empty) {
          const userData = userSnap.docs[0].data();
          setExistingUser(userData);
          setIsReturningUser(true);
          
          // Auto-redirect for returning users
          setTimeout(() => {
            sessionStorage.setItem('kiosk_visitor', JSON.stringify({
              studentId: userData.studentId || googleUser.email,
              fullName: userData.fullName || userData.displayName,
              college: userData.college,
              program: userData.program,
              email: userData.email,
              loginMethod: 'google'
            }));
            router.push('/kiosk/purpose');
          }, 3000);
          setLoading(false);
          return;
        }
      } else if (idFromUrl) {
        setStudentId(idFromUrl);
        setLoginMethod('id');
      } else if (!method && !idFromUrl) {
        router.push('/');
        return;
      }
      
      setLoading(false);
    };

    initialize();
  }, [db, method, idFromUrl, router]);

  const filteredOptions = useMemo(() => {
    const term = search.toLowerCase();
    const results: { type: 'header' | 'item' | 'non-student'; label: string; college?: string }[] = [];
    
    NON_STUDENT_OPTIONS.forEach(opt => { 
      if (opt.toLowerCase().includes(term)) {
        results.push({ type: 'non-student', label: opt }); 
      }
    });

    COLLEGES.forEach(college => {
      const matchedPrograms = college.programs.filter(p => 
        p.toLowerCase().includes(term) || college.name.toLowerCase().includes(term)
      );
      
      if (matchedPrograms.length > 0) {
        results.push({ type: 'header', label: college.name });
        matchedPrograms.forEach(p => { 
          results.push({ type: 'item', label: p, college: college.name }); 
        });
      }
    });
    return results;
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || submitting) return;
    setFormError(null);

    if (!validateFullName(fullName)) {
      setFormError("Please enter your full name (letters only, min 3 chars).");
      return;
    }

    if (!validateStudentId(studentId)) {
      setFormError("Invalid Student ID format (XX-XXXXX-XXX).");
      return;
    }

    if (!selectedCollege) {
      setFormError("Please select your college and program.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Check if student ID already exists
      const idSnap = await getDocs(query(collection(db, 'users'), where('studentId', '==', studentId), limit(1)));
      
      const userId = studentId; // Use student ID as doc ID for consistency
      const docRef = doc(db, 'users', userId);

      const userData = {
        studentId: studentId,
        fullName: fullName,
        displayName: fullName,
        college: selectedCollege,
        program: selectedProgram || 'N/A',
        email: email || '',
        role: 'visitor',
        googleLinked: loginMethod === 'google',
        blocked: false,
        updatedAt: Timestamp.now()
      };

      if (idSnap.empty) {
        await setDoc(docRef, { ...userData, createdAt: Timestamp.now(), uid: userId });
      } else {
        await updateDoc(docRef, userData);
      }

      // 2. Check blocklist
      const blockSnap = await getDocs(query(collection(db, 'blocklist'), where('studentId', '==', studentId), limit(1)));
      if (!blockSnap.empty) {
        setFormError("This student ID is restricted. Please contact library staff.");
        setSubmitting(false);
        return;
      }

      // 3. Complete session
      sessionStorage.setItem('kiosk_visitor', JSON.stringify({
        studentId: studentId,
        fullName: fullName,
        college: selectedCollege,
        program: selectedProgram || 'N/A',
        email: email || '',
        loginMethod: loginMethod
      }));
      
      router.push('/kiosk/purpose');
    } catch (err: any) {
      logAppError('Registration', 'SaveUser', err);
      setFormError("Registration failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen neu-dark-bg flex flex-col items-center justify-center p-6 gap-4">
        <Loader2 className="animate-spin text-[#c9a227] h-12 w-12" />
        <p className="text-[#c9a227] font-black uppercase tracking-widest text-sm">Validating profile...</p>
      </div>
    );
  }

  if (isReturningUser && existingUser) {
    return (
      <div className="h-screen neu-dark-bg flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700">
        <div className="bg-black/40 backdrop-blur-2xl p-12 rounded-[3rem] border-2 border-[#c9a227]/30 flex flex-col items-center gap-6 shadow-2xl">
          <div className="h-24 w-24 rounded-full bg-[#c9a227]/20 flex items-center justify-center border-2 border-[#c9a227]/50">
            <CheckCircle2 className="h-12 w-12 text-[#c9a227]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Welcome back!</h2>
            <p className="text-[#c9a227] font-black text-xl uppercase tracking-widest">{existingUser.fullName || existingUser.displayName}</p>
            <p className="text-white/40 font-bold text-xs uppercase tracking-[0.2em]">{existingUser.college}</p>
          </div>
          <div className="flex items-center gap-3 text-white/40 font-bold uppercase tracking-[0.2em] text-[10px] mt-4">
            <Sparkles className="h-4 w-4 animate-pulse text-[#c9a227]" />
            Redirecting to selection...
          </div>
          <Button onClick={() => router.push('/kiosk/purpose')} className="mt-4 bg-[#c9a227] text-[#0a2a1a] font-black rounded-xl px-10 h-12 hover:opacity-90">
            Continue Now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen neu-dark-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {isDropdownOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]" onClick={() => setIsDropdownOpen(false)} />}
      
      <div className="absolute top-6 left-6">
        <Button variant="ghost" onClick={() => router.push('/')} className="text-[#c9a227] hover:bg-white/10 gap-2 font-bold h-10 rounded-full border border-[#c9a227]/20 text-xs">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="max-w-[480px] w-full space-y-4 z-10 animate-in fade-in zoom-in duration-700 mx-auto">
        <div className="text-center space-y-1">
          <div className="mx-auto bg-[#c9a227]/10 h-14 w-14 rounded-2xl flex items-center justify-center border border-[#c9a227]/20 shadow-xl mb-2">
            <UserPlus className="h-7 w-7 text-[#c9a227]" />
          </div>
          <h2 className="text-2xl font-black text-[#c9a227] tracking-tight uppercase leading-none">
            {method === 'google' ? 'Complete Profile' : 'New Registration'}
          </h2>
          <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">
            {method === 'google' ? 'Link your Google account to your NEU profile' : 'Please verify your details'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-neu rounded-[2rem] p-8 space-y-5 shadow-2xl border-none">
          {formError && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
              <p className="text-red-200 text-[9px] font-black uppercase text-center tracking-widest">{formError}</p>
            </div>
          )}

          <div className="space-y-4">
            {email && (
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1 flex items-center gap-1.5">
                  Institutional Email <Lock className="h-2.5 w-2.5 opacity-50" />
                </Label>
                <div className="relative group">
                  <Input 
                    value={email} 
                    readOnly 
                    className="h-12 text-xs font-bold bg-black/40 border-[#c9a227] text-white/50 rounded-xl px-4 cursor-not-allowed" 
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2"><Lock className="h-4 w-4 text-[#c9a227]/50" /></div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Student ID</Label>
              <Input 
                autoFocus={!email}
                placeholder="XX-XXXXX-XXX" 
                className="h-12 text-base font-mono bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4 focus:ring-2 focus:ring-[#c9a227]/20" 
                value={studentId} 
                onChange={(e) => setStudentId(e.target.value)} 
                required 
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Full Name</Label>
              <Input 
                placeholder="Enter your full name" 
                className="h-12 text-base font-bold bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                required 
              />
            </div>

            <div className="space-y-1 relative">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">College / Program / Affiliation</Label>
              <div 
                className={`h-12 flex items-center justify-between px-4 bg-black/40 border border-[#c9a227]/20 text-white rounded-xl cursor-pointer hover:border-[#c9a227] transition-all z-[101] relative ${isDropdownOpen ? 'ring-2 ring-[#c9a227]/30' : ''}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className={`font-bold text-xs truncate pr-2 ${selectedProgram || selectedCollege ? 'text-white' : 'text-white/20'}`}>
                  {selectedProgram || selectedCollege || "Search for your program..."}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#c9a227] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isDropdownOpen && (
                <div className="absolute bottom-full mb-3 left-0 w-full bg-[#071a0f] rounded-[1.25rem] border border-[#c9a227] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-3 z-[102] animate-in slide-in-from-bottom-2 duration-300">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c9a227]" />
                    <Input 
                      autoFocus 
                      placeholder="Type to search..." 
                      className="pl-9 h-10 bg-black/40 border-[#c9a227]/20 rounded-xl text-white font-bold text-xs focus:border-[#c9a227] text-white"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <ScrollArea className="h-[220px] pr-2">
                    <div className="space-y-1">
                      {filteredOptions.map((opt, i) => (
                        <div key={i}>
                          {opt.type === 'header' && (
                            <div className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-[#c9a227] opacity-60">{opt.label}</div>
                          )}
                          {(opt.type === 'item' || opt.type === 'non-student') && (
                            <div 
                              className={`px-3 py-2 rounded-lg hover:bg-[#0d3d24] cursor-pointer flex items-center justify-between group transition-colors ${selectedProgram === opt.label ? 'border-l-2 border-[#c9a227] bg-[#c9a227]/10' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (opt.type === 'non-student') { 
                                  setSelectedCollege(opt.label); 
                                  setSelectedProgram(''); 
                                } else { 
                                  setSelectedCollege(opt.college!); 
                                  setSelectedProgram(opt.label); 
                                }
                                setIsDropdownOpen(false); 
                                setSearch(''); 
                                setFormError(null);
                              }}
                            >
                              <span className="text-xs font-bold text-white">{opt.label}</span>
                              {(selectedProgram === opt.label || selectedCollege === opt.label) && <Check className="h-4 w-4 text-[#c9a227]" />}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          <Button className="w-full h-14 text-lg font-black rounded-xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-lg mt-2" disabled={submitting} type="submit">
            {submitting ? <Loader2 className="animate-spin h-6 w-6" /> : "Complete Registration"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="h-screen neu-dark-bg flex items-center justify-center"><Loader2 className="animate-spin text-[#c9a227] h-10 w-10" /></div>}>
      <RegisterForm />
    </Suspense>
  );
}
