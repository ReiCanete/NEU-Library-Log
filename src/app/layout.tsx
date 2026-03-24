import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';

export const metadata: Metadata = {
  title: 'NEU Library Log',
  description: 'Digital visitor log system for NEU Library',
  icons: {
    icon: [
      { url: '/neu-library-logo.png', type: 'image/png' },
    ],
    apple: [
      { url: '/neu-library-logo.png', type: 'image/png' },
    ],
    shortcut: [
      { url: '/neu-library-logo.png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        {/* Primary favicon link for maximum browser support */}
        <link rel="icon" href="/neu-library-logo.png" type="image/png" />
        <link rel="shortcut icon" href="/neu-library-logo.png" />
        <link rel="apple-touch-icon" href="/neu-library-logo.png" />
      </head>
      <body className="font-body antialiased min-h-screen overflow-x-hidden">
        <ErrorBoundary>
          <FirebaseClientProvider>
            <OfflineBanner />
            {children}
            <Toaster />
          </FirebaseClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
