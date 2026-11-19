import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import {
  isFirebaseConfigured,
  registerWithEmail,
  signInWithEmail,
  signInWithGoogle,
  translateAuthError,
} from '../services/firebaseSync';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMessage(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setMode(nextMode);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isFirebaseConfigured) {
      setErrorMessage(
        'Cloud sync is unavailable in this build. Continue offline to save progress on this device.'
      );
      return;
    }

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (mode === 'signup' && !trimmedName) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await registerWithEmail(trimmedName, trimmedEmail, password);
      } else {
        await signInWithEmail(trimmedEmail, password);
      }
      setFullName('');
      setEmail('');
      setPassword('');
      onSuccess();
    } catch (err) {
      setErrorMessage(translateAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    if (!isFirebaseConfigured) {
      setErrorMessage(
        'Cloud sync is unavailable in this build. Continue offline to save progress on this device.'
      );
      return;
    }
    setSubmitting(true);
    try {
      await signInWithGoogle();
      onSuccess();
    } catch (err) {
      setErrorMessage(translateAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B1B12]/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-[380px] rounded-2xl border border-[#EFE8DD] bg-[#FDFBF7] p-6 shadow-2xl">
        {/* Top Row */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#C85A28]">JANKENFIT</p>
            <h2
              id="auth-modal-heading"
              className="mt-1 font-serif text-xl font-bold text-[#2B1B12]"
            >
              {mode === 'signin' ? 'Welcome Back' : 'Create Your Account'}
            </h2>
            <p className="mt-1 text-xs text-[#6E5D52]">
              {mode === 'signin'
                ? 'Sync your readiness, meals, and training across mobile and web.'
                : 'Sign up once to stay signed in and synced across devices.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close sign in dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6E5D52] transition-colors hover:bg-[#EFE8DD]/70 hover:text-[#2B1B12]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div
          role="tablist"
          aria-label="Authentication mode"
          className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-[#EFE8D8] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            onClick={() => switchMode('signin')}
            className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
              mode === 'signin'
                ? 'bg-[#C85A28] text-white shadow-xs'
                : 'text-[#6E5D52] hover:text-[#2B1B12]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => switchMode('signup')}
            className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
              mode === 'signup'
                ? 'bg-[#C85A28] text-white shadow-xs'
                : 'text-[#6E5D52] hover:text-[#2B1B12]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Email / Password Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5" noValidate>
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-full-name" className="block text-xs font-medium text-[#6E5D52]">
                Full Name
              </label>
              <input
                id="auth-full-name"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Rohan Verma"
                className="mt-1 min-h-[42px] w-full rounded-lg border border-[#EFE8DD] bg-[#F9F6EE] px-3 py-2 text-sm text-[#1F1916] placeholder:text-[#8E8174] focus:border-[#C85A28] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-[#6E5D52]">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
              className="mt-1 min-h-[42px] w-full rounded-lg border border-[#EFE8DD] bg-[#F9F6EE] px-3 py-2 text-sm text-[#1F1916] placeholder:text-[#8E8174] focus:border-[#C85A28] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-[#6E5D52]">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Minimum 6 characters' : 'Enter your password'}
                className="min-h-[42px] w-full rounded-lg border border-[#EFE8DD] bg-[#F9F6EE] py-2 pr-11 pl-3 text-sm text-[#1F1916] placeholder:text-[#8E8174] focus:border-[#C85A28] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#6E5D52] hover:text-[#2B1B12]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-lg border border-[#B91C1C]/25 bg-[#B91C1C]/8 px-3 py-2 text-xs font-medium text-[#B91C1C]"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#C85A28] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#B04A1D] disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {isFirebaseConfigured && (
          <div className="mt-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg border border-[#EFE8DD] bg-[#F9F6EE] px-4 py-2 text-xs font-semibold text-[#2B1B12] transition-colors hover:border-[#C85A28]/60 disabled:opacity-60"
            >
              Continue with Google
            </button>
          </div>
        )}

        {/* Optional Offline Guest Entry */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-xs font-medium text-[#6E5D52] underline-offset-2 transition-colors hover:text-[#2B1B12] hover:underline"
          >
            Continue without signing in
          </button>
        </div>
      </div>
    </div>
  );
};
