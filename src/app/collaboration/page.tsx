'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Id } from '../../../convex/_generated/dataModel';

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

const CollaborativeEditor = dynamic(() => import('../../components/collaboration/CollaborativeEditor'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-[#1e1e1e] text-white">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>Loading collaborative editor...</p>
      </div>
    </div>
  ),
});

export default function CollaborationPage() {
  const [activeSessionId, setActiveSessionId] = useState<Id<"collaborativeSessions"> | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSessionSelect = (sessionId: Id<"collaborativeSessions">) => {
    setActiveSessionId(sessionId);
  };

  const handleLeaveSession = () => {
    setActiveSessionId(null);
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
      {!activeSessionId ? (
        // Show session manager when no session is active
        <div className="w-full max-w-4xl mx-auto">
          <SessionManager onSessionSelect={handleSessionSelect} />
        </div>
      ) : (
        // Show collaborative editor when session is active
        <div className="w-full flex">
          {/* Session Manager Sidebar */}
          <div className="w-80 border-r border-[#333]">
            <SessionManager onSessionSelect={handleSessionSelect} />
          </div>
          
          {/* Collaborative Editor */}
          <div className="flex-1">
            <CollaborativeEditor 
              sessionId={activeSessionId} 
              onLeaveSession={handleLeaveSession}
            />
          </div>
        </div>
      )}
    </div>
  );
}