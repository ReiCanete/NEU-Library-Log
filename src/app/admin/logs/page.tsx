
"use client";

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Search, Trash2, FileText, Calendar, History, ArrowRight, Mail, CreditCard, Filter, Loader2, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc, Timestamp, where, getDocs, addDoc } from 'firebase/firestore';
import { format, isSameDay } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdminLayout } from '@/components/admin/admin-layout';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const NEU_COLLEGES = [
  'College of Accountancy',
  'College of Agriculture',
  'College of Arts and Sciences',
  'College of Business Administration',
  'College of Communication',
  'College of Informatics and Computing Studies',
  'College of Criminology',
  'College of Education',
  'College of Engineering and Architecture',
  'College of Medical Technology',
  'College of Midwifery',
  'College of Music',
  'College of Nursing',
  'College of Physical Therapy',
  'College of Respiratory Therapy',
  'School of International Relations',
  'Faculty',
  'Administrative Staff',
  'Library Staff',
  'Guest / Visitor',
];

const TYPE_COLORS: Record<string, string> = {
  'Student': 'bg-blue-50 text-blue-700 border-blue-200',
  'Faculty': 'bg-purple-50 text-purple-700 border-purple-200',
  'Administrative Staff': 'bg-orange-50 text-orange-700 border-orange-200',
  'Library Staff': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Guest': 'bg-slate-50 text-slate-700 border-slate-200',
};

export default function VisitorLogs() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const visitsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'visits'), orderBy('timestamp', 'desc'));
  }, [db]);
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);

  const blocklistQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'blocklist'));
  }, [db]);
  const { data: blocklist } = useCollection(blocklistQuery);

  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [historyUser, setHistoryUser] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredVisits = useMemo(() => {
    if (!allVisits) return [];
    return allVisits.filter(v => {
      const matchesSearch = v.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           v.studentId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPurpose = purposeFilter === 'all' || v.purpose === purposeFilter;
      const matchesCollege = collegeFilter === 'all' || v.college === collegeFilter;
      const matchesDate = !dateFilter || isSameDay(v.timestamp.toDate(), new Date(dateFilter));
      
      let matchesType = typeFilter === 'all';
      if (typeFilter === 'employee') {
        matchesType = ['Faculty', 'Administrative Staff', 'Library Staff'].includes(v.visitorType);
      } else if (typeFilter !== 'all') {
        matchesType = v.visitorType === typeFilter;
      }
      
      return matchesSearch && matchesPurpose && matchesCollege && matchesType && matchesDate;
    });
  }, [allVisits, searchTerm, purposeFilter, collegeFilter, typeFilter, dateFilter]);

  const paginatedVisits = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVisits.slice(start, start + itemsPerPage);
  }, [filteredVisits, currentPage]);

  const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);

  const isBlocked = (studentId: string) => blocklist?.some(b => b.studentId === studentId);

  const handleBlockUser = async () => {
    const userToBlock = selectedVisit || historyUser;
    if (!userToBlock || !db) return;
    if (blockReason.trim().length < 10) {
      toast({ title: "Validation Error", description: "Reason must be at least 10 characters.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'blocklist'), {
        studentId: userToBlock.studentId,
        fullName: userToBlock.fullName,
        college: userToBlock.college || '',
        program: userToBlock.program || '',
        reason: blockReason,
        blockedBy: auth?.currentUser?.email || 'Staff',
        blockedAt: Timestamp.now()
      });
      toast({ title: "Access Restricted", description: `${userToBlock.fullName} is now blocked.` });
      setSelectedVisit(null);
      setHistoryUser(null);
      setBlockReason('');
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnblockUser = async (studentId: string) => {
    if (!db) return;
    setIsProcessing(true);
    try {
      const q = query(collection(db, 'blocklist'), where('studentId', '==', studentId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'blocklist', snap.docs[0].id));
        toast({ title: "Access Restored", description: "Restriction removed." });
      }
    } catch (e: any) {
      toast({ title: "Action Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-[#1a3a2a]">Visitor Activity Logs</h2>
            <p className="text-xs tracking-widest text-[#4a6741] uppercase mt-1">Institutional Activity Archive</p>
          </div>
        </div>

        <Card className="rounded-2xl border-[#d4e4d8] shadow-sm bg-white p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input placeholder="Name or ID..." className="h-11 pl-10 rounded-xl bg-[#f0f4f1] border-none font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">College</Label>
              <Select value={collegeFilter} onValueChange={setCollegeFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-[#f0f4f1] border-none font-bold text-xs">
                  <SelectValue placeholder="All Colleges" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colleges</SelectItem>
                  {NEU_COLLEGES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Visitor Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-[#f0f4f1] border-none font-bold text-xs">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Student">Student</SelectItem>
                  <SelectItem value="Faculty">Faculty / Teacher</SelectItem>
                  <SelectItem value="Administrative Staff">Administrative Staff</SelectItem>
                  <SelectItem value="Library Staff">Library Staff</SelectItem>
                  <SelectItem value="Guest">Guest / Visitor</SelectItem>
                  <SelectItem value="employee">Employee (Staff)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Purpose</Label>
              <Select value={purposeFilter} onValueChange={setPurposeFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-[#f0f4f1] border-none font-bold text-xs">
                  <SelectValue placeholder="All Activities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="Reading Books">Reading Books</SelectItem>
                  <SelectItem value="Research / Study">Research / Study</SelectItem>
                  <SelectItem value="Computer / Internet">Computer / Internet</SelectItem>
                  <SelectItem value="Group Discussion">Group Discussion</SelectItem>
                  <SelectItem value="Thesis / Archival">Thesis / Archival</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Date</Label>
              <Input type="date" className="h-11 px-4 rounded-xl bg-[#f0f4f1] border-none font-medium" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-[#d4e4d8] shadow-sm bg-white overflow-hidden">
          <Table>
            <TableHeader className="bg-[#1a3a2a]">
              <TableRow className="border-none hover:bg-[#1a3a2a]">
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold h-12 px-6">ID</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">Full Name</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold text-center">Type</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">College</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">Purpose</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold text-center">Method</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">Time</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitsLoading ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={8} className="px-6 py-4"><Skeleton className="h-10 w-full rounded-lg" /></TableCell></TableRow>
                ))
              ) : paginatedVisits.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-96 text-center text-slate-400 font-medium">No activity records found.</TableCell></TableRow>
              ) : paginatedVisits.map((v) => (
                <TableRow key={v.id} className="group hover:bg-[#f0f7f2] border-b-[#f0f4f1] transition-colors even:bg-[#f7faf8]">
                  <TableCell className="px-6 font-mono text-xs font-semibold text-[#1a3a2a]">{v.studentId}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-[#1a3a2a]">{v.fullName}</span>
                      {v.email && <span className="text-[9px] text-[#c9a227] font-bold flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {v.email}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`${TYPE_COLORS[v.visitorType || 'Student']} text-[8px] font-black uppercase px-2 py-0.5 border`}>
                      {v.visitorType || 'Student'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-slate-600 truncate max-w-[150px]">{v.college || '—'}</TableCell>
                  <TableCell>
                    <Badge className="bg-white text-[#1a3a2a] text-[9px] font-bold px-3 py-1 rounded-full border border-[#d4e4d8] uppercase">
                      {v.purpose}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-[8px] font-black uppercase px-2 py-0.5 border ${v.loginMethod === 'email' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      {v.loginMethod === 'email' ? 'Email' : 'ID Card'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 font-medium text-[10px] tabular-nums">
                    {format(v.timestamp.toDate(), 'MMM dd, hh:mm a')}
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    {isBlocked(v.studentId) ? (
                      <Button size="sm" className="h-8 px-4 rounded-full font-bold text-[9px] uppercase text-emerald-600 border-emerald-200 hover:bg-emerald-50" variant="outline" onClick={() => handleUnblockUser(v.studentId)}>Unblock</Button>
                    ) : (
                      <Button size="sm" className="h-8 px-4 rounded-full font-bold text-[9px] uppercase bg-red-600 text-white hover:bg-red-700" onClick={() => { setSelectedVisit(v); setBlockReason(''); }}>Block</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-6 bg-[#f7faf8] flex justify-between items-center border-t border-[#d4e4d8]">
            <p className="text-[10px] font-bold text-[#4a6741] uppercase tracking-widest">Page {currentPage} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="rounded-lg h-9 px-4 font-bold border-[#d4e4d8]">Prev</Button>
              <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="rounded-lg h-9 px-4 font-bold border-[#d4e4d8]">Next</Button>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
