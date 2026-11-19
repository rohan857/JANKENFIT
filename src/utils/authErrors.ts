export function translateAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Please choose a stronger password with at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'No internet connection right now. You can continue offline and sign in later.';
    case 'auth/operation-not-allowed':
      return 'Email & password sign-in is not yet enabled on this workspace. You can use Google Sign-In or continue offline.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed before completing.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Please allow popups and try again.';
    default:
      return 'Unable to complete sign-in right now. Please try again.';
  }
}
