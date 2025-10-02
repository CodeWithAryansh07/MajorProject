'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { useUser } from '@clerk/nextjs';
import { toast } from 'react-hot-toast';

export default function SavedSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [showSessionLimitModal, setShowSessionLimitModal] = useState(false);
  const [pendingLoadOptions, setPendingLoadOptions] = useState<{ makePublic: boolean } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Id<"collaborativeSessions"> | null>(null);
  
  const sessionId = params.sessionId as Id<"savedSessions">;
  
  const savedSession = useQuery(api.collaboration.getSavedSession, {
    savedSessionId: sessionId,
    userId: user?.id || undefined,
  });

  const userSessions = useQuery(
    api.collaboration.getUserSessions,
    user?.id ? { userId: user.id } : "skip"
  );

  const sessionLimitCheck = useQuery(
    api.collaboration.validateSessionCreationLimit,
    user?.id ? { userId: user.id } : "skip"
  );
  
  const loadSavedSession = useMutation(api.collaboration.loadSavedSession);
  const deleteSession = useMutation(api.collaboration.deleteSession);
  
  const handleLoadSession = async (makePublic?: boolean) => {
    if (!user?.id) {
      toast.error('Please sign in to load sessions');
      return;
    }

    // Check session limit first
    if (sessionLimitCheck && !sessionLimitCheck.canCreate) {
      setPendingLoadOptions({ makePublic: makePublic || false });
      setShowSessionLimitModal(true);
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await loadSavedSession({
        savedSessionId: sessionId,
        userId: user.id,
        makePublic,
      });
      
      toast.success('Session loaded successfully!');
      router.push(`/collaboration/${result.sessionKey}`);
    } catch (error: unknown) {
      console.error('Failed to load session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('SESSION_LIMIT_EXCEEDED')) {
        toast.error('You have reached the maximum of 2 sessions. Please delete an existing session first.');
        setPendingLoadOptions({ makePublic: makePublic || false });
        setShowSessionLimitModal(true);
      } else {
        toast.error(errorMessage || 'Failed to load session');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: Id<"collaborativeSessions">) => {
    if (!user?.id) return;
    
    // Show confirmation modal instead of deleting directly
    setShowDeleteConfirm(sessionId);
  };

  const confirmDeleteSession = async (sessionId: Id<"collaborativeSessions">) => {
    if (!user?.id) return;

    try {
      await deleteSession({
        sessionId,
        userId: user.id,
      });
      setShowDeleteConfirm(null);
      toast.success('Session deleted successfully!');
      
      // Check if we can auto-load after deletion
      if (pendingLoadOptions) {
        // Wait a moment for the database to update, then check session count
        setTimeout(async () => {
          // Get updated session count directly from our query
          const currentSessionCount = userSessions?.length || 0;
          
          // Since we just deleted one, the count should now allow loading
          if (currentSessionCount <= 1) { // -1 because we deleted one
            setShowSessionLimitModal(false);
            setPendingLoadOptions(null);
            toast('Auto-loading session...', { icon: 'ℹ️' });
            handleLoadSession(pendingLoadOptions.makePublic);
          } else {
            // Still at limit, keep the modal open
            toast('Session limit still reached. Please delete another session.', { icon: '⚠️' });
          }
        }, 1000); // Give time for the query to update
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast.error('Failed to delete session. Please try again.');
    }
  };
  
  if (!savedSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1e1e1e] text-white">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading saved session...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen bg-[#1e1e1e] text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Saved Sessions
          </button>
          
          <h1 className="text-3xl font-bold mb-2">{savedSession.name}</h1>
          <p className="text-gray-400 mb-4">{savedSession.description}</p>
          
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <span>Language: {savedSession.language}</span>
            <span>•</span>
            <span>Created: {new Date(savedSession.createdAt).toLocaleDateString()}</span>
            <span>•</span>
            <span>{savedSession.isPrivate ? '🔒 Private' : '🌐 Public'}</span>
          </div>
        </div>
        
        {/* Code Preview */}
        <div className="bg-[#2d2d2d] rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium">Code Preview</h3>
            <span className="text-sm text-gray-400">{savedSession.code.length} characters</span>
          </div>
          <pre className="text-sm overflow-x-auto bg-[#1e1e1e] p-4 rounded max-h-64 overflow-y-auto">
            <code>{savedSession.code}</code>
          </pre>
        </div>
        
        {/* Actions */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Load as New Session</h3>
          <p className="text-gray-400 text-sm">
            Create a new collaborative session from this saved code. You can choose to make it public or private.
          </p>
          
          <div className="flex space-x-4">
            <button
              onClick={() => handleLoadSession(false)}
              disabled={isLoading}
              className="px-6 py-3 bg-[#007acc] text-white rounded-lg hover:bg-[#005a9e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Loading...' : 'Load as Private Session'}
            </button>
            
            <button
              onClick={() => handleLoadSession(true)}
              disabled={isLoading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Loading...' : 'Load as Public Session'}
            </button>
          </div>
          
          <div className="mt-4 p-4 bg-[#2d2d2d] rounded-lg">
            <h4 className="font-medium mb-2">What happens when you load?</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• A new collaborative session will be created with this code</li>
              <li>• You&apos;ll be redirected to the live session where you can edit and collaborate</li>
              <li>• The original saved session will remain unchanged</li>
              <li>• Public sessions will be visible to all users in the live sessions list</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Session Limit Modal */}
      {showSessionLimitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2d2d2d] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#333]">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                Session Limit Reached
              </h3>
              <p className="text-gray-400 mb-6">
                You have reached the maximum of 2 sessions. Please delete one of your existing sessions to load this saved session.
              </p>
              
              <div className="space-y-3 mb-6">
                <h4 className="text-lg font-medium text-white">Your Current Sessions:</h4>
                {userSessions?.map((session) => (
                  <div
                    key={session._id}
                    className="p-4 rounded-lg border border-[#333] bg-[#252526]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-white">{session.name}</h5>
                        <div className="flex items-center space-x-3 text-sm text-gray-400 mt-1">
                          <span className="bg-[#007acc] text-white px-2 py-1 rounded">
                            {session.language}
                          </span>
                          <span>{session.isActive ? '🟢 Active' : '🔴 Inactive'}</span>
                          <span>{session.isPublic ? '🌐 Public' : '🔒 Private'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteSession(session._id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowSessionLimitModal(false);
                    setPendingLoadOptions(null);
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2d2d2d] rounded-lg max-w-md w-full border border-[#333]">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                Confirm Deletion
              </h3>
              <p className="text-gray-400 mb-6">
                Are you sure you want to delete this session? This action cannot be undone.
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDeleteSession(showDeleteConfirm)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}