import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React ErrorBoundary yakaladı:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Önbellek temizlenemedi:', e);
    }
    // Ana sayfaya dön ve sayfayı yenile
    window.location.href = window.location.pathname;
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-black/[0.06] text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 mx-auto flex items-center justify-center mb-4 shadow-sm">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="text-2xl font-black text-[#1C1C1E] tracking-tight mb-2">
              Bir Sorun Oluştu
            </h1>
            <p className="text-sm text-[#8E8E93] font-medium mb-6 leading-relaxed">
              Sayfa yüklenirken beklenmeyen bir hata oluştu. Tarayıcı önbelleğinizi temizleyerek veya sayfayı yenileyerek devam edebilirsiniz.
            </p>

            {this.state.error && (
              <details className="text-left bg-rose-50/50 rounded-2xl p-3 mb-6 border border-rose-100 text-xs">
                <summary className="font-bold text-rose-700 cursor-pointer select-none">
                  Hata Detayı
                </summary>
                <div className="mt-2 text-rose-900 font-mono text-[11px] break-all whitespace-pre-wrap">
                  {this.state.error.toString()}
                </div>
              </details>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="ios-press w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-105 active:scale-[0.98] text-white font-bold py-3.5 px-6 rounded-2xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Sayfayı Yenile</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCache}
                className="ios-press w-full bg-rose-50 hover:bg-rose-100 active:scale-[0.98] text-rose-600 font-bold py-3 px-6 rounded-2xl border border-rose-200 flex items-center justify-center gap-2 transition-all text-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>Önbelleği Temizle & Sıfırla</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="ios-press w-full bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-gray-700 font-semibold py-2.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all text-xs"
              >
                <Home className="w-4 h-4" />
                <span>Giriş Ekranına Dönmeyi Dene</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
