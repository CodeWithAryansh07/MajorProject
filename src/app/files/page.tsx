"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FileTree from "@/components/FileTree";
import MultiFileEditor from "@/components/MultiFileEditor";
import SearchResults from "@/components/SearchResults";
import FileOperationsPanel from "@/components/FileOperationsPanel";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import { Id } from "../../../convex/_generated/dataModel";

export default function FilesPage() {
  const router = useRouter();
  const [selectedFileId, setSelectedFileId] = useState<Id<"practiceFiles"> | undefined>();
  const [showSearch, setShowSearch] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Id<"practiceFiles">[]>([]);

  const handleFileSelect = (fileId: Id<"practiceFiles">) => {
    setSelectedFileId(fileId);
  };

  const handleFileClose = () => {
    setSelectedFileId(undefined);
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f]">
      {/* Back Navigation */}
      <div className="flex items-center p-2 bg-[#252526] border-b border-[#333]">
        <button
          onClick={() => router.push('/')}
          className="flex items-center space-x-2 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-[#3c3c3c] rounded-md transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Editor</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Keyboard Shortcuts */}
        <KeyboardShortcuts
          onSearchOpen={() => setShowSearch(true)}
          onOperationsOpen={() => setShowOperations(true)}
        />

        {/* File Tree Sidebar */}
        <FileTree
          onFileSelect={handleFileSelect}
          selectedFileId={selectedFileId}
          onSearchOpen={() => setShowSearch(true)}
          onOperationsOpen={() => setShowOperations(true)}
        />

        {/* Main Editor Area */}
        <div className="flex-1">
          <MultiFileEditor
            selectedFileId={selectedFileId}
            onFileClose={handleFileClose}
          />
        </div>

        {/* Search Overlay */}
        {showSearch && (
          <SearchResults
            onFileSelect={handleFileSelect}
            onClose={() => setShowSearch(false)}
          />
        )}

        {/* File Operations Overlay */}
        {showOperations && (
          <FileOperationsPanel
            selectedFiles={selectedFiles}
            onSelectionChange={setSelectedFiles}
            onClose={() => setShowOperations(false)}
          />
        )}
      </div>
    </div>
  );
}