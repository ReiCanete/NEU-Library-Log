"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Megaphone, Plus, Calendar, AlertCircle, Trash2, CheckCircle2, XCircle, Clock, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useAuth } from '@/firebase';
import { collection, query, orderBy, addDoc, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [msg, setMsg] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [endDate, setEndDate] = useState(format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm"));

  const announcementsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'announcements'), orderBy('startDate', 'desc'));
  }, [db]);
  const { data: announcements, loading } = useCollection(announcementsQuery);

  const handleAdd = async () => {
    if (!msg || !startDate || !endDate || !db) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        message: msg,
        priority,
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: Timestamp.fromDate(new Date(endDate)),
        isActive: true,
        createdBy: auth.currentUser?.email || 'Admin',
        createdAt: Timestamp.now()
      });
      toast({ title: "Broadcast Live", description: "Announcement sent to kiosk." });
      setMsg(''); setPriority('normal'); setShowAddModal(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Permission Denied", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'announcements', id), { isActive: !current });
      toast({ title: "Status Updated", description: `Announcement ${!current ? 'enabled' : 'disabled'}.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast({ title: "Broadcast Ended", description: "Announcement removed." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-[#1a3a2a] tracking-tight">Kiosk Broadcasts</h2>
            <p className="text-[7px] font-black text-[#4a6741] uppercase tracking-widest mt-0.5">Institutional alerts and announcements</p>
          </div>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button className="h-9 px-4 rounded-lg bg-[#c9a227] text-[#0a2a1a] font-black hover:bg-[#b08d20] shadow-sm flex gap-2 transition-all text-[10px]">
                <Plus className="h-3.5 w-3.5" /> New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl p-6 max-w-sm border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-black text-[#1a3a2a]">Create Announcement</DialogTitle>
                <DialogDescription className="text-[8px] text-[#4a6741] font-bold uppercase tracking-widest">This message will appear on the Kiosk entry screen.</DialogDescription>
              </DialogHeader>
              <div className="py-3 space-y-3">
                <div className="space-y-1">
                  <Label className="font-black text-[7px] uppercase tracking-widest ml-1 text-[#1a3a2a]">Message Content</Label>
                  <Textarea placeholder="Type your message here..." className="rounded-lg bg-[#f0f4f1] min-h-[70px] p-2.5 text-[11px] font-bold border-none resize-none" value={msg} onChange={(e) => setMsg(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="font-black text-[7px] uppercase tracking-widest ml-1 text-[#1a3a2a]">Priority Level</Label>
                    <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                      <SelectTrigger className="h-9 rounded-lg bg-[#f0f4f1] border-none text-[10px] font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-none shadow-xl">
                        <SelectItem value="normal" className="text-[10px] font-bold">Normal (Gold)</SelectItem>
                        <SelectItem value="urgent" className="text-[10px] font-bold">Urgent (Red)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="font-black text-[7px] uppercase tracking-widest ml-1 text-[#1a3a2a]">Status</Label>
                    <div className="h-9 bg-[#f0f4f1] rounded-lg px-3 flex items-center justify-between">
                      <span className="font-bold text-[9px]">Active</span>
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="font-black text-[7px] uppercase tracking-widest ml-1 text-[#1a3a2a]">Display Starts</Label>
                    <Input type="datetime-local" className="h-9 rounded-lg bg-[#f0f4f1] border-none text-[9px] font-bold" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-black text-[7px] uppercase tracking-widest ml-1 text-[#1a3a2a]">Display Ends</Label>
                    <Input type="datetime-local" className="h-9 rounded-lg bg-[#f0f4f1] border-none text-[9px] font-bold" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="ghost" className="h-9 px-4 rounded-lg font-black text-[10px]" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button className="h-9 px-6 rounded-lg bg-[#1a3a2a] text-white font-black flex gap-2 text-[10px]" disabled={isProcessing || !msg} onClick={handleAdd}>
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Post
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="rounded-xl shadow-md border border-[#d4e4d8] bg-white overflow-hidden">
          <Table>
            <TableHeader className="bg-[#f0f4f1]">
              <TableRow className="border-none">
                <TableHead className="px-4 h-10 font-black text-[#4a6741] uppercase tracking-widest text-[7px]">Status</TableHead>
                <TableHead className="h-10 font-black text-[#4a6741] uppercase tracking-widest text-[7px]">Priority</TableHead>
                <TableHead className="h-10 font-black text-[#4a6741] uppercase tracking-widest text-[7px]">Message</TableHead>
                <TableHead className="h-10 font-black text-[#4a6741] uppercase tracking-widest text-[7px]">Schedule</TableHead>
                <TableHead className="px-4 h-10 text-right font-black text-[#4a6741] uppercase tracking-widest text-[7px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5} className="px-4 py-3"><Skeleton className="h-8 w-full rounded-lg" /></TableCell></TableRow>
                ))
              ) : announcements?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2 opacity-20">
                      <Megaphone className="h-10 w-10" />
                      <p className="text-[10px] font-black uppercase tracking-widest">No Active Broadcasts</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : announcements?.map((a) => (
                <TableRow key={a.id} className="group hover:bg-[#f0f4f1]/30 transition-colors border-b-[#f0f4f1]">
                  <TableCell className="px-4">
                    <Switch checked={a.isActive} onCheckedChange={() => toggleStatus(a.id, a.isActive)} className="scale-75" />
                  </TableCell>
                  <TableCell>
                    {a.priority === 'urgent' ? (
                      <Badge className="bg-red-500 text-white font-black uppercase text-[6px] px-1.5 py-0.5 animate-pulse border-none">Urgent</Badge>
                    ) : (
                      <Badge className="bg-[#c9a227] text-[#0a2a1a] font-black uppercase text-[6px] px-1.5 py-0.5 border-none">Normal</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[250px] py-3">
                    <p className="font-black text-[#1a3a2a] line-clamp-2 text-[10px] leading-tight">{a.message}</p>
                    <p className="text-[6px] font-black text-[#4a6741]/50 uppercase tracking-widest mt-0.5">By {a.createdBy}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1 text-[7px] font-black text-emerald-600 uppercase">
                        <CheckCircle2 className="h-2 w-2" /> {format(a.startDate.toDate(), 'MMM dd, p')}
                      </div>
                      <div className="flex items-center gap-1 text-[7px] font-black text-red-400 uppercase">
                        <XCircle className="h-2 w-2" /> {format(a.endDate.toDate(), 'MMM dd, p')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AdminLayout>
  );
}