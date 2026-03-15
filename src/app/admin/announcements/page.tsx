"use client";

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Megaphone, Plus, Trash2, Edit2, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useAuth, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, orderBy, addDoc, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { format, isValid } from 'date-fns';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTrigger, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

  const handleSave = async () => {
    if (!db) {
      toast({ title: "System Offline", description: "Database is not available. Please refresh.", variant: "destructive" });
      return;
    }

    if (!msg.trim()) {
      toast({ title: "Validation Error", description: "Message content cannot be empty.", variant: "destructive" });
      return;
    }

    const sDate = new Date(startDate);
    const eDate = new Date(endDate);

    if (!isValid(sDate) || !isValid(eDate)) {
      toast({ title: "Invalid Dates", description: "Please ensure the start and end dates are correctly set.", variant: "destructive" });
      return;
    }

    if (eDate <= sDate) {
      toast({ title: "Timeline Error", description: "End date must be after the start date.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    const announcementData = {
      message: msg.trim(),
      priority,
      startDate: Timestamp.fromDate(sDate),
      endDate: Timestamp.fromDate(eDate),
      isActive: true,
      createdBy: auth?.currentUser?.email || 'reiangelo.canete@neu.edu.ph',
      updatedAt: Timestamp.now()
    };

    try {
      if (editingId) {
        const docRef = doc(db, 'announcements', editingId);
        await updateDoc(docRef, announcementData);
        toast({ title: "Broadcast Updated", description: "Changes have been published successfully." });
      } else {
        const newData = { ...announcementData, createdAt: Timestamp.now() };
        await addDoc(collection(db, 'announcements'), newData);
        toast({ title: "Broadcast Live", description: "Your message is now visible on the kiosk." });
      }
      
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      const operation = editingId ? 'update' : 'create';
      const path = editingId ? `announcements/${editingId}` : 'announcements';
      
      const permissionError = new FirestorePermissionError({
        path,
        operation,
        requestResourceData: announcementData
      });
      
      errorEmitter.emit('permission-error', permissionError);
      toast({ 
        title: "Action Denied", 
        description: "You do not have permission to post broadcasts or a network error occurred.", 
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
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
      .then(() => {
        toast({ title: "Post Removed", description: "Announcement deleted." });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        }));
      });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-[#1a3a2a] tracking-tight uppercase">Broadcast Center</h2>
            <p className="text-xs font-bold text-[#4a6741] uppercase tracking-widest mt-1">Manage institutional alerts</p>
          </div>
          <Dialog open={showModal} onOpenChange={(open) => { if (!open) resetForm(); setShowModal(open); }}>
            <DialogTrigger asChild>
              <Button className="h-12 px-6 rounded-xl bg-[#c9a227] text-[#0a2a1a] font-black hover:bg-[#b08d20] shadow-md flex gap-2">
                <Plus className="h-5 w-5" /> New Broadcast
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl p-6 max-w-md border-none shadow-2xl">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-xl font-black text-[#1a3a2a]">
                  {editingId ? "Edit Broadcast" : "New Broadcast"}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#4a6741] font-bold">
                  Messages appear on the kiosk entry screen.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a]">Message</Label>
                  <Textarea placeholder="Type message..." className="rounded-xl bg-[#f0f4f1] min-h-[100px] p-3 text-sm font-bold border-none" value={msg} onChange={(e) => setMsg(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a]">Priority</Label>
                    <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                      <SelectTrigger className="h-10 rounded-xl bg-[#f0f4f1] border-none text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none">
                        <SelectItem value="normal" className="text-xs font-bold">Normal</SelectItem>
                        <SelectItem value="urgent" className="text-xs font-bold">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a]">Visibility</Label>
                    <div className="h-10 bg-[#f0f4f1] rounded-xl px-4 flex items-center justify-between">
                      <span className="font-bold text-[10px] text-[#1a3a2a]">LIVE</span>
                      <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a]">Start</Label>
                    <Input type="datetime-local" className="h-10 rounded-xl bg-[#f0f4f1] border-none text-[10px] font-bold" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a]">End</Label>
                    <Input type="datetime-local" className="h-10 rounded-xl bg-[#f0f4f1] border-none text-[10px] font-bold" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 pt-4">
                <Button variant="ghost" className="h-10 px-4 rounded-xl font-black text-xs" onClick={() => setShowModal(false)} disabled={isProcessing}>Cancel</Button>
                <Button className="h-10 px-6 rounded-xl bg-[#1a3a2a] text-white font-black flex gap-2 text-xs" disabled={isProcessing || !msg.trim()} onClick={handleSave}>
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {editingId ? "Update Broadcast" : "Post Broadcast"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="rounded-2xl shadow-xl border border-[#d4e4d8] bg-white overflow-hidden">
          <Table>
            <TableHeader className="bg-[#f0f4f1]">
              <TableRow className="border-none">
                <TableHead className="px-6 h-12 font-black text-[#4a6741] uppercase tracking-widest text-[10px]">Active</TableHead>
                <TableHead className="h-12 font-black text-[#4a6741] uppercase tracking-widest text-[10px]">Priority</TableHead>
                <TableHead className="h-12 font-black text-[#4a6741] uppercase tracking-widest text-[10px]">Message</TableHead>
                <TableHead className="h-12 font-black text-[#4a6741] uppercase tracking-widest text-[10px]">Schedule</TableHead>
                <TableHead className="px-6 h-12 text-right font-black text-[#4a6741] uppercase tracking-widest text-[10px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5} className="px-6 py-4"><Skeleton className="h-10 w-full rounded-xl" /></TableCell></TableRow>
                ))
              ) : announcements?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 opacity-20">
                      <Megaphone className="h-12 w-12" />
                      <p className="text-sm font-black uppercase tracking-widest">No Broadcasts</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : announcements?.map((a) => (
                <TableRow key={a.id} className="group hover:bg-[#f0f4f1]/30 border-b-[#f0f4f1]">
                  <TableCell className="px-6">
                    <Switch checked={a.isActive} onCheckedChange={() => toggleStatus(a.id, a.isActive)} />
                  </TableCell>
                  <TableCell>
                    <Badge className={`${a.priority === 'urgent' ? 'bg-red-600' : 'bg-[#c9a227]'} text-white font-black uppercase text-[9px] px-2 py-0.5 rounded`}>
                      {a.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[300px] py-4">
                    <p className="font-bold text-sm text-[#1a3a2a] line-clamp-2">{a.message}</p>
                    <p className="text-[9px] font-black text-[#4a6741]/50 uppercase tracking-widest mt-1">Admin: {a.createdBy}</p>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-[9px] font-black uppercase tabular-nums">
                      <div className="text-emerald-600">IN: {format(a.startDate.toDate(), 'MMM dd, HH:mm')}</div>
                      <div className="text-red-400">OUT: {format(a.endDate.toDate(), 'MMM dd, HH:mm')}</div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 text-right space-x-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#4a6741] hover:text-[#1a3a2a]" onClick={() => handleEdit(a)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#4a6741] hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl p-6 max-w-sm border-none shadow-2xl">
                        <AlertDialogHeader className="space-y-2">
                          <AlertDialogTitle className="text-lg font-black text-[#1a3a2a]">Delete Post?</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs font-bold text-[#4a6741] uppercase tracking-widest">Permanently stop this broadcast.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4 gap-2">
                          <AlertDialogCancel className="rounded-xl h-10 px-4 font-black text-xs border-[#d4e4d8]">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(a.id)} className="rounded-xl h-10 px-6 font-black text-xs bg-red-600 text-white hover:bg-red-700">Delete</AlertDialogAction>
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
