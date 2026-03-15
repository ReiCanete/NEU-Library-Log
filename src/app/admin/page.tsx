'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Loader2, RefreshCcw, Sparkles, BookOpen, GraduationCap, ArrowUpRight, ArrowDownRight, Settings2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth, useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, Timestamp } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { format, startOfDay, getHours, subDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logAppError } from '@/lib/errorMessages';

function CountUp({ value, error }: { value: number; error?: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (error) return;
    let start = 0;
    const end = value;
    if (start === end) {
      setCount(end);
      return;
    }
    const duration = 1000;
    const increment = Math.ceil(end / (duration / 16)) || 1;
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, error]);

  if (error) return <span className="flex items-center gap-2">— <AlertTriangle className="h-3 w-3 text-red-500" /></span>;
  return <>{count}</>;
}

const ABBREVIATIONS: Record<string, string> = {
  "College of Informatics and Computing Studies": "CICS",
  "College of Engineering and Architecture": "CEA",
  "College of Business Administration": "CBA",
  "College of Arts and Sciences": "CAS",
  "College of Accountancy": "COA",
  "College of Education": "COE",
  "College of Medical Technology": "CMT",
  "College of Nursing": "CON",
  "College of Agriculture": "CAG",
  "College of Music": "CMU",
  "College of Physical Therapy": "CPT",
  "College of Respiratory Therapy": "CRT",
  "College of Criminology": "CC",
  "College of Midwifery": "CMID",
  "College of Communication": "CCOM",
  "School of International Relations": "SIR"
};

const PURPOSE_COLORS: Record<string, string> = {
  "Reading Books": "#1a5c2e",
  "Research / Study": "#c9a227",
  "Computer / Internet": "#0d7377",
  "Group Discussion": "#4a7c59",
  "Thesis / Archival": "#8b6914",
  "Other Purpose": "#6b7280"
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [newCapacity, setNewCapacity] = useState('');

  const todayDate = useMemo(() => typeof window !== 'undefined' ? startOfDay(new Date()) : null, []);
  
  const visitsQuery = useMemo(() => {
    if (typeof window === 'undefined' || !db) return null;
    return query(collection(db, 'visits'), orderBy('timestamp', 'desc'));
  }, [db]);
  
  const { data: allVisits, loading: visitsLoading, error: visitsError } = useCollection(visitsQuery);
  
  const settingsRef = useMemo(() => (typeof window !== 'undefined' && db) ? doc(db, 'settings', 'library') : null, [db]);
  const { data: settings } = useDoc(settingsRef);

  const dailyCapacity = settings?.dailyCapacity || 200;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsRefreshing(false);
      toast({ title: "Synchronized", description: "Latest metrics loaded." });
    }, 600);
  };

  const updateCapacity = async () => {
    if (!db || !auth) return;
    const val = parseInt(newCapacity);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Invalid", description: "Enter a positive number.", variant: "destructive" });
      return;
    }
    try {
      await setDoc(doc(db, 'settings', 'library'), {
        dailyCapacity: val,
        lastUpdatedBy: auth?.currentUser?.email || 'Admin',
        updatedAt: Timestamp.now()
      }, { merge: true });
      toast({ title: "Updated", description: `Capacity set to ${val}.` });
      setIsEditingCapacity(false);
    } catch (e: any) {
      logAppError('Dashboard', 'UpdateCapacity', e);
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const stats = useMemo(() => {
    if (!allVisits || !todayDate) return { today: 0, yesterday: 0, week: 0, month: 0 };
    const yesterdayDate = subDays(todayDate, 1);
    const weekDate = subDays(todayDate, 7);
    const monthDate = subDays(todayDate, 30);
    
    return {
      today: allVisits.filter(v => v.timestamp.toDate() >= todayDate).length,
      yesterday: allVisits.filter(v => {
        const d = v.timestamp.toDate();
        return d >= yesterdayDate && d < todayDate;
      }).length,
      week: allVisits.filter(v => v.timestamp.toDate() >= weekDate).length,
      month: allVisits.filter(v => v.timestamp.toDate() >= monthDate).length
    };
  }, [allVisits, todayDate]);

  const purposeData = useMemo(() => {
    if (!allVisits) return [];
    const counts: Record<string, number> = {};
    allVisits.forEach(v => { counts[v.purpose] = (counts[v.purpose] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allVisits]);

  const collegeData = useMemo(() => {
    if (!allVisits) return [];
    const counts: Record<string, number> = {};
    allVisits.forEach(v => { 
      const college = v.college || 'Other';
      const label = ABBREVIATIONS[college] || college;
      counts[label] = (counts[label] || 0) + 1; 
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 5);
  }, [allVisits]);

  return (
    <AdminLayout>
      <div className="space-y-6 pb-6">
        {visitsError && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-800 rounded-xl mb-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="font-bold text-[9px] uppercase tracking-widest">
                  Connection unstable. Displaying cached metrics.
                </AlertDescription>
              </div>
              <Button size="sm" variant="outline" className="h-6 text-[8px] font-black" onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </Alert>
        )}

        <div className="bg-gradient-to-br from-[#0a2a1a] to-[#1a5c2e] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col sm:flex-row justify-between items-center gap-4 border-b-2 border-[#c9a227]">
          <div className="z-10 text-center sm:text-left space-y-1">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <img src="/neu-logo.png" alt="Logo" className="h-6 w-6 rounded-full" />
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                System Overview <Sparkles className="h-3 w-3 text-[#c9a227]" />
              </h2>
            </div>
            <p className="text-white/60 font-medium text-xs">
              Today: <span className="text-[#c9a227] font-black">{stats.today}</span> entries logged.
            </p>
          </div>
          <div className="flex items-center gap-3 z-10">
            <Dialog open={isEditingCapacity} onOpenChange={setIsEditingCapacity}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl h-10 px-4 font-black flex gap-2 text-[10px]">
                  <Settings2 className="h-4 w-4 text-[#c9a227]" />
                  Limit: {dailyCapacity}
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl p-6 max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-lg font-black text-[#1a3a2a]">Daily Capacity</DialogTitle>
                  <DialogDescription className="font-medium text-[10px] text-[#4a6741]">Max visitors allowed per day.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input type="number" className="h-12 rounded-lg bg-[#f0f4f1] border-none font-black text-xl text-center" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button className="w-full h-11 rounded-lg bg-[#1a3a2a] font-black text-xs" onClick={updateCapacity}>Save Settings</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl h-10 px-4 font-black text-[10px]">
              {isRefreshing ? <Loader2 className="animate-spin h-3 w-3" /> : <RefreshCcw className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Today\'s Visits', value: stats.today, prev: stats.yesterday, icon: Users, circle: 'bg-emerald-50', iconColor: 'text-emerald-600' },
            { label: 'Weekly Total', value: stats.week, icon: Calendar, circle: 'bg-amber-50', iconColor: 'text-amber-600' },
            { label: 'Monthly Traffic', value: stats.month, icon: TrendingUp, circle: 'bg-slate-100', iconColor: 'text-[#0a2a1a]' }
          ].map((s, i) => (
            <Card key={i} className="border-none shadow-md rounded-xl bg-white overflow-hidden group hover:translate-y-[-1px] transition-all border-t-2 border-[#c9a227]">
              <CardHeader className="flex flex-row items-center justify-between pb-1 p-5">
                <div className={`p-2.5 rounded-xl ${s.circle}`}>
                  <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                </div>
                <div className="text-right">
                  <CardTitle className="text-[8px] font-black text-[#4a6741] uppercase tracking-widest">{s.label}</CardTitle>
                  <div className="text-2xl font-black text-[#1a3a2a] mt-0.5 tabular-nums">
                    {visitsLoading ? <Skeleton className="h-6 w-12 ml-auto" /> : <CountUp value={s.value} error={!!visitsError} />}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-4 pt-0 flex justify-between items-center text-[7px] font-bold text-[#4a6741]/50 uppercase tracking-widest">
                <span>Real-time Sync</span>
                {s.prev !== undefined && s.value >= s.prev ? <ArrowUpRight className="h-2.5 w-2.5 text-emerald-500" /> : <ArrowDownRight className="h-2.5 w-2.5 text-red-400" />}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl shadow-md border border-[#d4e4d8] bg-white p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-[#1a3a2a] tracking-tight">Visit Purpose</h3>
                <p className="text-[8px] text-[#4a6741] font-bold uppercase tracking-widest">Activity Split</p>
              </div>
              <BookOpen className="h-4 w-4 text-[#c9a227]" />
            </div>
            <div className="h-[240px] w-full">
              {visitsLoading ? <Skeleton className="h-full w-full rounded-xl" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={purposeData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                      {purposeData.map((entry, index) => <Cell key={`cell-${index}`} fill={PURPOSE_COLORS[entry.name] || '#ccc'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="rounded-2xl shadow-md border border-[#d4e4d8] bg-white p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-[#1a3a2a] tracking-tight">Active Colleges</h3>
                <p className="text-[8px] text-[#4a6741] font-bold uppercase tracking-widest">Visitor Groups</p>
              </div>
              <GraduationCap className="h-4 w-4 text-[#1a3a2a]" />
            </div>
            <div className="h-[240px] w-full">
              {visitsLoading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full rounded-lg" />)}</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={collegeData} layout="vertical" margin={{ left: 0, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={60} axisLine={false} tickLine={false} tick={{ fill: '#4a6741', fontSize: 9, fontWeight: 'bold' }} />
                    <Tooltip cursor={{ fill: '#f0f4f1' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }} />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={18}>
                      {collegeData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#1a3a2a' : '#c9a227'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}