import { useState } from 'react';

interface LoginPanelProps {
  isConfigured: boolean;
  onLogin: (email: string) => Promise<void>;
  onLogout: () => Promise<void>;
  userEmail: string | null;
}

export function LoginPanel({ isConfigured, onLogin, onLogout, userEmail }: LoginPanelProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await onLogin(trimmedEmail);
      setMessage('ログインリンクをメール送信しました。');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログインに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await onLogout();
      setMessage('ログアウトしました。');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログアウトに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel login-panel">
      <h2>ログイン</h2>
      {!isConfigured && (
        <p className="custom-reading-error">Supabase Auth の環境変数が未設定です。</p>
      )}

      {userEmail ? (
        <div className="login-row">
          <p className="custom-reading-help">ログイン中: {userEmail}</p>
          <button className="btn-secondary" onClick={handleLogout} disabled={loading}>
            ログアウト
          </button>
        </div>
      ) : (
        <div className="login-row">
          <input
            className="custom-reading-input"
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!isConfigured || loading}
          />
          <button className="btn-primary" onClick={handleLogin} disabled={!isConfigured || loading || !email.trim()}>
            {loading ? '送信中...' : 'メールでログイン'}
          </button>
        </div>
      )}

      {message && <p className="custom-reading-message">{message}</p>}
      {error && <p className="custom-reading-error">{error}</p>}
    </section>
  );
}
