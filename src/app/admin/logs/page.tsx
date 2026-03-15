"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Trash2, Loader2, FileText, Calendar, Table as TableIcon, History, UserX, CheckCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, addDoc, deleteDoc, doc, Timestamp, where, getDocs } from 'firebase/firestore';
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

export default function VisitorLogs() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
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

  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [historyUser, setHistoryUser] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredVisits = useMemo(() => {
    if (!allVisits) return [];
    return allVisits.filter(v => {
      const matchesSearch = v.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           v.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           v.college?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPurpose = purposeFilter === 'all' || v.purpose === purposeFilter;
      const matchesDate = !dateFilter || isSameDay(v.timestamp.toDate(), new Date(dateFilter));
      return matchesSearch && matchesPurpose && matchesDate;
    });
  }, [allVisits, searchTerm, purposeFilter, dateFilter]);

  const paginatedVisits = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVisits.slice(start, start + itemsPerPage);
  }, [filteredVisits, currentPage]);

  const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);

  const handleBlockUser = async () => {
    const userToBlock = selectedVisit || historyUser;
    if (!userToBlock || !blockReason || !db) return;
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
    setIsProcessing(true);
    deleteDoc(docRef)
      .then(() => {
        toast({ title: "Log Deleted", description: "Record removed." });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
      })
      .finally(() => setIsProcessing(false));
  };

  const isBlocked = (studentId: string) => blocklist?.some(b => b.studentId === studentId);

  const userHistory = useMemo(() => {
    if (!historyUser || !allVisits) return [];
    return allVisits.filter(v => v.studentId === historyUser.studentId);
  }, [historyUser, allVisits]);

  const exportPDF = () => {
    const pdf = new jsPDF('l', 'mm', 'a4');
    pdf.setFillColor(26, 92, 46);
    pdf.rect(0, 0, 297, 30, 'F');
    pdf.setTextColor(201, 162, 39);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text("NEW ERA UNIVERSITY — VISITOR ACTIVITY ARCHIVES", 148, 20, { align: 'center' });
    
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    pdf.text(`Filtered Results: ${filteredVisits.length} records | Generated: ${format(new Date(), 'PPP p')}`, 14, 40);

    autoTable(pdf, {
      startY: 45,
      head: [['#', 'Student ID', 'Full Name', 'College', 'Purpose', 'Date & Time']],
      body: filteredVisits.map((v, i) => [i + 1, v.studentId, v.fullName, v.college || '—', v.purpose, format(v.timestamp.toDate(), 'yyyy-MM-dd HH:mm')]),
      headStyles: { fillColor: [26, 92, 46], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 244, 241] },
      styles: { fontSize: 8 },
      margin: { top: 45 }
    });

    const pageCount = (pdf as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(`NEU Library Log System | Page ${i} of ${pageCount} | Official Records`, 148, 200, { align: 'center' });
    }

    pdf.save(`NEU-Visitor-Log-${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-4xl font-black text-[#1a3a2a] tracking-tight">Visitor Activity Logs</h2>
            <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest mt-1">Archive of all library entries</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
             <Badge className="bg-[#f0f4f1] text-[#1a3a2a] border-[#d4e4d8] px-6 h-14 flex items-center font-black text-xs rounded-2xl">
              {filteredVisits.length} Records Found
             </Badge>
             <Button onClick={exportPDF} className="h-14 px-8 rounded-2xl bg-[#c9a227] text-[#0a2a1a] font-black flex gap-2 hover:bg-[#b08d20] shadow-lg transition-all">
              <FileText className="h-5 w-5" /> Export PDF
            </Button>
          </div>
        </div>

        <Card className="rounded-[2.5rem] border-[#d4e4d8] shadow-xl bg-white overflow-hidden">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">Search Name / ID / College</Label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                  <Input placeholder="Type to filter..." className="h-14 pl-12 rounded-2xl bg-[#f0f4f1] border-none font-bold text-[#1a3a2a]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">Filter Purpose</Label>
                <select className="w-full h-14 px-6 rounded-2xl bg-[#f0f4f1] border-none font-bold text-[#1a3a2a] appearance-none" value={purposeFilter} onChange={(e) => setPurposeFilter(e.target.value)}>
                  <option value="all">All Activities</option>
                  <option value="Reading Books">Reading Books</option>
                  <option value="Research / Study">Research / Study</option>
                  <option value="Computer / Internet">Computer / Internet</option>
                  <option value="Group Discussion">Group Discussion</option>
                  <option value="Thesis / Archival">Thesis / Archival</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">Filter Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                  <Input type="date" className="h-14 pl-12 rounded-2xl bg-[#f0f4f1] border-none font-bold text-[#1a3a2a]" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[3rem] border-[#d4e4d8] shadow-2xl bg-white overflow-hidden">
          <Table>
            <TableHeader className="bg-[#f0f4f1]">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="px-8 h-16 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">#</TableHead>
                <TableHead className="h-16 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Student ID</TableHead>
                <TableHead className="h-16 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Visitor Info</TableHead>
                <TableHead className="h-16 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Activity</TableHead>
                <TableHead className="h-16 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Timestamp</TableHead>
                <TableHead className="h-16 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Status</TableHead>
                <TableHead className="px-8 h-16 text-right font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={7} className="px-8 py-6"><Skeleton className="h-14 w-full rounded-2xl" /></TableCell></TableRow>
                ))
              ) : paginatedVisits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-96 text-center">
                    <div className="flex flex-col items-center justify-center opacity-10 gap-4">
                      <TableIcon className="h-24 w-24" />
                      <p className="text-3xl font-black uppercase tracking-tighter">No Logs Found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedVisits.map((v, i) => {
                const blocked = isBlocked(v.studentId);
                return (
                  <TableRow key={v.id} className="group hover:bg-[#f0f4f1]/50 border-b-[#f0f4f1] transition-colors">
                    <TableCell className="px-8 text-[#4a6741]/40 font-black text-[10px]">{(currentPage - 1) * itemsPerPage + i + 1}</TableCell>
                    <TableCell className="font-mono text-sm font-bold text-slate-500">{v.studentId}</TableCell>
                    <TableCell>
                      <button 
                        onClick={() => setHistoryUser(v)}
                        className="flex flex-col text-left hover:opacity-70 transition-all"
                      >
                        <span className="font-black text-[#1a3a2a] underline decoration-[#c9a227]/30 underline-offset-4">{v.fullName}</span>
                        <span className="text-[9px] font-black text-[#4a6741]/60 uppercase tracking-widest">{v.college || '—'}</span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-[#1a3a2a]/5 text-[#1a3a2a] border-none px-4 py-1 font-black rounded-full text-[9px] uppercase">
                        {v.purpose}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400 font-bold text-[10px] tabular-nums">
                      {format(v.timestamp.toDate(), 'MMM dd, hh:mm a')}
                    </TableCell>
                    <TableCell>
                      {blocked ? (
                        <Badge className="bg-red-50 text-red-600 border-none px-4 py-1 font-black rounded-full text-[9px] uppercase">Restricted</Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-600 border-none px-4 py-1 font-black rounded-full text-[9px] uppercase">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-8 text-right space-x-2">
                      <div className="flex justify-end gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2rem] p-10 max-w-md border-none shadow-2xl">
                            <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black text-[#1a3a2a]">Delete Log?</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogDescription className="text-[#4a6741] font-bold">Permanently remove the record for <span className="text-[#1a3a2a]">{v.fullName}</span>?</AlertDialogDescription>
                            <AlertDialogFooter className="mt-8 gap-4">
                              <AlertDialogCancel className="rounded-xl h-12 font-black border-[#d4e4d8]">Cancel</AlertDialogCancel>
                              <AlertDialogAction className="rounded-xl h-12 font-black bg-red-600 hover:bg-red-700" onClick={() => handleDeleteVisit(v.id)}>Delete Now</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {blocked ? (
                          <Button size="sm" className="h-9 px-6 rounded-full font-black text-[9px] uppercase text-emerald-600 border-emerald-200 hover:bg-emerald-50" variant="outline" onClick={() => handleUnblockUser(v.studentId)}>Unblock</Button>
                        ) : (
                          <Dialog>
                            <DialogTrigger asChild><Button size="sm" className="h-9 px-6 rounded-full font-black text-[9px] uppercase bg-[#9b1c1c] text-white hover:bg-red-900" onClick={() => setSelectedVisit(v)}>Block</Button></DialogTrigger>
                            <DialogContent className="rounded-[2.5rem] p-10 max-w-lg border-none shadow-2xl">
                              <DialogHeader><DialogTitle className="text-3xl font-black text-[#1a3a2a]">Restrict Student</DialogTitle></DialogHeader>
                              <DialogDescription className="text-[#4a6741] font-bold">Restrict access for <span className="text-red-700 underline font-black">{v.fullName}</span>.</DialogDescription>
                              <div className="py-6 space-y-4">
                                <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a]">Reason for Restriction</Label>
                                <Textarea className="rounded-2xl bg-[#f0f4f1] p-5 font-bold border-none" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Describe violation details..." />
                              </div>
                              <DialogFooter className="gap-4">
                                <Button variant="outline" className="rounded-2xl h-14 px-8 font-black border-[#d4e4d8]" onClick={() => setSelectedVisit(null)}>Cancel</Button>
                                <Button className="rounded-2xl h-14 px-10 font-black bg-red-600 text-white" disabled={!blockReason || isProcessing} onClick={handleBlockUser}>Confirm Restriction</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="p-8 bg-[#f0f4f1]/50 flex justify-between items-center">
            <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredVisits.length)} to {Math.min(currentPage * itemsPerPage, filteredVisits.length)} of {filteredVisits.length} entries</p>
            <div className="flex gap-4">
              <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="rounded-xl h-12 px-6 font-black border-[#d4e4d8] text-[#4a6741]">Previous</Button>
              <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="rounded-xl h-12 px-6 font-black border-[#d4e4d8] text-[#4a6741]">Next</Button>
            </div>
          </div>
        </Card>
      </div>

      <Sheet open={!!historyUser} onOpenChange={() => setHistoryUser(null)}>
        <SheetContent className="w-full sm:max-w-xl bg-white border-l-[#d4e4d8] p-0 overflow-hidden flex flex-col">
          {historyUser && (
            <>
              <SheetHeader className="p-10 bg-[#0a2a1a] text-white relative">
                <div className="flex items-center gap-6">
                  <div className="h-20 w-20 rounded-[2rem] bg-[#c9a227] flex items-center justify-center text-3xl font-black text-[#0a2a1a] shadow-2xl">
                    {historyUser.fullName.charAt(0)}
                  </div>
                  <div className="space-y-1">
                    <SheetTitle className="text-3xl font-black text-white">{historyUser.fullName}</SheetTitle>
                    <SheetDescription className="text-white/40 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                      <Badge className="bg-[#c9a227] text-[#0a2a1a] font-black">{historyUser.studentId}</Badge>
                      {historyUser.college}
                    </SheetDescription>
                  </div>
                </div>
                <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-[#c9a227]/10 rounded-full blur-3xl" />
              </SheetHeader>

              <div className="flex-1 p-10 space-y-10 overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-[#f0f4f1] rounded-[2rem] border-t-4 border-[#c9a227]">
                    <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">Total Visits</p>
                    <p className="text-4xl font-black text-[#1a3a2a]">{userHistory.length}</p>
                  </div>
                  <div className="p-6 bg-[#f0f4f1] rounded-[2rem] border-t-4 border-[#c9a227]">
                    <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">Status</p>
                    <p className={`text-xl font-black ${isBlocked(historyUser.studentId) ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isBlocked(historyUser.studentId) ? 'Restricted' : 'Authorized'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-[#1a3a2a] uppercase tracking-widest flex items-center gap-2">
                      <History className="h-4 w-4 text-[#c9a227]" /> Activity History
                    </h4>
                  </div>
                  <div className="rounded-[1.5rem] border border-[#d4e4d8] overflow-hidden">
                    <Table>
                      <TableHeader className="bg-[#f0f4f1]">
                        <TableRow className="border-none">
                          <TableHead className="font-black text-[9px] uppercase h-10">Purpose</TableHead>
                          <TableHead className="font-black text-[9px] uppercase h-10">Date & Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userHistory.map((h: any) => (
                          <TableRow key={h.id} className="border-b-[#f0f4f1]">
                            <TableCell className="font-bold text-xs text-[#1a3a2a] py-4">{h.purpose}</TableCell>
                            <TableCell className="text-[10px] font-black text-[#4a6741]/50 uppercase">{format(h.timestamp.toDate(), 'PP p')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-[#f0f4f1]/50 border-t border-[#d4e4d8] flex gap-4">
                {isBlocked(historyUser.studentId) ? (
                  <Button className="flex-1 h-14 rounded-2xl bg-emerald-600 font-black text-white hover:bg-emerald-700" onClick={() => handleUnblockUser(historyUser.studentId)}>
                    <CheckCircle className="mr-2 h-5 w-5" /> Restore Access
                  </Button>
                ) : (
                  <Button className="flex-1 h-14 rounded-2xl bg-[#9b1c1c] font-black text-white hover:bg-red-900" onClick={() => setSelectedVisit(historyUser)}>
                    <UserX className="mr-2 h-5 w-5" /> Block This Visitor
                  </Button>
                )}
                <Button variant="outline" className="h-14 w-14 rounded-2xl border-[#d4e4d8] flex items-center justify-center" onClick={() => setHistoryUser(null)}>
                  <Info className="h-6 w-6 text-[#1a3a2a]" />
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
