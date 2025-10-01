"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { 
  FolderIcon, 
  FolderOpenIcon, 
  FileIcon, 
  PlusIcon, 
  TrashIcon,
  FolderPlusIcon,
  SearchIcon,
  SettingsIcon
} from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import InlineInput from "./InlineInput";

interface FileTreeProps {
  onFileSelect: (fileId: Id<"practiceFiles">) => void;
  selectedFileId?: Id<"practiceFiles">;
  onSearchOpen?: () => void;
  onOperationsOpen?: () => void;
}

export default function FileTree({ onFileSelect, selectedFileId, onSearchOpen, onOperationsOpen }: FileTreeProps) {
  const { user } = useUser();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'folder' | 'file' | 'root';
    id?: string;
  } | null>(null);
  
  // State for inline creation
  const [creatingItem, setCreatingItem] = useState<{
    type: 'folder' | 'file';
    parentId?: Id<"folders">;
  } | null>(null);

  // State for handling duplicate name errors
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // Mutations
  const createFolder = useMutation(api.folders.createFolder);
  const createFile = useMutation(api.files.createFile);
  const deleteFolder = useMutation(api.folders.deleteFolder);
  const deleteFile = useMutation(api.files.deleteFile);

  // Queries
  const folderTree = useQuery(
    api.folders.getFolderTree,
    user?.id ? { userId: user.id } : "skip"
  );

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'folder' | 'file' | 'root', id?: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      id,
    });
  };

  const handleCreateFolder = async (parentId?: Id<"folders">) => {
    if (!user?.id) return;
    
    setCreatingItem({ type: 'folder', parentId });
    setContextMenu(null);
  };

  const handleCreateFile = async (folderId?: Id<"folders">) => {
    if (!user?.id) return;
    
    setCreatingItem({ type: 'file', parentId: folderId });
    setContextMenu(null);
  };

  const handleCreateSave = async (name: string) => {
    if (!user?.id || !creatingItem) return;

    try {
      if (creatingItem.type === 'folder') {
        await createFolder({
          name,
          parentFolderId: creatingItem.parentId,
          userId: user.id,
        });
      } else {
        // Extract language from extension
        const extension = name.split('.').pop()?.toLowerCase() || 'txt';
        const languageMap: Record<string, string> = {
          'js': 'javascript',
          'ts': 'typescript',
          'py': 'python',
          'java': 'java',
          'cpp': 'cpp',
          'c': 'c',
          'go': 'go',
          'rs': 'rust',
          'html': 'html',
          'css': 'css',
        };
        const language = languageMap[extension] || 'javascript';

        const fileId = await createFile({
          name,
          language,
          folderId: creatingItem.parentId,
          userId: user.id,
        });
        onFileSelect(fileId);
      }
      setCreatingItem(null);
      setDuplicateError(null); // Clear any previous errors
    } catch (error) {
      console.error(`Failed to create ${creatingItem.type}:`, error);
      
      // Handle duplicate name error
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          // Show a visual error indicator - we'll add a state for this
          setDuplicateError(name);
          // Don't reset creatingItem, let user try again with different name
          return;
        }
      }
      
      // For other errors, cancel the creation
      setCreatingItem(null);
    }
  };

  const handleCreateCancel = () => {
    setCreatingItem(null);
    setDuplicateError(null); // Clear any duplicate errors
  };

  const handleDelete = async (type: 'folder' | 'file', id: string) => {
    if (!user?.id) return;
    
    const confirmMessage = type === 'folder' 
      ? "Delete this folder and all its contents?" 
      : "Delete this file?";
    
    if (!confirm(confirmMessage)) return;

    try {
      if (type === 'folder') {
        await deleteFolder({
          folderId: id as Id<"folders">,
          userId: user.id,
        });
      } else {
        await deleteFile({
          fileId: id as Id<"practiceFiles">,
          userId: user.id,
        });
      }
    } catch (error) {
      console.error(`Failed to delete ${type}:`, error);
      // You can add a toast notification here instead of alert
    }
    setContextMenu(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderFolder = (folder: any, depth = 0) => {
    const isExpanded = expandedFolders.has(folder._id);
    const paddingClass = depth === 0 ? 'pl-2' : depth === 1 ? 'pl-6' : depth === 2 ? 'pl-10' : 'pl-14';
    
    return (
      <div key={folder._id}>
        <div
          className={`flex items-center gap-2 px-2 py-1 hover:bg-[#ffffff08] cursor-pointer rounded text-sm ${paddingClass}`}
          onClick={() => toggleFolder(folder._id)}
          onContextMenu={(e) => handleContextMenu(e, 'folder', folder._id)}
        >
          {isExpanded ? (
            <FolderOpenIcon className="w-4 h-4 text-blue-400" />
          ) : (
            <FolderIcon className="w-4 h-4 text-blue-400" />
          )}
          <span className="text-gray-300">{folder.name}</span>
        </div>
        
        {isExpanded && (
          <div>
            {/* Files in this folder */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {folder.files?.map((file: any) => renderFile(file, depth + 1))}
            
            {/* Inline input for creating file in this folder */}
            {creatingItem && creatingItem.type === 'file' && creatingItem.parentId === folder._id && (
              <div className={`px-2 py-1 ${depth === 0 ? 'pl-6' : depth === 1 ? 'pl-10' : depth === 2 ? 'pl-14' : 'pl-18'}`}>
                <div className="flex items-center gap-2">
                  <FileIcon className="w-4 h-4 text-gray-400" />
                  <InlineInput
                    onSave={handleCreateSave}
                    onCancel={handleCreateCancel}
                    placeholder="filename.ext"
                    className="flex-1"
                    error={duplicateError?.includes('.') ? `File "${duplicateError}" already exists` : null}
                  />
                </div>
              </div>
            )}
            
            {/* Subfolders */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {folder.children?.map((subfolder: any) => renderFolder(subfolder, depth + 1))}
            
            {/* Inline input for creating folder in this folder */}
            {creatingItem && creatingItem.type === 'folder' && creatingItem.parentId === folder._id && (
              <div className={`px-2 py-1 ${depth === 0 ? 'pl-6' : depth === 1 ? 'pl-10' : depth === 2 ? 'pl-14' : 'pl-18'}`}>
                <div className="flex items-center gap-2">
                  <FolderIcon className="w-4 h-4 text-blue-400" />
                  <InlineInput
                    onSave={handleCreateSave}
                    onCancel={handleCreateCancel}
                    placeholder="Folder name"
                    className="flex-1"
                    error={duplicateError && !duplicateError.includes('.') ? `Folder "${duplicateError}" already exists` : null}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderFile = (file: any, depth = 0) => {
    const isSelected = selectedFileId === file._id;
    const paddingClass = depth === 0 ? 'pl-2' : depth === 1 ? 'pl-6' : depth === 2 ? 'pl-10' : 'pl-14';
    
    return (
      <div
        key={file._id}
        className={`flex items-center gap-2 px-2 py-1 hover:bg-[#ffffff08] cursor-pointer rounded text-sm ${paddingClass} ${
          isSelected ? 'bg-[#ffffff15]' : ''
        }`}
        onClick={() => onFileSelect(file._id)}
        onContextMenu={(e) => handleContextMenu(e, 'file', file._id)}
      >
        <FileIcon className="w-4 h-4 text-gray-400" />
        <span className="text-gray-300">{file.name}</span>
        <span className="text-xs text-gray-500 ml-auto">{file.language}</span>
      </div>
    );
  };

  if (!folderTree) {
    return (
      <div className="w-64 bg-[#12121a] border-r border-white/[0.05] p-4">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="w-64 bg-[#12121a] border-r border-white/[0.05] flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.05]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-white">Explorer</h3>
            <div className="flex gap-1">
              <button
                onClick={onSearchOpen}
                className="p-1 hover:bg-[#ffffff08] rounded"
                title="Search Files"
              >
                <SearchIcon className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={onOperationsOpen}
                className="p-1 hover:bg-[#ffffff08] rounded"
                title="File Operations"
              >
                <SettingsIcon className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => handleCreateFile()}
                className="p-1 hover:bg-[#ffffff08] rounded"
                title="New File"
              >
                <PlusIcon className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => handleCreateFolder()}
                className="p-1 hover:bg-[#ffffff08] rounded"
                title="New Folder"
              >
                <FolderPlusIcon className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Root files */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {folderTree.files?.map((file: any) => renderFile(file))}
          
          {/* Inline input for creating file at root */}
          {creatingItem && creatingItem.type === 'file' && !creatingItem.parentId && (
            <div className="px-2 py-1 pl-2">
              <div className="flex items-center gap-2">
                <FileIcon className="w-4 h-4 text-gray-400" />
                <InlineInput
                  onSave={handleCreateSave}
                  onCancel={handleCreateCancel}
                  placeholder="filename.ext"
                  className="flex-1"
                  error={duplicateError?.includes('.') ? `File "${duplicateError}" already exists` : null}
                />
              </div>
            </div>
          )}
          
          {/* Root folders */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {folderTree.folders?.map((folder: any) => renderFolder(folder))}
          
          {/* Inline input for creating folder at root */}
          {creatingItem && creatingItem.type === 'folder' && !creatingItem.parentId && (
            <div className="px-2 py-1 pl-2">
              <div className="flex items-center gap-2">
                <FolderIcon className="w-4 h-4 text-blue-400" />
                <InlineInput
                  onSave={handleCreateSave}
                  onCancel={handleCreateCancel}
                  placeholder="Folder name"
                  className="flex-1"
                  error={duplicateError && !duplicateError.includes('.') ? `Folder "${duplicateError}" already exists` : null}
                />
              </div>
            </div>
          )}
          
          {folderTree.files?.length === 0 && folderTree.folders?.length === 0 && !creatingItem && (
            <div className="text-gray-500 text-xs p-4 text-center">
              No files yet. Create your first file or folder!
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-[#1e1e2e] border border-white/[0.1] rounded-lg shadow-lg py-1 z-50"
          ref={(el) => {
            if (el && typeof window !== 'undefined') {
              el.style.left = `${Math.min(contextMenu.x, window.innerWidth - 200)}px`;
              el.style.top = `${Math.min(contextMenu.y, window.innerHeight - 200)}px`;
            }
          }}
          onMouseLeave={() => setContextMenu(null)}
        >
          {contextMenu.type === 'root' && (
            <>
              <button
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-[#ffffff08] flex items-center gap-2"
                onClick={() => handleCreateFile()}
              >
                <PlusIcon className="w-4 h-4" />
                New File
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-[#ffffff08] flex items-center gap-2"
                onClick={() => handleCreateFolder()}
              >
                <FolderPlusIcon className="w-4 h-4" />
                New Folder
              </button>
            </>
          )}
          
          {contextMenu.type === 'folder' && (
            <>
              <button
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-[#ffffff08] flex items-center gap-2"
                onClick={() => handleCreateFile(contextMenu.id as Id<"folders">)}
              >
                <PlusIcon className="w-4 h-4" />
                New File
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-[#ffffff08] flex items-center gap-2"
                onClick={() => handleCreateFolder(contextMenu.id as Id<"folders">)}
              >
                <FolderPlusIcon className="w-4 h-4" />
                New Folder
              </button>
              <hr className="border-white/[0.1] my-1" />
              <button
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-[#ffffff08] flex items-center gap-2"
                onClick={() => handleDelete('folder', contextMenu.id!)}
              >
                <TrashIcon className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
          
          {contextMenu.type === 'file' && (
            <>
              <button
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-[#ffffff08] flex items-center gap-2"
                onClick={() => handleDelete('file', contextMenu.id!)}
              >
                <TrashIcon className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}