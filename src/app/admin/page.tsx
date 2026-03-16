
'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, RefreshCcw, Sparkles, BookOpen, GraduationCap, ArrowUpRight, ArrowDownRight, UserCheck, Clock, CalendarRange, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { format, startOfDay, subDays, isWithinInterval, endOfDay, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const NEU_COLLEGES = [
  'College of Accountancy',
  'College of Agriculture',
  'College of Arts and Sciences',
  'College of Business Administration',
  'College of Communication',
  'College of Informatics and Computing Studies',
  'College of Criminology',
  'College of Education',
  'College of Engineering and Architecture',
  'College of Medical Technology',
  'College of Midwifery',
  'College of Music',
  'College of Nursing',
  'College of Physical Therapy',
  'College of Respiratory Therapy',
  'School of International Relations',
  'Faculty',
  'Administrative Staff',
  'Library Staff',
  'Guest / Visitor',
];

const PURPOSE_COLORS: Record<string, string> = {
  "Reading Books": "#1a5c2e",
  "Research / Study": "#c9a227",
  "Computer / Internet": "#0d7377",
  "Group Discussion": "#4a7c59",
  "Thesis / Archival": "#8b6914",
  "Other Purpose": "#9ca3af"
};

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'Student', label: 'Student' },
  { value: 'Faculty', label: 'Faculty / Teacher' },
  { value: 'Administrative Staff', label: 'Administrative Staff' },
  { value: 'Library Staff', label: 'Library Staff' },
  { value: 'Guest', label: 'Guest / Visitor' },
  { value: 'employee', label: 'Employee (All Staff)' },
];

export default function AdminDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filters
  const [filterPurpose, setFilterPurpose] = useState('all');
  const [filterCollege, setFilterCollege] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRangeActive, setIsRangeActive] = useState(false);

  const visitsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'visits'), orderBy('timestamp', 'desc'));
  }, [db]);
  
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);

  const filteredVisits = useMemo(() => {
    if (!allVisits) return [];
    return allVisits.filter(visit => {
      const purposeMatch = filterPurpose === 'all' || visit.purpose === filterPurpose;
      const collegeMatch = filterCollege === 'all' || visit.college === filterCollege;
      
      let typeMatch = filterType === 'all';
      if (filterType === 'employee') {
        typeMatch = ['Faculty', 'Administrative Staff', 'Library Staff'].includes(visit.visitorType);
      } else if (filterType !== 'all') {
        typeMatch = visit.visitorType === filterType;
      }

      let dateMatch = true;
      if (isRangeActive && startDate && endDate) {
        const d = visit.timestamp?.toDate();
        dateMatch = isWithinInterval(d, { 
          start: startOfDay(new Date(startDate)), 
          end: endOfDay(new Date(endDate)) 
        });
      }

      return purposeMatch && collegeMatch && typeMatch && dateMatch;
    });
  }, [allVisits, filterPurpose, filterCollege, filterType, startDate, endDate, isRangeActive]);

  const stats = useMemo(() => {
    if (!filteredVisits) return { today: 0, week: 0, month: 0 };
    
    const now = new Date();
    const today = isRangeActive && startDate ? startOfDay(new Date(startDate)) : startOfDay(now);
    const weekStart = isRangeActive && startDate && endDate ? startOfDay(new Date(startDate)) : subDays(today, 7);
    const weekEnd = isRangeActive && endDate ? endOfDay(new Date(endDate)) : endOfDay(today);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    return {
      today: filteredVisits.filter(v => isSameDay(v.timestamp.toDate(), today)).length,
      week: filteredVisits.filter(v => {
        const d = v.timestamp.toDate();
        return isRangeActive 
          ? isWithinInterval(d, { start: weekStart, end: weekEnd })
          : d >= subDays(now, 7);
      }).length,
      month: filteredVisits.filter(v => isWithinInterval(v.timestamp.toDate(), { start: monthStart, end: monthEnd })).length
    };
  }, [filteredVisits, isRangeActive, startDate, endDate]);

  const purposeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredVisits.forEach(v => { counts[v.purpose] = (counts[v.purpose] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredVisits]);

  const collegeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredVisits.forEach(v => { counts[v.college || 'Other'] = (counts[v.college || 'Other'] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredVisits]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast({ title: "Metrics Updated", description: "Latest database snapshots loaded." });
    }, 800);
  };

  const resetRange = () => {
    setStartDate('');
    setEndDate('');
    setIsRangeActive(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header Banner */}
        <div className="bg-[#1a3a2a] rounded-2xl p-6 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#c9a227]/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-[#c9a227]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">System Overview</h2>
              <p className="text-white/60 text-sm">
                The NEU Library Log system is active. 
                <span className="text-[#c9a227] font-semibold"> {stats.today} visits {isRangeActive ? 'on selected date' : 'today so far'}.</span>
              </p>
            </div>
          </div>
          <button onClick={handleRefresh} disabled={isRefreshing} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-sm transition-all font-bold">
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Sync Data
          </button>
        </div>

        {/* Global Filters */}
        <Card className="p-6 rounded-2xl border-[#d4e4d8] shadow-sm bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">Purpose Filter</Label>
              <Select value={filterPurpose} onValueChange={setFilterPurpose}>
                <SelectTrigger className="h-11 rounded-xl bg-[#f0f4f1] border-none font-bold text-xs">
                  <SelectValue placeholder="All Purposes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Purposes</SelectItem>
                  {Object.keys(PURPOSE_COLORS).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">College Filter</Label>
              <Select value={filterCollege} onValueChange={setFilterCollege}>
                <SelectTrigger className="h-11 rounded-xl bg-[#f0f4f1] border-none font-bold text-xs">
                  <SelectValue placeholder="All Colleges" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colleges</SelectItem>
                  {NEU_COLLEGES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">Visitor Type Filter</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-11 rounded-xl bg-[#f0f4f1] border-none font-bold text-xs">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-[#f0f4f1] flex flex-col md:flex-row items-end gap-4">
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 rounded-xl bg-[#f0f4f1] border-none font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 rounded-xl bg-[#f0f4f1] border-none font-bold" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsRangeActive(true)} disabled={!startDate || !endDate} className="h-11 px-6 rounded-xl bg-[#1a3a2a] text-white font-bold flex gap-2">
                <CalendarRange className="h-4 w-4" /> Apply Range
              </Button>
              {isRangeActive && (
                <Button variant="ghost" onClick={resetRange} className="h-11 text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50">
                  Reset Filter
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: isRangeActive ? 'Visits on Start Date' : 'Visits Today', value: stats.today, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: isRangeActive ? 'Range Total' : 'Last 7 Days', value: stats.week, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: isRangeActive ? 'Month containing Start' : 'Monthly Total', value: stats.month, icon: TrendingUp, color: 'text-[#1a3a2a]', bg: 'bg-slate-100' }
          ].map((s, i) => (
            <Card key={i} className="border border-[#d4e4d8] shadow-sm rounded-2xl bg-white p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">{s.label}</p>
                  <h3 className="text-5xl font-black text-[#1a3a2a] mt-2 tabular-nums">
                    {visitsLoading ? <Skeleton className="h-12 w-20 rounded-lg" /> : s.value}
                  </h3>
                </div>
                <div className={`p-4 rounded-2xl ${s.bg}`}>
                  <s.icon className={`h-8 w-8 ${s.color}`} />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[#f0f4f1] flex items-center justify-between">
                <span className="text-[9px] font-bold text-[#4a6741]/50 uppercase tracking-widest">Sync Active</span>
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              </div>
            </Card>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="rounded-2xl shadow-sm border border-[#d4e4d8] bg-white p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#1a3a2a]">Activity Analytics</h3>
                <p className="text-[10px] text-[#4a6741] font-bold uppercase tracking-widest">Purpose distribution</p>
              </div>
              <BookOpen className="h-6 w-6 text-[#c9a227]" />
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={purposeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {purposeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PURPOSE_COLORS[entry.name] || '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-2xl shadow-sm border border-[#d4e4d8] bg-white p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#1a3a2a]">College Demographics</h3>
                <p className="text-[10px] text-[#4a6741] font-bold uppercase tracking-widest">Top 5 active colleges</p>
              </div>
              <GraduationCap className="h-6 w-6 text-[#1a3a2a]" />
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collegeData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fill: '#4a6741', fontSize: 10, fontWeight: 'bold' }} />
                  <Tooltip cursor={{ fill: '#f0f4f1' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                    {collegeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#1a3a2a' : '#c9a227'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
