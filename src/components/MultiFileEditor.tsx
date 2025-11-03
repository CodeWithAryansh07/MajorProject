// DOCUMENTED BY SCRIPT - Phase 4
"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Editor } from "@monaco-editor/react";
import { defineMonacoThemes, LANGUAGE_CONFIG } from "@/app/(root)/_constants";
import { XIcon, FileIcon, PlayIcon, Loader2Icon } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import useMounted from "@/hooks/useMounted";

interface EditorTab {
  fileId: Id<"practiceFiles">;
  name: string;
  language: string;
  isDirty: boolean;
  isLoading?: boolean; // Optional loading state
}

interface MultiFileEditorProps {
  selectedFileId?: Id<"practiceFiles">;
  onFileClose?: () => void;
}

export default function MultiFileEditor({ selectedFileId, onFileClose }: MultiFileEditorProps) {
  const { user } = useUser();
  const mounted = useMounted();
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<Id<"practiceFiles"> | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState<Map<string, string>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);

  // Mutations
  const updateFile = useMutation(api.files.updateFile);

  // Queries
  const activeFile = useQuery(
    api.files.getFile,
    activeTabId && user?.id ? { fileId: activeTabId, userId: user.id } : "skip"
  );

  const openFile = useCallback((fileId: Id<"practiceFiles">) => {
    // Check if file is already open
    const existingTab = tabs.find(tab => tab.fileId === fileId);
    if (existingTab) {
      setActiveTabId(fileId);
      return;
    }
    
    // Optimistic update: Create tab immediately with loading state
    const optimisticTab: EditorTab = {
      fileId,
      name: "Loading...", // Placeholder name
      language: "javascript", // Default language
      isDirty: false,
      isLoading: true, // Add loading flag
    };
    
    setTabs(prevTabs => [...prevTabs, optimisticTab]);
    setActiveTabId(fileId);
  }, [tabs]);

  // Handle file selection from file tree
  useEffect(() => {
    if (selectedFileId && user?.id) {
      openFile(selectedFileId);
    }
  }, [selectedFileId, user?.id, openFile]);

  // Override Ctrl+S to save file instead of downloading webpage
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        event.stopPropagation();
        
        if (activeTabId && user?.id) {
          const editorContent = unsavedChanges.get(activeTabId);
          if (editorContent !== undefined) {
            try {
              await updateFile({
                fileId: activeTabId,
                code: editorContent,
                userId: user.id,
              });
              
              // Remove from unsaved changes
              setUnsavedChanges(prev => {
                const newMap = new Map(prev);
                newMap.delete(activeTabId);
                return newMap;
              });

              // Update tab dirty state
              setTabs(prevTabs => 
                prevTabs.map(tab => 
                  tab.fileId === activeTabId ? { ...tab, isDirty: false } : tab
                )
              );
            } catch (error) {
              console.error("Failed to save file:", error);
            }
          }
        }
      }
    };

    // Add global event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTabId, unsavedChanges, updateFile, user?.id]);

  // Update tabs when activeFile data is loaded
  useEffect(() => {
    if (activeFile && activeTabId) {
      const existingTab = tabs.find(tab => tab.fileId === activeTabId);
      if (!existingTab) {
        // This shouldn't happen with optimistic updates, but keep as fallback
        const newTab: EditorTab = {
          fileId: activeTabId,
          name: activeFile.name,
          language: activeFile.language,
          isDirty: false,
        };
        setTabs(prevTabs => [...prevTabs, newTab]);
      } else if (existingTab.isLoading) {
        // Update the optimistic tab with real data
        setTabs(prevTabs => 
          prevTabs.map(tab => 
            tab.fileId === activeTabId 
              ? { 
                  ...tab, 
                  name: activeFile.name, 
                  language: activeFile.language,
                  isLoading: false 
                }
              : tab
          )
        );
      }
    }
  }, [activeFile, activeTabId, tabs]);

  const closeTab = (fileId: Id<"practiceFiles">, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    // Check for unsaved changes
    const hasUnsavedChanges = unsavedChanges.has(fileId);
    if (hasUnsavedChanges) {
      const shouldClose = confirm("You have unsaved changes. Close anyway?");
      if (!shouldClose) return;
    }

    // Get remaining tabs before removing current one
    const remainingTabs = tabs.filter(tab => tab.fileId !== fileId);

    // Remove tab
    setTabs(remainingTabs);

    // Remove unsaved changes
    setUnsavedChanges(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });

    // Update active tab
    if (activeTabId === fileId) {
      if (remainingTabs.length > 0) {
        // Switch to the last remaining tab
        setActiveTabId(remainingTabs[remainingTabs.length - 1].fileId);
      } else {
        setActiveTabId(null);
        onFileClose?.();
      }
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined || !activeTabId) return;

    // Store unsaved changes
    const newUnsavedChanges = new Map(unsavedChanges);
    newUnsavedChanges.set(activeTabId, value);
    setUnsavedChanges(newUnsavedChanges);

    // Mark tab as dirty
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.fileId === activeTabId ? { ...tab, isDirty: true } : tab
      )
    );
  };

  // Auto-save effect
  useEffect(() => {
    if (!activeTabId || !user?.id) return;

    const interval = setInterval(async () => {
      const editorContent = unsavedChanges.get(activeTabId);
      if (editorContent !== undefined) {
        try {
          await updateFile({
            fileId: activeTabId,
            code: editorContent,
            userId: user.id,
          });
          
          // Remove from unsaved changes
          const newUnsavedChanges = new Map(unsavedChanges);
          newUnsavedChanges.delete(activeTabId);
          setUnsavedChanges(newUnsavedChanges);

          // Update tab dirty state
          setTabs(prevTabs => 
            prevTabs.map(tab => 
              tab.fileId === activeTabId ? { ...tab, isDirty: false } : tab
            )
          );
        } catch (error) {
          console.error("Auto-save failed:", error);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeTabId, unsavedChanges, updateFile, user?.id]);

  // Run code function
  const runCode = async () => {
    if (!activeFile || !activeTabId) return;

    const code = unsavedChanges.get(activeTabId) ?? activeFile.code;
    if (!code.trim()) {
      setError("Please enter some code");
      return;
    }

    setIsRunning(true);
    setError(null);
    setOutput("");
    setShowOutput(true); // Show output panel when running code

    try {
      const runtime = LANGUAGE_CONFIG[activeFile.language]?.pistonRuntime;
      if (!runtime) {
        setError(`Language ${activeFile.language} is not supported for execution`);
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

      // Handle API-level errors
      if (data.message) {
        setError(data.message);
        return;
      }

      // Handle compilation errors
      if (data.compile && data.compile.code !== 0) {
        const error = data.compile.stderr || data.compile.output;
        setError(error);
        return;
      }

      // Handle runtime errors
      if (data.run && data.run.code !== 0) {
        const error = data.run.stderr || data.run.output;
        setError(error);
        return;
      }

      // Success
      const output = data.run.output;
      setOutput(output.trim());
    } catch (error) {
      setError("Error running code");
      console.error("Error running code:", error);
    } finally {
      setIsRunning(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      {tabs.length > 0 && (
        <div className="flex items-center justify-between bg-[#1e1e2e] border-b border-white/[0.05]">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <div
                key={tab.fileId}
                className={`flex items-center gap-2 px-4 py-2 cursor-pointer border-r border-white/[0.05] min-w-0 max-w-48 ${
                  activeTabId === tab.fileId 
                    ? 'bg-[#12121a] text-white' 
                    : 'text-gray-400 hover:text-gray-300 hover:bg-[#ffffff08]'
                }`}
                onClick={() => setActiveTabId(tab.fileId)}
              >
                <FileIcon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate text-sm">
                  {tab.isLoading ? (
                    <span className="flex items-center gap-1">
                      <span className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full"></span>
                      Loading...
                    </span>
                  ) : (
                    <>
                      {tab.name}
                      {tab.isDirty && <span className="text-orange-400">*</span>}
                    </>
                  )}
                </span>
                <button
                  onClick={(e) => closeTab(tab.fileId, e)}
                  className="flex-shrink-0 p-1 hover:bg-[#ffffff15] rounded"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          
          {/* Run Button */}
          {activeFile && LANGUAGE_CONFIG[activeFile.language]?.pistonRuntime && (
            <div className="flex items-center gap-2 px-4 py-2">
              <button
                onClick={runCode}
                disabled={isRunning}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
                  isRunning
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isRunning ? (
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                ) : (
                  <PlayIcon className="w-4 h-4" />
                )}
                <span className="text-sm">
                  {isRunning ? 'Running...' : 'Run'}
                </span>
              </button>
              
              {showOutput && (
                <button
                  onClick={() => setShowOutput(false)}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-gray-300"
                >
                  Hide Output
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      <div className={`flex-1 relative ${showOutput ? 'h-1/2' : 'h-full'}`}>
        {activeTabId && activeFile ? (
          <Editor
            height="100%"
            language={LANGUAGE_CONFIG[activeFile.language]?.monacoLanguage || activeFile.language}
            value={unsavedChanges.get(activeTabId) ?? activeFile.code}
            theme="vs-dark"
            beforeMount={defineMonacoThemes}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              renderWhitespace: "selection",
              fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
              fontLigatures: true,
              cursorBlinking: "smooth",
              smoothScrolling: true,
              contextmenu: true,
              renderLineHighlight: "all",
              lineHeight: 1.6,
              letterSpacing: 0.5,
              roundedSelection: true,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
              wordWrap: "on",
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FileIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No file selected</p>
              <p className="text-sm">Select a file from the file tree or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Output Panel */}
      {showOutput && (
        <div className="h-1/2 border-t border-white/[0.05] flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e2e] border-b border-white/[0.05]">
            <span className="text-sm font-medium text-gray-300">Output</span>
            <button
              onClick={() => setShowOutput(false)}
              className="p-1 hover:bg-[#ffffff15] rounded"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 p-4 bg-[#12121a] overflow-auto">
            {error ? (
              <div className="text-red-400 font-mono text-sm whitespace-pre-wrap">
                {error}
              </div>
            ) : output ? (
              <div className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                {output}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">
                No output yet. Run your code to see results here.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status bar */}
      {activeFile && (
        <div className="bg-[#1e1e2e] border-t border-white/[0.05] px-4 py-2 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>Language: {activeFile.language}</span>
            <span>
              {unsavedChanges.has(activeTabId!) ? "Unsaved changes" : "Saved"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Lines: {activeFile.code.split('\n').length}</span>
            <span>Characters: {activeFile.code.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}