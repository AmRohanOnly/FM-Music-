import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3, Check } from 'lucide-react';

interface PlaylistRenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistId: string;
  currentName: string;
  onRename: (playlistId: string, newName: string) => void;
}

export function PlaylistRenameModal({
  isOpen,
  onClose,
  playlistId,
  currentName,
  onRename,
}: PlaylistRenameModalProps) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed !== currentName) {
      onRename(playlistId, trimmed);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md liquid-glass-strong rounded-3xl p-6 shadow-2xl border border-[var(--fm-glass-border)] space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[var(--fm-accent)]/15 text-[var(--fm-accent)] flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-[var(--fm-text)]">Rename Playlist</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--fm-text-muted)] mb-1.5">
              Playlist Title
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter new playlist name..."
              className="w-full h-12 px-4 rounded-xl liquid-glass-input text-[var(--fm-text)] placeholder-[var(--fm-text-muted)]/50 focus:outline-none focus:border-[var(--fm-accent)] text-sm transition-colors"
              maxLength={60}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || name.trim() === currentName}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-opacity"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
