'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Editor } from '@monaco-editor/react';
import { defineMonacoThemes } from '../../app/(root)/_constants';
import {
  UsersIcon,
  MessageSquareIcon,
  LogOutIcon,
  PlayIcon,
  SquareIcon,
} from 'lucide-react';
import { ConfirmModal } from '../ui/Modal';

interface CollaborativeEditorProps {
  sessionId: Id<"collaborativeSessions">;
  onLeaveSession: () => void;
}

export default function CollaborativeEditor({ sessionId, onLeaveSession }: CollaborativeEditorProps) {
  const { user } = useUser();
  const [code, setCode] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  const isUpdatingFromRemote = useRef(false);
  const lastRemoteCode = useRef<string>('');

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Language configurations for code execution
  const LANGUAGE_CONFIG: Record<string, { pistonRuntime: { language: string; version: string } }> = {
    javascript: { pistonRuntime: { language: 'javascript', version: '18.15.0' } },
    typescript: { pistonRuntime: { language: 'typescript', version: '5.0.3' } },
    python: { pistonRuntime: { language: 'python', version: '3.10.0' } },
    java: { pistonRuntime: { language: 'java', version: '15.0.2' } },
    cpp: { pistonRuntime: { language: 'cpp', version: '10.2.0' } },
    go: { pistonRuntime: { language: 'go', version: '1.16.2' } },
    rust: { pistonRuntime: { language: 'rust', version: '1.68.2' } },
  };

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
  const updateSessionCode = useMutation(api.collaboration.updateSessionCode);
  const leaveSession = useMutation(api.collaboration.leaveSession);
  const sendChatMessage = useMutation(api.collaboration.sendChatMessage);

  // Initialize code when session loads for the first time
  useEffect(() => {
    if (session?.code && !lastRemoteCode.current) {
      setCode(session.code);
      lastRemoteCode.current = session.code;
    }
  }, [session?.code]);

  // Handle remote code updates without interfering with local typing
  useEffect(() => {
    if (session?.code && 
        session.code !== lastRemoteCode.current && 
        session.code !== code &&
        !isUpdatingFromRemote.current) {
      
      // Only update if the remote code is significantly different
      // This prevents overwriting local changes
      const editor = editorRef.current;
      if (editor) {
        const position = editor.getPosition();
        isUpdatingFromRemote.current = true;
        
        setCode(session.code);
        lastRemoteCode.current = session.code;
        
        // Restore cursor position after a short delay
        setTimeout(() => {
          if (position && editor) {
            editor.setPosition(position);
          }
          isUpdatingFromRemote.current = false;
        }, 50);
      } else {
        setCode(session.code);
        lastRemoteCode.current = session.code;
      }
    }
  }, [session?.code, code]);

  // Handle code changes with shorter debouncing for better real-time feel
  const handleCodeChange = useCallback((value: string | undefined) => {
    if (value === undefined || !user?.id || isUpdatingFromRemote.current) return;

    setCode(value);

    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Shorter debounce for more responsive collaboration
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateSessionCode({
          sessionId,
          userId: user.id,
          code: value,
        });
        lastRemoteCode.current = value;
      } catch (error) {
        console.error('Failed to update code:', error);
      }
    }, 300); // Reduced to 300ms for better responsiveness
  }, [sessionId, user?.id, updateSessionCode]);

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

  // Handle code execution
  const handleRunCode = async () => {
    if (!session || isRunning) return;

    setIsRunning(true);
    setError('');
    setOutput('');
    setShowOutput(true);

    try {
      const runtime = LANGUAGE_CONFIG[session.language]?.pistonRuntime;
      if (!runtime) {
        setError(`Language ${session.language} is not supported for execution`);
        return;
      }

      const response = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: runtime.language,
          version: runtime.version,
          files: [{ content: code }],
        }),
      });

      const data = await response.json();

      if (data.message) {
        setError(data.message);
        return;
      }

      if (data.run) {
        if (data.run.stdout) {
          setOutput(data.run.stdout);
        }
        if (data.run.stderr) {
          setError(data.run.stderr);
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsRunning(false);
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
          {/* Run Code Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning || !canEdit}
            className="flex items-center space-x-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
          >
            {isRunning ? (
              <SquareIcon className="w-4 h-4" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
            <span>{isRunning ? 'Running...' : 'Run'}</span>
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
      <div className="flex-1 flex">
        {/* Editor */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1">
            <Editor
              height="100%"
              language={session.language}
              value={code}
              onChange={handleCodeChange}
              theme="vs-dark"
              beforeMount={defineMonacoThemes}
              onMount={(editor) => {
                editorRef.current = editor;
                
                // Optimize editor for collaborative editing
                editor.updateOptions({
                  readOnly: !canEdit,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  minimap: { enabled: false },
                  fontSize: 14,
                  renderWhitespace: 'selection',
                  bracketPairColorization: { enabled: true },
                  // Performance optimizations for real-time collaboration
                  quickSuggestions: false,
                  suggestOnTriggerCharacters: false,
                  acceptSuggestionOnEnter: 'off',
                  tabCompletion: 'off',
                  wordBasedSuggestions: 'off',
                  // Reduce validation delays for better performance
                  'semanticHighlighting.enabled': false,
                });
              }}
              options={{
                readOnly: !canEdit,
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                renderWhitespace: 'selection',
                bracketPairColorization: { enabled: true },
                // Performance optimizations for collaborative editing
                quickSuggestions: false,
                suggestOnTriggerCharacters: false,
                acceptSuggestionOnEnter: 'off',
                tabCompletion: 'off',
                wordBasedSuggestions: 'off',
                parameterHints: { enabled: false },
                hover: { enabled: false },
                // Disable some features that can cause lag in collaborative mode
                folding: false,
                foldingHighlight: false,
                unfoldOnClickAfterEndOfLine: false,
                showUnused: false,
                showDeprecated: false,
              }}
            />
          </div>

          {/* Output Panel */}
          {showOutput && (
            <div className="h-64 border-t border-[#333] bg-[#1e1e1e] flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-[#333]">
                <h3 className="font-semibold text-white">Output</h3>
                <button
                  onClick={() => setShowOutput(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-auto p-3 font-mono text-sm">
                {error && (
                  <div className="text-red-400 mb-2">
                    <strong>Error:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">{error}</pre>
                  </div>
                )}
                {output && (
                  <div className="text-green-400">
                    <strong>Output:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">{output}</pre>
                  </div>
                )}
                {!error && !output && !isRunning && (
                  <div className="text-gray-400">No output yet</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Participants Panel */}
        {showParticipants && (
          <div className="w-64 border-l border-[#333] bg-[#252526] flex flex-col">
            <div className="p-3 border-b border-[#333]">
              <h3 className="font-semibold text-white">Participants</h3>
            </div>
            <div className="flex-1 overflow-auto p-3">
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
          <div className="w-80 border-l border-[#333] bg-[#252526] flex flex-col">
            <div className="p-3 border-b border-[#333]">
              <h3 className="font-semibold text-white">Chat</h3>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-auto p-3 space-y-2">
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