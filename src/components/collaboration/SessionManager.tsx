'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import {
  PlusIcon,
  UsersIcon,
  GlobeIcon,
  LockIcon,
  ClockIcon,
} from 'lucide-react';

interface SessionManagerProps {
  onSessionSelect: (sessionId: Id<"collaborativeSessions">) => void;
}

export default function SessionManager({ onSessionSelect }: SessionManagerProps) {
  const { user } = useUser();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'public'>('my');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Queries
  const userSessions = useQuery(
    api.collaboration.getUserSessions,
    user?.id ? { userId: user.id } : "skip"
  );

  const publicSessions = useQuery(
    api.collaboration.getPublicSessions,
    { limit: 20 }
  );

  // Mutations
  const createSession = useMutation(api.collaboration.createSession);
  const joinSession = useMutation(api.collaboration.joinSession);

  const handleCreateSession = async (formData: FormData) => {
    if (!user?.id) return;

    const name = formData.get('name') as string;
    const language = formData.get('language') as string;
    const isPublic = formData.get('isPublic') === 'on';
    const maxUsers = parseInt(formData.get('maxUsers') as string) || 10;

    try {
      const sessionId = await createSession({
        name,
        creatorId: user.id,
        language,
        isPublic,
        maxUsers,
      });

      setShowCreateForm(false);
      onSessionSelect(sessionId);
    } catch (error) {
      console.error('Failed to create session:', error);
      alert('Failed to create session. Please try again.');
    }
  };

  const handleJoinSession = async (sessionId: Id<"collaborativeSessions">) => {
    if (!user?.id) return;

    try {
      await joinSession({
        sessionId,
        userId: user.id,
      });

      onSessionSelect(sessionId);
    } catch (error) {
      console.error('Failed to join session:', error);
      alert('Failed to join session. Please try again.');
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!isClient) return 'Recently'; // Fallback for SSR
    
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border-r border-[#333]">
      {/* Header */}
      <div className="p-4 border-b border-[#333]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Collaboration</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="p-2 bg-[#007acc] hover:bg-[#005a99] rounded-md transition-colors"
            title="Create New Session"
          >
            <PlusIcon className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex space-x-1 bg-[#2d2d2d] rounded-md p-1">
          <button
            onClick={() => setActiveTab('my')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'my'
                ? 'bg-[#007acc] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            My Sessions
          </button>
          <button
            onClick={() => setActiveTab('public')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'public'
                ? 'bg-[#007acc] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Public Sessions
          </button>
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'my' ? (
          <div className="p-2">
            {userSessions?.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No sessions yet</p>
                <p className="text-xs">Create your first collaborative session</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userSessions?.filter((session): session is NonNullable<typeof session> => session !== null).map((session) => (
                  <div
                    key={session._id}
                    onClick={() => onSessionSelect(session._id)}
                    className="p-3 rounded-lg border border-[#333] hover:border-[#007acc] cursor-pointer transition-colors bg-[#252526]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white truncate">
                        {session.name}
                      </h3>
                      <div className="flex items-center space-x-1 ml-2">
                        {session.isPublic ? (
                          <GlobeIcon className="w-3 h-3 text-green-400" />
                        ) : (
                          <LockIcon className="w-3 h-3 text-gray-400" />
                        )}
                        <span className="text-xs text-gray-400">
                          {session.activeUsers.length}/{session.maxUsers}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="bg-[#007acc] text-white px-2 py-1 rounded">
                        {session.language}
                      </span>
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="w-3 h-3" />
                        <span>{formatTimeAgo(session.lastActivity)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-2">
            {publicSessions?.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <GlobeIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No public sessions</p>
                <p className="text-xs">Be the first to create a public session</p>
              </div>
            ) : (
              <div className="space-y-2">
                {publicSessions?.map((session) => (
                  <div
                    key={session._id}
                    onClick={() => handleJoinSession(session._id)}
                    className="p-3 rounded-lg border border-[#333] hover:border-[#007acc] cursor-pointer transition-colors bg-[#252526]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white truncate">
                        {session.name}
                      </h3>
                      <div className="flex items-center space-x-1 ml-2">
                        <UsersIcon className="w-3 h-3 text-blue-400" />
                        <span className="text-xs text-gray-400">
                          {session.participantCount}/{session.maxUsers}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="bg-[#007acc] text-white px-2 py-1 rounded">
                        {session.language}
                      </span>
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="w-3 h-3" />
                        <span>{formatTimeAgo(session.lastActivity)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#2d2d2d] rounded-lg p-6 w-96 max-w-90vw border border-[#333]">
            <h3 className="text-lg font-semibold text-white mb-4">
              Create Collaborative Session
            </h3>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateSession(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Session Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="My Coding Session"
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#555] rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#007acc]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Programming Language
                </label>
                <select
                  name="language"
                  required
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#555] rounded-md text-white focus:outline-none focus:border-[#007acc]"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Max Users
                </label>
                <input
                  type="number"
                  name="maxUsers"
                  min="2"
                  max="20"
                  defaultValue="10"
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#555] rounded-md text-white focus:outline-none focus:border-[#007acc]"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isPublic"
                  id="isPublic"
                  className="mr-2 accent-[#007acc]"
                />
                <label htmlFor="isPublic" className="text-sm text-gray-300">
                  Make session public (anyone can join)
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 border border-[#555] text-gray-300 rounded-md hover:bg-[#333] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#007acc] text-white rounded-md hover:bg-[#005a99] transition-colors"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function useClientOnly() {
    throw new Error('Function not implemented.');
}
