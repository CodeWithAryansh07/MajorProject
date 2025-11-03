// DOCUMENTED BY SCRIPT - Phase 4
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { toast } from 'react-toastify';
import {
  PlusIcon,
  UsersIcon,
  GlobeIcon,
  LockIcon,
  ClockIcon,
  EditIcon,
  TrashIcon,
  SaveIcon,
} from 'lucide-react';
import { ConfirmModal, InputModal } from '../ui/Modal';

interface SessionManagerProps {
  onSessionSelect: (sessionKey: string) => void;
}

export default function SessionManager({ onSessionSelect }: SessionManagerProps) {
  const { user } = useUser();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'public' | 'savedPublic'>('my');
  const [isClient, setIsClient] = useState(false);
  
  // Modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState<{ sessionId: string; sessionName: string } | null>(null);
  const [showEditModal, setShowEditModal] = useState<{
    sessionId: string;
    name: string;
    description?: string;
    isPublic: boolean;
    maxUsers: number;
  } | null>(null);

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

  // Get public saved sessions
  const publicSavedSessions = useQuery(
    api.collaboration.getPublicSavedSessions,
    { limit: 20 }
  );

  // Get participant counts for real-time updates
  const userSessionIds = userSessions?.map(s => s._id).filter(Boolean) || [];
  const publicSessionIds = publicSessions?.map(s => s._id).filter(Boolean) || [];
  const allSessionIds = [...userSessionIds, ...publicSessionIds];
  
  const participantCounts = useQuery(
    api.collaboration.getSessionParticipantCounts,
    allSessionIds.length > 0 ? { sessionIds: allSessionIds } : "skip"
  );

  // Create a map for quick lookup of participant counts
  const participantCountMap = participantCounts?.reduce((acc, item) => {
    acc[item.sessionId] = item.participantCount;
    return acc;
  }, {} as Record<string, number>) || {};

  // Mutations
  const createSession = useMutation(api.collaboration.createSession);
  const joinSession = useMutation(api.collaboration.joinSession);
  const updateSession = useMutation(api.collaboration.updateSession);
  const deleteSession = useMutation(api.collaboration.deleteSession);
  const saveSessionToCollection = useMutation(api.collaboration.saveSessionToCollection);
  // New query for session limit validation
  const sessionLimitCheck = useQuery(
    api.collaboration.validateSessionCreationLimit,
    user?.id ? { userId: user.id } : "skip"
  );

  // Check which sessions are already saved
  const sessionSaveStatus = useQuery(
    api.collaboration.getSessionSaveStatus,
    user?.id && userSessionIds.length > 0 ? { 
      userId: user.id, 
      sessionIds: userSessionIds 
    } : "skip"
  );

  // Get saved session info
  const savedSessionInfo = useQuery(
    api.collaboration.getSavedSessionInfo,
    user?.id ? { userId: user.id } : "skip"
  );

  // Create a map for quick lookup
  const saveStatusMap = sessionSaveStatus?.reduce((acc, item) => {
    acc[item.sessionId] = item.isSaved;
    return acc;
  }, {} as Record<string, boolean>) || {};

  const handleCreateSession = async (formData: FormData) => {
    if (!user?.id) return;
    
    // Check session limit
    if (sessionLimitCheck && !sessionLimitCheck.canCreate) {
      toast.error(sessionLimitCheck.message);
      return;
    }

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const language = formData.get('language') as string;
    const isPublic = formData.get('isPublic') === 'on';
    const maxUsers = parseInt(formData.get('maxUsers') as string) || 5;

    try {
      const result = await createSession({
        name,
        description: description || undefined,
        creatorId: user.id,
        language,
        isPublic,
        maxUsers,
      });

      setShowCreateForm(false);
      toast.success('Session created successfully!');
      // Navigate to the session using sessionKey
      onSessionSelect(result.sessionKey);
    } catch (error) {
      console.error('Failed to create session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create session. Please try again.';
      toast.error(errorMessage);
    }
  };

  const handleJoinSession = async (session: { _id: Id<"collaborativeSessions">; sessionKey: string }) => {
    if (!user?.id) return;

    try {
      await joinSession({
        sessionId: session._id,
        userId: user.id,
      });

      onSessionSelect(session.sessionKey);
    } catch (error) {
      console.error('Failed to join session:', error);
      toast.error('Failed to join session. Please try again.');
    }
  };

  const handleUpdateSession = async (updateData: {
    sessionId: string;
    name?: string;
    description?: string;
    isPublic?: boolean;
    maxUsers?: number;
    sessionSettings?: {
      allowGuests?: boolean;
      autoSave?: boolean;
      theme?: string;
    };
  }) => {
    if (!user?.id) return;

    try {
      const { sessionId, ...restData } = updateData;
      await updateSession({
        sessionId: sessionId as Id<"collaborativeSessions">,
        userId: user.id,
        ...restData,
      });
      setShowEditModal(null);
      toast.success('Session updated successfully!');
    } catch (error) {
      console.error('Failed to update session:', error);
      toast.error('Failed to update session. Please try again.');
    }
  };

  const confirmDeleteSession = async (sessionId: string) => {
    if (!user?.id) return;

    try {
      await deleteSession({
        sessionId: sessionId as Id<"collaborativeSessions">,
        userId: user.id,
      });
      setShowDeleteConfirm(null);
      toast.success('Session deleted successfully!');
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast.error('Failed to delete session. Please try again.');
    }
  };

  const handleSaveSession = async (sessionId: string, sessionName: string, name: string, description?: string) => {
    if (!user?.id) return;

    console.log("handleSaveSession called with:", { sessionId, sessionName, name, description, userId: user.id });

    try {
      const result = await saveSessionToCollection({
        sessionId: sessionId as Id<"collaborativeSessions">,
        userId: user.id,
        name,
        description: description || undefined,
        isPrivate: true,
      });
      
      console.log("saveSessionToCollection result:", result);
      setShowSaveModal(null);
      toast.success('Session saved to your collection!');
    } catch (error) {
      console.error('Failed to save session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save session. Please try again.';
      
      if (errorMessage.includes('DUPLICATE_SAVE')) {
        toast.warning('This session is already saved in your collection!');
      } else if (errorMessage.includes('SAVE_LIMIT_EXCEEDED')) {
        toast.error('You can only save up to 10 sessions. Please delete some saved sessions first.');
      } else {
        toast.error('Failed to save session. Please try again.');
      }
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
          <div>
            <h2 className="text-lg font-semibold text-white">Collaboration</h2>
            {sessionLimitCheck && (
              <p className="text-xs text-gray-400 mt-1">
                Sessions: {sessionLimitCheck.totalCount}/{sessionLimitCheck.limit}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            disabled={sessionLimitCheck && !sessionLimitCheck.canCreate}
            className={`p-2 rounded-md transition-colors ${
              sessionLimitCheck && !sessionLimitCheck.canCreate
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-[#007acc] hover:bg-[#005a99]'
            }`}
            title={sessionLimitCheck && !sessionLimitCheck.canCreate 
              ? sessionLimitCheck.message 
              : "Create New Session"
            }
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
            Live Public
          </button>
          <button
            onClick={() => setActiveTab('savedPublic')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'savedPublic'
                ? 'bg-[#007acc] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Saved Public
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
                    className="p-3 rounded-lg border border-[#333] hover:border-[#007acc] transition-colors bg-[#252526]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 
                            className="font-medium text-white truncate cursor-pointer"
                            onClick={() => onSessionSelect(session.sessionKey)}
                          >
                            {session.name}
                          </h3>
                          {session.creatorId === user?.id && (
                            <div className="flex items-center space-x-2 ml-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowEditModal({
                                    sessionId: session._id,
                                    name: session.name,
                                    description: session.description,
                                    isPublic: session.isPublic,
                                    maxUsers: session.maxUsers,
                                  });
                                }}
                                className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded"
                                title="Edit session"
                              >
                                <EditIcon className="w-4 h-4" />
                              </button>
                              <button
                                disabled={saveStatusMap[session._id] || (savedSessionInfo && !savedSessionInfo.canSave)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log("Save button clicked for session:", session._id, session.name);
                                    
                                    if (saveStatusMap[session._id]) {
                                      toast.info('This session is already saved in your collection');
                                      return;
                                    }
                                    
                                    if (savedSessionInfo && !savedSessionInfo.canSave) {
                                      toast.warning(savedSessionInfo.message);
                                      return;
                                    }
                                    
                                    setShowSaveModal({ sessionId: session._id, sessionName: session.name });
                                  }}
                                  className={`p-1.5 rounded transition-colors ${
                                    saveStatusMap[session._id]
                                      ? 'text-gray-500 cursor-not-allowed'
                                      : 'text-green-400 hover:text-green-300 hover:bg-green-400/10'
                                  }`}
                                  title={
                                    saveStatusMap[session._id] 
                                      ? 'Already saved' 
                                      : savedSessionInfo && !savedSessionInfo.canSave
                                        ? 'Save limit reached'
                                        : 'Save to collection'
                                  }
                                >
                                  <SaveIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDeleteConfirm(session._id);
                                  }}
                                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded"
                                  title="Delete session"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                      </div>
                      <div className="flex items-center space-x-1 ml-2">
                        {session.isPublic ? (
                          <GlobeIcon className="w-3 h-3 text-green-400" />
                        ) : (
                          <LockIcon className="w-3 h-3 text-gray-400" />
                        )}
                        <span className="text-xs text-gray-400">
                          {participantCountMap[session._id] ?? session.participantCount ?? 0}/{session.maxUsers}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="bg-[#007acc] text-white px-2 py-1 rounded">
                        {session.language}
                      </span>
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="w-3 h-3" />
                        <span>{formatTimeAgo(session.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'public' ? (
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
                    onClick={() => handleJoinSession(session)}
                    className="p-3 rounded-lg border border-[#333] hover:border-[#007acc] cursor-pointer transition-colors bg-[#252526]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white truncate">
                        {session.name}
                      </h3>
                      <div className="flex items-center space-x-1 ml-2">
                        <UsersIcon className="w-3 h-3 text-blue-400" />
                        <span className="text-xs text-gray-400">
                          {participantCountMap[session._id] ?? session.participantCount ?? 0}/{session.maxUsers}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="bg-[#007acc] text-white px-2 py-1 rounded">
                        {session.language}
                      </span>
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="w-3 h-3" />
                        <span>{formatTimeAgo(session.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Saved Public Sessions Tab
          <div className="p-2">
            {publicSavedSessions?.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <SaveIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No public saved sessions</p>
                <p className="text-xs">Public saved sessions from the community will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {publicSavedSessions?.map((session) => (
                  <div
                    key={session._id}
                    onClick={() => window.open(`/collaboration/saved/${session._id}`, '_blank')}
                    className="p-3 rounded-lg border border-[#333] hover:border-[#007acc] cursor-pointer transition-colors bg-[#252526]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white truncate">
                        {session.name}
                      </h3>
                      <div className="flex items-center space-x-1 ml-2">
                        <SaveIcon className="w-3 h-3 text-green-400" />
                        <span className="text-xs text-gray-400">Saved</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                      <span className="bg-[#007acc] text-white px-2 py-1 rounded">
                        {session.language}
                      </span>
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="w-3 h-3" />
                        <span>{formatTimeAgo(session.createdAt)}</span>
                      </div>
                    </div>
                    
                    {session.description && (
                      <p className="text-xs text-gray-400 truncate">{session.description}</p>
                    )}
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
                  Description (Optional)
                </label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="What are you building today?"
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
                <select
                  name="maxUsers"
                  defaultValue="5"
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#555] rounded-md text-white focus:outline-none focus:border-[#007acc]"
                >
                  <option value="2">2 users</option>
                  <option value="3">3 users</option>
                  <option value="4">4 users</option>
                  <option value="5">5 users</option>
                </select>
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

      {/* Modals */}
      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => showDeleteConfirm && confirmDeleteSession(showDeleteConfirm)}
        title="Delete Session"
        message="Are you sure you want to delete this session? This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />

      <InputModal
        isOpen={!!showSaveModal}
        onClose={() => setShowSaveModal(null)}
        onSubmit={(name) => {
          console.log("InputModal onSubmit called with name:", name);
          console.log("showSaveModal state:", showSaveModal);
          if (showSaveModal) {
            handleSaveSession(showSaveModal.sessionId, showSaveModal.sessionName, name, `Saved from session: ${showSaveModal.sessionName}`);
          }
        }}
        title="Save Session"
        label="Session Name"
        placeholder="Enter a name for your saved session"
        defaultValue={showSaveModal?.sessionName || ''}
      />

      {/* Edit Session Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2d2d2d] rounded-lg max-w-md w-full border border-[#333]">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-white mb-6">
                Edit Session
              </h3>
              
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const name = formData.get('name') as string;
                  const description = formData.get('description') as string;
                  const isPublic = formData.get('isPublic') === 'true';
                  const maxUsers = parseInt(formData.get('maxUsers') as string);

                  handleUpdateSession({
                    sessionId: showEditModal.sessionId,
                    name,
                    description: description || undefined,
                    isPublic,
                    maxUsers,
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Session Name
                  </label>
                  <input
                    name="name"
                    type="text"
                    defaultValue={showEditModal.name}
                    className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#333] rounded text-white focus:outline-none focus:border-[#007acc]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    defaultValue={showEditModal.description || ''}
                    rows={3}
                    className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#333] rounded text-white focus:outline-none focus:border-[#007acc]"
                    placeholder="Optional description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Visibility
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        name="isPublic"
                        type="radio"
                        value="false"
                        defaultChecked={!showEditModal.isPublic}
                        className="mr-2"
                      />
                      <span className="text-gray-300">🔒 Private</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        name="isPublic"
                        type="radio"
                        value="true"
                        defaultChecked={showEditModal.isPublic}
                        className="mr-2"
                      />
                      <span className="text-gray-300">🌐 Public</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Maximum Users
                  </label>
                  <select
                    name="maxUsers"
                    defaultValue={showEditModal.maxUsers}
                    className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#333] rounded text-white focus:outline-none focus:border-[#007acc]"
                  >
                    <option value={2}>2 users</option>
                    <option value={3}>3 users</option>
                    <option value={4}>4 users</option>
                    <option value={5}>5 users</option>
                  </select>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(null)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#007acc] hover:bg-[#005a9e] text-white rounded transition-colors"
                  >
                    Update Session
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
