
'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Calendar, TrendingUp, RefreshCcw, Sparkles, Clock, Filter, X, Users } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, getDoc, doc, setDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
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
      let typeMatch = filterType === 'all' ? true : (filterType === 'employee' ? ['Faculty', 'Administrative Staff', 'Library Staff'].includes(visitType) : visitType === filterType);
      
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
        <div className="bg-[#1a3a2a] rounded-2xl p-6 flex items-center justify-between shadow-xl border-l-4 border-[#c9a227]">
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
          <button onClick={handleRefresh} disabled={isRefreshing} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-sm transition-all font-black uppercase tracking-widest"><RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Sync</button>
        </div>

        {/* Global Filters Row */}
        <div className="bg-white rounded-2xl border border-[#d4e4d8] p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] mb-2 block">Purpose Filter</Label>
              <select
                value={filterPurpose}
                onChange={e => setFilterPurpose(e.target.value)}
                className="w-full h-11 bg-[#f8fafc] border border-[#d4e4d8] rounded-xl px-4 text-xs font-bold text-[#1a3a2a] focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
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
                className="w-full h-11 bg-[#f8fafc] border border-[#d4e4d8] rounded-xl px-4 text-xs font-bold text-[#1a3a2a] focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
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
                className="w-full h-11 bg-[#f8fafc] border border-[#d4e4d8] rounded-xl px-4 text-xs font-bold text-[#1a3a2a] focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
              >
                <option value="all">All Types</option>
                <option value="Student">Student</option>
                <option value="Faculty">Faculty</option>
                <option value="Administrative Staff">Admin Staff</option>
                <option value="Library Staff">Library Staff</option>
                <option value="Guest">Guest</option>
                <option value="employee">All Staff Total</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-end gap-6 pt-4 border-t border-[#f0f4f1]">
            <div className="flex-1 w-full">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] mb-2 block">Date Range</Label>
              <div className="flex items-center gap-3">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="flex-1 h-11 bg-[#f8fafc] border border-[#d4e4d8] rounded-xl px-4 text-[11px] font-bold text-[#1a3a2a]" />
                <span className="text-slate-300">to</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="flex-1 h-11 bg-[#f8fafc] border border-[#d4e4d8] rounded-xl px-4 text-[11px] font-bold text-[#1a3a2a]" />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Visits (Filtered)', value: filteredVisits.length, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Weekly Traffic', value: stats.week, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Monthly Volume', value: stats.month, icon: TrendingUp, color: 'text-[#1a3a2a]', bg: 'bg-slate-100' }
          ].map((s, i) => (
            <Card key={i} className="border border-[#d4e4d8] border-t-2 border-t-[#c9a227] shadow-sm rounded-2xl bg-white p-6">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">{s.label}</p><h3 className="text-4xl font-black text-[#1a3a2a] mt-2 tabular-nums">{visitsLoading ? <Skeleton className="h-10 w-20" /> : s.value}</h3></div>
                <div className={`p-4 rounded-xl ${s.bg}`}><s.icon className={`h-6 w-6 ${s.color}`} /></div>
              </div>
            </Card>
          ))}

          {/* Daily Capacity Card */}
          <div className="bg-white rounded-2xl border border-[#d4e4d8] border-t-2 border-t-purple-500 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">Daily Capacity</p>
                <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tight">Kiosk Entry limit</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>

            {editingCapacity ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  value={capacityInput}
                  onChange={e => setCapacityInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveCapacity()}
                  className="flex-1 h-9 border border-[#d4e4d8] rounded-lg px-3 text-sm font-bold text-[#1a3a2a] focus:outline-none focus:border-[#1a3a2a]"
                  min="1"
                  autoFocus
                />
                <button
                  onClick={handleSaveCapacity}
                  disabled={savingCapacity}
                  className="h-9 px-3 bg-[#1a3a2a] text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#0a2a1a] transition-colors disabled:opacity-50"
                >
                  {savingCapacity ? '...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingCapacity(false);
                    setCapacityInput(String(capacity));
                  }}
                  className="h-9 px-3 bg-[#f8fafc] border border-[#d4e4d8] text-[#4a6741] text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#f0f4f1] transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-end justify-between mt-2">
                <div className="flex-1">
                  <p className="text-4xl font-black text-[#1a3a2a] tabular-nums">{capacity}</p>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight">
                    {stats.today} recorded today ({Math.round((stats.today / capacity) * 100)}%)
                  </p>
                  {/* Usage bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-1000 ${
                        stats.today / capacity > 0.9 ? 'bg-red-500' :
                        stats.today / capacity > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.round((stats.today / capacity) * 100))}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => setEditingCapacity(true)}
                  className="ml-4 text-[9px] font-black uppercase tracking-widest text-[#4a6741] border border-[#d4e4d8] px-3 py-1.5 rounded-lg hover:bg-[#f0f4f1] transition-all"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="rounded-2xl shadow-sm border border-[#d4e4d8] border-t-2 border-t-[#c9a227] bg-white p-8">
            <h3 className="text-lg font-black text-[#1a3a2a] mb-6 uppercase tracking-tight">Visit Activity</h3>
            <div className="h-[300px]"><ResponsiveContainer><PieChart><Pie data={chartData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">{chartData.map((e, i) => <Cell key={i} fill={PURPOSE_COLORS[e.name] || CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
          </Card>
          <Card className="rounded-2xl shadow-sm border border-[#d4e4d8] border-t-2 border-t-[#c9a227] bg-white p-8">
            <h3 className="text-lg font-black text-[#1a3a2a] mb-6 uppercase tracking-tight">Top Colleges</h3>
            <div className="h-[300px]"><ResponsiveContainer><BarChart data={chartData.slice(0, 5)} layout="vertical"><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: 'bold' }} /><Tooltip /><Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>{chartData.map((e, i) => <Cell key={i} fill={i === 0 ? '#1a3a2a' : '#c9a227'} />)}</Bar></BarChart></ResponsiveContainer></div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
