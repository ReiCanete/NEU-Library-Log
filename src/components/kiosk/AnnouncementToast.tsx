'use client';
/**
 * @fileOverview A professional static bottom bar for kiosk announcements.
 * - Displays up to 2 active announcements in a persistent bar.
 */

import { useEffect, useState, memo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';

interface Announcement {
  id: string;
  message: string;
  priority: 'normal' | 'urgent';
  isActive: boolean;
  startDate: any;
  endDate: any;
}

function AnnouncementToast() {
  const [rawAnnouncements, setRawAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

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
          });
        setRawAnnouncements(active);
      }
    );
    return () => unsubscribe();
  }, []);

  const announcements = rawAnnouncements?.filter((a: any) => !dismissed.includes(a.id));

  if (!announcements || announcements.length === 0) return null;

  // Show max 2, urgent first
  const sorted = [...announcements].sort((a, b) => {
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
    return 0;
  });
  const visible = sorted.slice(0, 2);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-0 shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
      {visible.map((a: any, i: number) => (
        <div
          key={a.id}
          className={`w-full flex items-center justify-between gap-4 px-6 py-3 text-sm font-bold
            ${a.priority === 'urgent'
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-[#c9a227] text-[#0a2a1a]'
            }`}
          style={{ borderTop: i === 0 ? '1px solid rgba(255,255,255,0.15)' : 'none' }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0
              ${a.priority === 'urgent'
                ? 'bg-white/20 text-white'
                : 'bg-[#0a2a1a]/20 text-[#0a2a1a]'
              }`}>
              {a.priority === 'urgent' ? '⚠ URGENT' : '📢 NOTICE'}
            </span>
            <p className="truncate text-[13px]">{a.message}</p>
          </div>
          <button
            onClick={() => setDismissed(prev => [...prev, a.id])}
            className={`shrink-0 text-[18px] leading-none font-black opacity-60 hover:opacity-100 transition-opacity
              ${a.priority === 'urgent' ? 'text-white' : 'text-[#0a2a1a]'}`}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default memo(AnnouncementToast);
