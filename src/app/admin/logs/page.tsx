
"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Search, Filter, Trash2, Loader2, ChevronLeft, ChevronRight, FileText, UserX, Calendar, Table as TableIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection } from '@/firebase';
import { db, auth } from '@/firebase/config';
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdminLayout } from '@/components/admin/admin-layout';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export default function VisitorLogs() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const visitsQuery = useMemo(() => query(collection(db, 'visits'), orderBy('timestamp', 'desc')), []);
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);

  const blocklistQuery = useMemo(() => query(collection(db, 'blocklist')), []);
  const { data: blocklist, loading: blocklistLoading } = useCollection(blocklistQuery);

  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredVisits = useMemo(() => {
    if (!allVisits) return [];
    return allVisits.filter(v => {
      const matchesSearch = v.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           v.studentId.toLowerCase().includes(searchTerm.toLowerCase());
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
    if (!selectedVisit || !blockReason) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'blocklist'), {
        studentId: selectedVisit.studentId,
        fullName: selectedVisit.fullName,
        reason: blockReason,
        blockedBy: auth.currentUser?.email || 'Staff',
        blockedAt: Timestamp.now()
      });
      toast({ title: "Access Restricted", description: `${selectedVisit.fullName} is now blocked.` });
      setSelectedVisit(null);
      setBlockReason('');
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnblockUser = async (studentId: string) => {
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
    const docRef = doc(db, 'visits', visitId);
    setIsProcessing(true);
    deleteDoc(docRef)
      .then(() => {
        toast({ title: "Log Deleted", description: "Record removed from archives." });
      })
      .catch(async (e) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
      })
      .finally(() => setIsProcessing(false));
  };

  const isBlocked = (studentId: string) => blocklist?.some(b => b.studentId === studentId);

  const exportPDF = () => {
    const pdf = new jsPDF('l', 'mm', 'a4');
    pdf.setFontSize(22);
    pdf.setTextColor(26, 92, 46);
    pdf.text("NEU Library — Visitor Activity Archives", 14, 20);
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    pdf.text(`Generated: ${format(new Date(), 'PPP p')} | Filtered Results: ${filteredVisits.length}`, 14, 28);

    autoTable(pdf, {
      startY: 40,
      head: [['ID', 'Full Name', 'College', 'Purpose', 'Date & Time']],
      body: filteredVisits.map(v => [v.studentId, v.fullName, v.college || '—', v.purpose, format(v.timestamp.toDate(), 'yyyy-MM-dd HH:mm')]),
      headStyles: { fillColor: [26, 92, 46] },
      alternateRowStyles: { fillColor: [240, 244, 241] }
    });
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
             <Button onClick={exportPDF} className="h-14 px-8 rounded-2xl bg-[#c9a227] text-[#0a2a1a] font-black flex gap-2 hover:bg-[#b08d20] shadow-lg">
              <FileText className="h-5 w-5" /> Export PDF
            </Button>
          </div>
        </div>

        <Card className="rounded-[2.5rem] border-[#d4e4d8] shadow-xl bg-white overflow-hidden">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">Search Name / ID</Label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                  <Input placeholder="Search..." className="h-14 pl-12 rounded-2xl bg-[#f0f4f1] border-none font-bold text-[#1a3a2a]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                  <TableRow key={v.id} className="group hover:bg-[#f0f4f1]/50 border-b-[#f0f4f1]">
                    <TableCell className="px-8 text-[#4a6741]/40 font-black text-[10px]">{(currentPage - 1) * itemsPerPage + i + 1}</TableCell>
                    <TableCell className="font-mono text-sm font-bold text-slate-500">{v.studentId}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-black text-[#1a3a2a]">{v.fullName}</span>
                        <span className="text-[9px] font-black text-[#4a6741]/60 uppercase tracking-widest">{v.college || '—'}</span>
                      </div>
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
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2rem] p-10 max-w-md">
                            <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black text-[#1a3a2a]">Delete Log?</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogDescription className="text-[#4a6741] font-bold">This permanent action removes the record for <span className="text-[#1a3a2a]">{v.fullName}</span>.</AlertDialogDescription>
                            <AlertDialogFooter className="mt-8 gap-4">
                              <AlertDialogCancel className="rounded-xl h-12 font-black">Cancel</AlertDialogCancel>
                              <AlertDialogAction className="rounded-xl h-12 font-black bg-red-600 hover:bg-red-700" onClick={() => handleDeleteVisit(v.id)}>Delete Now</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {blocked ? (
                          <Button size="sm" className="h-9 px-6 rounded-full font-black text-[9px] uppercase text-emerald-600 border-emerald-200 hover:bg-emerald-50" variant="outline" onClick={() => handleUnblockUser(v.studentId)}>Unblock</Button>
                        ) : (
                          <Dialog>
                            <DialogTrigger asChild><Button size="sm" className="h-9 px-6 rounded-full font-black text-[9px] uppercase bg-[#9b1c1c] hover:bg-red-900" onClick={() => setSelectedVisit(v)}>Block</Button></DialogTrigger>
                            <DialogContent className="rounded-[2.5rem] p-10 max-w-lg">
                              <DialogHeader><DialogTitle className="text-3xl font-black text-[#1a3a2a]">Restrict Student</DialogTitle></DialogHeader>
                              <DialogDescription className="text-[#4a6741] font-bold">Block access for <span className="text-red-700 underline">{selectedVisit?.fullName}</span>?</DialogDescription>
                              <div className="py-6 space-y-2">
                                <Label className="font-black text-[9px] uppercase tracking-widest">Reason</Label>
                                <Textarea className="rounded-2xl bg-[#f0f4f1] p-5 font-bold" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Describe violation..." />
                              </div>
                              <DialogFooter className="gap-4">
                                <Button variant="outline" className="rounded-2xl h-14 px-8 font-black" onClick={() => setSelectedVisit(null)}>Cancel</Button>
                                <Button className="rounded-2xl h-14 px-10 font-black bg-red-600" disabled={!blockReason || isProcessing} onClick={handleBlockUser}>Confirm Block</Button>
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
    </AdminLayout>
  );
}
