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
    <div style={{ maxWidth: '400px', width: '100%', margin: '20px auto', padding: '24px 20px', border: '1px solid #e2e8f0', borderRadius: '16px', backgroundColor: '#fff', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>
      <h3 style={{ textAlign: 'center', margin: '0 0 20px 0', fontSize: '1.25rem', color: '#1e293b' }}>Đăng nhập hệ thống</h3>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input type="text" placeholder="Username hoặc Email" value={id} onChange={e => setId(e.target.value)} style={inputStyle} required />
        <input type="password" placeholder="Mật khẩu" value={pw} onChange={e => setPw(e.target.value)} style={inputStyle} required />
        {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>{error}</p>}
        <button disabled={loading} style={{ ...btnStyle, backgroundColor: loading ? '#94a3b8' : '#2563eb' }}>{loading ? 'Đang xử lý...' : 'Đăng nhập'}</button>
      </form>
    </div>
  );
};

const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: '#f8fafc', boxSizing: 'border-box' as const };
const btnStyle = { width: '100%', padding: '12px', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '15px' };

export default LoginForm;