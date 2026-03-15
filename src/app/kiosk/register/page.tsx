"use client";

import { useState, Suspense, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { db as firestore } from '@/firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Check, ChevronDown, UserPlus, ArrowLeft } from 'lucide-react';

const COLLEGES = [
  {
    name: "College of Accountancy",
    programs: ["BS Accountancy", "BS Accounting Information System"]
  },
  {
    name: "College of Agriculture",
    programs: ["BS Agriculture"]
  },
  {
    name: "College of Arts and Sciences",
    programs: ["BA Economics", "BA Political Science", "BS Biology", "BS Psychology", "BS Public Administration"]
  },
  {
    name: "College of Business Administration",
    programs: [
      "BS Business Administration Major in Financial Management",
      "BS Business Administration Major in Human Resource Development Management",
      "BS Business Administration Major in Legal Management",
      "BS Business Administration Major in Marketing Management",
      "BS Entrepreneurship",
      "BS Real Estate Management"
    ]
  },
  {
    name: "College of Communication",
    programs: ["BA Broadcasting", "BA Communication", "BA Journalism"]
  },
  {
    name: "College of Informatics and Computing Studies",
    programs: [
      "BS Library and Information Science",
      "BS Computer Science",
      "BS Entertainment and Multimedia Computing (Digital Animation Technology)",
      "BS Entertainment and Multimedia Computing (Game Development)",
      "BS Information Technology",
      "BS Information System"
    ]
  },
  {
    name: "College of Criminology",
    programs: ["BS Criminology"]
  },
  {
    name: "College of Education",
    programs: [
      "BS Elementary Education",
      "BS Elementary Education (Preschool Education)",
      "BS Elementary Education (Special Education)",
      "BS Secondary Education Major in Music Arts and Physical Education",
      "BS Secondary Education Major in English",
      "BS Secondary Education Major in Filipino",
      "BS Secondary Education Major in Mathematics",
      "BS Secondary Education Major in Science",
      "BS Secondary Education Major in Social Studies",
      "BS Secondary Education Major in Technology and Livelihood Education"
    ]
  },
  {
    name: "College of Engineering and Architecture",
    programs: [
      "BS Architecture",
      "BS Astronomy",
      "BS Civil Engineering",
      "BS Electrical Engineering",
      "BS Electronics Engineering",
      "BS Industrial Engineering",
      "BS Mechanical Engineering"
    ]
  },
  {
    name: "College of Medical Technology",
    programs: ["BS Medical Technology"]
  },
  {
    name: "College of Midwifery",
    programs: ["Diploma in Midwifery"]
  },
  {
    name: "College of Music",
    programs: ["BM Choral Conducting", "BM Music Education", "BM Piano", "BM Voice"]
  },
  {
    name: "College of Nursing",
    programs: ["BS Nursing"]
  },
  {
    name: "College of Physical Therapy",
    programs: ["BS Physical Therapy"]
  },
  {
    name: "College of Respiratory Therapy",
    programs: ["BS Respiratory Therapy"]
  },
  {
    name: "School of International Relations",
    programs: ["BA Foreign Service"]
  }
];

const NON_STUDENT_OPTIONS = ["Faculty", "Administrative Staff", "Library Staff", "Guest / Visitor"];

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const studentId = searchParams.get('id') || '';
  
  const [fullName, setFullName] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const filteredOptions = useMemo(() => {
    const term = search.toLowerCase();
    const results: { type: 'header' | 'item' | 'non-student'; label: string; college?: string }[] = [];
    
    // Non-student options first
    NON_STUDENT_OPTIONS.forEach(opt => {
      if (opt.toLowerCase().includes(term)) {
        results.push({ type: 'non-student', label: opt });
      }
    });

    // Colleges and Programs
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
    if (!fullName || !selectedCollege) return;

    setLoading(true);
    try {
      const userId = `std_${studentId.replace(/[^a-zA-Z0-9]/g, '')}`;
      await setDoc(doc(firestore, 'users', userId), {
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
      toast({
        title: "Registration Failed",
        description: err.message || "Could not save profile.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px] animate-orb" />
      
      <div className="absolute top-8 left-8">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/')}
          className="text-white hover:bg-white/10 gap-2 font-bold"
        >
          <ArrowLeft className="h-5 w-5" /> Back
        </Button>
      </div>

      <div className="max-w-2xl w-full space-y-10 z-10 animate-in fade-in zoom-in duration-700">
        <div className="text-center space-y-4">
          <div className="mx-auto bg-blue-500/10 h-20 w-20 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl">
            <UserPlus className="h-10 w-10 text-blue-400" />
          </div>
          <h2 className="text-5xl font-black text-white tracking-tight">New Profile</h2>
          <p className="text-xl text-blue-200/50 font-medium">Please complete your registration details</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-dark rounded-[2.5rem] p-12 space-y-8 shadow-2xl border-white/5">
          <div className="grid grid-cols-1 gap-8">
             <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest text-blue-300 ml-1">Assigned ID</Label>
              <Input value={studentId} readOnly className="h-16 text-2xl font-mono bg-black/40 border-white/5 text-white/50 rounded-2xl px-6" />
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest text-blue-300 ml-1">Full Name</Label>
              <Input 
                placeholder="Enter your full name" 
                className="h-16 text-xl font-bold bg-black/40 border-white/10 text-white rounded-2xl px-6 focus:border-blue-500 focus:ring-blue-500/20"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-3 relative">
              <Label className="text-xs font-black uppercase tracking-widest text-blue-300 ml-1">College / Program / Affiliation</Label>
              <div 
                className="h-16 flex items-center justify-between px-6 bg-black/40 border border-white/10 text-white rounded-2xl cursor-pointer hover:border-white/30 transition-all"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className={`font-bold text-lg ${selectedProgram ? 'text-white' : 'text-white/20'}`}>
                  {selectedProgram || selectedCollege || "Search for your program..."}
                </span>
                <ChevronDown className={`h-5 w-5 text-blue-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isDropdownOpen && (
                <div className="absolute top-[calc(100%+12px)] left-0 w-full glass-dark rounded-[2rem] border-white/10 shadow-2xl p-4 z-50 animate-in slide-in-from-top-4 duration-300 max-h-[450px] flex flex-col">
                  <div className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                    <Input 
                      autoFocus
                      placeholder="Type to filter..." 
                      className="pl-11 h-12 bg-white/5 border-none rounded-xl text-white font-bold"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="overflow-y-auto space-y-1 flex-1 pr-2">
                    {filteredOptions.map((opt, i) => (
                      <div key={i}>
                        {opt.type === 'header' && (
                          <div className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-400 opacity-60 mt-2">
                            {opt.label}
                          </div>
                        )}
                        {(opt.type === 'item' || opt.type === 'non-student') && (
                          <div 
                            className="px-4 py-4 rounded-xl hover:bg-blue-600/40 cursor-pointer flex items-center justify-between group transition-colors"
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
                            }}
                          >
                            <span className="text-sm font-bold text-white group-hover:translate-x-1 transition-transform">{opt.label}</span>
                            {(selectedProgram === opt.label || selectedCollege === opt.label) && <Check className="h-4 w-4 text-blue-400" />}
                          </div>
                        )}
                      </div>
                    ))}
                    {filteredOptions.length === 0 && (
                      <div className="p-8 text-center text-blue-200/30 font-bold">No results found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button 
            className="w-full h-20 text-2xl font-black rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all active:scale-[0.98]"
            disabled={loading || !fullName || !selectedCollege}
          >
            {loading ? <Loader2 className="animate-spin mr-3 h-7 w-7" /> : "Complete Registration"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a1628] flex items-center justify-center"><Loader2 className="animate-spin text-white h-12 w-12" /></div>}>
      <RegisterForm />
    </Suspense>
  );
}