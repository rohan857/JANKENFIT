import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error('Application error caught by boundary:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F9F6EE] p-6 text-[#1F1916]">
          <div className="w-full max-w-sm rounded-2xl border border-[#EFE8DD] bg-[#FDFBF7] p-6 text-center shadow-sm">
            <p className="text-xs font-semibold tracking-wide text-[#C85A28]">JANKENFIT</p>
            <h1 className="mt-2 font-serif text-xl font-bold text-[#2B1B12]">
              Something went wrong
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-[#6E5D52]">
              Your local wellness logs are safe. Reload the page to continue your session.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#C85A28] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B04A1D]"
            >
              Reload JANKENFIT
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
