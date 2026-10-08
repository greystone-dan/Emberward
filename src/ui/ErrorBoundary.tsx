import { Component, type ErrorInfo, type ReactNode } from 'react';
import { kvDel } from './save';

/**
 * The last line of defence for the demo: a render error shows a lit panel instead of a blank page,
 * with a way to reload or to drop the saved run (the one piece of state that outlives a reload).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ERROR RENDER', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const msg = String(this.state.error?.message ?? this.state.error).slice(0, 200);
    return (
      <div className="screen crash" data-testid="crash">
        <div className="overlay crash-panel">
          <h1 className="lost">The lantern gutters.</h1>
          <p>Something went wrong while drawing the screen. Reloading usually brings it back; starting fresh also drops the saved run.</p>
          <p className="crash-detail">{msg}</p>
          <div className="row">
            <button className="primary" onClick={() => window.location.reload()} data-testid="btn-crash-reload">
              Reload
            </button>
            <button
              onClick={() => {
                void kvDel('run.v1').finally(() => window.location.reload());
              }}
              data-testid="btn-crash-fresh"
            >
              Start fresh
            </button>
          </div>
        </div>
      </div>
    );
  }
}
