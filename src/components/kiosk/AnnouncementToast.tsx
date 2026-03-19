'use client';
/**
 * @fileOverview A professional floating announcement system for the kiosk.
 * Displays up to 2 active announcements in the top-right corner.
 */

import { useEffect, useState, memo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { X } from 'lucide-react';

interface Announcement {
  id: string;
  message: string;
  priority: 'normal' | 'urgent';
  isActive: boolean;
  startDate: any;
  endDate: any;
}

function AnnouncementToast() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!db) return;

    const q = query(collection(db, 'announcements'), where('isActive', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => {
      const now = new Date();
      const active = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Announcement))
        .filter(a => {
          const start = a.startDate?.toDate?.() || new Date(0);
          const end = a.endDate?.toDate?.() || new Date('2099-01-01');
          return now >= start && now <= end;
        })
        .sort((a, b) => {
          // Urgent priority first
          if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
          if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
          return 0;
        });
      setAnnouncements(active);
    });

    return () => unsubscribe();
  }, []);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => [...prev, id]);
  };

  const visible = announcements
    .filter(a => !dismissedIds.includes(a.id))
    .slice(0, 2);

  if (visible.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes urgentGlow {
          0%, 100% { box-shadow: 0 0 8px 2px rgba(239,68,68,0.3), 0 4px 24px rgba(0,0,0,0.4); }
          50% { box-shadow: 0 0 20px 6px rgba(239,68,68,0.6), 0 4px 24px rgba(0,0,0,0.4); }
        }
        .urgent-glow {
          animation: urgentGlow 2.5s ease-in-out infinite;
        }
      `}</style>
      <div
        style={{ position: 'fixed', top: '56px', right: '16px', zIndex: 48 }}
        className="flex flex-col gap-2 pointer-events-none"
      >
        {visible.map((a) => (
          <div
            key={a.id}
            className={`
              relative backdrop-blur-md rounded-2xl px-4 py-3 shadow-2xl w-[280px] pointer-events-auto
              animate-in slide-in-from-right fade-in duration-300
              ${a.priority === 'urgent'
                ? 'bg-red-900/90 border border-red-500/50 text-white urgent-glow'
                : 'bg-[#1a3a2a] border border-[#c9a227]/30 text-[#c9a227]'
              }
            `}
          >
            <button
              onClick={() => handleDismiss(a.id)}
              className="absolute top-2.5 right-2.5 opacity-40 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex flex-col gap-1 pr-5">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest">
                  {a.priority === 'urgent' ? '⚠ URGENT' : '📢 NOTICE'}
                </span>
              </div>
              <p className="text-[12px] font-bold line-clamp-2 leading-tight">
                {a.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default memo(AnnouncementToast);