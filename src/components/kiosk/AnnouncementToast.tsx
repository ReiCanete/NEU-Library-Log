'use client';
/**
 * @fileOverview A professional sequence of popup announcements for the kiosk.
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

    const duration = Math.min(12000, Math.max(5000, current.message.length * 70));
    
    // Slight delay before showing first one or next one
    const showTimeout = setTimeout(() => setVisible(true), 300);

    const hideTimeout = setTimeout(() => {
      setVisible(false);
      // Wait for exit animation before moving to next
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % announcements.length);
      }, 500);
    }, duration);

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, [currentIndex, announcements]);

  const current = announcements[currentIndex];
  if (!current || announcements.length === 0) return null;

  const isUrgent = current.priority === 'urgent';

  return (
    <div
      className={`fixed top-6 left-1/2 z-50 transition-all duration-500 ease-out ${
        visible 
          ? 'opacity-100 -translate-x-1/2 translate-y-0' 
          : 'opacity-0 -translate-x-1/2 -translate-y-8 pointer-events-none'
      }`}
      style={{ width: 'calc(100% - 3rem)', maxWidth: '520px' }}
    >
      <div className={`w-full rounded-[1.5rem] shadow-2xl overflow-hidden border ${
        isUrgent 
          ? 'bg-red-600 border-red-400' 
          : 'bg-[#0a2a1a] border-[#c9a227]/30'
      }`}>
        <div className={`flex items-center justify-between px-5 py-2.5 ${
          isUrgent ? 'bg-red-800' : 'bg-[#c9a227]'
        }`}>
          <div className="flex items-center gap-2.5">
            {isUrgent ? (
              <AlertTriangle className="w-4 h-4 text-white" />
            ) : (
              <Megaphone className="w-4 h-4 text-[#0a2a1a]" />
            )}
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
              isUrgent ? 'text-white' : 'text-[#0a2a1a]'
            }`}>
              {isUrgent ? 'Urgent Alert' : 'Announcement'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {announcements.length > 1 && (
              <span className={`text-[9px] font-black tracking-widest ${
                isUrgent ? 'text-white/60' : 'text-[#0a2a1a]/60'
              }`}>
                {currentIndex + 1} / {announcements.length}
              </span>
            )}
            <button
              onClick={() => setVisible(false)}
              className={`p-1 hover:bg-black/10 rounded-full transition-colors ${
                isUrgent ? 'text-white' : 'text-[#0a2a1a]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm font-bold leading-relaxed text-white">
            {current.message}
          </p>
        </div>

        <div className={`h-1.5 ${isUrgent ? 'bg-red-900' : 'bg-[#071a0f]'}`}>
          <div
            className={`h-full ${isUrgent ? 'bg-white' : 'bg-[#c9a227]'} transition-none`}
            style={{
              animation: visible 
                ? `shrink ${Math.min(12000, Math.max(5000, current.message.length * 70))}ms linear forwards`
                : 'none',
              width: '100%',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(AnnouncementToast);
