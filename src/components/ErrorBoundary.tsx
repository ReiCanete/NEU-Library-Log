"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackType?: 'kiosk' | 'admin';
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[NEU Library Log Error] [ErrorBoundary]:", error, errorInfo);
  }

  private handleReturnHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallbackType === 'kiosk') {
        return (
          <div className="h-screen bg-[#0a2a1a] flex flex-col items-center justify-center p-8 text-center text-white">
            <AlertCircle className="h-20 w-20 text-[#c9a227] mb-6 animate-pulse" />
            <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter">Something went wrong</h2>
            <p className="text-[#c9a227] font-bold text-lg mb-8 uppercase tracking-widest">
              An unexpected system error occurred.
            </p>
            <Button 
              onClick={this.handleReturnHome} 
              className="bg-[#c9a227] text-[#0a2a1a] font-black h-16 px-12 rounded-[1.5rem] flex gap-3 shadow-2xl transition-all active:scale-95"
            >
              <Home className="h-6 w-6" /> Return to Home
            </Button>
          </div>
        );
      }

      return (
        <div className="h-screen bg-[#f0f4f1] flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-black text-[#1a3a2a] mb-2 uppercase tracking-tighter">Application Error</h2>
          <p className="text-[#4a6741] font-bold mb-8">A critical error occurred while rendering this section.</p>
          <Button 
            onClick={this.handleReturnHome} 
            className="bg-[#1a3a2a] text-white font-black h-14 px-10 rounded-xl flex gap-2 shadow-xl"
          >
            <Home className="h-5 w-5" /> Return to System Root
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
