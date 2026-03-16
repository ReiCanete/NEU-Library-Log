'use client';
/**
 * @fileOverview A professional sequence of popup announcements for the kiosk, positioned in the bottom-right corner.
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
  const [currentIndex, setCurrentIndex] = useState(0);
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
          .slice(0, 5);
        setAnnouncements(active);
        setCurrentIndex(0);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (announcements.length === 0) return;

    const current = announcements[currentIndex];
    if (!current) return;

    const duration = Math.min(12000, Math.max(4000, current.message.length * 60));

    // Small delay before showing so transition is visible
    const showTimer = setTimeout(() => setVisible(true), 100);

    const hideTimer = setTimeout(() => {
      setVisible(false);
      // Wait for hide animation then move to next
      setTimeout(() => {
        setCurrentIndex(i => 
          i < announcements.length - 1 ? i + 1 : 0
        );
      }, 600);
    }, duration + 100);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [currentIndex, announcements]);

  const current = announcements[currentIndex];
  if (!current || announcements.length === 0) return null;

  const isUrgent = current.priority === 'urgent';
  const displayDuration = Math.min(12000, Math.max(4000, current.message.length * 60));

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out ${
        visible
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-full pointer-events-none'
      }`}
      style={{ width: '320px' }}
    >
      <div className={`w-full rounded-2xl shadow-2xl overflow-hidden ${
        isUrgent
          ? 'bg-red-600 border border-red-400'
          : 'bg-[#0a2a1a] border border-[#c9a227]/30'
      }`}>
        {/* Header bar */}
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
              {isUrgent ? '⚠ Urgent Notice' : 'Announcement'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {announcements.length > 1 && (
              <span className={`text-[9px] font-black tracking-widest ${
                isUrgent ? 'text-white/70' : 'text-[#0a2a1a]/70'
              }`}>
                {currentIndex + 1}/{announcements.length}
              </span>
            )}
            <button
              onClick={() => setVisible(false)}
              className={`p-1 rounded-full hover:bg-black/10 transition-colors ${
                isUrgent ? 'text-white' : 'text-[#0a2a1a]'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Message body */}
        <div className="px-4 py-3">
          <p className="text-sm font-medium leading-relaxed text-white">
            {current.message}
          </p>
        </div>

        {/* Progress bar showing remaining display time */}
        <div className={`h-1 ${isUrgent ? 'bg-red-900' : 'bg-[#071a0f]'}`}>
          {visible && (
            <div
              className={`h-full ${isUrgent ? 'bg-white' : 'bg-[#c9a227]'} transition-none`}
              style={{
                animation: `shrink ${displayDuration}ms linear forwards`,
                width: '100%',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(AnnouncementToast);
