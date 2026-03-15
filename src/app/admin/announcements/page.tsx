"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Megaphone, Plus, Trash2, Edit2, Send, Loader2, AlertCircle, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useAuth, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, orderBy, addDoc, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { format, isPast } from 'date-fns';
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
  const [formError, setFormError] = useState<string | null>(null);
  
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Set default dates on mount
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    setStartDate(format(now, "yyyy-MM-dd'T'HH:mm"));
    setEndDate(format(tomorrow, "yyyy-MM-dd'T'HH:mm"));
  }, []);

  const announcementsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: allAnnouncements, loading } = useCollection(announcementsQuery);

  const { active, past } = useMemo(() => {
    if (!allAnnouncements) return { active: [], past: [] };
    const now = new Date();
    return {
      active: allAnnouncements.filter(a => a.isActive && !isPast(a.endDate.toDate())),
      past: allAnnouncements.filter(a => !a.isActive || isPast(a.endDate.toDate()))
    };
  }, [allAnnouncements]);

  const resetForm = () => {
    setMessage('');
    setPriority('normal');
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    setStartDate(format(now, "yyyy-MM-dd'T'HH:mm"));
    setEndDate(format(tomorrow, "yyyy-MM-dd'T'HH:mm"));
    setEditingId(null);
    setFormError(null);
  };

  const handleSave = () => {
    if (!db) return;
    setFormError(null);

    if (!message.trim()) {
      setFormError("Please enter a message");
      return;
    }

    setIsProcessing(true);

    const data = {
      message: message.trim(),
      priority,
      isActive: true,
      startDate: Timestamp.fromDate(new Date(startDate)),
      endDate: Timestamp.fromDate(new Date(endDate)),
      createdBy: auth?.currentUser?.email || 'Admin',
      updatedAt: Timestamp.now()
    };

    if (editingId) {
      const docRef = doc(db, 'announcements', editingId);
      updateDoc(docRef, data)
        .then(() => {
          toast({ title: "Updated", description: "Announcement updated successfully.", className: "bg-emerald-500 text-white border-none" });
          setShowModal(false);
          resetForm();
        })
        .catch(async (err) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: data
          }));
          toast({ title: "Error", description: "Failed to update. Please try again.", variant: "destructive" });
        })
        .finally(() => setIsProcessing(false));
    } else {
      const newData = { ...data, createdAt: Timestamp.now() };
      addDoc(collection(db, 'announcements'), newData)
        .then(() => {
          toast({ title: "Success", description: "Announcement posted successfully!", className: "bg-emerald-500 text-white border-none" });
          setShowModal(false);
          resetForm();
        })
        .catch(async (err) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'announcements',
            operation: 'create',
            requestResourceData: newData
          }));
          toast({ title: "Error", description: "Failed to post. Please try again.", variant: "destructive" });
        })
        .finally(() => setIsProcessing(false));
    }
  };

  const handleEdit = (a: any) => {
    setEditingId(a.id);
    setMessage(a.message);
    setPriority(a.priority);
    setStartDate(format(a.startDate.toDate(), "yyyy-MM-dd'T'HH:mm"));
    setEndDate(format(a.endDate.toDate(), "yyyy-MM-dd'T'HH:mm"));
    setShowModal(true);
  };

  const toggleActive = (id: string, currentState: boolean) => {
    if (!db) return;
    const docRef = doc(db, 'announcements', id);
    updateDoc(docRef, { isActive: !currentState })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: { isActive: !currentState }
        }));
      });
  };

  const handleDelete = (id: string) => {
    if (!db) return;
    const docRef = doc(db, 'announcements', id);
    deleteDoc(docRef)
      .then(() => {
        toast({ title: "Deleted", description: "Record permanently removed." });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        }));
      });
  };

  const AnnouncementCard = ({ a, isPast = false }: { a: any, isPast?: boolean }) => (
    <Card className={`p-6 rounded-2xl border border-[#d4e4d8] shadow-sm transition-all hover:shadow-md ${isPast ? 'opacity-60 bg-slate-50' : 'bg-white'}`}>
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-2">
            <Badge className={`${a.priority === 'urgent' ? 'bg-red-600' : 'bg-[#c9a227]'} text-white font-black uppercase text-[10px] px-2.5 py-1 rounded-lg`}>
              {a.priority}
            </Badge>
            {isPast && (
              <Badge variant="outline" className="border-slate-300 text-slate-500 font-black uppercase text-[10px] px-2.5 py-1 rounded-lg">
                EXPIRED
              </Badge>
            )}
          </div>
          <p className="text-sm font-bold text-[#1a3a2a] leading-relaxed">{a.message}</p>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[10px] font-black text-[#4a6741] uppercase tracking-widest">
              <Calendar className="h-3 w-3" />
              Active: {format(a.startDate.toDate(), 'PP p')} — {format(a.endDate.toDate(), 'PP p')}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <Clock className="h-3 w-3" />
              Posted by: {a.createdBy}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-4">
          {!isPast && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-[#4a6741] tracking-widest">Status</span>
              <Switch checked={a.isActive} onCheckedChange={() => toggleActive(a.id, a.isActive)} />
            </div>
          )}
          <div className="flex gap-1">
            {!isPast && (
              <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-[#1a3a2a] hover:bg-[#f0f4f1]" onClick={() => handleEdit(a)}>
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl p-6">
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>This cannot be undone. This announcement will be permanently deleted.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 mt-4">
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(a.id)} className="bg-red-600 text-white hover:bg-red-700 rounded-xl">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <AdminLayout>
      <div className="space-y-10">
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
            <DialogContent className="rounded-2xl p-6 max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-[#1a3a2a]">
                  {editingId ? "Edit Broadcast" : "New Broadcast"}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#4a6741] font-bold">
                  Enter message and schedule for the kiosk display.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a]">Message</Label>
                  <Textarea 
                    placeholder="Type broadcast message..." 
                    className={`rounded-xl bg-[#f0f4f1] min-h-[100px] p-4 text-sm font-bold border-none ${formError ? 'ring-2 ring-red-500' : ''}`} 
                    value={message} 
                    onChange={(e) => { setMessage(e.target.value); setFormError(null); }} 
                  />
                  {formError && <p className="text-[10px] font-black text-red-500 uppercase flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {formError}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a]">Priority</Label>
                  <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                    <SelectTrigger className="h-12 rounded-xl bg-[#f0f4f1] border-none text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="normal">Normal Priority (Gold)</SelectItem>
                      <SelectItem value="urgent">Urgent Priority (Red Pulsing)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a]">Start Date</Label>
                    <Input type="datetime-local" className="h-12 rounded-xl bg-[#f0f4f1] border-none text-[11px] font-bold" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a]">End Date</Label>
                    <Input type="datetime-local" className="h-12 rounded-xl bg-[#f0f4f1] border-none text-[11px] font-bold" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 pt-4">
                <Button variant="ghost" className="h-12 px-4 rounded-xl font-black text-xs" onClick={() => setShowModal(false)} disabled={isProcessing}>Cancel</Button>
                <Button className="h-12 px-8 rounded-xl bg-[#1a3a2a] text-white font-black flex gap-2 text-xs" disabled={isProcessing} onClick={handleSave}>
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isProcessing ? (editingId ? "Updating..." : "Posting...") : (editingId ? "Update Broadcast" : "Post Broadcast")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-12">
          {/* Active Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-[#4a6741] uppercase tracking-[0.2em] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Active Announcements
            </h3>
            <div className="grid gap-4">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
              ) : active.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-[#d4e4d8] rounded-[2rem] text-center space-y-3">
                  <Megaphone className="h-12 w-12 text-slate-200 mx-auto" />
                  <p className="text-sm font-bold text-slate-400">No active announcements. Click '+ New Broadcast' to create one.</p>
                </div>
              ) : (
                active.map(a => <AnnouncementCard key={a.id} a={a} />)
              )}
            </div>
          </div>

          {/* Past Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Clock className="h-4 w-4" /> Past & Inactive
            </h3>
            <div className="grid gap-4">
              {loading ? (
                <Skeleton className="h-32 w-full rounded-2xl" />
              ) : past.length === 0 ? (
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-8 italic">No records in archive</p>
              ) : (
                past.map(a => <AnnouncementCard key={a.id} a={a} isPast />)
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
