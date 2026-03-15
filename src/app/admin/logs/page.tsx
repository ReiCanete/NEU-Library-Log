
"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, Filter, Download, UserX, UserCheck, Loader2, ArrowUpDown, ChevronLeft, ChevronRight, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection } from '@/firebase';
import { db, auth } from '@/firebase/config';
import { collection, query, orderBy, addDoc, deleteDoc, doc, Timestamp, where, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdminLayout } from '@/components/admin/admin-layout';

export default function VisitorLogs() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Firestore Queries
  const visitsQuery = useMemo(() => query(collection(db, 'visits'), orderBy('timestamp', 'desc')), []);
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);

  const blocklistQuery = useMemo(() => query(collection(db, 'blocklist')), []);
  const { data: blocklist, loading: blocklistLoading } = useCollection(blocklistQuery);

  // Blocking/Unblocking Logic
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Filtered visits
  const filteredVisits = useMemo(() => {
    if (!allVisits) return [];
    return allVisits.filter(v => {
      const matchesSearch = v.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           v.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           v.college.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPurpose = purposeFilter === 'all' || v.purpose === purposeFilter;
      return matchesSearch && matchesPurpose;
    });
  }, [allVisits, searchTerm, purposeFilter]);

  // Pagination
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
        blockedBy: auth.currentUser?.email || 'System',
        blockedAt: Timestamp.now()
      });
      toast({ title: "User Blocked", description: `${selectedVisit.fullName} has been restricted.` });
      setSelectedVisit(null);
      setBlockReason('');
    } catch (e: any) {
      toast({ title: "Action Failed", description: e.message, variant: "destructive" });
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
        toast({ title: "Access Restored", description: "Student can now enter the library again." });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteVisit = async (visitId: string) => {
    if (!confirm('Are you sure you want to delete this visit record? This action cannot be undone.')) return;
    
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'visits', visitId));
      toast({ title: "Record Deleted", description: "The visit log has been permanently removed." });
    } catch (e: any) {
      toast({ title: "Delete Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const isBlocked = (studentId: string) => {
    return blocklist?.some(b => b.studentId === studentId);
  };

  const exportFilteredData = () => {
    if (filteredVisits.length === 0) return;
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(22);
    doc.setTextColor(10, 42, 26);
    doc.text("NEU Library — Visitor Activity Log", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, 28);
    doc.text(`Filter: ${purposeFilter} | Search: ${searchTerm || 'None'}`, 14, 33);

    autoTable(doc, {
      startY: 40,
      head: [['ID', 'Full Name', 'College/Program', 'Purpose', 'Method', 'Date & Time']],
      body: filteredVisits.map(v => [
        v.studentId,
        v.fullName,
        `${v.college}\n${v.program}`,
        v.purpose,
        v.loginMethod.toUpperCase(),
        format(v.timestamp.toDate(), 'yyyy-MM-dd HH:mm')
      ]),
      headStyles: { fillColor: [26, 92, 46], fontSize: 10 },
      styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 240] }
    });

    doc.save(`NEU-Library-Logs-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
    toast({ title: "Log Exported", description: "Current view has been saved to PDF." });
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black text-[#0a2a1a] tracking-tight">Visitor Activity Logs</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Detailed history of all library entries</p>
          </div>
          <Button 
            onClick={exportFilteredData}
            className="h-14 px-8 rounded-2xl bg-[#c9a227] text-[#0a2a1a] font-black flex gap-2 hover:bg-[#b08d20] shadow-lg shadow-[#c9a227]/20"
          >
            <FileText className="h-5 w-5" /> Export View to PDF
          </Button>
        </div>

        {/* Search & Filters */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1 w-full space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Search Records</Label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                  <Input 
                    placeholder="Filter by name, ID, or college..." 
                    className="h-14 pl-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 w-full"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              </div>
              <div className="w-full md:w-64 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Filter by Purpose</Label>
                <select 
                  className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 appearance-none cursor-pointer"
                  value={purposeFilter}
                  onChange={(e) => { setPurposeFilter(e.target.value); setCurrentPage(1); }}
                >
                  <option value="all">All Purposes</option>
                  <option value="Reading Books">Reading Books</option>
                  <option value="Research / Study">Research / Study</option>
                  <option value="Computer / Internet">Computer / Internet</option>
                  <option value="Group Discussion">Group Discussion</option>
                  <option value="Thesis / Archival">Thesis / Archival</option>
                  <option value="Other Purpose">Other Purpose</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Logs Table */}
        <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-[#0a2a1a] hover:bg-[#0a2a1a]">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="px-8 h-16 font-black text-white uppercase tracking-widest text-[10px]">#</TableHead>
                  <TableHead className="h-16 font-black text-white uppercase tracking-widest text-[10px]">Student ID</TableHead>
                  <TableHead className="h-16 font-black text-white uppercase tracking-widest text-[10px]">Visitor Info</TableHead>
                  <TableHead className="h-16 font-black text-white uppercase tracking-widest text-[10px]">Purpose</TableHead>
                  <TableHead className="h-16 font-black text-white uppercase tracking-widest text-[10px]">Time</TableHead>
                  <TableHead className="h-16 font-black text-white uppercase tracking-widest text-[10px]">Status</TableHead>
                  <TableHead className="px-8 h-16 text-right font-black text-white uppercase tracking-widest text-[10px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitsLoading || blocklistLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="px-8"><Skeleton className="h-14 w-full rounded-2xl" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedVisits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-96 text-center">
                      <div className="flex flex-col items-center justify-center opacity-20 space-y-4">
                        <Search className="h-24 w-24" />
                        <p className="text-2xl font-black uppercase">No records found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedVisits.map((v, i) => {
                  const blocked = isBlocked(v.studentId);
                  return (
                    <TableRow key={v.id} className="group hover:bg-slate-50 transition-colors border-b-slate-50">
                      <TableCell className="px-8 text-slate-300 font-black text-xs">{(currentPage - 1) * itemsPerPage + i + 1}</TableCell>
                      <TableCell className="font-mono text-sm font-bold text-slate-500">{v.studentId}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-black text-[#0a2a1a]">{v.fullName}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[150px]">{v.program}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-[#1a5c2e]/5 text-[#1a5c2e] hover:bg-[#1a5c2e]/10 border-none px-4 py-1.5 font-black rounded-full text-[9px] uppercase">
                          {v.purpose}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 font-bold text-[10px] tabular-nums">
                        {format(v.timestamp.toDate(), 'MMM dd, hh:mm a')}
                      </TableCell>
                      <TableCell>
                        {blocked ? (
                          <Badge className="bg-red-50 text-red-600 hover:bg-red-50 border-none px-4 py-1.5 font-black rounded-full text-[9px] uppercase">Blocked</Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-none px-4 py-1.5 font-black rounded-full text-[9px] uppercase">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-8 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={isProcessing}
                            className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50"
                            onClick={() => handleDeleteVisit(v.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

                          {blocked ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={isProcessing}
                              className="h-9 px-6 rounded-full font-black text-[9px] uppercase text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => handleUnblockUser(v.studentId)}
                            >
                              Unblock Access
                            </Button>
                          ) : (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  className="h-9 px-6 rounded-full font-black text-[9px] uppercase bg-red-500 hover:bg-red-600 shadow-md"
                                  onClick={() => setSelectedVisit(v)}
                                >
                                  Block
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-10 max-w-lg">
                                <DialogHeader className="space-y-4">
                                  <DialogTitle className="text-3xl font-black text-[#0a2a1a]">Restrict Access</DialogTitle>
                                  <DialogDescription className="text-slate-500 font-medium">
                                    Are you sure you want to block <span className="text-red-600 font-black underline">{selectedVisit?.fullName}</span>? This student will be immediately denied entry.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="py-8 space-y-3">
                                  <Label className="font-black text-[#0a2a1a] text-[10px] uppercase tracking-widest ml-1">Reason for blocking</Label>
                                  <Textarea 
                                    placeholder="Describe the violation..." 
                                    className="rounded-2xl border-slate-100 bg-slate-50 focus:bg-white min-h-[140px] p-5 font-bold text-sm"
                                    value={blockReason}
                                    onChange={(e) => setBlockReason(e.target.value)}
                                  />
                                </div>
                                <DialogFooter className="gap-4">
                                  <Button variant="outline" className="rounded-2xl h-14 px-8 font-black border-slate-200" onClick={() => setSelectedVisit(null)}>Cancel</Button>
                                  <Button 
                                    variant="destructive" 
                                    className="rounded-2xl h-14 px-10 font-black shadow-lg"
                                    disabled={isProcessing || !blockReason}
                                    onClick={handleBlockUser}
                                  >
                                    {isProcessing ? <Loader2 className="animate-spin" /> : "Confirm Block"}
                                  </Button>
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
            
            <div className="p-8 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Showing <span className="text-[#0a2a1a] font-black">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-[#0a2a1a] font-black">{Math.min(currentPage * itemsPerPage, filteredVisits.length)}</span> of <span className="text-[#0a2a1a] font-black">{filteredVisits.length}</span> entries
              </p>
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="rounded-xl h-12 px-6 font-black border-slate-200 text-slate-600 hover:bg-white transition-all"
                >
                  <ChevronLeft className="h-5 w-5 mr-2" /> Previous
                </Button>
                <Button 
                  variant="outline" 
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="rounded-xl h-12 px-6 font-black border-slate-200 text-slate-600 hover:bg-white transition-all"
                >
                  Next <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
