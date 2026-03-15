"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

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

  public render() {
    if (this.state.hasError) {
      if (this.props.fallbackType === 'kiosk') {
        return (
          <div className="h-screen bg-[#0a2a1a] flex flex-col items-center justify-center p-8 text-center text-white">
            <AlertCircle className="h-20 w-20 text-[#c9a227] mb-6 animate-pulse" />
            <h2 className="text-4xl font-black mb-4">Something went wrong</h2>
            <p className="text-[#c9a227] font-bold text-lg mb-8 uppercase tracking-widest">
              An unexpected system error occurred.
            </p>
            <Button 
              onClick={() => window.location.href = '/'} 
              className="bg-[#c9a227] text-[#0a2a1a] font-black h-14 px-10 rounded-2xl flex gap-2"
            >
              <Home className="h-5 w-5" /> Return to Home
            </Button>
          </div>
        );
      }

      return (
        <div className="h-screen bg-[#f0f4f1] flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-black text-[#1a3a2a] mb-2">Application Error</h2>
          <p className="text-[#4a6741] font-medium mb-6">A critical error occurred while rendering this section.</p>
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={() => window.location.reload()} 
              className="bg-[#1a3a2a] text-white font-black h-12 px-8 rounded-xl flex gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Reload System
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/'} 
              className="border-[#1a3a2a] text-[#1a3a2a] font-black h-12 px-8 rounded-xl flex gap-2"
            >
              <Home className="h-4 w-4" /> Go to Kiosk
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
