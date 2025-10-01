"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { SearchIcon, FileIcon, FolderIcon, ClockIcon, XIcon } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

interface SearchResultsProps {
  onFileSelect: (fileId: Id<"practiceFiles">) => void;
  onClose: () => void;
}

export default function SearchResults({ onFileSelect, onClose }: SearchResultsProps) {
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"all" | "files" | "folders">("all");
  const [isSearching, setIsSearching] = useState(false);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Search files
  const searchResults = useQuery(
    api.files.searchFiles,
    searchTerm.length >= 2 && user?.id 
      ? { userId: user.id, searchTerm } 
      : "skip"
  );

  // Recent files for when no search is active
  const recentFiles = useQuery(
    api.files.getRecentFiles,
    user?.id ? { userId: user.id, limit: 10 } : "skip"
  );

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setIsSearching(value.length >= 2);
  };

  const handleFileClick = (fileId: Id<"practiceFiles">) => {
    onFileSelect(fileId);
    onClose();
  };

  const filesToShow = isSearching ? searchResults : recentFiles;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20">
      <div className="bg-[#1e1e2e] border border-white/[0.1] rounded-lg shadow-2xl w-full max-w-2xl max-h-[70vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.1]">
          <div className="flex items-center gap-3">
            <SearchIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">
              {isSearching ? "Search Results" : "Recent Files"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/[0.1] rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-white/[0.1]">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search files by name, content, or description..."
              className="w-full pl-10 pr-4 py-2 bg-[#12121a] border border-white/[0.1] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
              autoFocus
            />
          </div>

          {/* Search Type Filter */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-gray-400">Filter:</span>
            {(["all", "files", "folders"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSearchType(type)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  searchType === type
                    ? "bg-blue-500 text-white"
                    : "bg-white/[0.1] text-gray-400 hover:text-gray-300"
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-96">
          {!filesToShow ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          ) : filesToShow.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <SearchIcon className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">
                {isSearching ? "No results found" : "No recent files"}
              </p>
              <p className="text-sm">
                {isSearching 
                  ? "Try different keywords or check your spelling"
                  : "Create some files to see them here"
                }
              </p>
            </div>
          ) : (
            <div className="p-2">
              {filesToShow.map((file) => (
                <div
                  key={file._id}
                  onClick={() => handleFileClick(file._id)}
                  className="flex items-center gap-3 p-3 hover:bg-white/[0.05] rounded-lg cursor-pointer transition-colors group"
                >
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
                    
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <FolderIcon className="w-3 h-3" />
                      <span className="truncate">
                        {file.path.split('/').slice(0, -1).join('/') || '/'}
                      </span>
                    </div>

                    {file.description && (
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {file.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <ClockIcon className="w-3 h-3" />
                    <span>
                      {new Date(file.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with shortcuts */}
        <div className="p-3 border-t border-white/[0.1] bg-[#12121a]">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span>↑↓ Navigate</span>
              <span>Enter Open</span>
              <span>Esc Close</span>
              <span>Ctrl+Shift+P Search</span>
            </div>
            <span>
              {filesToShow?.length || 0} results
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}