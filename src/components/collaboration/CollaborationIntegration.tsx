'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Users, UserPlus } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface CollaborationIntegrationProps {
  currentCode?: string;
  currentLanguage?: string;
  fileName?: string;
}

export default function CollaborationIntegration({ 
  currentCode = '', 
  currentLanguage = 'javascript',
  fileName = 'Untitled'
}: CollaborationIntegrationProps) {
  const { user } = useUser();
  const [isCreating, setIsCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const createSession = useMutation(api.collaboration.createSession);

  const handleCreateSession = async (isPublic: boolean) => {
    if (!user?.id) return;

    setIsCreating(true);
    try {
      const result = await createSession({
        name: `${fileName} - Collaborative Session`,
        creatorId: user.id,
        language: currentLanguage,
        code: currentCode,
        isPublic,
        maxUsers: 5, // Updated to maximum of 5 users
      });

      // Redirect to collaboration page with the new session using sessionKey
      window.open(`/collaboration/${result.sessionKey}`, '_blank');
      setShowModal(false);
    } catch (error) {
      console.error('Failed to create session:', error);
      toast.error('Failed to create collaborative session. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Collaborate Button */}
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors text-sm"
          title="Start collaborative session"
        >
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">Collaborate</span>
        </button>
      </div>

      {/* Create Session Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#2d2d2d] rounded-lg p-6 w-96 max-w-90vw border border-[#333]">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Create Collaborative Session
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-[#3c3c3c] rounded-md">
                <p className="text-sm text-gray-300 mb-2">
                  <strong>File:</strong> {fileName}
                </p>
                <p className="text-sm text-gray-300 mb-2">
                  <strong>Language:</strong> {currentLanguage}
                </p>
                <p className="text-sm text-gray-300">
                  <strong>Code Lines:</strong> {currentCode.split('\\n').length}
                </p>
              </div>

              <div className="text-sm text-gray-400">
                Choose session visibility:
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleCreateSession(false)}
                  disabled={isCreating}
                  className="flex items-center justify-between p-3 bg-[#3c3c3c] hover:bg-[#4c4c4c] disabled:bg-gray-600 disabled:cursor-not-allowed border border-[#555] rounded-md transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <div>
                      <div className="text-white font-medium">Private Session</div>
                      <div className="text-xs text-gray-400">Only invited users can join</div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">Recommended</span>
                </button>

                <button
                  onClick={() => handleCreateSession(true)}
                  disabled={isCreating}
                  className="flex items-center justify-between p-3 bg-[#3c3c3c] hover:bg-[#4c4c4c] disabled:bg-gray-600 disabled:cursor-not-allowed border border-[#555] rounded-md transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <div className="text-white font-medium">Public Session</div>
                      <div className="text-xs text-gray-400">Anyone can discover and join</div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 border border-[#555] text-gray-300 rounded-md hover:bg-[#333] transition-colors"
                >
                  Cancel
                </button>
                <Link
                  href="/collaboration"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-center"
                >
                  Browse Sessions
                </Link>
              </div>
            </div>

            {isCreating && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                <div className="flex items-center gap-3 text-white">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  Creating session...
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}