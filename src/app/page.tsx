'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This is a mock authentication check.
    const isAuthenticated = localStorage.getItem('chatview_operator_name');
    if (isAuthenticated) {
      router.replace('/chat');
    } else {
      router.replace('/login');
    }
    // No need to setLoading(false) as the page will be replaced.
  }, [router]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-lg">Carregando ChatView...</p>
    </div>
  );
}
