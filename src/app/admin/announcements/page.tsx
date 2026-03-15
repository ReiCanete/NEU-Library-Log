"use client";

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Megaphone, Plus, Trash2, CheckCircle2, XCircle, Send, Loader2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useAuth, errorEmitter, FirestorePermissionError } from '@/firebase';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [msg, setMsg] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [endDate, setEndDate] = useState(format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm"));

  const announcementsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'announcements'), orderBy('startDate', 'desc'));
  }, [db]);
  const { data: announcements, loading } = useCollection(announcementsQuery);

  const resetForm = () => {
    setMsg('');
    setPriority('normal');
    setStartDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setEndDate(format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm"));
    setEditingId(null);
  };

  const handleSave = () => {
    if (!msg || !startDate || !endDate || !db) return;
    setIsProcessing(true);
    
    // Close modal immediately for optimistic feel
    setShowModal(false);

    const announcementData = {
      message: msg,
      priority,
      startDate: Timestamp.fromDate(new Date(startDate)),
      endDate: Timestamp.fromDate(new Date(endDate)),
      isActive: true,
      createdBy: auth.currentUser?.email || 'Admin',
      updatedAt: Timestamp.now()
    };

    if (editingId) {
      const docRef = doc(db, 'announcements', editingId);
      updateDoc(docRef, announcementData)
        .catch(async () => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: announcementData
          }));
        });
      toast({ title: "Broadcast Updated", description: "The message has been refreshed on the kiosk." });
    } else {
      const newData = { ...announcementData, createdAt: Timestamp.now() };
      addDoc(collection(db, 'announcements'), newData)
        .catch(async () => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: '/announcements',
            operation: 'create',
            requestResourceData: newData
          }));
        });
      toast({ title: "Broadcast Live", description: "New announcement sent to kiosk display." });
    }

    resetForm();
    setIsProcessing(false);
  };

  const handleEdit = (a: any) => {
    setEditingId(a.id);
    setMsg(a.message);
    setPriority(a.priority);
    setStartDate(format(a.startDate.toDate(), "yyyy-MM-dd'T'HH:mm"));
    setEndDate(format(a.endDate.toDate(), "yyyy-MM-dd'T'HH:mm"));
    setShowModal(true);
  };

  const toggleStatus = (id: string, current: boolean) => {
    if (!db) return;
    const docRef = doc(db, 'announcements', id);
    updateDoc(docRef, { isActive: !current })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: { isActive: !current }
        }));
      });
  };

  const handleDelete = (id: string) => {
    if (!db) return;
    const docRef = doc(db, 'announcements', id);
    deleteDoc(docRef)
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        }));
      });
    toast({ title: "Broadcast Removed", description: "Record deleted from system." });
  };

  return (
    <AdminLayout>
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-4xl font-black text-[#1a3a2a] tracking-tight uppercase">Broadcast Center</h2>
            <p className="text-xs font-bold text-[#4a6741] uppercase tracking-[0.2em] mt-1">Live Institutional Announcements</p>
          </div>
          <Dialog open={showModal} onOpenChange={(open) => { if (!open) resetForm(); setShowModal(open); }}>
            <DialogTrigger asChild>
              <Button className="h-16 px-10 rounded-2xl bg-[#c9a227] text-[#0a2a1a] font-black hover:bg-[#b08d20] shadow-xl flex gap-3 text-base transition-all">
                <Plus className="h-6 w-6" /> Create Post
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-10 max-w-xl border-none shadow-2xl">
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-3xl font-black text-[#1a3a2a]">
                  {editingId ? "Edit Broadcast" : "New Broadcast"}
                </DialogTitle>
                <DialogDescription className="text-sm text-[#4a6741] font-bold uppercase tracking-widest">
                  Messages appear on the kiosk entry screen instantly.
                </DialogDescription>
              </DialogHeader>
              <div className="py-8 space-y-6">
                <div className="space-y-3">
                  <Label className="font-black text-xs uppercase tracking-widest ml-1 text-[#1a3a2a]">Message Content</Label>
                  <Textarea placeholder="Enter announcement text..." className="rounded-2xl bg-[#f0f4f1] min-h-[140px] p-6 text-base font-bold border-none resize-none" value={msg} onChange={(e) => setMsg(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="font-black text-xs uppercase tracking-widest ml-1 text-[#1a3a2a]">Priority</Label>
                    <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                      <SelectTrigger className="h-14 rounded-2xl bg-[#f0f4f1] border-none text-sm font-black uppercase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        <SelectItem value="normal" className="text-sm font-bold">Normal (Gold)</SelectItem>
                        <SelectItem value="urgent" className="text-sm font-bold">Urgent (Red)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="font-black text-xs uppercase tracking-widest ml-1 text-[#1a3a2a]">Display Period</Label>
                    <div className="h-14 bg-[#f0f4f1] rounded-2xl px-6 flex items-center justify-between">
                      <span className="font-black text-xs text-[#1a3a2a]">VISIBLE</span>
                      <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="font-black text-xs uppercase tracking-widest ml-1 text-[#1a3a2a]">Release Time</Label>
                    <Input type="datetime-local" className="h-14 rounded-2xl bg-[#f0f4f1] border-none text-xs font-black" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-3">
                    <Label className="font-black text-xs uppercase tracking-widest ml-1 text-[#1a3a2a]">Expiry Time</Label>
                    <Input type="datetime-local" className="h-14 rounded-2xl bg-[#f0f4f1] border-none text-xs font-black" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-4">
                <Button variant="ghost" className="h-14 px-8 rounded-2xl font-black text-base" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button className="h-14 px-12 rounded-2xl bg-[#1a3a2a] text-white font-black flex gap-3 text-base shadow-xl" disabled={isProcessing || !msg} onClick={handleSave}>
                  {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  {editingId ? "Update Post" : "Broadcast Now"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="rounded-[3rem] shadow-2xl border border-[#d4e4d8] bg-white overflow-hidden">
          <Table>
            <TableHeader className="bg-[#f0f4f1]">
              <TableRow className="border-none">
                <TableHead className="px-10 h-16 font-black text-[#4a6741] uppercase tracking-[0.2em] text-[10px]">Active</TableHead>
                <TableHead className="h-16 font-black text-[#4a6741] uppercase tracking-[0.2em] text-[10px]">Priority</TableHead>
                <TableHead className="h-16 font-black text-[#4a6741] uppercase tracking-[0.2em] text-[10px]">Message</TableHead>
                <TableHead className="h-16 font-black text-[#4a6741] uppercase tracking-[0.2em] text-[10px]">Timeline</TableHead>
                <TableHead className="px-10 h-16 text-right font-black text-[#4a6741] uppercase tracking-[0.2em] text-[10px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5} className="px-10 py-6"><Skeleton className="h-14 w-full rounded-2xl" /></TableCell></TableRow>
                ))
              ) : announcements?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-80 text-center">
                    <div className="flex flex-col items-center justify-center space-y-6 opacity-20">
                      <Megaphone className="h-24 w-24" />
                      <p className="text-2xl font-black uppercase tracking-tighter">No Scheduled Broadcasts</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : announcements?.map((a) => (
                <TableRow key={a.id} className="group hover:bg-[#f0f4f1]/30 transition-colors border-b-[#f0f4f1]">
                  <TableCell className="px-10">
                    <Switch checked={a.isActive} onCheckedChange={() => toggleStatus(a.id, a.isActive)} className="scale-110" />
                  </TableCell>
                  <TableCell>
                    {a.priority === 'urgent' ? (
                      <Badge className="bg-red-600 text-white font-black uppercase text-[10px] px-3 py-1 animate-pulse border-none rounded-lg shadow-lg">Urgent</Badge>
                    ) : (
                      <Badge className="bg-[#c9a227] text-[#0a2a1a] font-black uppercase text-[10px] px-3 py-1 border-none rounded-lg shadow-md">Normal</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[400px] py-6">
                    <p className="font-black text-[#1a3a2a] line-clamp-2 text-base leading-snug">{a.message}</p>
                    <p className="text-[10px] font-black text-[#4a6741]/50 uppercase tracking-widest mt-2 flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3" /> By {a.createdBy}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase">
                        <span className="w-10">STARTS:</span> {format(a.startDate.toDate(), 'MMM dd, hh:mm a')}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase">
                        <span className="w-10">EXPIRES:</span> {format(a.endDate.toDate(), 'MMM dd, hh:mm a')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-10 text-right space-x-3">
                    <Button variant="ghost" size="icon" className="h-12 w-12 text-[#4a6741] hover:text-[#1a3a2a] hover:bg-[#f0f4f1] rounded-2xl" onClick={() => handleEdit(a)}>
                      <Edit2 className="h-5 w-5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-12 w-12 text-[#4a6741] hover:text-red-600 hover:bg-red-50 rounded-2xl">
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[2.5rem] p-10 max-w-sm border-none shadow-2xl">
                        <AlertDialogHeader className="space-y-3">
                          <AlertDialogTitle className="text-2xl font-black text-[#1a3a2a]">Delete Post?</AlertDialogTitle>
                          <AlertDialogDescription className="text-sm font-bold text-[#4a6741] uppercase tracking-widest">
                            This action will permanently stop this broadcast.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-8 gap-4">
                          <AlertDialogCancel className="rounded-2xl h-14 px-8 font-black border-[#d4e4d8]">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(a.id)} className="rounded-2xl h-14 px-10 font-black bg-red-600 text-white hover:bg-red-700">
                            Confirm Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
