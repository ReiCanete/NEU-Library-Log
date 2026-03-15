"use client";

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Megaphone, Plus, Trash2, CheckCircle2, Send, Loader2, Edit2 } from 'lucide-react';
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
        .then(() => {
          toast({ title: "Broadcast Updated", description: "The message has been refreshed on the kiosk." });
          setShowModal(false);
          resetForm();
        })
        .catch(async () => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: announcementData
          }));
        })
        .finally(() => setIsProcessing(false));
    } else {
      const newData = { ...announcementData, createdAt: Timestamp.now() };
      addDoc(collection(db, 'announcements'), newData)
        .then(() => {
          toast({ title: "Broadcast Live", description: "New announcement sent to kiosk display." });
          setShowModal(false);
          resetForm();
        })
        .catch(async () => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: '/announcements',
            operation: 'create',
            requestResourceData: newData
          }));
        })
        .finally(() => setIsProcessing(false));
    }
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
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-[#1a3a2a] tracking-tight uppercase">Broadcast Center</h2>
            <p className="text-sm font-bold text-[#4a6741] uppercase tracking-widest">Live Institutional Announcements</p>
          </div>
          <Dialog open={showModal} onOpenChange={(open) => { if (!open) resetForm(); setShowModal(open); }}>
            <DialogTrigger asChild>
              <Button className="h-14 px-8 rounded-2xl bg-[#c9a227] text-[#0a2a1a] font-black hover:bg-[#b08d20] shadow-lg flex gap-3 transition-all">
                <Plus className="h-5 w-5" /> Create Post
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl p-6 max-w-lg border-none shadow-2xl">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-2xl font-black text-[#1a3a2a]">
                  {editingId ? "Edit Broadcast" : "New Broadcast"}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#4a6741] font-bold uppercase tracking-widest">
                  Messages appear on the kiosk entry screen instantly.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label className="font-black text-xs uppercase tracking-widest text-[#1a3a2a]">Message Content</Label>
                  <Textarea placeholder="Enter announcement text..." className="rounded-xl bg-[#f0f4f1] min-h-[120px] p-4 text-sm font-bold border-none resize-none" value={msg} onChange={(e) => setMsg(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-black text-xs uppercase tracking-widest text-[#1a3a2a]">Priority</Label>
                    <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                      <SelectTrigger className="h-12 rounded-xl bg-[#f0f4f1] border-none text-xs font-black uppercase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="normal" className="text-xs font-bold">Normal (Gold)</SelectItem>
                        <SelectItem value="urgent" className="text-xs font-bold">Urgent (Red)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-black text-xs uppercase tracking-widest text-[#1a3a2a]">Status</Label>
                    <div className="h-12 bg-[#f0f4f1] rounded-xl px-4 flex items-center justify-between">
                      <span className="font-black text-[10px] text-[#1a3a2a]">ACTIVE</span>
                      <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-black text-xs uppercase tracking-widest text-[#1a3a2a]">Release</Label>
                    <Input type="datetime-local" className="h-12 rounded-xl bg-[#f0f4f1] border-none text-xs font-bold" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-black text-xs uppercase tracking-widest text-[#1a3a2a]">Expiry</Label>
                    <Input type="datetime-local" className="h-12 rounded-xl bg-[#f0f4f1] border-none text-xs font-bold" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" className="h-12 px-6 rounded-xl font-black text-sm" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button className="h-12 px-8 rounded-xl bg-[#1a3a2a] text-white font-black flex gap-2 text-sm shadow-md" disabled={isProcessing || !msg} onClick={handleSave}>
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {editingId ? "Update" : "Broadcast"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="rounded-3xl shadow-xl border border-[#d4e4d8] bg-white overflow-hidden">
          <Table>
            <TableHeader className="bg-[#f0f4f1]">
              <TableRow className="border-none">
                <TableHead className="px-6 h-14 font-black text-[#4a6741] uppercase tracking-widest text-xs">Active</TableHead>
                <TableHead className="h-14 font-black text-[#4a6741] uppercase tracking-widest text-xs">Priority</TableHead>
                <TableHead className="h-14 font-black text-[#4a6741] uppercase tracking-widest text-xs">Message</TableHead>
                <TableHead className="h-14 font-black text-[#4a6741] uppercase tracking-widest text-xs">Timeline</TableHead>
                <TableHead className="px-6 h-14 text-right font-black text-[#4a6741] uppercase tracking-widest text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5} className="px-6 py-4"><Skeleton className="h-12 w-full rounded-xl" /></TableCell></TableRow>
                ))
              ) : announcements?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4 opacity-20">
                      <Megaphone className="h-16 w-16" />
                      <p className="text-xl font-black uppercase tracking-tighter">No Scheduled Broadcasts</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : announcements?.map((a) => (
                <TableRow key={a.id} className="group hover:bg-[#f0f4f1]/30 transition-colors border-b-[#f0f4f1]">
                  <TableCell className="px-6">
                    <Switch checked={a.isActive} onCheckedChange={() => toggleStatus(a.id, a.isActive)} />
                  </TableCell>
                  <TableCell>
                    {a.priority === 'urgent' ? (
                      <Badge className="bg-red-600 text-white font-black uppercase text-[10px] px-2 py-0.5 rounded shadow-sm">Urgent</Badge>
                    ) : (
                      <Badge className="bg-[#c9a227] text-[#0a2a1a] font-black uppercase text-[10px] px-2 py-0.5 rounded shadow-sm">Normal</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[300px] py-4">
                    <p className="font-bold text-[#1a3a2a] line-clamp-2 text-sm leading-tight">{a.message}</p>
                    <p className="text-[10px] font-black text-[#4a6741]/50 uppercase tracking-widest mt-1">By {a.createdBy}</p>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-[10px] font-black uppercase tabular-nums">
                      <div className="text-emerald-600">START: {format(a.startDate.toDate(), 'MMM dd, HH:mm')}</div>
                      <div className="text-red-400">END: {format(a.endDate.toDate(), 'MMM dd, HH:mm')}</div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 text-right space-x-2">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-[#4a6741] hover:text-[#1a3a2a] hover:bg-[#f0f4f1] rounded-xl" onClick={() => handleEdit(a)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-[#4a6741] hover:text-red-600 hover:bg-red-50 rounded-xl">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl p-8 max-w-sm border-none shadow-2xl">
                        <AlertDialogHeader className="space-y-2">
                          <AlertDialogTitle className="text-xl font-black text-[#1a3a2a]">Delete Post?</AlertDialogTitle>
                          <AlertDialogDescription className="text-sm font-bold text-[#4a6741] uppercase tracking-widest">This action will permanently stop this broadcast.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-6 gap-2">
                          <AlertDialogCancel className="rounded-xl h-12 px-6 font-black border-[#d4e4d8]">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(a.id)} className="rounded-xl h-12 px-8 font-black bg-red-600 text-white hover:bg-red-700">Delete</AlertDialogAction>
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
