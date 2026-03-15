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
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-[#1a3a2a] tracking-tight">Kiosk Broadcasts</h2>
            <p className="text-[8px] font-black text-[#4a6741] uppercase tracking-widest mt-0.5">Institutional alerts and announcements</p>
          </div>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button className="h-10 px-6 rounded-xl bg-[#c9a227] text-[#0a2a1a] font-black hover:bg-[#b08d20] shadow-md flex gap-2 transition-all text-xs">
                <Plus className="h-4 w-4" /> New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl p-6 max-w-md border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-[#1a3a2a]">Create Announcement</DialogTitle>
                <DialogDescription className="text-[10px] text-[#4a6741] font-bold uppercase tracking-widest">This message will appear on the Kiosk entry screen.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-black text-[8px] uppercase tracking-widest ml-1">Message Content</Label>
                  <Textarea placeholder="Type your message here..." className="rounded-xl bg-[#f0f4f1] min-h-[80px] p-3 text-xs font-bold border-none" value={msg} onChange={(e) => setMsg(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-black text-[8px] uppercase tracking-widest ml-1">Priority Level</Label>
                    <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                      <SelectTrigger className="h-10 rounded-xl bg-[#f0f4f1] border-none text-[11px] font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-none shadow-xl">
                        <SelectItem value="normal" className="text-xs font-bold">Normal (Gold)</SelectItem>
                        <SelectItem value="urgent" className="text-xs font-bold">Urgent (Red)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-black text-[8px] uppercase tracking-widest ml-1">Status</Label>
                    <div className="h-10 bg-[#f0f4f1] rounded-xl px-4 flex items-center justify-between">
                      <span className="font-bold text-[10px]">Active</span>
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-black text-[8px] uppercase tracking-widest ml-1">Display Starts</Label>
                    <Input type="datetime-local" className="h-10 rounded-xl bg-[#f0f4f1] border-none text-[10px] font-bold" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-black text-[8px] uppercase tracking-widest ml-1">Display Ends</Label>
                    <Input type="datetime-local" className="h-10 rounded-xl bg-[#f0f4f1] border-none text-[10px] font-bold" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" className="h-10 px-6 rounded-lg font-black text-xs" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button className="h-10 px-8 rounded-lg bg-[#1a3a2a] text-white font-black flex gap-2 text-xs" disabled={isProcessing || !msg} onClick={handleAdd}>
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Post
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="rounded-2xl shadow-xl border border-[#d4e4d8] bg-white overflow-hidden">
          <Table>
            <TableHeader className="bg-[#f0f4f1]">
              <TableRow className="border-none">
                <TableHead className="px-6 h-12 font-black text-[#4a6741] uppercase tracking-widest text-[8px]">Status</TableHead>
                <TableHead className="h-12 font-black text-[#4a6741] uppercase tracking-widest text-[8px]">Priority</TableHead>
                <TableHead className="h-12 font-black text-[#4a6741] uppercase tracking-widest text-[8px]">Message</TableHead>
                <TableHead className="h-12 font-black text-[#4a6741] uppercase tracking-widest text-[8px]">Schedule</TableHead>
                <TableHead className="px-6 h-12 text-right font-black text-[#4a6741] uppercase tracking-widest text-[8px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5} className="px-6 py-4"><Skeleton className="h-10 w-full rounded-lg" /></TableCell></TableRow>
                ))
              ) : announcements?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4 opacity-20">
                      <Megaphone className="h-16 w-16" />
                      <p className="text-sm font-black uppercase tracking-widest">No Active Broadcasts</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : announcements?.map((a) => (
                <TableRow key={a.id} className="group hover:bg-[#f0f4f1]/30 transition-colors border-b-[#f0f4f1]">
                  <TableCell className="px-6">
                    <Switch checked={a.isActive} onCheckedChange={() => toggleStatus(a.id, a.isActive)} className="scale-75" />
                  </TableCell>
                  <TableCell>
                    {a.priority === 'urgent' ? (
                      <Badge className="bg-red-500 text-white font-black uppercase text-[7px] animate-pulse">Urgent</Badge>
                    ) : (
                      <Badge className="bg-[#c9a227] text-[#0a2a1a] font-black uppercase text-[7px]">Normal</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[300px] py-4">
                    <p className="font-black text-[#1a3a2a] line-clamp-2 text-xs leading-tight">{a.message}</p>
                    <p className="text-[7px] font-black text-[#4a6741]/50 uppercase tracking-widest mt-0.5">By {a.createdBy}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 text-[8px] font-black text-emerald-600 uppercase">
                        <CheckCircle2 className="h-2.5 w-2.5" /> {format(a.startDate.toDate(), 'MMM dd, p')}
                      </div>
                      <div className="flex items-center gap-1.5 text-[8px] font-black text-red-400 uppercase">
                        <XCircle className="h-2.5 w-2.5" /> {format(a.endDate.toDate(), 'MMM dd, p')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="h-4 w-4" />
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