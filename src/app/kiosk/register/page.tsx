
"use client";

import { useState, Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, limit, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ChevronDown, UserPlus, ArrowLeft, Lock } from 'lucide-react';
import { validateFullName, validateStudentId } from '@/lib/validation';
import { logAppError } from '@/lib/errorMessages';

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
  
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  
  const method = searchParams.get('method');
  const idFromUrl = searchParams.get('id');
  const emailFromUrl = searchParams.get('email');

  useEffect(() => {
    if (!db) return;

    const initialize = async () => {
      setLoading(true);
      
      if (method === 'email' && emailFromUrl) {
        setEmail(emailFromUrl);
      } else if (idFromUrl) {
        setStudentId(idFromUrl);
      } else if (!method && !idFromUrl) {
        router.push('/');
        return;
      }
      
      setLoading(false);
    };

    initialize();
  }, [db, method, idFromUrl, emailFromUrl, router]);

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

  const handleStudentIdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (studentId.trim().length > 0) {
        document.getElementById('fullName-input')?.focus();
      }
    }
  };

  const handleFullNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsDropdownOpen(true);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      const idSnap = await getDocs(query(collection(db, 'users'), where('studentId', '==', studentId), limit(1)));
      
      const userId = studentId; 
      const docRef = doc(db, 'users', userId);

      const userData = {
        studentId: studentId,
        fullName: fullName,
        displayName: fullName,
        college: selectedCollege,
        program: selectedProgram || 'N/A',
        email: email || '',
        role: 'visitor',
        updatedAt: Timestamp.now()
      };

      if (idSnap.empty) {
        await setDoc(docRef, { ...userData, createdAt: Timestamp.now(), uid: userId });
      } else {
        await updateDoc(docRef, userData);
      }

      const blockSnap = await getDocs(query(collection(db, 'blocklist'), where('studentId', '==', studentId), limit(1)));
      if (!blockSnap.empty) {
        setFormError("This student ID is restricted. Please contact library staff.");
        setSubmitting(false);
        return;
      }

      sessionStorage.setItem('kiosk_visitor', JSON.stringify({
        studentId: studentId,
        fullName: fullName,
        college: selectedCollege,
        program: selectedProgram || 'N/A',
        email: email || '',
        loginMethod: method === 'email' ? 'email' : 'id'
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
        <p className="text-[#c9a227] font-black uppercase tracking-widest text-sm">Initializing profile...</p>
      </div>
    );
  }

  return (
    <div className="h-screen neu-dark-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
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
            {method === 'email' ? 'Complete Your Profile' : 'New Registration'}
          </h2>
          <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">
            {method === 'email' ? "First time? Let's set up your library profile." : 'Please verify your details'}
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="glass-neu rounded-[2rem] p-8 space-y-5 shadow-2xl border-none">
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
                    className="h-12 text-xs font-bold bg-black/40 border-2 border-[#c9a227] text-[#c9a227] rounded-xl px-4 cursor-not-allowed" 
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2"><Lock className="h-4 w-4 text-[#c9a227]/50" /></div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Student ID</Label>
              <Input 
                id="studentId-input"
                autoFocus={!email}
                placeholder="XX-XXXXX-XXX" 
                className="h-12 text-base font-mono bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4 focus:ring-2 focus:ring-[#c9a227]/20" 
                value={studentId} 
                onChange={(e) => setStudentId(e.target.value)} 
                onKeyDown={handleStudentIdKeyDown}
                required 
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Full Name</Label>
              <Input 
                id="fullName-input"
                placeholder="Enter your full name" 
                className="h-12 text-base font-bold bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                onKeyDown={handleFullNameKeyDown}
                required 
              />
            </div>

            <div className="space-y-1 relative">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">College / Program / Affiliation</Label>
              <div 
                className={`h-12 flex items-center justify-between px-4 bg-black/40 border border-[#c9a227]/20 text-white rounded-xl cursor-pointer hover:border-[#c9a227] transition-all relative ${isDropdownOpen ? 'ring-2 ring-[#c9a227]/30' : ''}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className={`font-bold text-xs truncate pr-2 ${selectedProgram || selectedCollege ? 'text-white' : 'text-white/20'}`}>
                  {selectedProgram || selectedCollege || "Search for your program..."}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#c9a227] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isDropdownOpen && (
                <div 
                  className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden"
                  style={{
                    background: '#071a0f',
                    border: '1px solid #c9a227',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.9)',
                    maxHeight: '280px',
                    overflowY: 'auto'
                  }}
                >
                  <div className="sticky top-0 p-0 z-10">
                    <input 
                      autoFocus 
                      style={{
                        background: '#0a2a1a',
                        border: 'none',
                        borderBottom: '1px solid #c9a227',
                        color: 'white',
                        padding: '10px 16px',
                        width: '100%',
                        outline: 'none',
                        fontSize: '14px'
                      }}
                      placeholder="Type to search..." 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="py-2">
                    {filteredOptions.map((opt, i) => (
                      <div key={i}>
                        {opt.type === 'header' && (
                          <div style={{
                            padding: '8px 16px 4px',
                            color: '#c9a227',
                            fontSize: '11px',
                            fontWeight: '600',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            background: '#071a0f',
                            borderTop: i > 0 ? '1px solid rgba(201, 162, 39, 0.1)' : 'none'
                          }}>
                            {opt.label}
                          </div>
                        )}
                        {(opt.type === 'item' || opt.type === 'non-student') && (
                          <div 
                            style={{
                              padding: '10px 16px',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '14px',
                              transition: 'all 0.2s',
                              borderLeft: (selectedProgram === opt.label || selectedCollege === opt.label) ? '3px solid #c9a227' : '3px solid transparent',
                              background: hoveredOption === opt.label ? '#0d3d24' : 'transparent',
                            }}
                            onMouseEnter={() => setHoveredOption(opt.label)}
                            onMouseLeave={() => setHoveredOption(null)}
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
                            <div className="flex items-center justify-between">
                              <span className="truncate pr-4">{opt.label}</span>
                              {(selectedProgram === opt.label || selectedCollege === opt.label) && <Check className="h-4 w-4 text-[#c9a227] shrink-0" />}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button 
            className="w-full h-14 text-lg font-black rounded-xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-lg mt-2" 
            disabled={submitting} 
            type="submit"
          >
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
