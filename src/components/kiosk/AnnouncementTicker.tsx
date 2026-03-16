'use client';
/**
 * @fileOverview A professional news ticker for library announcements.
 */

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Megaphone } from 'lucide-react';

interface Announcement {
  id: string;
  message: string;
  priority: 'normal' | 'urgent';
  isActive: boolean;
  startDate: any;
  endDate: any;
}

export default function AnnouncementTicker() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!db) return;
    
    const unsubscribe = onSnapshot(
      query(collection(db, 'announcements'), where('isActive', '==', true)),
      (snap) => {
        const now = new Date();
        const active = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Announcement))
          .filter(a => {
            const start = a.startDate?.toDate?.() || new Date(0);
            const end = a.endDate?.toDate?.() || new Date('2099-01-01');
            return now >= start && now <= end;
          })
          .sort((a, b) => {
            if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
            if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
            return 0;
          })
          .slice(0, 5);
        setAnnouncements(active);
      }
    );
    return () => unsubscribe();
  }, []);

  if (announcements.length === 0) return null;

  const hasUrgent = announcements.some(a => a.priority === 'urgent');

  const tickerContent = announcements.map((a, i) => (
    <span key={a.id} className="inline-flex items-center gap-3">
      {a.priority === 'urgent' && (
        <span className="bg-white text-red-700 text-xs font-black px-2 py-0.5 rounded">
          ⚠ URGENT
        </span>
      )}
      <span className={a.priority === 'urgent' ? 'font-bold' : 'font-medium'}>
        {a.message}
      </span>
      <span className="mx-8 opacity-40">◆</span>
    </span>
  ));

  return (
    <div
      className={`w-full flex items-center shrink-0 ${
        hasUrgent ? 'bg-red-600 text-white' : 'bg-[#c9a227] text-[#0a2a1a]'
      }`}
      style={{ height: '36px', overflow: 'hidden', position: 'relative' }}
    >
      {/* Megaphone icon label on left */}
      <div className={`shrink-0 px-3 h-full flex items-center gap-1.5 border-r z-10 ${
        hasUrgent
          ? 'bg-red-800 text-white border-red-500'
          : 'bg-[#a07d1a] text-[#0a2a1a] border-[#0a2a1a]/20'
      }`}>
        <Megaphone className="w-4 h-4" />
      </div>

      {/* Scrolling area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%' }}>
        <div
          className="ticker-track text-sm"
          style={{
            animationDuration: `${Math.max(12, announcements.reduce((acc, a) => acc + a.message.length * 0.12, 10))}s`
          }}
        >
          {tickerContent}
          {/* Duplicate for seamless loop */}
          {tickerContent}
        </div>
      </div>
    </div>
  );
}
