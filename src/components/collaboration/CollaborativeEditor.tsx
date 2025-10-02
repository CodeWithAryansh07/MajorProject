'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import {
  UsersIcon,
  MessageSquareIcon,
  LogOutIcon,
  FolderIcon,
  FolderOpenIcon,
} from 'lucide-react';
import { ConfirmModal } from '../ui/Modal';
import CollaborativeFileTree from './CollaborativeFileTree';
import MultiSessionFileEditor from './MultiSessionFileEditor';
import '../../styles/vscode-scrollbar.css';

interface CollaborativeEditorProps {
  sessionId: Id<"collaborativeSessions">;
  onLeaveSession: () => void;
}

export default function CollaborativeEditor({ sessionId, onLeaveSession }: CollaborativeEditorProps) {
  const { user } = useUser();
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // File system states
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [selectedFileId, setSelectedFileId] = useState<Id<"sessionFiles"> | undefined>();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Keyboard shortcut handler for Ctrl + B to toggle file explorer
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl + B to toggle file explorer
      if (event.ctrlKey && event.key === 'b') {
        event.preventDefault();
        setShowFileExplorer(prev => !prev);
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup function
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Language configurations for code execution
  // Moved to MultiSessionFileEditor where it's actually used

  // Queries
  const session = useQuery(
    api.collaboration.getSession,
    { sessionId }
  );

  const chatMessages = useQuery(
    api.collaboration.getChatMessages,
    { sessionId, limit: 50 }
  );

  // Mutations
  const leaveSession = useMutation(api.collaboration.leaveSession);
  const sendChatMessage = useMutation(api.collaboration.sendChatMessage);

  // Handle leaving session
  const handleLeaveSession = async () => {
    if (!user?.id) return;
    setShowLeaveConfirm(true);
  };

  const confirmLeaveSession = async () => {
    if (!user?.id) return;
    
    try {
      await leaveSession({
        sessionId,
        userId: user.id,
      });
      onLeaveSession();
    } catch (error) {
      console.error('Failed to leave session:', error);
    } finally {
      setShowLeaveConfirm(false);
    }
  };

  // Handle sending chat message
  const handleSendMessage = async () => {
    if (!user?.id || !chatMessage.trim()) return;

    try {
      await sendChatMessage({
        sessionId,
        userId: user.id,
        message: chatMessage.trim(),
      });
      setChatMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const currentUserPermission = session?.participants?.find(p => p.userId === user?.id)?.permission || 'read';
  const canEdit = currentUserPermission === 'write';

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e1e] text-white">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#333] bg-[#252526]">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-white">{session.name}</h1>
          <span className="px-2 py-1 bg-[#007acc] text-white text-xs rounded">
            {session.language}
          </span>
          {!canEdit && (
            <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded">
              Read Only
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* File Explorer Toggle */}
          <button
            onClick={() => setShowFileExplorer(!showFileExplorer)}
            className={`flex items-center space-x-1 px-3 py-2 rounded-md transition-colors ${
              showFileExplorer 
                ? 'bg-[#007acc] text-white' 
                : 'bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white'
            }`}
            title="Toggle File Explorer (Ctrl + B)"
          >
            {showFileExplorer ? (
              <FolderOpenIcon className="w-4 h-4" />
            ) : (
              <FolderIcon className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Files</span>
          </button>

          {/* Participants Button */}
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="flex items-center space-x-1 px-3 py-2 bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white rounded-md transition-colors"
          >
            <UsersIcon className="w-4 h-4" />
            <span>{session.participants?.length || 0}</span>
          </button>

          {/* Chat Button */}
          <button
            onClick={() => setShowChat(!showChat)}
            className="flex items-center space-x-1 px-3 py-2 bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white rounded-md transition-colors"
          >
            <MessageSquareIcon className="w-4 h-4" />
          </button>

          {/* Leave Session Button */}
          <button
            onClick={handleLeaveSession}
            className="flex items-center space-x-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            <LogOutIcon className="w-4 h-4" />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex relative">
        {/* File Explorer */}
        {showFileExplorer && (
          <CollaborativeFileTree
            sessionId={sessionId}
            onFileSelect={setSelectedFileId}
            selectedFileId={selectedFileId}
          />
        )}

        {/* Editor Area */}
        <div className="flex-1 flex flex-col">
          {selectedFileId ? (
            /* Multi-File Editor for session files */
            <MultiSessionFileEditor
              sessionId={sessionId}
              selectedFileId={selectedFileId}
              onFileClose={() => setSelectedFileId(undefined)}
            />
          ) : (
            /* No File Selected State - Similar to /files route */
            <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
              <div className="text-center text-gray-400">
                <div className="mb-4">
                  <FolderIcon className="w-16 h-16 mx-auto text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                  No file selected
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Select a file from the explorer to start editing
                </p>
                <p className="text-xs text-gray-600">
                  Tip: Press <kbd className="px-1 py-0.5 bg-[#3c3c3c] rounded text-gray-300">Ctrl + B</kbd> to toggle file explorer
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Participants Panel */}
        {showParticipants && (
          <div className={`fixed top-16 right-4 w-64 h-80 border border-[#333] bg-[#252526] flex flex-col z-60 rounded-lg shadow-lg ${showChat ? 'right-[340px]' : 'right-4'}`}>
            <div className="p-3 border-b border-[#333] flex items-center justify-between">
              <h3 className="font-semibold text-white">Participants</h3>
              <button
                onClick={() => setShowParticipants(false)}
                className="text-gray-400 hover:text-white text-lg font-bold w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] transition-colors"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 vscode-scrollbar">
              <div className="space-y-2">
                {session.participants?.map((participant) => (
                  <div
                    key={participant._id}
                    className="flex items-center justify-between p-2 rounded-md bg-[#3c3c3c]"
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        participant.isActive ? 'bg-green-400' : 'bg-gray-400'
                      }`} />
                      <span className="text-white text-sm">
                        {participant.userName}
                        {participant.userId === session.creatorId && ' (Host)'}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      participant.permission === 'write' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-600 text-white'
                    }`}>
                      {participant.permission}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {showChat && (
          <div className="fixed top-16 right-4 w-80 h-96 border border-[#333] bg-[#252526] flex flex-col z-60 rounded-lg shadow-lg">
            <div className="p-3 border-b border-[#333] flex items-center justify-between">
              <h3 className="font-semibold text-white">Chat</h3>
              <button
                onClick={() => setShowChat(false)}
                className="text-gray-400 hover:text-white text-lg font-bold w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] transition-colors"
              >
                ×
              </button>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-auto p-3 space-y-2 vscode-scrollbar">
              {chatMessages?.map((message) => (
                <div key={`${message._id}-${message.timestamp}`} className="text-sm">
                  <div className="flex items-center space-x-1 mb-1">
                    <span className="font-medium text-blue-400">
                      {message.userName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {isClient ? new Date(message.timestamp).toLocaleTimeString() : 'Recently'}
                    </span>
                  </div>
                  <div className="text-gray-300 whitespace-pre-wrap">
                    {message.message}
                  </div>
                </div>
              ))}
              {(!chatMessages || chatMessages.length === 0) && (
                <div className="text-center text-gray-400 py-8">
                  No messages yet. Start the conversation!
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-3 border-t border-[#333]">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-[#3c3c3c] border border-[#555] rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#007acc]"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim()}
                  className="px-4 py-2 bg-[#007acc] hover:bg-[#005a99] disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leave Session Confirmation Modal */}
      <ConfirmModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={confirmLeaveSession}
        title="Leave Session"
        message="Are you sure you want to leave this collaborative session? Any unsaved changes will be lost."
        confirmText="Leave Session"
        type="danger"
      />
    </div>
  );
}