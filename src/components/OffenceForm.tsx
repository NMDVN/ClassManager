import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import Select from 'react-select';

// --- Types ---
type StatusType = 'info' | 'success' | 'error' | '';

interface ListsState {
  student: any[];
  offence_catalog: any[];
  period: any[];
  session: any[];
  subject: any[];
  week: any[];
}

interface OffenceFormProps {
  onUpdate?: () => Promise<void>;
}

const OffenceForm: React.FC<OffenceFormProps> = ({ onUpdate }) => {
  // --- States ---
  const [lists, setLists] = useState<ListsState>({
    student: [],
    offence_catalog: [],
    period: [],
    session: [],
    subject: [],
    week: []
  });

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: StatusType; msg: string }>({
    type: '',
    msg: ''
  });

  const [form, setForm] = useState({
    student_id: '',
    offence_id: '',
    sub_id: '',
    period_id: '',
    session_id: '',
    week: 0,
    day: new Date().toISOString().split('T')[0]
  });

  // --- Fetch Master Data ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [st, ca, pe, se, su, we] = await Promise.all([
          // Sắp xếp học sinh theo ID (theo yêu cầu của bạn)
          supabase.from('student').select('id, name, class').order('id', { ascending: true }),
          supabase.from('offence_catalog').select('id, name, deducted_point').order('name'),
          supabase.from('period').select('id, name').order('id'),
          supabase.from('session').select('id, name').order('id'),
          supabase.from('subject').select('id, name').order('name'),
          supabase.from('week').select('week').order('week')
        ]);

        if (st.error || ca.error || pe.error || se.error || su.error || we.error) {
          throw new Error('Không thể tải danh mục dữ liệu');
        }

        setLists({
          student: st.data ?? [],
          offence_catalog: ca.data ?? [],
          period: pe.data ?? [],
          session: se.data ?? [],
          subject: su.data ?? [],
          week: we.data ?? []
        });
      } catch (err: any) {
        setStatus({ type: 'error', msg: err.message });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- Prepare Options for Select ---
  const studentOptions = useMemo(() => 
    lists.student.map(s => ({ value: s.id, label: `${s.name} - Lớp ${s.class}` })), 
  [lists.student]);

  const offenceOptions = useMemo(() => 
    lists.offence_catalog.map(c => ({ 
      value: c.id, 
      label: `${c.name} (${c.deducted_point > 0 ? '-' : '+'}${Math.abs(c.deducted_point)}đ)` 
    })), 
  [lists.offence_catalog]);

  // --- Handlers ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_id || !form.offence_id || form.week === 0) {
      setStatus({ type: 'error', msg: 'Vui lòng điền đầy đủ thông tin bắt buộc.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: 'info', msg: 'Đang gửi dữ liệu...' });

    const { error } = await supabase.from('offence_log').insert([form]);

    if (error) {
      setStatus({ type: 'error', msg: 'Lỗi: ' + error.message });
    } else {
      setStatus({ type: 'success', msg: '✅ Ghi nhận thành công!' });
      if (onUpdate) await onUpdate();
      setForm(prev => ({
        ...prev,
        student_id: '',
        offence_id: '',
        sub_id: '',
        period_id: '',
        session_id: ''
      }));
    }
    setIsSubmitting(false);
  };

  if (loading) return <div style={loadingStyle}>⏳ Đang tải dữ liệu hệ thống...</div>;

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h3 style={headerStyle}>📝 NHẬP LIỆU THI ĐUA</h3>

        <form onSubmit={handleSubmit} style={formStyle}>
          {/* HỌC SINH (Sắp xếp theo ID) */}
          <div style={fieldGroup}>
            <label style={labelStyle}>Học sinh <span style={{ color: '#ef4444' }}>*</span></label>
            <Select
              options={studentOptions}
              placeholder="Tìm tên học sinh..."
              isSearchable
              value={studentOptions.find(o => o.value === form.student_id) || null}
              onChange={(opt: any) => setForm({ ...form, student_id: opt?.value || '' })}
              styles={customSelectStyles}
            />
          </div>

          {/* NỘI DUNG VI PHẠM / CỘNG ĐIỂM */}
          <div style={fieldGroup}>
            <label style={labelStyle}>Nội dung vi phạm/cộng <span style={{ color: '#ef4444' }}>*</span></label>
            <Select
              options={offenceOptions}
              placeholder="Chọn nội dung..."
              isSearchable
              value={offenceOptions.find(o => o.value === form.offence_id) || null}
              onChange={(opt: any) => setForm({ ...form, offence_id: opt?.value || '' })}
              styles={customSelectStyles}
            />
          </div>

          <div style={gridStyle}>
            {/* MÔN HỌC */}
            <div style={fieldGroup}>
              <label style={labelStyle}>Môn học</label>
              <select style={inputStyle} value={form.sub_id} onChange={e => setForm({ ...form, sub_id: e.target.value })} required>
                <option value="">-- Môn --</option>
                {lists.subject.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>

            {/* TIẾT HỌC */}
            <div style={fieldGroup}>
              <label style={labelStyle}>Tiết học</label>
              <select style={inputStyle} value={form.period_id} onChange={e => setForm({ ...form, period_id: e.target.value })} required>
                <option value="">-- Tiết --</option>
                {lists.period.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
          </div>

          <div style={gridStyle}>
            {/* BUỔI */}
            <div style={fieldGroup}>
              <label style={labelStyle}>Buổi</label>
              <select style={inputStyle} value={form.session_id} onChange={e => setForm({ ...form, session_id: e.target.value })} required>
                <option value="">-- Buổi --</option>
                {lists.session.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>

            {/* TUẦN */}
            <div style={fieldGroup}>
              <label style={labelStyle}>Tuần</label>
              <select style={inputStyle} value={form.week} onChange={e => setForm({ ...form, week: Number(e.target.value) })} required>
                <option value={0}>-- Tuần --</option>
                {lists.week.map(x => <option key={x.week} value={x.week}>Tuần {x.week}</option>)}
              </select>
            </div>
          </div>

          {/* NGÀY */}
          <div style={fieldGroup}>
            <label style={labelStyle}>Ngày ghi nhận</label>
            <input type="date" style={inputStyle} value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} required />
          </div>

          <button type="submit" disabled={isSubmitting} style={{ 
            ...btnStyle, 
            backgroundColor: isSubmitting ? '#94a3b8' : '#2563eb' 
          }}>
            {isSubmitting ? 'ĐANG LƯU...' : 'XÁC NHẬN GỬI'}
          </button>

          {status.msg && (
            <div style={{
              ...statusBox,
              backgroundColor: status.type === 'error' ? '#fef2f2' : (status.type === 'success' ? '#f0fdf4' : '#eff6ff'),
              color: status.type === 'error' ? '#dc2626' : (status.type === 'success' ? '#16a34a' : '#2563eb'),
              border: `1px solid ${status.type === 'error' ? '#fecaca' : '#bbf7d0'}`
            }}>
              {status.msg}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

// --- Styles ---
const containerStyle: React.CSSProperties = { maxWidth: '600px', margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' };
const cardStyle: React.CSSProperties = { backgroundColor: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9' };
const headerStyle: React.CSSProperties = { margin: '0 0 25px 0', textAlign: 'center', color: '#1e293b', fontSize: '1.4rem', fontWeight: 700 };
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '18px' };
const fieldGroup: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px' };
const labelStyle: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#475569' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: '#f8fafc', boxSizing: 'border-box' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
const btnStyle: React.CSSProperties = { marginTop: '10px', padding: '14px', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '16px', transition: '0.2s' };
const statusBox: React.CSSProperties = { marginTop: '10px', padding: '12px', borderRadius: '8px', textAlign: 'center', fontSize: '14px', fontWeight: 500 };
const loadingStyle: React.CSSProperties = { textAlign: 'center', padding: '100px', color: '#64748b' };

const customSelectStyles = {
  control: (base: any) => ({ ...base, borderRadius: '8px', borderColor: '#cbd5e1', backgroundColor: '#f8fafc', padding: '2px', boxShadow: 'none' }),
  option: (base: any, state: any) => ({ ...base, fontSize: '14px', backgroundColor: state.isFocused ? '#eff6ff' : '#fff', color: state.isFocused ? '#2563eb' : '#1e293b' })
};

export default OffenceForm;