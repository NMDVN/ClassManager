import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onLoginSuccess: () => void;
}

const LoginForm: React.FC<Props> = ({ onLoginSuccess }) => {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const email = id.includes('@') ? id : `${id}@school.local`;

    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: pw });

    if (authErr) {
      setError('Sai tài khoản hoặc mật khẩu');
      setLoading(false);
    } else {
      onLoginSuccess();
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '20px auto', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
      <h3 style={{ textAlign: 'center' }}>Đăng nhập hệ thống</h3>
      <form onSubmit={handleLogin}>
        <input type="text" placeholder="Username hoặc Email" value={id} onChange={e => setId(e.target.value)} style={inputStyle} required />
        <input type="password" placeholder="Mật khẩu" value={pw} onChange={e => setPw(e.target.value)} style={inputStyle} required />
        {error && <p style={{ color: 'red', fontSize: '13px' }}>{error}</p>}
        <button disabled={loading} style={btnStyle}>{loading ? 'Đang xử lý...' : 'Đăng nhập'}</button>
      </form>
    </div>
  );
};

const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' as const };
const btnStyle = { width: '100%', padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };

export default LoginForm;