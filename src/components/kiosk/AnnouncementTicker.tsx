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
  createdAt?: any;
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
            return (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0);
          })
          .slice(0, 5);
        setAnnouncements(active);
      }
    );
    return () => unsubscribe();
  }, []);

  if (announcements.length === 0) return null;

  const allUrgent = announcements.every(a => a.priority === 'urgent');
  const bannerBg = allUrgent ? 'bg-red-600 text-white' : 'bg-[#c9a227] text-[#0a2a1a]';
  const labelBg = allUrgent ? 'bg-red-800 text-white border-red-500' : 'bg-[#a07d1a] text-[#0a2a1a] border-[#0a2a1a]/20';

  const totalChars = announcements.reduce((acc, a) => acc + a.message.length, 0);
  const tickerDuration = Math.max(20, totalChars * 0.3 + announcements.length * 8);

  const buildCopy = () => (
    <span className="inline-flex items-center">
      {announcements.map((a) => (
        <span key={a.id} className="inline-flex items-center">
          {/* Priority badge */}
          {a.priority === 'urgent' && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded mr-3 uppercase tracking-tight ${
              allUrgent 
                ? 'bg-white text-red-700'
                : 'bg-red-600 text-white'
            }`}>
              ⚠ URGENT
            </span>
          )}
          {/* Message text */}
          <span className={a.priority === 'urgent' ? 'font-bold' : 'font-medium'}>
            {a.message}
          </span>
          {/* Spacing after each announcement - larger gap between multiple */}
          <span style={{ 
            display: 'inline-block', 
            width: announcements.length > 1 
              ? `${Math.floor(600 / announcements.length)}px`
              : '200px'
          }} />
          {/* Diamond divider */}
          <span className="opacity-40 mr-6">◆</span>
          <span style={{ 
            display: 'inline-block', 
            width: announcements.length > 1 
              ? `${Math.floor(600 / announcements.length)}px`
              : '200px'
          }} />
        </span>
      ))}
    </span>
  );

  return (
    <div
      className={`w-full flex items-center shrink-0 ${bannerBg}`}
      style={{ height: '36px', overflow: 'hidden', position: 'relative' }}
    >
      <div className={`shrink-0 px-3 h-full flex items-center gap-1.5 border-r z-10 ${labelBg}`}>
        <Megaphone className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
          {allUrgent ? 'ALERT' : 'NOTICE'}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%' }}>
        <div
          className="ticker-track text-sm"
          style={{
            animationDuration: `${tickerDuration}s`
          }}
        >
          {/* Content repeated twice for seamless loop using translateX(-50%) animation */}
          {buildCopy()}
          {buildCopy()}
        </div>
      </div>
    </div>
  );
}
