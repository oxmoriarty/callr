'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in dev — in production you'd send to Sentry/etc
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary]', error, info);
    }
  }

  override render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <p className="font-semibold text-text-primary mb-1">Something went wrong</p>
          <p className="text-sm text-text-muted mb-4">
            An unexpected error occurred. Your funds are safe.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
