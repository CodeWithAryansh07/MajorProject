// DOCUMENTED BY SCRIPT - Phase 4
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import toast from "react-hot-toast";
import { 
  FileIcon, 
  TrashIcon, 
  MoveIcon,
  DownloadIcon,
  FilterIcon,
  SortAscIcon,
  SortDescIcon,
  XIcon
} from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

interface FileOperationsPanelProps {
  selectedFiles: Id<"practiceFiles">[];
  onSelectionChange: (files: Id<"practiceFiles">[]) => void;
  onClose: () => void;
}

type SortOption = "name" | "date" | "size" | "type";
type SortOrder = "asc" | "desc";

export default function FileOperationsPanel({ 
  selectedFiles, 
  onSelectionChange, 
  onClose 
}: FileOperationsPanelProps) {
  const { user } = useUser();
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filterType, setFilterType] = useState<string>("all");
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState<Id<"folders"> | undefined>();

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showMoveDialog) {
          setShowMoveDialog(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showMoveDialog]);

  // Mutations
  const deleteFile = useMutation(api.files.deleteFile);
  const moveFile = useMutation(api.files.moveFile);

  // Queries
  const allFiles = useQuery(
    api.files.getUserFiles,
    user?.id ? { userId: user.id } : "skip"
  );

  const folderTree = useQuery(
    api.folders.getFolderTree,
    user?.id ? { userId: user.id } : "skip"
  );

  const handleDeleteSelected = async () => {
    if (!user?.id || selectedFiles.length === 0) return;

    const confirmDelete = confirm(
      `Are you sure you want to delete ${selectedFiles.length} file(s)? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      for (const fileId of selectedFiles) {
        await deleteFile({ fileId, userId: user.id });
      }
      onSelectionChange([]);
      toast.success("Files deleted successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete files");
    }
  };

  const handleMoveSelected = async () => {
    if (!user?.id || selectedFiles.length === 0) return;

    try {
      for (const fileId of selectedFiles) {
        await moveFile({ 
          fileId, 
          targetFolderId, 
          userId: user.id 
        });
      }
      onSelectionChange([]);
      setShowMoveDialog(false);
      toast.success("Files moved successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move files");
    }
  };

  const handleExportSelected = () => {
    if (!allFiles || selectedFiles.length === 0) return;

    const filesToExport = allFiles.filter(file => 
      selectedFiles.includes(file._id)
    );

    const exportData = {
      files: filesToExport.map(file => ({
        name: file.name,
        language: file.language,
        code: file.code,
        description: file.description,
        path: file.path,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      })),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `files-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredAndSortedFiles = allFiles
    ?.filter(file => {
      if (filterType === "all") return true;
      return file.language === filterType;
    })
    ?.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "date":
          comparison = a.updatedAt - b.updatedAt;
          break;
        case "type":
          comparison = a.language.localeCompare(b.language);
          break;
        case "size":
          comparison = a.code.length - b.code.length;
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    }) || [];

  const uniqueLanguages = Array.from(
    new Set(allFiles?.map(file => file.language) || [])
  ).sort();

  type FolderTreeItem = {
    _id: Id<"folders">;
    name: string;
    children?: FolderTreeItem[];
  };

  const renderFolderOption = (folder: FolderTreeItem, depth = 0) => (
    <option key={folder._id} value={folder._id}>
      {"  ".repeat(depth)}📁 {folder.name}
    </option>
  );

  const renderFolderTree = (folders: FolderTreeItem[], depth = 0): JSX.Element[] => {
    return folders.flatMap(folder => [
      renderFolderOption(folder, depth),
      ...renderFolderTree(folder.children || [], depth + 1)
    ]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-[#1e1e2e] border border-white/[0.1] rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.1]">
          <div className="flex items-center gap-3">
            <FileIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">File Operations</h2>
            {selectedFiles.length > 0 && (
              <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                {selectedFiles.length} selected
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/[0.1] rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-white/[0.1] bg-[#12121a]">
          <div className="flex items-center justify-between gap-4 mb-4">
            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <FilterIcon className="w-4 h-4 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort files by"
                className="bg-[#1e1e2e] border border-white/[0.1] rounded px-2 py-1 text-white text-sm"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="type">Sort by Type</option>
                <option value="size">Sort by Size</option>
              </select>
              
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="p-1 hover:bg-white/[0.1] rounded transition-colors"
              >
                {sortOrder === "asc" ? (
                  <SortAscIcon className="w-4 h-4 text-gray-400" />
                ) : (
                  <SortDescIcon className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Filter:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                aria-label="Filter files by type"
                className="bg-[#1e1e2e] border border-white/[0.1] rounded px-2 py-1 text-white text-sm"
              >
                <option value="all">All Types</option>
                {uniqueLanguages.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedFiles.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-[#1e1e2e] rounded-lg">
              <span className="text-sm text-gray-400">Bulk Actions:</span>
              
              <button
                onClick={() => setShowMoveDialog(true)}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
              >
                <MoveIcon className="w-3 h-3" />
                Move
              </button>
              
              <button
                onClick={handleExportSelected}
                className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
              >
                <DownloadIcon className="w-3 h-3" />
                Export
              </button>
              
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                <TrashIcon className="w-3 h-3" />
                Delete
              </button>
              
              <button
                onClick={() => onSelectionChange([])}
                className="flex items-center gap-1 px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>

        {/* File List */}
        <div className="overflow-y-auto max-h-96">
          {filteredAndSortedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileIcon className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">No files found</p>
              <p className="text-sm">Create some files or adjust your filters</p>
            </div>
          ) : (
            <div className="p-2">
              {filteredAndSortedFiles.map((file) => (
                <div
                  key={file._id}
                  className={`flex items-center gap-3 p-3 hover:bg-white/[0.05] rounded-lg cursor-pointer transition-colors ${
                    selectedFiles.includes(file._id) ? "bg-blue-500/20 border border-blue-500/50" : ""
                  }`}
                  onClick={() => {
                    const isSelected = selectedFiles.includes(file._id);
                    if (isSelected) {
                      onSelectionChange(selectedFiles.filter(id => id !== file._id));
                    } else {
                      onSelectionChange([...selectedFiles, file._id]);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(file._id)}
                    onChange={() => {}} // Handled by parent div onClick
                    className="w-4 h-4 text-blue-500 bg-[#12121a] border-white/[0.2] rounded focus:ring-blue-500"
                  />
                  
                  <FileIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium truncate">
                        {file.name}
                      </h3>
                      <span className="text-xs px-2 py-0.5 bg-white/[0.1] rounded text-gray-300">
                        {file.language}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{file.path}</span>
                      <span>{file.code.length} chars</span>
                      <span>{new Date(file.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.1] bg-[#12121a]">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              {filteredAndSortedFiles.length} files • {selectedFiles.length} selected
            </span>
            <span>
              Total: {allFiles?.reduce((acc, file) => acc + file.code.length, 0) || 0} characters
            </span>
          </div>
        </div>
      </div>

      {/* Move Dialog */}
      {showMoveDialog && (
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center">
          <div className="bg-[#1e1e2e] border border-white/[0.1] rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">Move Files</h3>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Select destination folder:
              </label>
              <select
                value={targetFolderId || ""}
                onChange={(e) => setTargetFolderId(e.target.value as Id<"folders"> || undefined)}
                aria-label="Select destination folder"
                className="w-full bg-[#12121a] border border-white/[0.1] rounded px-3 py-2 text-white"
              >
                <option value="">Root Folder</option>
                {folderTree && renderFolderTree(folderTree.folders)}
              </select>
            </div>
            
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowMoveDialog(false)}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveSelected}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Move Files
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}