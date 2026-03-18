
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

const NEU_COLLEGES = [
  'College of Accountancy', 'College of Agriculture', 'College of Arts and Sciences',
  'College of Business Administration', 'College of Communication',
  'College of Informatics and Computing Studies', 'College of Criminology',
  'College of Education', 'College of Engineering and Architecture',
  'College of Medical Technology', 'College of Midwifery', 'College of Music',
  'College of Nursing', 'College of Physical Therapy', 'College of Respiratory Therapy',
  'School of International Relations'
];

const PURPOSES = [
  'Reading Books', 'Research / Study', 'Computer / Internet',
  'Group Discussion', 'Thesis / Archival', 'Other Purpose'
];

export default function ReportsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterPurpose, setFilterPurpose] = useState('all');
  const [filterCollege, setFilterCollege] = useState('all');
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
    return allVisits.filter(v => {
      const dateMatch = isWithinInterval(v.timestamp.toDate(), { start, end });
      const purposeMatch = filterPurpose === 'all' || v.purpose === filterPurpose;
      const collegeMatch = filterCollege === 'all' || (v.college || '') === filterCollege;
      return dateMatch && purposeMatch && collegeMatch;
    });
  }, [allVisits, startDate, endDate, filterPurpose, filterCollege]);

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
      toast({ title: "CSV Exported", description: "All records downloaded." });
    } catch (e) {
      toast({ title: "Export Failed", variant: "destructive" });
    } finally {
      setIsExportingCSV(false);
    }
  };

  const generatePDF = async () => {
    if (!stats) return;
    setIsGenerating(true);

    let logoBase64 = '';
    try {
      const response = await fetch('/neu-logo.png');
      const blob = await response.blob();
      logoBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Could not load NEU logo for PDF:', e);
    }

    try {
      const pageW = 210;
      const doc = new jsPDF('p', 'mm', 'a4');
      const adminEmail = auth?.currentUser?.email || 'System Administrator';
      const generatedAt = format(new Date(), 'MMMM dd, yyyy hh:mm a');
      const periodLabel = `${format(new Date(startDate), 'MMM dd, yyyy')} — ${format(new Date(endDate), 'MMM dd, yyyy')}`;

      // Deep green header block — taller to fit logo
      doc.setFillColor(26, 58, 42);
      doc.rect(0, 0, pageW, 68, 'F');

      // Gold accent bar
      doc.setFillColor(201, 162, 39);
      doc.rect(0, 68, pageW, 3, 'F');

      // NEU Logo
      if (logoBase64) {
        // Draw green filled circle as background behind logo to fix transparency issues
        doc.setFillColor(26, 58, 42);
        doc.circle(36, 34, 28, 'F');
        // Place logo centered over the circle
        doc.addImage(logoBase64, 'PNG', 10, 8, 52, 52);
      }

      // University name — to the right of the logo
      doc.setTextColor(201, 162, 39);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('NEW ERA UNIVERSITY', 72, 24);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('LIBRARY VISITOR ACTIVITY REPORT', 72, 35);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(200, 220, 210);
      doc.text('NEU Library Log — Official System Export', 72, 44);
      doc.text(`Period: ${periodLabel}`, 72, 52);

      // Thin gold divider line inside header separating logo area
      doc.setDrawColor(201, 162, 39);
      doc.setLineWidth(0.3);
      doc.line(68, 10, 68, 62);

      // Meta info row below gold bar
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated by: ${adminEmail}`, 14, 78);
      doc.text(`Date: ${generatedAt}`, pageW - 14, 78, { align: 'right' });

      // Active filters notice
      const activeFilters = [];
      if (filterPurpose !== 'all') activeFilters.push(`Purpose: ${filterPurpose}`);
      if (filterCollege !== 'all') activeFilters.push(`College: ${filterCollege}`);
      if (activeFilters.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(139, 105, 20);
        doc.text(`Filters applied: ${activeFilters.join(' | ')}`, 14, 86);
      }

      let y = activeFilters.length > 0 ? 94 : 88;

      // Section: Executive Summary
      doc.setFillColor(26, 58, 42);
      doc.rect(14, y, pageW - 28, 7, 'F');
      doc.setTextColor(201, 162, 39);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('EXECUTIVE SUMMARY', 18, y + 5);
      y += 12;

      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Total Visits (filtered period)', stats.total.toString()],
          ['Most Common Purpose', `${stats.topP?.[0] || 'N/A'} (${stats.topP?.[1] || 0} visits)`],
          ['Most Active College', `${stats.topC?.[0] || 'N/A'} (${stats.topC?.[1] || 0} visits)`],
          ['Most Active Program', `${stats.topPr?.[0] || 'N/A'} (${stats.topPr?.[1] || 0} visits)`],
          ['Restrictions Issued (period)', stats.restrictions.toString()],
        ],
        styles: {
          fontSize: 9,
          cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
          valign: 'middle',
        },
        headStyles: {
          halign: 'center',
          valign: 'middle',
          fontStyle: 'bold',
          fontSize: 9,
          fillColor: [26, 58, 42],
          textColor: [201, 162, 39],
          cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
        },
        alternateRowStyles: { fillColor: [240, 247, 242] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 90 },
          1: { halign: 'center' },
        },
        margin: { left: 14, right: 14 },
        pageBreak: 'avoid',
        rowPageBreak: 'avoid',
      });

      y = (doc as any).lastAutoTable.finalY + 14;

      // Section: Purpose Breakdown
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFillColor(201, 162, 39);
      doc.rect(14, y, pageW - 28, 7, 'F');
      doc.setTextColor(26, 58, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('PURPOSE BREAKDOWN', 18, y + 5);
      y += 12;

      autoTable(doc, {
        startY: y,
        head: [['Purpose', 'Visits', 'Share']],
        body: Object.entries(stats.purposes)
          .sort((a, b) => b[1] - a[1])
          .map(([n, c]) => [n, c.toString(), `${((c / stats.total) * 100).toFixed(1)}%`]),
        styles: {
          fontSize: 9,
          cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
          valign: 'middle',
        },
        headStyles: {
          halign: 'center',
          valign: 'middle',
          fontStyle: 'bold',
          fontSize: 9,
          fillColor: [201, 162, 39],
          textColor: [26, 58, 42],
          cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
        },
        alternateRowStyles: { fillColor: [254, 249, 235] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'center', cellWidth: 22 },
          2: { halign: 'center', cellWidth: 22 },
        },
        margin: { left: 14, right: 14 },
        pageBreak: 'avoid',
        rowPageBreak: 'avoid',
      });

      y = (doc as any).lastAutoTable.finalY + 14;

      // Section: College Breakdown
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFillColor(26, 58, 42);
      doc.rect(14, y, pageW - 28, 7, 'F');
      doc.setTextColor(201, 162, 39);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('COLLEGE BREAKDOWN', 18, y + 5);
      y += 12;

      autoTable(doc, {
        startY: y,
        head: [['College', 'Visits', 'Share']],
        body: Object.entries(stats.colleges)
          .sort((a, b) => b[1] - a[1])
          .map(([n, c]) => [n, c.toString(), `${((c / stats.total) * 100).toFixed(1)}%`]),
        styles: {
          fontSize: 9,
          cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
          valign: 'middle',
        },
        headStyles: {
          halign: 'center',
          valign: 'middle',
          fontStyle: 'bold',
          fontSize: 9,
          fillColor: [26, 58, 42],
          textColor: [201, 162, 39],
          cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
        },
        alternateRowStyles: { fillColor: [240, 247, 242] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'center', cellWidth: 22 },
          2: { halign: 'center', cellWidth: 22 },
        },
        margin: { left: 14, right: 14 },
        pageBreak: 'avoid',
        rowPageBreak: 'avoid',
      });

      // ── PAGE 2: Full Visit Log ────────────────────────────────────────────
      doc.addPage();
      doc.setFillColor(26, 58, 42);
      doc.rect(0, 0, pageW, 22, 'F');
      doc.setFillColor(201, 162, 39);
      doc.rect(0, 22, pageW, 2, 'F');

      // Small logo on page 2 header
      if (logoBase64) {
        doc.setFillColor(26, 58, 42);
        doc.circle(16, 11, 9, 'F');
        doc.addImage(logoBase64, 'PNG', 7, 2, 18, 18);
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('DETAILED ACTIVITY LOG', pageW / 2, 14, { align: 'center' });

      doc.setTextColor(26, 58, 42);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${filteredData.length} records  |  ${periodLabel}`, 14, 32);

      autoTable(doc, {
        startY: 36,
        head: [['Student ID', 'Full Name', 'College', 'Purpose', 'Date', 'Time']],
        body: filteredData.map(v => [
          v.studentId || '—',
          v.fullName || '—',
          v.college || '—',
          v.purpose || '—',
          format(v.timestamp.toDate(), 'MMM dd, yyyy'),
          format(v.timestamp.toDate(), 'hh:mm a'),
        ]),
        styles: {
          fontSize: 7.5,
          cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
          valign: 'middle',
        },
        headStyles: {
          halign: 'center',
          valign: 'middle',
          fontStyle: 'bold',
          fontSize: 8,
          fillColor: [26, 58, 42],
          textColor: [201, 162, 39],
          cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
        },
        columnStyles: {
          0: { cellWidth: 30, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 38 },
          2: { cellWidth: 50 },
          3: { cellWidth: 34 },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 12, halign: 'center' },
        },
        alternateRowStyles: { fillColor: [240, 247, 242] },
        margin: { left: 14, right: 14, top: 4 },
        pageBreak: 'avoid',
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
      });

      // ── FOOTER on all pages ───────────────────────────────────────────────
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(26, 58, 42);
        doc.rect(0, 288, pageW, 10, 'F');
        doc.setFontSize(7);
        doc.setTextColor(200, 220, 210);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `NEW ERA UNIVERSITY — NEU Library Log  |  Confidential  |  Page ${i} of ${totalPages}`,
          pageW / 2, 294, { align: 'center' }
        );
      }

      doc.save(`NEU-Library-Report-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
      toast({ title: "Report Generated", description: "PDF downloaded successfully." });
    } catch (e) {
      console.error(e);
      toast({ title: "Generation Failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-12 rounded-full bg-gradient-to-b from-[#c9a227] to-[#1a3a2a]" />
            <div>
              <h2 className="text-4xl font-black text-[#1a3a2a] tracking-tight">System Reporting</h2>
              <p className="text-xs font-bold text-[#4a6741] uppercase tracking-[0.2em] mt-1">Official Database Archive</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={exportCSV} disabled={filteredData.length === 0 || isExportingCSV} className="h-11 px-5 rounded-xl border border-[#c8ddd0] bg-white text-[#1a3a2a] font-bold flex gap-2 hover:bg-[#f4f8f5] hover:border-[#1a3a2a]/30 transition-all shadow-sm">
              <Share2 className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={generatePDF} disabled={isGenerating || !stats} className="bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] px-8 h-11 rounded-xl font-black flex gap-2 shadow-lg shadow-[#c9a227]/20 hover:opacity-90 transition-all">
              {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <Download className="h-5 w-5" />}
              Generate PDF Report
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-2xl border border-[#d4e4d8] shadow-sm bg-white p-6 ring-1 ring-[#1a3a2a]/5">
              <h3 className="text-xs font-black text-[#4a6741] uppercase tracking-widest mb-6 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Filter Selection
              </h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#1a3a2a]">Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-12 bg-[#f4f8f5] border-none rounded-xl font-bold focus:ring-2 focus:ring-[#c9a227]/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#1a3a2a]">End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-12 bg-[#f4f8f5] border-none rounded-xl font-bold focus:ring-2 focus:ring-[#c9a227]/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#1a3a2a]">Purpose</Label>
                  <select value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)}
                    className="w-full h-12 bg-[#f4f8f5] border-none rounded-xl px-4 text-xs font-bold text-[#1a3a2a] focus:ring-2 focus:ring-[#c9a227]/30">
                    <option value="all">All Purposes</option>
                    {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#1a3a2a]">College</Label>
                  <select value={filterCollege} onChange={e => setFilterCollege(e.target.value)}
                    className="w-full h-12 bg-[#f4f8f5] border-none rounded-xl px-4 text-xs font-bold text-[#1a3a2a] focus:ring-2 focus:ring-[#c9a227]/30">
                    <option value="all">All Colleges</option>
                    {NEU_COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={() => { setFilterPurpose('all'); setFilterCollege('all'); setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd')); setEndDate(format(new Date(), 'yyyy-MM-dd')); }}
                  className="w-full h-10 bg-slate-100 text-[#4a6741] text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">
                  Reset Filters
                </button>
              </div>
            </Card>

            <Card className="rounded-2xl border border-[#d4e4d8] bg-gradient-to-br from-[#f4f8f5] to-white p-6 ring-1 ring-[#1a3a2a]/5">
              <h3 className="text-xs font-black text-[#4a6741] uppercase tracking-widest mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Period Total:</span>
                  <span className="text-lg font-black text-[#1a3a2a]">{filteredData.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Purpose Filter:</span>
                  <span className="text-xs font-black text-[#1a3a2a]">{filterPurpose === 'all' ? 'All' : filterPurpose}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">College Filter:</span>
                  <span className="text-xs font-black text-[#1a3a2a] text-right max-w-[120px] truncate">{filterCollege === 'all' ? 'All' : filterCollege}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Restrictions:</span>
                  <span className="text-lg font-black text-red-600">{stats?.restrictions || 0}</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="rounded-2xl border border-[#d4e4d8] shadow-sm bg-white overflow-hidden min-h-[500px] ring-1 ring-[#1a3a2a]/5">
              <div className="bg-gradient-to-r from-[#0d2b1a] to-[#1a3a2a] p-4 flex items-center gap-3">
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
${filterPurpose !== 'all' || filterCollege !== 'all'
    ? `Filters:   ${[filterPurpose !== 'all' ? `Purpose: ${filterPurpose}` : '', filterCollege !== 'all' ? `College: ${filterCollege}` : ''].filter(Boolean).join(' | ')}`
    : 'Filters:   None (showing all)'}
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
