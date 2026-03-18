
'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Calendar, TrendingUp, RefreshCcw, Sparkles, Clock, X, Users } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, getDoc, doc, setDoc } from 'firebase/firestore';
import { BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { format, startOfDay, subDays, isWithinInterval, endOfDay, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Label } from '@/components/ui/label';

const NEU_COLLEGES = [
  'College of Accountancy', 'College of Agriculture', 'College of Arts and Sciences', 'College of Business Administration', 'College of Communication', 'College of Informatics and Computing Studies', 'College of Criminology', 'College of Education', 'College of Engineering and Architecture', 'College of Medical Technology', 'College of Midwifery', 'College of Music', 'College of Nursing', 'College of Physical Therapy', 'College of Respiratory Therapy', 'School of International Relations'
];

const PURPOSE_COLORS: Record<string, string> = {
  "Reading Books": "#1a5c2e", "Research / Study": "#c9a227", "Computer / Internet": "#0d7377", "Group Discussion": "#4a7c59", "Thesis / Archival": "#8b6914", "Other Purpose": "#9ca3af"
};

const CHART_COLORS = ['#1a3a2a', '#c9a227', '#0d7377', '#4a7c59', '#8b6914', '#9ca3af'];

export default function AdminDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Capacity Management States
  const [capacity, setCapacity] = useState(200);
  const [capacityInput, setCapacityInput] = useState('200');
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [savingCapacity, setSavingCapacity] = useState(false);

  // Filters
  const [filterPurpose, setFilterPurpose] = useState('all');
  const [filterCollege, setFilterCollege] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const visitsQuery = useMemo(() => db ? query(collection(db, 'visits'), orderBy('timestamp', 'desc')) : null, [db]);
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);

  useEffect(() => {
    // Fetch capacity setting on mount
    if (db) {
      getDoc(doc(db, 'settings', 'library')).then(snap => {
        if (snap.exists()) {
          const cap = snap.data().dailyCapacity;
          if (cap) {
            setCapacity(cap);
            setCapacityInput(String(cap));
          }
        }
      }).catch(() => {});
    }
  }, [db]);

  const handleSaveCapacity = async () => {
    const val = parseInt(capacityInput);
    if (isNaN(val) || val < 1 || !db) return;
    setSavingCapacity(true);
    try {
      await setDoc(doc(db, 'settings', 'library'), { dailyCapacity: val }, { merge: true });
      setCapacity(val);
      setEditingCapacity(false);
      toast({ title: "Settings Updated", description: "Daily library capacity has been modified." });
    } catch (e) {
      console.error('Failed to save capacity:', e);
      toast({ title: "Update Failed", description: "Could not save capacity setting.", variant: "destructive" });
    } finally {
      setSavingCapacity(false);
    }
  };

  const filteredVisits = useMemo(() => {
    if (!allVisits) return [];
    return allVisits.filter(visit => {
      const visitType = visit.visitorType || 'Student';
      const purposeMatch = filterPurpose === 'all' || visit.purpose === filterPurpose;
      const collegeMatch = filterCollege === 'all' || visit.college === filterCollege;
      let typeMatch = filterType === 'all' || (visitType || 'Student') === filterType;
      
      const visitDate = visit.timestamp?.toDate ? visit.timestamp.toDate() : new Date();
      const dateMatch = isWithinInterval(visitDate, { 
        start: startOfDay(new Date(startDate)), 
        end: endOfDay(new Date(endDate)) 
      });

      return purposeMatch && collegeMatch && typeMatch && dateMatch;
    });
  }, [allVisits, filterPurpose, filterCollege, filterType, startDate, endDate]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    return {
      today: filteredVisits.filter(v => isSameDay(v.timestamp?.toDate?.() || new Date(), today)).length,
      week: filteredVisits.filter(v => (v.timestamp?.toDate?.() || new Date()) >= subDays(new Date(), 7)).length,
      month: filteredVisits.filter(v => isWithinInterval(v.timestamp?.toDate?.() || new Date(), { start: startOfMonth(today), end: endOfMonth(today) })).length
    };
  }, [filteredVisits]);

  const avgDaily = useMemo(() => {
    if (!filteredVisits.length) return 0;
    const days = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);
    return Math.round(filteredVisits.length / days);
  }, [filteredVisits, startDate, endDate]);

  const mostActiveHour = useMemo(() => {
    if (!filteredVisits.length) return 'N/A';
    const hours: Record<number, number> = {};
    filteredVisits.forEach(v => {
      const h = v.timestamp?.toDate?.()?.getHours?.() ?? -1;
      if (h >= 0) hours[h] = (hours[h] || 0) + 1;
    });
    const peak = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];
    if (!peak) return 'N/A';
    const h = parseInt(peak[0]);
    const label = h === 0 ? '12AM' : h < 12 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`;
    return label;
  }, [filteredVisits]);

  const dailyTrendData = useMemo(() => {
    if (!filteredVisits.length) return [];
    const counts: Record<string, number> = {};
    filteredVisits.forEach(v => {
      const d = v.timestamp?.toDate?.();
      if (d) {
        const key = format(d, 'MMM dd');
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .slice(-14)
      .map(([date, count]) => ({ date, count }));
  }, [filteredVisits]);

  const topPurposes = useMemo(() => {
    return Object.entries(
      filteredVisits.reduce((acc: Record<string, number>, v) => {
        const k = v.purpose || 'Other Purpose';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [filteredVisits]);

  const collegeRankData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredVisits.forEach(v => {
      if (v.college) counts[v.college] = (counts[v.college] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = sorted[0]?.[1] || 1;
    return sorted.map(([name, count]) => ({ name, count, pct: Math.round((count / filteredVisits.length) * 100), bar: Math.round((count / max) * 100) }));
  }, [filteredVisits]);

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredVisits.forEach(v => {
      const key = v.purpose || 'Other Purpose';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredVisits]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => { setIsRefreshing(false); toast({ title: "Live Sync", description: "Metrics updated." }); }, 800);
  };

  const resetFilters = () => {
    setFilterPurpose('all');
    setFilterCollege('all');
    setFilterType('all');
    setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-[#0d2b1a] via-[#1a3a2a] to-[#0d2b1a] rounded-2xl p-6 flex items-center justify-between shadow-xl border border-[#c9a227]/20 ring-1 ring-[#c9a227]/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#c9a227]/20 rounded-xl flex items-center justify-center"><Sparkles className="w-7 h-7 text-[#c9a227]" /></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-black text-[#c9a227] uppercase tracking-[0.2em]">Live Session</span>
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">System Dashboard</h2>
            </div>
          </div>
          <button onClick={handleRefresh} disabled={isRefreshing} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-sm transition-all font-black uppercase tracking-widest border border-white/10 hover:border-white/20">
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Sync
          </button>
        </div>

        {/* Global Filters Row */}
        <div className="bg-white rounded-2xl border border-[#d4e4d8] p-6 shadow-sm ring-1 ring-[#1a3a2a]/5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] mb-2 block">Purpose Filter</Label>
              <select
                value={filterPurpose}
                onChange={e => setFilterPurpose(e.target.value)}
                className="w-full h-11 bg-[#f4f8f5] border border-[#c8ddd0] rounded-xl px-4 text-xs font-bold text-[#1a3a2a] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/30 focus:border-[#c9a227]/60 transition-all"
              >
                <option value="all">All Purposes</option>
                {Object.keys(PURPOSE_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] mb-2 block">College Filter</Label>
              <select
                value={filterCollege}
                onChange={e => setFilterCollege(e.target.value)}
                className="w-full h-11 bg-[#f4f8f5] border border-[#c8ddd0] rounded-xl px-4 text-xs font-bold text-[#1a3a2a] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/30 focus:border-[#c9a227]/60 transition-all"
              >
                <option value="all">All Colleges</option>
                {NEU_COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] mb-2 block">Visitor Type</Label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="w-full h-11 bg-[#f4f8f5] border border-[#c8ddd0] rounded-xl px-4 text-xs font-bold text-[#1a3a2a] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/30 focus:border-[#c9a227]/60 transition-all"
              >
                <option value="all">All Types</option>
                <option value="Student">Student</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-end gap-6 pt-4 border-t border-[#f0f4f1]">
            <div className="flex-1 w-full">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] mb-2 block">Date Range</Label>
              <div className="flex items-center gap-3">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="flex-1 h-11 bg-[#f4f8f5] border border-[#c8ddd0] rounded-xl px-4 text-[11px] font-bold text-[#1a3a2a]" />
                <span className="text-slate-300">to</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="flex-1 h-11 bg-[#f4f8f5] border border-[#c8ddd0] rounded-xl px-4 text-[11px] font-bold text-[#1a3a2a]" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={resetFilters}
                className="h-11 px-6 bg-slate-100 text-[#4a6741] text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2">
                <X className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          </div>
        </div>

        {/* Wide Summary Banner */}
        <div className="bg-white rounded-2xl border border-[#d4e4d8] shadow-sm ring-1 ring-[#1a3a2a]/5 overflow-hidden">
          <div className="bg-gradient-to-r from-[#0d2b1a] to-[#1a3a2a] px-6 py-3 flex items-center justify-between">
            <span className="text-[10px] font-black text-[#c9a227] uppercase tracking-[0.25em]">Period Summary</span>
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{startDate} → {endDate}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-[#f0f4f1]">
            {[
              { label: 'Total Visits', value: visitsLoading ? '—' : filteredVisits.length, sub: 'filtered period', color: 'text-[#1a3a2a]' },
              { label: 'This Week', value: visitsLoading ? '—' : stats.week, sub: 'last 7 days', color: 'text-amber-600' },
              { label: 'This Month', value: visitsLoading ? '—' : stats.month, sub: 'calendar month', color: 'text-emerald-600' },
              { label: 'Avg / Day', value: visitsLoading ? '—' : avgDaily, sub: 'daily average', color: 'text-blue-600' },
              { label: 'Peak Hour', value: visitsLoading ? '—' : mostActiveHour, sub: 'most active', color: 'text-purple-600' },
            ].map((s, i) => (
              <div key={i} className="px-6 py-5 flex flex-col gap-1">
                <p className="text-[9px] font-black text-[#4a6741] uppercase tracking-widest">{s.label}</p>
                <p className={`text-3xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 border-t border-[#f0f4f1] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-[9px] font-black text-[#4a6741] uppercase tracking-widest whitespace-nowrap">Daily Capacity</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    stats.today / capacity > 0.9 ? 'bg-gradient-to-r from-red-400 to-red-600' :
                    stats.today / capacity > 0.7 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                    'bg-gradient-to-r from-emerald-400 to-emerald-600'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((stats.today / capacity) * 100))}%` }}
                />
              </div>
              <span className="text-[9px] font-black text-[#1a3a2a] tabular-nums whitespace-nowrap">{stats.today} / {capacity}</span>
            </div>
            {editingCapacity ? (
              <div className="flex items-center gap-2">
                <input type="number" value={capacityInput} onChange={e => setCapacityInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveCapacity()} className="w-20 h-8 border border-[#d4e4d8] rounded-lg px-2 text-sm font-bold text-[#1a3a2a] focus:outline-none" min="1" autoFocus />
                <button onClick={handleSaveCapacity} disabled={savingCapacity} className="h-8 px-3 bg-[#1a3a2a] text-white text-[9px] font-black uppercase rounded-lg">{savingCapacity ? '...' : 'Save'}</button>
                <button onClick={() => { setEditingCapacity(false); setCapacityInput(String(capacity)); }} className="h-8 px-3 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-lg">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setEditingCapacity(true)} className="text-[9px] font-black uppercase tracking-widest text-[#4a6741] border border-[#d4e4d8] px-3 py-1.5 rounded-lg hover:bg-[#f0f4f1] transition-all whitespace-nowrap">Edit Limit</button>
            )}
          </div>
        </div>

        {/* SECTION A: Top 3 Purpose stat cards + donut chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#c9a227] to-[#1a3a2a]" />
              <h3 className="text-xs font-black text-[#1a3a2a] uppercase tracking-widest">Top Purposes</h3>
            </div>
            {topPurposes.map(([name, count], i) => (
              <div key={name} className="bg-white rounded-2xl border border-[#d4e4d8] p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow ring-1 ring-[#1a3a2a]/5">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${i === 0 ? 'bg-[#c9a227]/15 text-[#c9a227]' : i === 1 ? 'bg-[#1a3a2a]/10 text-[#1a3a2a]' : 'bg-slate-100 text-slate-500'}`}>
                    {i + 1}
                  </div>
                  <p className="text-sm font-black text-[#1a3a2a]">{name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-[#1a3a2a] tabular-nums">{count}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">{filteredVisits.length ? Math.round((count / filteredVisits.length) * 100) : 0}%</p>
                </div>
              </div>
            ))}
            {topPurposes.length === 0 && <p className="text-xs text-slate-400 font-bold text-center py-8">No data in selected range</p>}
          </div>

          <div className="bg-white rounded-2xl border border-[#d4e4d8] p-6 shadow-sm ring-1 ring-[#1a3a2a]/5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#c9a227] to-[#1a3a2a]" />
              <h3 className="text-xs font-black text-[#1a3a2a] uppercase tracking-widest">Purpose Distribution</h3>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={chartData} innerRadius={65} outerRadius={105} paddingAngle={3} dataKey="value" stroke="none">
                    {chartData.map((e, i) => <Cell key={i} fill={PURPOSE_COLORS[e.name] || CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} visits`, '']} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{fontSize:'10px',fontWeight:'bold',color:'#1a3a2a'}}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* SECTION B: College leaderboard + daily trend line */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-[#d4e4d8] p-6 shadow-sm ring-1 ring-[#1a3a2a]/5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#c9a227] to-[#1a3a2a]" />
              <h3 className="text-xs font-black text-[#1a3a2a] uppercase tracking-widest">College Leaderboard</h3>
            </div>
            <div className="space-y-3">
              {collegeRankData.map((c, i) => (
                <div key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-400 w-4 tabular-nums">{i + 1}</span>
                      <span className="text-[11px] font-bold text-[#1a3a2a] truncate max-w-[200px]">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-[#1a3a2a] tabular-nums">{c.count}</span>
                      <span className="text-[9px] font-bold text-slate-400 w-8 text-right">{c.pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${c.bar}%`, background: i === 0 ? 'linear-gradient(to right, #c9a227, #a07d1a)' : 'linear-gradient(to right, #1a3a2a, #2d6a4f)' }}
                    />
                  </div>
                </div>
              ))}
              {collegeRankData.length === 0 && <p className="text-xs text-slate-400 font-bold text-center py-8">No college data in selected range</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#d4e4d8] p-6 shadow-sm ring-1 ring-[#1a3a2a]/5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#c9a227] to-[#1a3a2a]" />
              <h3 className="text-xs font-black text-[#1a3a2a] uppercase tracking-widest">Daily Trend</h3>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer>
                <LineChart data={dailyTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f1" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#4a6741' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#4a6741' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #d4e4d8', fontSize: '11px', fontWeight: 'bold' }} formatter={(v: any) => [`${v} visits`, 'Count']} />
                  <Line type="monotone" dataKey="count" stroke="#c9a227" strokeWidth={2.5} dot={{ fill: '#1a3a2a', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#c9a227' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
