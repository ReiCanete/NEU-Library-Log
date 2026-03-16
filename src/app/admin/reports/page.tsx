
"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Calendar, FileText, Loader2, Share2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useAuth } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/admin-layout';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Label } from '@/components/ui/label';

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
  const { data: allVisits } = useCollection(visitsQuery);

  const blocklistQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'blocklist'));
  }, [db]);
  const { data: allBlocked } = useCollection(blocklistQuery);

  const filteredData = useMemo(() => {
    if (!allVisits) return [];
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));
    return allVisits.filter(v => isWithinInterval(v.timestamp.toDate(), { start, end }));
  }, [allVisits, startDate, endDate]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const purposes: Record<string, number> = {};
    const colleges: Record<string, number> = {};
    const programs: Record<string, number> = {};
    
    filteredData.forEach(v => {
      purposes[v.purpose] = (purposes[v.purpose] || 0) + 1;
      colleges[v.college || 'Other'] = (colleges[v.college || 'Other'] || 0) + 1;
      programs[v.program || 'N/A'] = (programs[v.program || 'N/A'] || 0) + 1;
    });

    return {
      total: filteredData.length,
      purposes,
      colleges,
      programs,
      topP: Object.entries(purposes).sort((a,b)=>b[1]-a[1])[0],
      topC: Object.entries(colleges).sort((a,b)=>b[1]-a[1])[0],
      topPr: Object.entries(programs).sort((a,b)=>b[1]-a[1])[0],
      restrictions: allBlocked?.filter(b => isWithinInterval(b.blockedAt.toDate(), { start: startOfDay(new Date(startDate)), end: endOfDay(new Date(endDate)) })).length || 0
    };
  }, [filteredData, allBlocked, startDate, endDate]);

  const exportCSV = () => {
    if (filteredData.length === 0) return;
    setIsExportingCSV(true);
    try {
      const headers = "Student ID,Full Name,College,Program,Visitor Type,Purpose,Login Method,Date,Time\n";
      const rows = filteredData.map(v => {
        const d = v.timestamp.toDate();
        return `${v.studentId},"${v.fullName}","${v.college || ''}","${v.program || ''}","${v.visitorType || 'Student'}","${v.purpose}","${v.loginMethod || 'id'}",${format(d, 'yyyy-MM-dd')},${format(d, 'HH:mm')}`;
      }).join("\n");
      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `NEU-Library-Report-${startDate}-to-${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "CSV Exported", description: "All records including visitor types downloaded." });
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
      
      // Header
      doc.setFillColor(26, 58, 42);
      doc.rect(0, 0, 210, 45, 'F');
      doc.setTextColor(201, 162, 39);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('NEW ERA UNIVERSITY', 105, 18, { align: 'center' });
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text('NEU Library Log — Official Visitor Report', 105, 28, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Period: ${startDate} to ${endDate}`, 105, 36, { align: 'center' });

      // Sections
      let currentY = 55;

      doc.setTextColor(26, 58, 42);
      doc.setFontSize(14);
      doc.text("EXECUTIVE SUMMARY", 14, currentY);
      doc.setDrawColor(201, 162, 39);
      doc.line(14, currentY + 2, 196, currentY + 2);
      currentY += 10;

      autoTable(doc, {
        startY: currentY,
        head: [['Metric', 'Value']],
        body: [
          ['Total Visitors recorded', stats.total.toString()],
          ['Primary Purpose', stats.topP?.[0] || 'N/A'],
          ['Most Active College', stats.topC?.[0] || 'N/A'],
          ['Most Active Program', stats.topPr?.[0] || 'N/A'],
          ['Restrictions Issued', stats.restrictions.toString()]
        ],
        theme: 'striped',
        headStyles: { fillColor: [26, 58, 42] },
        styles: { fontSize: 10 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      doc.text("PURPOSE BREAKDOWN", 14, currentY);
      doc.line(14, currentY + 2, 196, currentY + 2);
      currentY += 8;

      autoTable(doc, {
        startY: currentY,
        head: [['Purpose', 'Count', 'Percentage']],
        body: Object.entries(stats.purposes).map(([n, c]) => [n, c.toString(), `${((c/stats.total)*100).toFixed(1)}%`]),
        headStyles: { fillColor: [201, 162, 39], textColor: [26, 58, 42] }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      doc.text("COLLEGE BREAKDOWN", 14, currentY);
      doc.line(14, currentY + 2, 196, currentY + 2);
      currentY += 8;

      autoTable(doc, {
        startY: currentY,
        head: [['College', 'Count', '%']],
        body: Object.entries(stats.colleges).map(([n, c]) => [n, c.toString(), `${((c/stats.total)*100).toFixed(1)}%`]),
        headStyles: { fillColor: [26, 58, 42] }
      });

      // Detailed Log on new page
      doc.addPage();
      doc.setTextColor(26, 58, 42);
      doc.text("DETAILED ACTIVITY LOG", 14, 20);
      doc.line(14, 22, 196, 22);

      autoTable(doc, {
        startY: 28,
        head: [['ID', 'Full Name', 'College', 'Type', 'Purpose', 'Date & Time']],
        body: filteredData.map(v => [
          v.studentId, 
          v.fullName, 
          v.college || '—',
          v.visitorType || 'Student',
          v.purpose, 
          format(v.timestamp.toDate(), 'MM/dd HH:mm')
        ]),
        headStyles: { fillColor: [26, 58, 42] },
        styles: { fontSize: 8 }
      });

      // Footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      for(let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`NEW ERA UNIVERSITY — NEU Library Log System | Confidential | Page ${i} of ${totalPages}`, 105, 285, { align: 'center' });
        doc.text(`Generated by: ${adminEmail} | ${new Date().toLocaleString()}`, 105, 290, { align: 'center' });
      }

      doc.save(`NEU-Official-Report-${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast({ title: "Report Ready", description: "PDF has been generated and downloaded." });
    } catch (e) {
      toast({ title: "Generation Failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-4xl font-black text-[#1a3a2a] tracking-tight">System Reporting</h2>
            <p className="text-xs font-bold text-[#4a6741] uppercase tracking-[0.2em] mt-1">Official Database Archive</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={exportCSV} disabled={filteredData.length === 0 || isExportingCSV} className="h-12 px-6 rounded-xl border-[#d4e4d8] text-[#1a3a2a] font-bold flex gap-2">
              <Share2 className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={generatePDF} disabled={isGenerating || !stats} className="bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] px-8 h-12 rounded-xl font-black flex gap-2 shadow-lg">
              {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <Download className="h-5 w-5" />}
              Generate PDF Report
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-2xl border-[#d4e4d8] shadow-sm bg-white p-6">
              <h3 className="text-xs font-black text-[#4a6741] uppercase tracking-widest mb-6 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Period Selection
              </h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#1a3a2a]">Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-12 bg-[#f0f4f1] border-none rounded-xl font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#1a3a2a]">End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-12 bg-[#f0f4f1] border-none rounded-xl font-bold" />
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border-[#d4e4d8] bg-[#f0f4f1]/50 p-6">
              <h3 className="text-xs font-black text-[#4a6741] uppercase tracking-widest mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Period Total:</span>
                  <span className="text-lg font-black text-[#1a3a2a]">{filteredData.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Restrictions:</span>
                  <span className="text-lg font-black text-red-600">{stats?.restrictions || 0}</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="rounded-[2rem] border-[#d4e4d8] shadow-2xl bg-white overflow-hidden min-h-[500px]">
              <div className="bg-[#1a3a2a] p-4 flex items-center gap-3">
                <Eye className="h-4 w-4 text-[#c9a227]" />
                <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Live Report Preview</span>
              </div>
              <CardContent className="p-10">
                {stats ? (
                  <pre className="font-mono text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
{`REPORT PREVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Period:    ${format(new Date(startDate), 'MMM dd, yyyy')} — ${format(new Date(endDate), 'MMM dd, yyyy')}
Generated: ${format(new Date(), 'MMMM dd, yyyy hh:mm a')}
By:        ${auth?.currentUser?.email || 'System Administrator'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUMMARY
Total Visitors:          ${stats.total}
Most Common Purpose:     ${stats.topP?.[0]}
Most Active College:     ${stats.topC?.[0]}
Most Active Program:     ${stats.topPr?.[0]}
Total Restrictions:      ${stats.restrictions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PURPOSE BREAKDOWN
${Object.entries(stats.purposes).map(([n, c]) => `${n.padEnd(24)} ${c.toString().padEnd(4)} (${((c/stats.total)*100).toFixed(1)}%)`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOP COLLEGES
${Object.entries(stats.colleges).sort((a,b)=>b[1]-a[1]).slice(0, 5).map(([n, c]) => `${n.padEnd(36)} ${c.toString().padEnd(4)} (${((c/stats.total)*100).toFixed(1)}%)`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEW ERA UNIVERSITY — NEU Library Log System | Confidential`}
                  </pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                    <FileText className="h-16 w-16 text-slate-100" />
                    <p className="text-sm font-bold text-slate-400">Select a date range with records to see the preview.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
