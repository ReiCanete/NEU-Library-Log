"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Trash2, FileText, Calendar, Table as TableIcon, History, UserX, CheckCircle, Info, ArrowRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc, Timestamp, where, getDocs } from 'firebase/firestore';
import { format, isSameDay } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
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

const COLLEGE_ABBREVIATIONS: Record<string, string> = {
  "College of Informatics and Computing Studies": "CICS",
  "College of Engineering and Architecture": "CEA",
  "College of Business Administration": "CBA",
  "College of Education": "COEd",
  "College of Arts and Sciences": "CAS",
  "College of Criminology": "CCrim",
  "College of Nursing": "CON",
  "College of Accountancy": "COA",
  "College of Communication": "COC",
  "College of Agriculture": "CA",
  "College of Medical Technology": "CMT",
  "College of Physical Therapy": "CPT",
  "College of Respiratory Therapy": "CRT",
  "College of Music": "COM",
  "College of Midwifery": "CMid",
  "College of Law": "COL",
  "College of Medicine": "COM",
  "School of International Relations": "SIR"
};

export default function VisitorLogs() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const usersQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'users'));
  }, [db]);
  const { data: users } = useCollection(usersQuery);

  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [historyUser, setHistoryUser] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fallback map for missing college/program data
  const userMap = useMemo(() => {
    const map: Record<string, any> = {};
    users?.forEach(u => {
      map[u.studentId] = u;
    });
    return map;
  }, [users]);

  const uniqueColleges = useMemo(() => {
    if (!allVisits) return [];
    const colleges = new Set<string>();
    allVisits.forEach(v => {
      const col = v.college || userMap[v.studentId]?.college;
      if (col) colleges.add(col);
    });
    return Array.from(colleges).sort();
  }, [allVisits, userMap]);

  const uniquePrograms = useMemo(() => {
    if (!allVisits) return [];
    const programs = new Set<string>();
    allVisits.forEach(v => {
      const col = v.college || userMap[v.studentId]?.college;
      const prog = v.program || userMap[v.studentId]?.program;
      if (prog && (collegeFilter === 'all' || col === collegeFilter)) {
        programs.add(prog);
      }
    });
    return Array.from(programs).sort();
  }, [allVisits, collegeFilter, userMap]);

  const filteredVisits = useMemo(() => {
    if (!allVisits) return [];
    return allVisits.filter(v => {
      const vCollege = v.college || userMap[v.studentId]?.college || '';
      const vProgram = v.program || userMap[v.studentId]?.program || '';
      
      const matchesSearch = v.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           v.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           vCollege.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPurpose = purposeFilter === 'all' || v.purpose === purposeFilter;
      const matchesCollege = collegeFilter === 'all' || vCollege === collegeFilter;
      const matchesProgram = programFilter === 'all' || vProgram === programFilter;
      const matchesDate = !dateFilter || isSameDay(v.timestamp.toDate(), new Date(dateFilter));
      
      return matchesSearch && matchesPurpose && matchesCollege && matchesProgram && matchesDate;
    });
  }, [allVisits, searchTerm, purposeFilter, collegeFilter, programFilter, dateFilter, userMap]);

  const paginatedVisits = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVisits.slice(start, start + itemsPerPage);
  }, [filteredVisits, currentPage]);

  const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);

  const isBlocked = (studentId: string) => blocklist?.some(b => b.studentId === studentId);

  const userHistory = useMemo(() => {
    if (!historyUser || !allVisits) return [];
    return allVisits.filter(v => v.studentId === historyUser.studentId);
  }, [historyUser, allVisits]);

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

  const handleDeleteVisit = (visitId: string) => {
    if (!db) return;
    const docRef = doc(db, 'visits', visitId);
    deleteDoc(docRef)
      .then(() => toast({ title: "Log Deleted", description: "Record removed." }))
      .catch(async () => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' })));
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const adminEmail = auth?.currentUser?.email || 'N/A';
    
    doc.setFillColor(26, 58, 42);
    doc.rect(0, 0, 297, 40, 'F');
    doc.setTextColor(201, 162, 39);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("NEW ERA UNIVERSITY", 148, 18, { align: 'center' });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text("NEU Library Log — Visitor Activity Archives", 148, 28, { align: 'center' });
    
    autoTable(doc, {
      startY: 45,
      head: [['#', 'Student ID', 'Full Name', 'College', 'Program', 'Purpose', 'Date & Time']],
      body: filteredVisits.map((v, i) => {
        const col = v.college || userMap[v.studentId]?.college || '—';
        const prog = v.program || userMap[v.studentId]?.program || '—';
        return [i + 1, v.studentId, v.fullName, col, prog, v.purpose, format(v.timestamp.toDate(), 'yyyy-MM-dd HH:mm')];
      }),
      headStyles: { fillColor: [26, 58, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [247, 250, 248] }
    });

    const totalPages = (doc as any).internal.getNumberOfPages();
    for(let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Generated by: ${adminEmail} | ${new Date().toLocaleString()} | Page ${i} of ${totalPages}`, 148, 205, { align: 'center' });
    }

    doc.save(`NEU-Visitor-Log-${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <AdminLayout>
      <title>NEU Library Log — Visitor Logs</title>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-[#1a3a2a]">Visitor Activity Logs</h2>
            <p className="text-xs tracking-widest text-[#4a6741] uppercase mt-1">Institutional Activity Archive</p>
          </div>
          <Button onClick={exportPDF} className="bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex gap-2">
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
        </div>

        <Card className="rounded-2xl border-[#d4e4d8] shadow-sm bg-white p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-1 md:col-span-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Search Name / ID</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input placeholder="Type to filter..." className="h-11 pl-10 rounded-xl bg-[#f0f4f1] border-none font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">College</Label>
              <Select value={collegeFilter} onValueChange={setCollegeFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-[#f0f4f1] border-none font-medium text-xs">
                  <SelectValue placeholder="All Colleges" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colleges</SelectItem>
                  {uniqueColleges.map(c => (
                    <SelectItem key={c} value={c} title={c}>
                      {COLLEGE_ABBREVIATIONS[c] || c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Program</Label>
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-[#f0f4f1] border-none font-medium text-xs">
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {uniquePrograms.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Purpose</Label>
              <Select value={purposeFilter} onValueChange={setPurposeFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-[#f0f4f1] border-none font-medium text-xs">
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
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold h-12 px-6">#</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">Student ID</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">Full Name</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">College</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">Program</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">Purpose</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">Time</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={8} className="px-6 py-4"><Skeleton className="h-10 w-full rounded-lg" /></TableCell></TableRow>
                ))
              ) : paginatedVisits.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-64 text-center text-slate-400 font-medium">No activity records found.</TableCell></TableRow>
              ) : paginatedVisits.map((v, i) => {
                const blocked = isBlocked(v.studentId);
                const vCollege = v.college || userMap[v.studentId]?.college || '—';
                const vProgram = v.program || userMap[v.studentId]?.program || '—';
                
                return (
                  <TableRow key={v.id} className="group hover:bg-[#f0f7f2] border-b-[#f0f4f1] transition-colors even:bg-[#f7faf8]">
                    <TableCell className="px-6 text-slate-400 font-bold text-xs">{(currentPage - 1) * itemsPerPage + i + 1}</TableCell>
                    <TableCell className="font-mono text-sm font-semibold text-[#1a3a2a]">{v.studentId}</TableCell>
                    <TableCell>
                      <button onClick={() => setHistoryUser(v)} className="font-bold text-[#1a3a2a] hover:underline flex items-center gap-1">
                        {v.fullName} <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-600">
                      {COLLEGE_ABBREVIATIONS[vCollege] || vCollege}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-500 max-w-[150px] truncate" title={vProgram}>
                      {vProgram}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-[#f0f7f2] text-[#1a3a2a] text-[9px] font-bold px-3 py-1 rounded-full border border-[#d4e4d8] uppercase">
                        {v.purpose}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 font-medium text-[10px]">
                      {format(v.timestamp.toDate(), 'MMM dd, hh:mm a')}
                    </TableCell>
                    <TableCell className="px-6 text-right space-x-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500 rounded-lg">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl">
                          <AlertDialogHeader><AlertDialogTitle>Delete Log?</AlertDialogTitle></AlertDialogHeader>
                          <AlertDialogDescription>Permanently remove the record for {v.fullName}?</AlertDialogDescription>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteVisit(v.id)}>Delete Now</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {blocked ? (
                        <Button size="sm" className="h-8 px-4 rounded-full font-bold text-[9px] uppercase text-emerald-600 border-emerald-200 hover:bg-emerald-50" variant="outline" onClick={() => handleUnblockUser(v.studentId)}>Unblock</Button>
                      ) : (
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" className="h-8 px-4 rounded-full font-bold text-[9px] uppercase bg-red-600 text-white hover:bg-red-700" onClick={() => { setSelectedVisit(v); setBlockReason(''); }}>Block</Button></DialogTrigger>
                          <DialogContent className="rounded-2xl">
                            <DialogHeader><DialogTitle>Restrict Student</DialogTitle></DialogHeader>
                            <div className="py-4 space-y-4">
                              <div className="space-y-1">
                                <Label className="text-xs font-bold text-[#1a3a2a]">Reason (Min 10 characters)</Label>
                                <Textarea className="rounded-xl bg-[#f0f4f1] border-none font-medium min-h-[100px]" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Describe violation details..." />
                                {blockReason && blockReason.length < 10 && <p className="text-[10px] text-red-500 font-bold uppercase">Reason must be at least 10 characters.</p>}
                              </div>
                            </div>
                            <DialogFooter>
                              <Button className="w-full h-11 bg-red-600 text-white font-bold rounded-xl" disabled={blockReason.length < 10 || isProcessing} onClick={handleBlockUser}>Confirm Restriction</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="p-6 bg-[#f7faf8] flex justify-between items-center border-t border-[#d4e4d8]">
            <p className="text-[10px] font-bold text-[#4a6741] uppercase tracking-widest">Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredVisits.length)} to {Math.min(currentPage * itemsPerPage, filteredVisits.length)} of {filteredVisits.length} entries</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="rounded-lg h-9 px-4 font-bold border-[#d4e4d8] text-[#1a3a2a]">Prev</Button>
              <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="rounded-lg h-9 px-4 font-bold border-[#d4e4d8] text-[#1a3a2a]">Next</Button>
            </div>
          </div>
        </Card>
      </div>

      <Sheet open={!!historyUser} onOpenChange={() => setHistoryUser(null)}>
        <SheetContent className="w-full sm:max-w-md bg-white p-0 overflow-hidden flex flex-col">
          {historyUser && (
            <>
              <SheetHeader className="p-8 bg-[#1a3a2a] text-white">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-[#c9a227] flex items-center justify-center text-xl font-bold text-[#1a3a2a]">
                    {historyUser.fullName.charAt(0)}
                  </div>
                  <div>
                    <SheetTitle className="text-xl font-bold text-white leading-tight">{historyUser.fullName}</SheetTitle>
                    <SheetDescription className="text-white/60 font-medium text-xs uppercase tracking-widest">{historyUser.studentId}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#f0f7f2] rounded-xl border border-[#d4e4d8]">
                    <p className="text-[9px] font-bold text-[#4a6741] uppercase tracking-widest">Total Visits</p>
                    <p className="text-2xl font-bold text-[#1a3a2a] mt-1">{userHistory.length}</p>
                  </div>
                  <div className="p-4 bg-[#f0f7f2] rounded-xl border border-[#d4e4d8]">
                    <p className="text-[9px] font-bold text-[#4a6741] uppercase tracking-widest">Status</p>
                    <p className={`text-sm font-bold mt-1 uppercase ${isBlocked(historyUser.studentId) ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isBlocked(historyUser.studentId) ? 'Restricted' : 'Authorized'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                   <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">College & Program</p>
                      <p className="text-xs font-bold text-[#1a3a2a]">{historyUser.college || userMap[historyUser.studentId]?.college || '—'}</p>
                      <p className="text-[10px] font-medium text-slate-500 mt-1">{historyUser.program || userMap[historyUser.studentId]?.program || '—'}</p>
                   </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-[#1a3a2a] uppercase tracking-widest flex items-center gap-2">
                    <History className="h-3 w-3 text-[#c9a227]" /> Activity Archive
                  </h4>
                  <div className="space-y-2">
                    {userHistory.map((h: any) => (
                      <div key={h.id} className="p-4 rounded-xl border border-[#f0f4f1] hover:bg-[#f0f7f2] transition-colors">
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-sm text-[#1a3a2a]">{h.purpose}</p>
                          <p className="text-[10px] font-bold text-slate-400 tabular-nums">{format(h.timestamp.toDate(), 'PP p')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-[#f0f4f1] bg-[#f7faf8]">
                {isBlocked(historyUser.studentId) ? (
                  <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl" onClick={() => handleUnblockUser(historyUser.studentId)}>Restore Access</Button>
                ) : (
                  <Button className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl" onClick={() => setSelectedVisit(historyUser)}>Block Visitor</Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
