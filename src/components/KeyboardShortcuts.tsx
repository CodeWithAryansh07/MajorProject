"use client";

import { useEffect } from "react";

interface KeyboardShortcutsProps {
  onSearchOpen: () => void;
  onOperationsOpen: () => void;
}

export default function KeyboardShortcuts({ onSearchOpen, onOperationsOpen }: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+P or Cmd+Shift+P for search
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'P') {
        event.preventDefault();
        onSearchOpen();
      }
      
      // Ctrl+Shift+O or Cmd+Shift+O for operations
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'O') {
        event.preventDefault();
        onOperationsOpen();
      }

      // Escape to close modals
      if (event.key === 'Escape') {
        // This will be handled by individual components
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSearchOpen, onOperationsOpen]);

  return null; // This component doesn't render anything
}