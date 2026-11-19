import React, { useEffect, useRef, useState } from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';

interface UserAvatarMenuProps {
  user: {
    displayName: string;
    email: string;
  } | null;
  isSyncedOnline: boolean;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export const UserAvatarMenu: React.FC<UserAvatarMenuProps> = ({
  user,
  isSyncedOnline,
  onOpenAuth,
  onSignOut,
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [popoverOpen]);

  const initial = user?.displayName?.trim()?.charAt(0)?.toUpperCase() || '';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (user) {
            setPopoverOpen((prev) => !prev);
          } else {
            onOpenAuth();
          }
        }}
        aria-label={user ? `Account menu for ${user.displayName}` : 'Sign in to JANKENFIT'}
        aria-haspopup={user ? 'menu' : 'dialog'}
        aria-expanded={user ? popoverOpen : undefined}
        data-testid="user-avatar-button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C85A28] font-sans text-[15px] font-bold text-[#FDFBF7] transition-colors hover:bg-[#B04A1D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2EAD3]"
      >
        {user && initial ? (
          <span aria-hidden="true">{initial}</span>
        ) : (
          <UserIcon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        )}
      </button>

      {user && popoverOpen && (
        <div
          role="menu"
          aria-label="Account summary"
          data-testid="user-account-popover"
          className="absolute top-12 right-0 z-50 w-[240px] rounded-xl border border-[#EFE8DD] bg-[#FDFBF7] p-4 text-[#1F1916] shadow-xl"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#2B1B12]">{user.displayName}</p>
            <p className="mt-0.5 truncate text-xs text-[#6E5D52]">{user.email}</p>
          </div>

          <div className="mt-3 flex items-center gap-2 border-y border-[#EFE8DD] py-2.5 text-xs text-[#6E5D52]">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                isSyncedOnline ? 'bg-[#2D6A4F]' : 'bg-[#6E5D52]'
              }`}
              aria-hidden="true"
            />
            <span>{isSyncedOnline ? 'Synced • Mobile & Web' : 'Offline Mode'}</span>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setPopoverOpen(false);
              onSignOut();
            }}
            className="mt-3 inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-lg border border-[#EFE8DD] bg-[#F9F6EE] px-3 py-2 text-xs font-semibold text-[#2B1B12] transition-colors hover:border-[#C85A28] hover:text-[#C85A28]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};
