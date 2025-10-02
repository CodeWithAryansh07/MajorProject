'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { toast } from 'react-hot-toast';
import {
  CodeIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  EyeOffIcon,
  TagIcon,
  CalendarIcon,
  CheckIcon,
  XIcon,
  PlayIcon,
} from 'lucide-react';
import { ConfirmModal } from '../ui/Modal';

export default function SavedSessions() {
  const { user } = useUser();
  const router = useRouter();
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: '',
    description: '',
    tags: [] as string[],
    isPrivate: true,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Queries
  const savedSessions = useQuery(
    api.collaboration.getUserSavedSessions,
    user?.id ? { userId: user.id } : "skip"
  );

  const savedSessionInfo = useQuery(
    api.collaboration.getSavedSessionInfo,
    user?.id ? { userId: user.id } : "skip"
  );

  // Mutations
  const updateSavedSession = useMutation(api.collaboration.updateSavedSession);
  const deleteSavedSession = useMutation(api.collaboration.deleteSavedSession);
  const toggleSavedSessionPrivacy = useMutation(api.collaboration.toggleSavedSessionPrivacy);

  const startEditing = (session: { _id: string; name: string; description?: string; tags?: string[]; isPrivate: boolean }) => {
    setEditingSession(session._id);
    setEditData({
      name: session.name,
      description: session.description || '',
      tags: session.tags || [],
      isPrivate: session.isPrivate,
    });
  };

  const cancelEditing = () => {
    setEditingSession(null);
    setEditData({ name: '', description: '', tags: [], isPrivate: true });
  };

  const handleUpdate = async (sessionId: string) => {
    if (!user?.id) return;

    try {
      await updateSavedSession({
        savedSessionId: sessionId as Id<"savedSessions">,
        userId: user.id,
        name: editData.name,
        description: editData.description,
        tags: editData.tags,
        isPrivate: editData.isPrivate,
      });
      cancelEditing();
      toast.success('Saved session updated successfully!');
    } catch (error) {
      console.error('Failed to update saved session:', error);
      toast.error('Failed to update session. Please try again.');
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!user?.id) return;

    try {
      await deleteSavedSession({
        savedSessionId: sessionId as Id<"savedSessions">,
        userId: user.id,
      });
      setShowDeleteConfirm(null);
      toast.success('Saved session deleted successfully!');
    } catch (error) {
      console.error('Failed to delete saved session:', error);
      toast.error('Failed to delete session. Please try again.');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const handleOpenSession = (sessionId: string) => {
    router.push(`/collaboration/saved/${sessionId}`);
  };

  const handleTogglePrivacy = async (sessionId: string) => {
    if (!user?.id) return;

    try {
      const result = await toggleSavedSessionPrivacy({
        savedSessionId: sessionId as Id<"savedSessions">,
        userId: user.id,
      });
      toast.success(`Session is now ${result.newPrivacyStatus}!`);
    } catch (error) {
      console.error('Failed to toggle privacy:', error);
      toast.error('Failed to toggle privacy. Please try again.');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      <div className="p-4 border-b border-[#333]">
        <h2 className="text-lg font-semibold text-white">Saved Sessions</h2>
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-gray-400">
            Your permanently saved coding sessions
          </p>
          {savedSessionInfo && (
            <p className="text-xs text-gray-500">
              {savedSessionInfo.count}/{savedSessionInfo.limit} saved
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!savedSessions || savedSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <CodeIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No saved sessions yet</p>
            <p className="text-xs mt-1">Save sessions from collaboration to access them forever</p>
            <p className="text-xs mt-2 text-gray-500">
              You can save up to {savedSessionInfo?.limit || 10} sessions
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedSessions.map((session) => (
              <div
                key={session._id}
                className="p-4 rounded-lg border border-[#333] bg-[#252526]"
              >
                {editingSession === session._id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-[#1e1e1e] text-white px-3 py-2 rounded border border-[#333]"
                      placeholder="Session name"
                    />
                    <textarea
                      value={editData.description}
                      onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-[#1e1e1e] text-white px-3 py-2 rounded border border-[#333] resize-none"
                      rows={2}
                      placeholder="Description"
                    />
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={editData.isPrivate}
                          onChange={(e) => setEditData(prev => ({ ...prev, isPrivate: e.target.checked }))}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-300">Private</span>
                      </label>
                    </div>
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleUpdate(session._id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                      >
                        <CheckIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-white">{session.name}</h3>
                        {session.description && (
                          <p className="text-sm text-gray-400 mt-1">{session.description}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleOpenSession(session._id)}
                          className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded"
                          title="Open Session"
                        >
                          <PlayIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => startEditing(session)}
                          className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded"
                          title="Edit"
                        >
                          <EditIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(session._id)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded"
                          title="Delete"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="bg-[#007acc] text-white px-2 py-1 rounded">
                          {session.language}
                        </span>
                        <div className="flex items-center space-x-1">
                          {session.isPrivate ? (
                            <EyeOffIcon className="w-3 h-3" />
                          ) : (
                            <EyeIcon className="w-3 h-3" />
                          )}
                          <span>{session.isPrivate ? 'Private' : 'Public'}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePrivacy(session._id);
                            }}
                            className="ml-1 text-xs text-blue-400 hover:text-blue-300"
                            title={`Make ${session.isPrivate ? 'Public' : 'Private'}`}
                          >
                            Toggle
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <CalendarIcon className="w-3 h-3" />
                        <span>Saved {formatDate(session.createdAt)}</span>
                      </div>
                    </div>

                    {session.tags && session.tags.length > 0 && (
                      <div className="flex items-center flex-wrap gap-1 mt-2">
                        <TagIcon className="w-3 h-3 text-gray-400" />
                        {session.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-[#333] text-gray-300 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
        title="Delete Saved Session"
        message="Are you sure you want to delete this saved session? This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}