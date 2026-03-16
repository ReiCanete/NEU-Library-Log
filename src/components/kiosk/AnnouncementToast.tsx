'use client';
/**
 * @fileOverview A professional static sidebar for kiosk announcements.
 * - Displays up to 2 active announcements in the bottom-right corner.
 * - Announcements remain until manually dismissed by the visitor.
 */

import { useEffect, useState, memo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Megaphone, X, AlertTriangle } from 'lucide-react';

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
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(false);

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
          .slice(0, 2); // Max 2 shown at once
        setAnnouncements(active);
        // Show with slide animation when announcements arrive
        if (active.length > 0) {
          setTimeout(() => setVisible(true), 100);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  const visibleAnnouncements = announcements.filter(a => !dismissed.has(a.id));

  const toggleDismiss = (id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex flex-col gap-3 transition-all duration-500 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
      style={{ width: '300px' }}
    >
      {visibleAnnouncements.map((announcement) => {
        const isUrgent = announcement.priority === 'urgent';
        return (
          <div
            key={announcement.id}
            className={`w-full rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-right-10 duration-500 ${
              isUrgent
                ? 'bg-red-600 border border-red-400'
                : 'bg-[#0a2a1a] border border-[#c9a227]/30'
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-2.5 ${
              isUrgent ? 'bg-red-800' : 'bg-[#c9a227]'
            }`}>
              <div className="flex items-center gap-2">
                {isUrgent ? (
                  <AlertTriangle className="w-4 h-4 text-white" />
                ) : (
                  <Megaphone className="w-4 h-4 text-[#0a2a1a]" />
                )}
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                  isUrgent ? 'text-white' : 'text-[#0a2a1a]'
                }`}>
                  {isUrgent ? '⚠ Urgent' : 'Announcement'}
                </span>
              </div>
              <button
                onClick={() => toggleDismiss(announcement.id)}
                className={`p-1 rounded-full hover:bg-black/10 transition-colors ${
                  isUrgent ? 'text-white' : 'text-[#0a2a1a]'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Message */}
            <div className="px-4 py-3">
              <p className="text-sm font-medium leading-relaxed text-white">
                {announcement.message}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(AnnouncementToast);