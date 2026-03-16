
"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Search, Trash2, UserX, Loader2, ShieldCheck, AlertTriangle, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useAuth } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc, Timestamp, addDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AdminLayout } from '@/components/admin/admin-layout';

export default function BlocklistManagement() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form state
  const [newBlockId, setNewBlockId] = useState('');
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const blocklistQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'blocklist'), orderBy('blockedAt', 'desc'));
  }, [db]);
  const { data: blocklist, loading: blocklistLoading } = useCollection(blocklistQuery);

  const filteredBlocklist = useMemo(() => {
    if (!blocklist) return [];
    return blocklist.filter(b => 
      b.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.studentId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [blocklist, searchTerm]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredBlocklist.length / itemsPerPage);
  const paginatedBlocks = filteredBlocklist.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleUnblockUser = async (docId: string, studentName: string) => {
    if (!db) return;
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'blocklist', docId));
      toast({ title: "Access Restored", description: `${studentName} is no longer restricted.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualBlock = async () => {
    if (!newBlockId || !newBlockReason || !db) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'blocklist'), {
        studentId: newBlockId,
        fullName: newBlockName || 'Unregistered Account',
        reason: newBlockReason,
        blockedBy: auth.currentUser?.email || 'Staff',
        blockedAt: Timestamp.now()
      });
      toast({ title: "Success", description: "ID added to blocklist." });
      setNewBlockId(''); setNewBlockName(''); setNewBlockReason('');
      setShowAddModal(false);
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-4xl font-black text-[#1a3a2a] tracking-tight">Access Restrictions</h2>
            <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest mt-1">Managed proactive prohibited list</p>
          </div>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button className="h-14 px-8 rounded-2xl bg-[#9b1c1c] text-white font-black hover:bg-red-900 shadow-xl shadow-red-200 flex gap-3 transition-all">
                <ShieldAlert className="h-5 w-5" /> Manually Block ID
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-10 max-w-lg border-none shadow-2xl">
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-3xl font-black text-[#1a3a2a]">Restrict New ID</DialogTitle>
                <DialogDescription className="text-[#4a6741] font-bold">Immediately deny access to this ID at the kiosk.</DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-6">
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a] ml-1">Student ID</Label>
                  <Input placeholder="e.g. 25-12946-343" className="h-14 rounded-2xl bg-[#f0f4f1] border-none font-bold text-[#1a3a2a]" value={newBlockId} onChange={(e) => setNewBlockId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a] ml-1">Full Name (Optional)</Label>
                  <Input placeholder="Visitor's name" className="h-14 rounded-2xl bg-[#f0f4f1] border-none font-bold text-[#1a3a2a]" value={newBlockName} onChange={(e) => setNewBlockName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a] ml-1">Reason</Label>
                  <Textarea placeholder="Describe violation details..." className="rounded-2xl bg-[#f0f4f1] min-h-[100px] p-5 font-bold border-none" value={newBlockReason} onChange={(e) => setNewBlockReason(e.target.value)} />
                </div>
              </div>
              <DialogFooter className="gap-4">
                <Button variant="outline" className="rounded-2xl h-14 px-8 font-black border-[#d4e4d8]" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button className="rounded-2xl h-14 px-10 font-black bg-[#9b1c1c] text-white" disabled={isProcessing || !newBlockId || !newBlockReason} onClick={handleManualBlock}>
                  {isProcessing ? <Loader2 className="animate-spin" /> : "Confirm Block"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="rounded-[3rem] shadow-2xl border border-[#d4e4d8] bg-white overflow-hidden">
          <CardHeader className="p-10 border-b border-[#f0f4f1]">
            <div className="flex flex-col md:flex-row justify-between gap-6 items-end">
              <div className="flex-1 w-full space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">Search Blocklist</Label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                  <Input placeholder="Search name or ID..." className="h-14 pl-12 rounded-2xl bg-[#f0f4f1] border-none font-bold text-[#1a3a2a] w-full max-w-md" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">
                  {filteredBlocklist.length} restricted records
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-[#f0f4f1]">
                <TableRow className="border-none">
                  <TableHead className="px-10 h-14 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Student ID</TableHead>
                  <TableHead className="h-14 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Full Name</TableHead>
                  <TableHead className="h-14 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Reason</TableHead>
                  <TableHead className="h-14 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Date</TableHead>
                  <TableHead className="px-10 h-14 text-right font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocklistLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={5} className="px-10 py-6"><Skeleton className="h-12 w-full rounded-2xl" /></TableCell></TableRow>
                  ))
                ) : paginatedBlocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-96 text-center">
                      <div className="flex flex-col items-center justify-center space-y-6">
                        <ShieldCheck className="h-32 w-32 text-[#c9a227] opacity-20" />
                        <div className="space-y-1">
                          <p className="text-2xl font-black text-[#1a3a2a] uppercase tracking-tighter">No Active Blocks</p>
                          <p className="text-sm font-bold text-[#4a6741]/50 uppercase tracking-widest">The library access list is clear</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedBlocks.map((b) => (
                  <TableRow key={b.id} className="group hover:bg-red-50/30 transition-colors border-b-[#f0f4f1]">
                    <TableCell className="px-10 font-mono text-sm font-bold text-slate-500">{b.studentId}</TableCell>
                    <TableCell className="font-black text-[#1a3a2a]">{b.fullName}</TableCell>
                    <TableCell className="max-w-[250px] font-bold text-xs text-[#4a6741] truncate">{b.reason}</TableCell>
                    <TableCell className="text-slate-400 font-bold text-[10px] uppercase tabular-nums">
                      {format(b.blockedAt.toDate(), 'PPP')}
                    </TableCell>
                    <TableCell className="px-10 text-right">
                      <Button variant="outline" size="sm" disabled={isProcessing} className="h-10 px-8 rounded-full font-black text-[9px] uppercase border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm" onClick={() => handleUnblockUser(b.id, b.fullName)}>
                        Restore Access
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination UI */}
            {!blocklistLoading && totalPages > 1 && (
              <div className="flex items-center justify-between px-10 py-6 border-t border-[#f0f4f1] bg-white">
                <div className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredBlocklist.length)} of {filteredBlocklist.length} restricted records
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-[#d4e4d8]"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="sm"
                            className={`h-8 w-8 rounded-lg text-[10px] font-black ${
                              currentPage === page ? 'bg-[#1a3a2a] text-white' : 'border-[#d4e4d8] text-[#1a3a2a]'
                            }`}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        );
                      }
                      if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="text-slate-300 px-1">...</span>;
                      }
                      return null;
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-[#d4e4d8]"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
