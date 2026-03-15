
"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Megaphone, Plus, Calendar, AlertCircle, Trash2, CheckCircle2, XCircle, Clock, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection } from '@/firebase';
import { db, auth } from '@/firebase/config';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [msg, setMsg] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [endDate, setEndDate] = useState(format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm"));

  const announcementsQuery = useMemo(() => query(collection(db, 'announcements'), orderBy('startDate', 'desc')), []);
  const { data: announcements, loading } = useCollection(announcementsQuery);

  const handleAdd = async () => {
    if (!msg || !startDate || !endDate) return;
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
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'announcements', id), { isActive: !current });
      toast({ title: "Status Updated", description: `Announcement ${!current ? 'enabled' : 'disabled'}.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast({ title: "Broadcast Ended", description: "Announcement removed." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-4xl font-black text-[#1a3a2a] tracking-tight">Kiosk Broadcasts</h2>
            <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest mt-1">Institutional alerts and announcements</p>
          </div>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button className="h-16 px-10 rounded-[1.5rem] bg-[#c9a227] text-[#0a2a1a] font-black hover:bg-[#b08d20] shadow-xl flex gap-3 transition-all">
                <Plus className="h-6 w-6" /> New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-10 max-w-xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-3xl font-black text-[#1a3a2a]">Create Announcement</DialogTitle>
                <DialogDescription className="text-[#4a6741] font-bold">This message will appear at the top of the Kiosk entry screen.</DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-6">
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest ml-1">Message Content</Label>
                  <Textarea placeholder="Type your message here..." className="rounded-2xl bg-[#f0f4f1] min-h-[120px] p-5 font-bold border-none" value={msg} onChange={(e) => setMsg(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest ml-1">Priority Level</Label>
                    <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                      <SelectTrigger className="h-14 rounded-2xl bg-[#f0f4f1] border-none font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-xl">
                        <SelectItem value="normal" className="font-bold">Normal (Gold)</SelectItem>
                        <SelectItem value="urgent" className="font-bold">Urgent (Red Pulsing)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest ml-1">Status</Label>
                    <div className="h-14 bg-[#f0f4f1] rounded-2xl px-6 flex items-center justify-between">
                      <span className="font-bold text-sm">Activate Now</span>
                      <Badge className="bg-emerald-500 font-black">Ready</Badge>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest ml-1">Display Starts</Label>
                    <Input type="datetime-local" className="h-14 rounded-2xl bg-[#f0f4f1] border-none font-bold" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest ml-1">Display Ends</Label>
                    <Input type="datetime-local" className="h-14 rounded-2xl bg-[#f0f4f1] border-none font-bold" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="h-14 px-8 rounded-xl font-black" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button className="h-14 px-12 rounded-xl bg-[#1a3a2a] text-white font-black flex gap-2" disabled={isProcessing || !msg} onClick={handleAdd}>
                  {isProcessing ? <Loader2 className="animate-spin" /> : <Send className="h-5 w-5" />}
                  Post Broadcast
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="rounded-[3rem] shadow-2xl border border-[#d4e4d8] bg-white overflow-hidden">
          <Table>
            <TableHeader className="bg-[#f0f4f1]">
              <TableRow className="border-none">
                <TableHead className="px-10 h-16 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Status</TableHead>
                <TableHead className="h-16 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Priority</TableHead>
                <TableHead className="h-16 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Message</TableHead>
                <TableHead className="h-16 font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Schedule</TableHead>
                <TableHead className="px-10 h-16 text-right font-black text-[#4a6741] uppercase tracking-widest text-[9px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5} className="px-10 py-6"><Skeleton className="h-16 w-full rounded-2xl" /></TableCell></TableRow>
                ))
              ) : announcements?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-96 text-center">
                    <div className="flex flex-col items-center justify-center space-y-6 opacity-20">
                      <Megaphone className="h-32 w-32" />
                      <p className="text-2xl font-black uppercase tracking-tighter">No Active Broadcasts</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : announcements?.map((a) => (
                <TableRow key={a.id} className="group hover:bg-[#f0f4f1]/30 transition-colors border-b-[#f0f4f1]">
                  <TableCell className="px-10">
                    <Switch checked={a.isActive} onCheckedChange={() => toggleStatus(a.id, a.isActive)} />
                  </TableCell>
                  <TableCell>
                    {a.priority === 'urgent' ? (
                      <Badge className="bg-red-500 text-white font-black uppercase text-[9px] animate-pulse">Urgent</Badge>
                    ) : (
                      <Badge className="bg-[#c9a227] text-[#0a2a1a] font-black uppercase text-[9px]">Normal</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[300px] py-6">
                    <p className="font-black text-[#1a3a2a] line-clamp-2 leading-tight">{a.message}</p>
                    <p className="text-[9px] font-black text-[#4a6741]/50 uppercase tracking-widest mt-1">By {a.createdBy}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase">
                        <CheckCircle2 className="h-3 w-3" /> {format(a.startDate.toDate(), 'MMM dd, p')}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase">
                        <XCircle className="h-3 w-3" /> {format(a.endDate.toDate(), 'MMM dd, p')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-10 text-right">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="h-5 w-5" />
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
