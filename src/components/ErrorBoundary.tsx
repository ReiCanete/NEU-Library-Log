"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackType?: 'kiosk' | 'admin';
}

interface State {
  hasError: boolean;
  countdown: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private timer: NodeJS.Timeout | null = null;

  public state: State = {
    hasError: false,
    countdown: 10,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true, countdown: 10 };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[NEU Library Log Error] [ErrorBoundary]:", error, errorInfo);
    
    if (this.props.fallbackType === 'kiosk') {
      this.timer = setInterval(() => {
        this.setState((prev) => {
          if (prev.countdown <= 1) {
            clearInterval(this.timer!);
            window.location.href = '/';
            return { ...prev, countdown: 0 };
          }
          return { ...prev, countdown: prev.countdown - 1 };
        });
      }, 1000);
    }
  }

  public componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallbackType === 'kiosk') {
        return (
          <div className="h-screen bg-[#0a2a1a] flex flex-col items-center justify-center p-8 text-center text-white">
            <AlertCircle className="h-20 w-20 text-[#c9a227] mb-6 animate-pulse" />
            <h2 className="text-4xl font-black mb-4">Something went wrong</h2>
            <p className="text-[#c9a227] font-bold text-lg mb-8 uppercase tracking-widest">
              The kiosk will reset in {this.state.countdown} seconds...
            </p>
            <Button 
              onClick={() => window.location.href = '/'} 
              className="bg-[#c9a227] text-[#0a2a1a] font-black h-14 px-10 rounded-2xl"
            >
              Reset Now
            </Button>
          </div>
        );
      }

      return (
        <div className="h-screen bg-[#f0f4f1] flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-black text-[#1a3a2a] mb-2">Application Error</h2>
          <p className="text-[#4a6741] font-medium mb-6">A critical error occurred while rendering this section.</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="bg-[#1a3a2a] text-white font-black h-12 px-8 rounded-xl flex gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Reload System
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
