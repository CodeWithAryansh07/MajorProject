'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SessionManager from '../../components/collaboration/SessionManager';
import SavedSessions from '../../components/collaboration/SavedSessions';

export default function CollaborationPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<'sessions' | 'saved'>('sessions');

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
    <div className="h-screen flex flex-col bg-[#1e1e1e]">
      {/* Tab Header */}
      <div className="border-b border-[#333] bg-[#1e1e1e]">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex space-x-1 bg-[#2d2d2d] rounded-md p-1 w-fit">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'sessions'
                  ? 'bg-[#007acc] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Live Sessions
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'saved'
                  ? 'bg-[#007acc] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Saved Sessions
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="w-full max-w-6xl mx-auto h-full">
          {activeTab === 'sessions' ? (
            <SessionManager onSessionSelect={handleSessionSelect} />
          ) : (
            <SavedSessions />
          )}
        </div>
      </div>
    </div>
  );
}