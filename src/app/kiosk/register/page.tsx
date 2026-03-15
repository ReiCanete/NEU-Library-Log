
"use client";

import { useState, Suspense, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Check, ChevronDown, UserPlus, ArrowLeft, RefreshCw } from 'lucide-react';
import { validateFullName } from '@/lib/validation';
import { getErrorMessage, logAppError } from '@/lib/errorMessages';
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
  const studentId = searchParams.get('id') || '';
  
  const [fullName, setFullName] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredOptions = useMemo(() => {
    const term = search.toLowerCase();
    const results: { type: 'header' | 'item' | 'non-student'; label: string; college?: string }[] = [];
    
    // Add non-student options if they match
    NON_STUDENT_OPTIONS.forEach(opt => { 
      if (opt.toLowerCase().includes(term)) {
        results.push({ type: 'non-student', label: opt }); 
      }
    });

    // Add college and program options
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
    if (!db) return;
    setFormError(null);

    if (!validateFullName(fullName)) {
      setFormError("Please enter your full name (letters only, minimum 3 characters).");
      return;
    }

    if (!selectedCollege) {
      setFormError("Please select your college and program.");
      return;
    }

    setLoading(true);
    try {
      const userId = `std_${studentId.replace(/[^a-zA-Z0-9]/g, '')}`;
      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        displayName: fullName,
        college: selectedCollege,
        program: selectedProgram || 'N/A',
        studentId: studentId,
        role: 'user',
        blocked: false,
        createdAt: new Date()
      }, { merge: true });

      sessionStorage.setItem('kiosk_visitor', JSON.stringify({
        studentId: studentId,
        fullName: fullName,
        college: selectedCollege,
        program: selectedProgram || 'N/A',
        loginMethod: 'id'
      }));
      router.push('/kiosk/purpose');
    } catch (err: any) {
      logAppError('Registration', 'SaveUser', err);
      setFormError("Registration failed. Please try again or ask library staff for help.");
      setLoading(false);
    }
  };

  return (
    <div className="h-screen neu-dark-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-6 left-6">
        <Button variant="ghost" onClick={() => router.push('/')} className="text-[#c9a227] hover:bg-white/10 gap-2 font-bold h-10 rounded-full border border-[#c9a227]/20 text-xs">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="max-w-xl w-full space-y-4 z-10 animate-in fade-in zoom-in duration-700">
        <div className="text-center space-y-1">
          <div className="mx-auto bg-[#c9a227]/10 h-14 w-14 rounded-2xl flex items-center justify-center border border-[#c9a227]/20 shadow-xl mb-2">
            <UserPlus className="h-7 w-7 text-[#c9a227]" />
          </div>
          <h2 className="text-2xl font-black text-[#c9a227] tracking-tight uppercase">New Profile</h2>
          <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Please complete your registration</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-neu rounded-[2rem] p-8 space-y-4 shadow-2xl border-none">
          {formError && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-300">
              <p className="text-red-200 text-[10px] font-black uppercase tracking-widest">{formError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
             <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Assigned ID</Label>
              <Input value={studentId} readOnly className="h-12 text-xl font-mono bg-black/40 border-[#c9a227]/20 text-white/50 rounded-xl px-4" />
            </div>

            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Full Name</Label>
              <Input 
                placeholder="Enter your full name" 
                className="h-12 text-base font-bold bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4 focus:border-[#c9a227]"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setFormError(null);
                }}
                required
              />
            </div>

            <div className="space-y-1 relative">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">College / Program / Affiliation</Label>
              <div 
                className={`h-12 flex items-center justify-between px-4 bg-black/40 border border-[#c9a227]/20 text-white rounded-xl cursor-pointer hover:border-[#c9a227] ${isDropdownOpen ? 'border-[#c9a227]' : ''}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className={`font-bold text-xs truncate pr-2 ${selectedProgram || selectedCollege ? 'text-white' : 'text-white/20'}`}>
                  {selectedProgram || selectedCollege || "Search for your program..."}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#c9a227] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isDropdownOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-full glass-neu rounded-[1.5rem] border border-[#c9a227]/20 shadow-2xl p-3 z-[100] animate-in slide-in-from-top-4 duration-300 flex flex-col">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c9a227]" />
                    <Input 
                      autoFocus
                      placeholder="Type to search..." 
                      className="pl-9 h-10 bg-black/20 border-none rounded-xl text-white font-bold text-xs"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-[220px] overflow-hidden">
                    <ScrollArea className="h-[220px] pr-1">
                      <div className="space-y-1 pb-2">
                        {filteredOptions.map((opt, i) => (
                          <div key={i}>
                            {opt.type === 'header' && (
                              <div className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-[#c9a227] opacity-60 mt-1">
                                {opt.label}
                              </div>
                            )}
                            {(opt.type === 'item' || opt.type === 'non-student') && (
                              <div 
                                className="px-3 py-2 rounded-lg hover:bg-[#c9a227]/20 cursor-pointer flex items-center justify-between group transition-colors"
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
                                <span className="text-xs font-bold text-white group-hover:translate-x-1 transition-transform">
                                  {opt.label}
                                </span>
                                {(selectedProgram === opt.label || selectedCollege === opt.label) && (
                                  <Check className="h-4 w-4 text-[#c9a227]" />
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {filteredOptions.length === 0 && (
                          <div className="p-6 text-center text-white/20 font-bold text-xs">
                            No results found
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button 
            className="w-full h-14 text-lg font-black rounded-xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-lg transition-all active:scale-[0.98]"
            disabled={loading}
            type="submit"
          >
            {loading ? <Loader2 className="animate-spin h-6 w-6" /> : "Complete Registration"}
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
