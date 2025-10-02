'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import collaboration components to avoid SSR issues
const SessionManager = dynamic(() => import('../../components/collaboration/SessionManager'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-[#1e1e1e] text-white">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>Loading session manager...</p>
      </div>
    </div>
  ),
});

export default function CollaborationPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSessionSelect = (sessionKey: string) => {
    // Navigate to the session-specific URL
    router.push(`/collaboration/${sessionKey}`);
  };

  if (!isClient) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1e1e1e] text-white">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading collaboration workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#1e1e1e]">
      {/* Session Manager - Full Width */}
      <div className="w-full max-w-6xl mx-auto">
        <SessionManager onSessionSelect={handleSessionSelect} />
      </div>
    </div>
  );
}