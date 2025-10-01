"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Editor } from "@monaco-editor/react";
import { defineMonacoThemes, LANGUAGE_CONFIG } from "@/app/(root)/_constants";
import { FileIcon } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import useMounted from "@/hooks/useMounted";

interface EditorTab {
  fileId: Id<"practiceFiles">;
  name: string;
  language: string;
  isDirty: boolean;
}

interface MultiFileEditorProps {
  selectedFileId?: Id<"practiceFiles">;
}

export default function MultiFileEditor({ selectedFileId }: MultiFileEditorProps) {
  const { user } = useUser();
  const mounted = useMounted();
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<Id<"practiceFiles"> | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState<Map<string, string>>(new Map());

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
    setActiveTabId(fileId);
  }, [tabs]);

  // Handle file selection from file tree
  useEffect(() => {
    if (selectedFileId && user?.id) {
      openFile(selectedFileId);
    }
  }, [selectedFileId, user?.id, openFile]);

  // Update tabs when activeFile data is loaded
  useEffect(() => {
    if (activeFile && activeTabId) {
      const existingTab = tabs.find(tab => tab.fileId === activeTabId);
      if (!existingTab) {
        const newTab: EditorTab = {
          fileId: activeTabId,
          name: activeFile.name,
          language: activeFile.language,
          isDirty: false,
        };
        setTabs(prevTabs => [...prevTabs, newTab]);
      }
    }
  }, [activeFile, activeTabId, tabs]);

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

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      {tabs.length > 0 && (
        <div className="flex bg-[#1e1e2e] border-b border-white/[0.05] overflow-x-auto">
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
                {tab.name}
                {tab.isDirty && <span className="text-orange-400">*</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 relative">
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
    </div>
  );
}