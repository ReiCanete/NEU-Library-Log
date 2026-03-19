'use client';
/**
 * @fileOverview A professional announcement system for the kiosk.
 * - Normal: Scrolling top ticker.
 * - Urgent: Sequential modals with auto-dismiss and visible progress.
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [sessionDismissed, setSessionDismissed] = useState<string[]>([]);
  const [activeUrgent, setActiveUrgent] = useState<Announcement | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Load already dismissed urgent IDs from sessionStorage
    const stored = sessionStorage.getItem('kiosk_dismissed_urgent');
    if (stored) setSessionDismissed(JSON.parse(stored));

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
        setAnnouncements(active);
      }
    );
    return () => unsubscribe();
  }, []);

  const normal = announcements.filter(a => a.priority === 'normal');
  const urgent = announcements.filter(a => a.priority === 'urgent' && !sessionDismissed.includes(a.id));

  // Handle sequential urgent modals
  useEffect(() => {
    if (urgent.length > 0 && !activeUrgent) {
      setActiveUrgent(urgent[0]);
      setCountdown(5);
    }
  }, [urgent, activeUrgent]);

  // Modal countdown timer
  useEffect(() => {
    if (!activeUrgent) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 0.1) {
          handleDismiss(activeUrgent.id);
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [activeUrgent]);

  const handleDismiss = (id: string) => {
    const updated = [...sessionDismissed, id];
    setSessionDismissed(updated);
    sessionStorage.setItem('kiosk_dismissed_urgent', JSON.stringify(updated));
    setActiveUrgent(null);
  };

  const tickerText = normal.map(a => a.message).join(' · ');

  return (
    <>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          white-space: nowrap;
          animation: marquee 30s linear infinite;
        }
      `}</style>

      {/* Normal Scrolling Ticker */}
      {normal.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 h-8 bg-[#1a3a2a] border-b border-[#c9a227]/30 flex items-center overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 bg-[#1a3a2a] z-10 px-3 flex items-center border-r border-[#c9a227]/20">
            <span className="text-xs">📢</span>
          </div>
          <div className="flex-1 overflow-hidden relative h-full flex items-center">
            <div className="animate-marquee text-[#c9a227] text-[11px] font-black uppercase tracking-widest pl-4">
              {tickerText}
            </div>
          </div>
        </div>
      )}

      {/* Urgent Modal Overlay */}
      {activeUrgent && (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#071a0f] border border-red-500/40 rounded-[2.5rem] p-10 max-w-md w-full text-center shadow-2xl space-y-8 relative overflow-hidden ring-1 ring-red-500/20">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] animate-pulse shadow-lg shadow-red-600/20">
              <span>⚠</span> URGENT
            </div>
            
            <h2 className="text-white text-3xl font-black leading-tight tracking-tight drop-shadow-lg">
              {activeUrgent.message}
            </h2>

            <button 
              onClick={() => handleDismiss(activeUrgent.id)}
              className="w-full h-16 bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] font-black rounded-[1.5rem] hover:opacity-90 transition-all shadow-xl shadow-[#c9a227]/20 text-sm uppercase tracking-[0.2em] active:scale-95"
            >
              I Understand
            </button>

            {/* Visual Countdown Bar */}
            <div className="absolute bottom-0 left-0 h-2 bg-red-600/10 w-full">
              <div 
                className="h-full bg-red-600 transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(220,38,38,0.5)]" 
                style={{ width: `${(countdown / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(AnnouncementToast);
