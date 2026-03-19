'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}

// Anyone visiting /admin/login gets silently redirected to /
// where they can use the Staff toggle to sign in.
