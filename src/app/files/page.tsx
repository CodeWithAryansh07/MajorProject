"use client";

import { useState } from "react";
import FileTree from "@/components/FileTree";
import MultiFileEditor from "@/components/MultiFileEditor";
import SearchResults from "@/components/SearchResults";
import FileOperationsPanel from "@/components/FileOperationsPanel";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import { Id } from "../../../convex/_generated/dataModel";

export default function FilesPage() {
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
    <div className="h-screen flex bg-[#0a0a0f]">
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
  );
}