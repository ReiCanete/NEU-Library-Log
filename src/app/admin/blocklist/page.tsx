
"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldX, Search, Trash2, UserX, UserPlus, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection } from '@/firebase';
import { db } from '@/firebase/config';
import { collection, query, orderBy, deleteDoc, doc, Timestamp, where, getDocs, addDoc } from 'firebase/firestore';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Add Block State
  const [newBlockId, setNewBlockId] = useState('');
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const blocklistQuery = useMemo(() => query(collection(db, 'blocklist'), orderBy('blockedAt', 'desc')), []);
  const { data: blocklist, loading: blocklistLoading } = useCollection(blocklistQuery);

  const filteredBlocklist = useMemo(() => {
    if (!blocklist) return [];
    return blocklist.filter(b => 
      b.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.studentId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [blocklist, searchTerm]);

  const handleUnblockUser = async (docId: string, studentName: string) => {
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
    if (!newBlockId || !newBlockReason) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'blocklist'), {
        studentId: newBlockId,
        fullName: newBlockName || 'Unregistered Student',
        reason: newBlockReason,
        blockedBy: 'Admin',
        blockedAt: Timestamp.now()
      });
      toast({ title: "Manual Block Success", description: `ID ${newBlockId} is now restricted.` });
      setNewBlockId('');
      setNewBlockName('');
      setNewBlockReason('');
      setShowAddModal(false);
    } catch (e: any) {
      toast({ title: "Block Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-4xl font-black text-[#0a2a1a] tracking-tight">Access Restrictions</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Manage prohibited entry list</p>
          </div>
          
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button className="h-14 px-8 rounded-2xl bg-red-600 text-white font-black hover:bg-red-700 shadow-xl shadow-red-200 transition-all flex gap-3">
                <UserX className="h-5 w-5" /> Manually Block ID
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-10 max-w-lg border-none">
              <DialogHeader className="space-y-4">
                <DialogTitle className="text-3xl font-black text-[#0a2a1a]">Manually Block ID</DialogTitle>
                <DialogDescription className="text-slate-500 font-medium text-base leading-tight">
                  This will immediately deny entry to any student using this ID at the kiosk.
                </DialogDescription>
              </DialogHeader>
              <div className="py-8 space-y-6">
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-[#0a2a1a] ml-1">Student ID (Required)</Label>
                  <Input 
                    placeholder="e.g. 25-12946-343" 
                    className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-slate-700"
                    value={newBlockId}
                    onChange={(e) => setNewBlockId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-[#0a2a1a] ml-1">Student Name (Optional)</Label>
                  <Input 
                    placeholder="Full name of student" 
                    className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-slate-700"
                    value={newBlockName}
                    onChange={(e) => setNewBlockName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-[#0a2a1a] ml-1">Reason for Blocking</Label>
                  <Textarea 
                    placeholder="Describe violation..." 
                    className="rounded-2xl border-slate-100 bg-slate-50 min-h-[100px] p-5 font-bold"
                    value={newBlockReason}
                    onChange={(e) => setNewBlockReason(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="gap-4">
                <Button variant="outline" className="rounded-2xl h-14 px-8 font-black border-slate-200" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button 
                  className="rounded-2xl h-14 px-10 font-black bg-red-600 hover:bg-red-700"
                  disabled={isProcessing || !newBlockId || !newBlockReason}
                  onClick={handleManualBlock}
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : "Confirm Block"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="rounded-[3rem] shadow-2xl border-none bg-white overflow-hidden">
          <CardHeader className="p-10 border-b border-slate-50">
            <div className="flex flex-col md:flex-row justify-between gap-6 items-end">
              <div className="flex-1 w-full space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Search Blocklist</Label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                  <Input 
                    placeholder="Filter by Name or ID..." 
                    className="h-14 pl-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 w-full md:max-w-md"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {filteredBlocklist.length} restricted records active
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-none">
                  <TableHead className="px-10 h-14 font-black text-slate-400 uppercase tracking-widest text-[9px]">Student ID</TableHead>
                  <TableHead className="h-14 font-black text-slate-400 uppercase tracking-widest text-[9px]">Full Name</TableHead>
                  <TableHead className="h-14 font-black text-slate-400 uppercase tracking-widest text-[9px]">Block Reason</TableHead>
                  <TableHead className="h-14 font-black text-slate-400 uppercase tracking-widest text-[9px]">Date Restricted</TableHead>
                  <TableHead className="h-14 font-black text-slate-400 uppercase tracking-widest text-[9px]">Blocked By</TableHead>
                  <TableHead className="px-10 h-14 text-right font-black text-slate-400 uppercase tracking-widest text-[9px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocklistLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="px-10 py-6"><Skeleton className="h-12 w-full rounded-2xl" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredBlocklist.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-96 text-center">
                      <div className="flex flex-col items-center justify-center opacity-10 space-y-6">
                        <ShieldCheck className="h-32 w-32" />
                        <p className="text-3xl font-black uppercase tracking-tighter">No Active Blocks</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredBlocklist.map((b) => (
                  <TableRow key={b.id} className="group hover:bg-red-50/30 transition-colors border-b-slate-50">
                    <TableCell className="px-10 font-mono text-sm font-bold text-slate-500">{b.studentId}</TableCell>
                    <TableCell className="font-black text-[#0a2a1a]">{b.fullName}</TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="text-xs text-slate-500 font-bold truncate leading-relaxed">{b.reason}</p>
                    </TableCell>
                    <TableCell className="text-slate-400 font-bold text-[10px] uppercase tabular-nums">
                      {format(b.blockedAt.toDate(), 'PPP')}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none px-4 py-1 font-black rounded-full text-[9px] uppercase">
                        {b.blockedBy}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-10 text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={isProcessing}
                        className="h-10 px-8 rounded-full font-black text-[9px] uppercase border-red-200 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                        onClick={() => handleUnblockUser(b.id, b.fullName)}
                      >
                        {isProcessing ? <Loader2 className="animate-spin h-3 w-3" /> : <Trash2 className="h-4 w-4 mr-2" />}
                        Unblock
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
