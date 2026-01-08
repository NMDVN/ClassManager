import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ShieldAlert, 
  RefreshCw, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown
} from 'lucide-react';

interface AdminToolsProps {
  onUpdate: () => void;
}

const AdminTools: React.FC<AdminToolsProps> = ({ onUpdate }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [targetWeek, setTargetWeek] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleRebuild = async () => {
    if (!window.confirm(`Bạn có chắc muốn TÍNH TOÁN LẠI TOÀN BỘ điểm tuần ${targetWeek}?`)) return;
    setIsProcessing(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('rebuild_weekly_scores', { p_week: targetWeek });
      if (error) throw error;
      setMessage({ type: 'success', text: `Đã cập nhật lại điểm tuần ${targetWeek}!` });
      onUpdate();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteWeeklyScore = async () => {
    if (!window.confirm(`CẢNH BÁO NGUY HIỂM: Xóa vĩnh viễn dữ liệu điểm tuần ${targetWeek}?`)) return;
    setIsProcessing(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('delete_weekly_score_by_week', { n: targetWeek });
      if (error) throw error;
      setMessage({ type: 'success', text: `Đã xóa sạch dữ liệu điểm tuần ${targetWeek}!` });
      onUpdate();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ ...styles.card, marginBottom: isMinimized ? '12px' : '24px' }}>
      {/* HEADER - Click để đóng/mở */}
      <div style={styles.header} onClick={() => setIsMinimized(!isMinimized)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={20} color="#4f46e5" fill="#4f46e520" />
          <h3 style={styles.title}>Quản trị viên (SuperAdmin)</h3>
        </div>
        <div style={{ ...styles.minimizeBtn, transform: isMinimized ? 'rotate(0deg)' : 'rotate(180deg)' }}>
          <ChevronDown size={20} />
        </div>
      </div>

      {/* BODY - Hiệu ứng trượt mượt mà */}
      <div style={{ 
        ...styles.collapsibleBody, 
        gridTemplateRows: isMinimized ? '0fr' : '1fr',
        opacity: isMinimized ? 0 : 1,
      }}>
        <div style={{ minHeight: 0 }}>
          <div style={styles.bodyInner}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Tuần thực hiện:</label>
              <input 
                type="number" 
                value={targetWeek} 
                onChange={(e) => setTargetWeek(parseInt(e.target.value) || 1)}
                style={styles.input}
                min={1}
                onClick={(e) => e.stopPropagation()} // Tránh việc bấm vào input mà lại thu gọn card
              />
            </div>

            <div style={styles.actions}>
              <button 
                onClick={(e) => { e.stopPropagation(); handleRebuild(); }} 
                disabled={isProcessing}
                style={{ ...styles.btn, ...styles.btnRebuild }}
              >
                {isProcessing ? <RefreshCw size={16} className="spin" /> : <RefreshCw size={16} />}
                Rebuild
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteWeeklyScore(); }} 
                disabled={isProcessing}
                style={{ ...styles.btn, ...styles.btnDelete }}
              >
                <Trash2 size={16} />
                Xóa điểm
              </button>
            </div>

            {message && (
              <div style={message.type === 'success' ? styles.successMsg : styles.errorMsg}>
                {message.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {message.text}
              </div>
            )}

            <div style={styles.warningBox}>
              <AlertTriangle size={14} color="#b45309" />
              <span>Cẩn trọng: Các thao tác này sẽ thay đổi dữ liệu vĩnh viễn.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: any = {
  card: { 
    background: '#ffffff', 
    borderRadius: '20px', 
    border: '1px solid #e2e8f0', 
    boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
    overflow: 'hidden'
  },
  header: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: '18px 24px',
    cursor: 'pointer',
    userSelect: 'none',
    background: '#fff',
  },
  title: { 
    margin: 0, 
    fontSize: '15px', 
    fontWeight: '800', 
    color: '#1e293b',
    textTransform: 'uppercase', 
    letterSpacing: '0.5px' 
  },
  minimizeBtn: { 
    color: '#94a3b8', 
    transition: 'transform 0.4s ease',
    display: 'flex',
    alignItems: 'center'
  },
  collapsibleBody: {
    display: 'grid',
    transition: 'all 0.4s ease-in-out',
  },
  bodyInner: { 
    padding: '0 24px 24px 24px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '18px' 
  },
  inputGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
  label: { fontSize: '13px', fontWeight: '700', color: '#64748b' },
  input: { 
    width: '65px', 
    padding: '10px', 
    borderRadius: '12px', 
    border: '2px solid #f1f5f9', 
    textAlign: 'center', 
    fontWeight: '800', 
    fontSize: '15px',
    outline: 'none',
    color: '#4f46e5',
    background: '#f8fafc'
  },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  btn: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: '8px', 
    padding: '14px', 
    borderRadius: '14px', 
    border: 'none', 
    cursor: 'pointer', 
    fontWeight: '700', 
    fontSize: '13px', 
    transition: 'all 0.2s' 
  },
  btnRebuild: { 
    background: '#4f46e5', 
    color: '#fff',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)' 
  },
  btnDelete: { 
    background: '#fef2f2', 
    color: '#ef4444', 
    border: '1px solid #fee2e2' 
  },
  warningBox: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px', 
    padding: '12px', 
    background: '#fffbeb', 
    borderRadius: '12px', 
    fontSize: '12px', 
    color: '#b45309', 
    fontWeight: '600' 
  },
  successMsg: { 
    padding: '12px', 
    borderRadius: '12px', 
    background: '#f0fdf4', 
    color: '#166534', 
    fontSize: '13px', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px',
    border: '1px solid #dcfce7'
  },
  errorMsg: { 
    padding: '12px', 
    borderRadius: '12px', 
    background: '#fef2f2', 
    color: '#991b1b', 
    fontSize: '13px', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px',
    border: '1px solid #fee2e2'
  },
};

export default AdminTools;