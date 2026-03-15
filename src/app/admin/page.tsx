'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Loader2, RefreshCcw, Sparkles, BookOpen, GraduationCap, Clock, ArrowUpRight, ArrowDownRight, Settings2, AlertTriangle, Info } from 'lucide-react';
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
    const increment = Math.ceil(end / (duration / 16));
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

  if (error) return <span className="flex items-center gap-2">— <AlertTriangle className="h-4 w-4 text-red-500" /></span>;
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
  const { data: settings, error: settingsError } = useDoc(settingsRef);

  const dailyCapacity = settings?.dailyCapacity || 200;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsRefreshing(false);
      toast({ title: "Sync Complete", description: "Dashboard stats refreshed." });
    }, 800);
  };

  const updateCapacity = async () => {
    if (!db) return;
    const val = parseInt(newCapacity);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Validation Error", description: "Please enter a valid positive number.", variant: "destructive" });
      return;
    }
    try {
      await setDoc(doc(db, 'settings', 'library'), {
        dailyCapacity: val,
        lastUpdatedBy: auth?.currentUser?.email || 'Admin',
        updatedAt: Timestamp.now()
      }, { merge: true });
      toast({ title: "Capacity Updated", description: `Limit set to ${val} visitors.` });
      setIsEditingCapacity(false);
    } catch (e: any) {
      logAppError('AdminDashboard', 'UpdateCapacity', e);
      toast({ title: "Error", description: e.message, variant: "destructive" });
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

  const insights = useMemo(() => {
    if (!allVisits || allVisits.length === 0) return { peakHour: '--', activeDay: '--', topPurpose: '--' };
    const hours: Record<number, number> = {};
    const days: Record<string, number> = {};
    const purposes: Record<string, number> = {};
    allVisits.forEach(v => {
      const date = v.timestamp.toDate();
      const h = getHours(date);
      const d = format(date, 'EEEE');
      hours[h] = (hours[h] || 0) + 1;
      days[d] = (days[d] || 0) + 1;
      purposes[v.purpose] = (purposes[v.purpose] || 0) + 1;
    });
    const peakH = Object.entries(hours).sort((a, b) => b[1] - a[1])[0]?.[0];
    const activeD = Object.entries(days).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topP = Object.entries(purposes).sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
      peakHour: peakH !== undefined ? format(new Date().setHours(Number(peakH)), 'hh:00 a') : '--',
      activeDay: activeD || '--',
      topPurpose: topP || '--'
    };
  }, [allVisits]);

  return (
    <AdminLayout>
      <div className="space-y-12">
        {(visitsError || settingsError) && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <AlertDescription className="font-black text-xs uppercase tracking-widest">
                Some data could not be loaded. Showing cached results.
              </AlertDescription>
            </div>
            <Button size="sm" variant="outline" className="h-8 border-amber-300 font-black text-[10px]" onClick={() => window.location.reload()}>
              Click to retry
            </Button>
          </Alert>
        )}

        <div className="bg-gradient-to-br from-[#0a2a1a] to-[#1a5c2e] rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 border-b-4 border-[#c9a227]">
          <div className="z-10 text-center md:text-left space-y-3">
            <div className="flex items-center gap-4 justify-center md:justify-start">
              <img src="/neu-logo.png" alt="Logo" className="h-10 w-10 rounded-full" />
              <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
                Staff Overview <Sparkles className="h-6 w-6 text-[#c9a227]" />
              </h2>
            </div>
            <p className="text-white/60 font-bold max-w-lg text-lg leading-tight">
              Good day, Staff! The library log is active. Today: <span className="text-[#c9a227]">{stats.today}</span> entries.
            </p>
          </div>
          <div className="flex items-center gap-4 z-10">
            <Dialog open={isEditingCapacity} onOpenChange={setIsEditingCapacity}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-2xl h-14 px-6 font-black flex gap-2">
                  <Settings2 className="h-5 w-5 text-[#c9a227]" />
                  Capacity: {dailyCapacity}
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[2rem] p-8 max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-[#1a3a2a]">Daily Capacity</DialogTitle>
                  <DialogDescription className="font-bold text-[#4a6741]">Set the maximum number of daily visitors allowed.</DialogDescription>
                </DialogHeader>
                <div className="py-6">
                  <Input type="number" placeholder="e.g. 200" className="h-14 rounded-xl bg-[#f0f4f1] border-none font-black text-2xl text-center" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button className="w-full h-14 rounded-xl bg-[#1a3a2a] font-black" onClick={updateCapacity}>Save Limit</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-2xl h-14 px-8 font-black">
              {isRefreshing ? <Loader2 className="animate-spin h-5 w-5" /> : <RefreshCcw className="h-5 w-5 mr-2" />}
              Refresh
            </Button>
          </div>
          <div className="absolute top-[-50%] right-[-10%] w-[400px] h-[400px] bg-[#c9a227]/10 rounded-full blur-[100px]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { label: 'Today\'s Visitors', value: stats.today, prev: stats.yesterday, icon: Users, circle: 'bg-emerald-500/10', iconColor: 'text-emerald-600' },
            { label: 'Weekly Total', value: stats.week, icon: Calendar, circle: 'bg-[#c9a227]/10', iconColor: 'text-[#c9a227]' },
            { label: 'Monthly Traffic', value: stats.month, icon: TrendingUp, circle: 'bg-[#0a2a1a]/10', iconColor: 'text-[#0a2a1a]' }
          ].map((s, i) => {
            const isUp = s.prev !== undefined ? s.value >= s.prev : true;
            return (
              <Card key={i} className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group hover:scale-[1.02] transition-all duration-300 border-t-4 border-[#c9a227]">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-8">
                  <div className={`p-4 rounded-2xl ${s.circle}`}>
                    <s.icon className={`h-6 w-6 ${s.iconColor}`} />
                  </div>
                  <div className="text-right">
                    <CardTitle className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">{s.label}</CardTitle>
                    <div className="text-5xl font-black text-[#1a3a2a] mt-1 tabular-nums">
                      {visitsLoading ? <Skeleton className="h-12 w-20 ml-auto" /> : <CountUp value={s.value} error={!!visitsError} />}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-8 pb-8 pt-2 border-t border-[#f0f4f1] mt-2 flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    {s.prev !== undefined && !visitsError && (
                      <span className={`text-[9px] font-black uppercase flex items-center ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {isUp ? 'Trending Up' : 'Trending Down'}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-[#4a6741]/50 font-black uppercase">Refreshed {format(lastUpdated, 'p')}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <Card className="rounded-[3rem] shadow-xl border border-[#d4e4d8] bg-white p-10 space-y-8">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-[#1a3a2a] tracking-tight">Visit Purpose Breakdown</h3>
                <p className="text-[10px] text-[#4a6741] font-black uppercase tracking-widest mt-1">Total distribution by category</p>
              </div>
              <div className="p-3 bg-[#f0f4f1] rounded-2xl"><BookOpen className="h-5 w-5 text-[#1a3a2a]" /></div>
            </div>
            <div className="h-[400px] w-full relative flex items-center justify-center">
              {visitsLoading ? (
                <Skeleton className="h-64 w-64 rounded-full" />
              ) : visitsError || purposeData.length === 0 ? (
                <div className="flex flex-col items-center gap-4 opacity-40">
                  <Info className="h-12 w-12" />
                  <p className="font-black uppercase text-[10px]">Chart data unavailable</p>
                  <Button size="sm" variant="link" className="font-black h-4" onClick={() => window.location.reload()}>Click to retry</Button>
                </div>
              ) : (
                <>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-black text-[#1a3a2a]">{allVisits?.length || 0}</span>
                    <span className="text-[9px] font-black text-[#4a6741] uppercase tracking-widest">Total Visits</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={purposeData} cx="50%" cy="50%" innerRadius={85} outerRadius={125} paddingAngle={5} dataKey="value" stroke="none">
                        {purposeData.map((entry, index) => <Cell key={`cell-${index}`} fill={PURPOSE_COLORS[entry.name] || '#ccc'} />)}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px', fontWeight: '900' }}
                        formatter={(value: number, name: string) => [`${value} visits (${((value/(allVisits?.length || 1))*100).toFixed(1)}%)`, name]}
                      />
                      <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </Card>

          <Card className="rounded-[3rem] shadow-xl border border-[#d4e4d8] bg-white p-10 space-y-8">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-[#1a3a2a] tracking-tight">Frequent Visitor Groups</h3>
                <p className="text-[10px] text-[#4a6741] font-black uppercase tracking-widest mt-1">Top 5 active colleges</p>
              </div>
              <div className="p-3 bg-[#f0f4f1] rounded-2xl"><GraduationCap className="h-5 w-5 text-[#1a3a2a]" /></div>
            </div>
            <div className="h-[400px] w-full">
              {visitsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
                </div>
              ) : visitsError || collegeData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
                   <TrendingUp className="h-12 w-12" />
                   <p className="font-black uppercase text-[10px]">No visitor data found for period</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={collegeData} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fill: '#4a6741', fontSize: 11, fontWeight: 900 }} />
                    <Tooltip cursor={{ fill: '#f0f4f1' }} contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }} />
                    <Bar dataKey="count" radius={[0, 20, 20, 0]} barSize={32} label={{ position: 'right', fill: '#1a3a2a', fontSize: 12, fontWeight: 900, formatter: (val: number) => `${val} visits` }}>
                      {collegeData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#1a3a2a' : '#c9a227'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { label: 'Peak Visit Hour', value: insights.peakHour, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Most Active Day', value: insights.activeDay, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Top Visit Purpose', value: insights.topPurpose, icon: BookOpen, color: 'text-[#0a2a1a]', bg: 'bg-slate-100' }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-6 p-8 bg-white rounded-[2rem] shadow-lg border-l-8 border-[#c9a227] group hover:border-[#1a3a2a] transition-all">
              <div className={`p-4 rounded-2xl ${item.bg} group-hover:scale-110 transition-transform`}>
                <item.icon className={`h-6 w-6 ${item.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">{item.label}</p>
                <p className="text-xl font-black text-[#1a3a2a] tracking-tight">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
