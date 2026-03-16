'use client';
/**
 * @fileOverview A professional news ticker for library announcements.
 */

import { useEffect, useState } from 'react';
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
            // Urgent first
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
  
  // Increased scroll speed (lower duration)
  const tickerDuration = Math.max(8, 
    announcements.reduce((acc, a) => acc + a.message.length * 0.06, 6)
  );

  const tickerText = announcements.map((a, i) => (
    <span key={a.id} className="inline-flex items-center gap-2">
      {a.priority === 'urgent' && (
        <span className="bg-white text-red-700 text-[10px] font-black px-2 py-0.5 rounded mr-1">
          ⚠ URGENT
        </span>
      )}
      <span className={a.priority === 'urgent' ? 'font-black' : 'font-medium'}>
        {a.message}
      </span>
      <span className="mx-10 opacity-30">◆</span>
    </span>
  ));

  return (
    <div 
      className={`w-full flex items-center shrink-0 shadow-lg relative z-[100] ${
        hasUrgent ? 'bg-red-600 text-white' : 'bg-[#c9a227] text-[#0a2a1a]'
      }`} 
      style={{ height: '36px', overflow: 'hidden' }}
    >
      {/* Static label on left */}
      <div className={`shrink-0 px-3 h-full flex items-center font-black text-[10px] tracking-widest uppercase border-r z-10 ${
        hasUrgent 
          ? 'bg-red-800 text-white border-red-500' 
          : 'bg-[#a07d1a] text-[#0a2a1a] border-[#0a2a1a]/20'
      }`}>
        {hasUrgent ? (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            ALERT
          </span>
        ) : 'NOTICE'}
      </div>

      {/* Ticker wrapper with absolute positioning for marquee effect */}
      <div className="flex-1 h-full overflow-hidden relative">
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            animation: `marquee ${tickerDuration}s linear infinite`,
            fontSize: '13px',
          }}
        >
          {/* Content repeated twice for seamless loop */}
          <span className="inline-flex items-center pr-24">{tickerText}</span>
          <span className="inline-flex items-center pr-24">{tickerText}</span>
        </div>
      </div>
    </div>
  );
}
