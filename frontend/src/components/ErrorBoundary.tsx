import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">🔄</div>
            <h1 className="text-lg font-semibold text-[#171717] mb-2">Something went wrong</h1>
            <p className="text-sm text-[#666] mb-4">{this.state.error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#171717] text-white rounded-md hover:bg-[#333]"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
