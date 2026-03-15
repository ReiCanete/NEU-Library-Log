"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Download, Calendar, FileText, Loader2, TrendingUp, LayoutList, Share2, Info, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useAuth } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/admin-layout';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function ReportsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  const visitsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'visits'), orderBy('timestamp', 'desc'));
  }, [db]);
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);

  const blocklistQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'blocklist'));
  }, [db]);
  const { data: allBlocked } = useCollection(blocklistQuery);

  const usersQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'users'));
  }, [db]);
  const { data: users } = useCollection(usersQuery);

  const userMap = useMemo(() => {
    const map: Record<string, any> = {};
    users?.forEach(u => map[u.studentId] = u);
    return map;
  }, [users]);

  const filteredData = useMemo(() => {
    if (!allVisits) return [];
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));
    return allVisits.filter(v => isWithinInterval(v.timestamp.toDate(), { start, end }));
  }, [allVisits, startDate, endDate]);

  const filteredBlocked = useMemo(() => {
    if (!allBlocked) return [];
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));
    return allBlocked.filter(b => isWithinInterval(b.blockedAt.toDate(), { start, end }));
  }, [allBlocked, startDate, endDate]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const p: Record<string, number> = {};
    const c: Record<string, number> = {};
    const prog: Record<string, { count: number; college: string }> = {};
    
    filteredData.forEach(v => {
      p[v.purpose] = (p[v.purpose] || 0) + 1;
      const col = v.college || userMap[v.studentId]?.college || 'Other';
      const pr = v.program || userMap[v.studentId]?.program || 'N/A';
      
      c[col] = (c[col] || 0) + 1;
      if (!prog[pr]) prog[pr] = { count: 0, college: col };
      prog[pr].count++;
    });

    return { 
      total: filteredData.length, 
      p, c, prog,
      topP: Object.entries(p).sort((a,b)=>b[1]-a[1])[0], 
      topC: Object.entries(c).sort((a,b)=>b[1]-a[1])[0],
      topProg: Object.entries(prog).sort((a,b)=>b[1].count-a[1].count)[0]
    };
  }, [filteredData, userMap]);

  const exportCSV = () => {
    if (filteredData.length === 0) return;
    setIsExportingCSV(true);
    try {
      const headers = "Student ID,Full Name,College,Program,Purpose,Login Method,Date,Time\n";
      const rows = filteredData.map(v => {
        const d = v.timestamp.toDate();
        const col = v.college || userMap[v.studentId]?.college || '';
        const pr = v.program || userMap[v.studentId]?.program || '';
        return `${v.studentId},"${v.fullName}","${col}","${pr}","${v.purpose}","${v.loginMethod || 'id'}",${format(d, 'yyyy-MM-dd')},${format(d, 'HH:mm')}`;
      }).join("\n");
      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `NEU-Library-Report-${startDate}-to-${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "CSV Exported", description: "Records downloaded successfully." });
    } catch (e) {
      toast({ title: "Export Failed", variant: "destructive" });
    } finally {
      setIsExportingCSV(false);
    }
  };

  const generatePDF = async () => {
    if (!stats) return;
    setIsGenerating(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const adminEmail = auth?.currentUser?.email || 'N/A';
      
      const renderHeader = () => {
        doc.setFillColor(26, 58, 42);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(201, 162, 39);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('NEW ERA UNIVERSITY', 105, 15, { align: 'center' });
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.text('NEU Library Log — Official Visitor Report', 105, 25, { align: 'center' });
        doc.setFontSize(9);
        doc.text(`Report Period: ${startDate} to ${endDate}`, 105, 33, { align: 'center' });
      };

      renderHeader();

      doc.setTextColor(26, 58, 42);
      doc.setFontSize(12);
      doc.text("Executive Summary", 14, 50);
      autoTable(doc, {
        startY: 55,
        head: [['Metric', 'Summary Value']],
        body: [
          ['Total Visitors Recorded', stats.total.toString()],
          ['Primary Purpose', stats.topP?.[0] || 'N/A'],
          ['Most Active College', stats.topC?.[0] || 'N/A'],
          ['Most Active Program', stats.topProg?.[0] || 'N/A'],
          ['Blocks Issued', filteredBlocked.length.toString()]
        ],
        headStyles: { fillColor: [26, 58, 42] },
        styles: { fontSize: 9 }
      });

      doc.text("Purpose Breakdown", 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Purpose', 'Count', 'Percentage']],
        body: Object.entries(stats.p).map(([n, c]) => [n, c.toString(), `${((c/stats.total)*100).toFixed(1)}%`]),
        headStyles: { fillColor: [201, 162, 39], textColor: [26, 58, 42] },
        styles: { fontSize: 8 }
      });

      doc.addPage();
      renderHeader();
      doc.text("Program Breakdown", 14, 50);
      autoTable(doc, {
        startY: 55,
        head: [['Program', 'College', 'Count', '%']],
        body: Object.entries(stats.prog)
          .sort((a,b) => b[1].count - a[1].count)
          .map(([name, data]) => [name, data.college, data.count.toString(), `${((data.count/stats.total)*100).toFixed(1)}%`]),
        headStyles: { fillColor: [26, 58, 42] },
        styles: { fontSize: 8 }
      });

      doc.addPage();
      renderHeader();
      doc.text("Detailed Activity Log", 14, 50);
      autoTable(doc, {
        startY: 55,
        head: [['#', 'ID', 'Full Name', 'College', 'Program', 'Purpose', 'Date & Time']],
        body: filteredData.map((v, i) => [
          i + 1, 
          v.studentId, 
          v.fullName, 
          v.college || userMap[v.studentId]?.college || '—',
          v.program || userMap[v.studentId]?.program || '—',
          v.purpose, 
          format(v.timestamp.toDate(), 'yyyy-MM-dd HH:mm')
        ]),
        headStyles: { fillColor: [26, 58, 42] },
        styles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [247, 250, 248] }
      });

      const totalPages = (doc as any).internal.getNumberOfPages();
      for(let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated by: ${adminEmail} | ${new Date().toLocaleString()} | Page ${i} of ${totalPages}`, 105, 290, { align: 'center' });
      }

      doc.save(`NEU-Report-${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast({ title: "PDF Generated", description: "Report downloaded successfully." });
    } catch (e) {
      toast({ title: "PDF Generation Failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AdminLayout>
      <title>NEU Library Log — System Reports</title>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-[#1a3a2a]">System Reporting</h2>
            <p className="text-xs tracking-widest text-[#4a6741] uppercase mt-1">Official Database Archives</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={exportCSV} disabled={filteredData.length === 0 || isExportingCSV} className="h-11 px-6 rounded-xl border-[#d4e4d8] text-[#1a3a2a] font-bold flex gap-2">
              <Share2 className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={generatePDF} disabled={isGenerating || !stats} className="bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-white px-8 h-11 rounded-xl font-bold flex gap-2">
              {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
              Generate PDF
            </Button>
          </div>
        </div>

        <Card className="rounded-2xl border-[#d4e4d8] shadow-sm bg-white p-6">
          <div className="flex flex-col md:flex-row gap-6 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Period Start</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 pl-10 bg-[#f0f4f1] border-none rounded-xl font-medium" />
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Period End</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 pl-10 bg-[#f0f4f1] border-none rounded-xl font-medium" />
              </div>
            </div>
          </div>
        </Card>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-[#d4e4d8] shadow-sm">
              <p className="text-[9px] font-bold text-[#4a6741] uppercase tracking-widest">Total Entries</p>
              <p className="text-3xl font-bold text-[#1a3a2a] mt-1">{stats.total}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-[#d4e4d8] shadow-sm">
              <p className="text-[9px] font-bold text-[#4a6741] uppercase tracking-widest">Top Purpose</p>
              <p className="text-[11px] font-bold text-[#1a3a2a] mt-2 uppercase truncate">{stats.topP?.[0]}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-[#d4e4d8] shadow-sm">
              <p className="text-[9px] font-bold text-[#4a6741] uppercase tracking-widest">Top College</p>
              <p className="text-[11px] font-bold text-[#1a3a2a] mt-2 uppercase truncate">{stats.topC?.[0]}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-[#d4e4d8] shadow-sm">
              <p className="text-[9px] font-bold text-[#4a6741] uppercase tracking-widest">Top Program</p>
              <p className="text-[11px] font-bold text-[#1a3a2a] mt-2 uppercase truncate">{stats.topProg?.[0]}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-[#d4e4d8] shadow-sm">
              <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest">Restrictions</p>
              <p className="text-3xl font-bold text-[#1a3a2a] mt-1">{filteredBlocked.length}</p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
