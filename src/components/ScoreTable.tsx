import React, { useMemo, useState, useCallback, useEffect } from 'react';
import Select from 'react-select';
import { supabase } from '../lib/supabase';

// --- Interfaces ---
interface Score {
  student_id: number;
  week: number;
  final_point: number;
  student?: { name: string };
}

interface OffenceLog {
  id: number;
  student_id: number | null;
  week: number | null;
  day: string;
  sub_id?: string | null;
  period_id?: string | null;
  session_id?: string | null;
  student?: { name: string };
  offence?: {
    name: string;
    deducted_point: number;
  };
}

interface Props {
  scores: Score[];
  offences: OffenceLog[];
  loading: boolean;
  role: string | null;
  sessionId: string | null;
  refreshData: () => void;
}

const ScoreTable: React.FC<Props> = ({
  scores,
  offences,
  loading,
  role,
  sessionId,
  refreshData,
}) => {
  const [tab, setTab] = useState<'score' | 'bonus' | 'penalty'>('score');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State lưu danh mục tên môn và buổi
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<Record<string, string>>({});

  const isAdmin = useMemo(() => role === 'admin' || role === 'superadmin', [role]);

  // Fetch danh mục để lấy tên
  useEffect(() => {
    const fetchMasters = async () => {
      const [subRes, sesRes] = await Promise.all([
        supabase.from('subject').select('id, name'),
        supabase.from('session').select('id, name')
      ]);

      if (subRes.data) {
        const subMap = subRes.data.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.name }), {});
        setSubjects(subMap);
      }
      if (sesRes.data) {
        const sesMap = sesRes.data.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.name }), {});
        setSessions(sesMap);
      }
    };
    fetchMasters();
  }, []);

  const getDayOfWeek = useCallback((dateString: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString.replace(/-/g, '/'));
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return isNaN(date.getTime()) ? '—' : days[date.getDay()];
  }, []);

  const formatDelta = useCallback((val: number) => {
    if (val === 0) return { text: '0', color: '#64748b' };
    return val > 0 
      ? { text: `-${val}`, color: '#ef4444' } 
      : { text: `+${Math.abs(val)}`, color: '#10b981' };
  }, []);

  const weekOptions = useMemo(() => {
    const weeks = Array.from(new Set([...scores.map(s => s.week), ...offences.map(o => o.week ?? 0)]))
      .filter(w => w > 0)
      .sort((a, b) => b - a);
    return weeks.map(w => ({ value: w, label: `Tuần ${w}` }));
  }, [scores, offences]);

  const deltaPointMap = useMemo(() => {
    const map = new Map<string, number>();
    offences.forEach(o => {
      if (!o.student_id || !o.week) return;
      const key = `${o.student_id}-${o.week}`;
      map.set(key, (map.get(key) || 0) + (o.offence?.deducted_point ?? 0));
    });
    return map;
  }, [offences]);

  const processedScores = useMemo(() => {
    let result = selectedWeek ? scores.filter(s => s.week === selectedWeek) : [...scores];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.student?.name.toLowerCase().includes(q));
    }
    return result.map(s => ({
      ...s,
      delta_point: deltaPointMap.get(`${s.student_id}-${s.week}`) || 0,
    })).sort((a, b) => (a.student_id > b.student_id ? 1 : -1));
  }, [scores, selectedWeek, deltaPointMap, searchQuery]);

  const filteredDetails = useMemo(() => {
    let result = selectedWeek ? offences.filter(o => o.week === selectedWeek) : [...offences];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => o.student?.name.toLowerCase().includes(q));
    }
    if (tab === 'bonus') return result.filter(o => (o.offence?.deducted_point ?? 0) < 0);
    if (tab === 'penalty') return result.filter(o => (o.offence?.deducted_point ?? 0) > 0);
    return [];
  }, [offences, selectedWeek, searchQuery, tab]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa?')) return;
    const { error } = await supabase.rpc('delete_offence', { p_id: id, p_user: sessionId, p_role: role });
    if (error) alert('Lỗi: ' + error.message);
    else refreshData();
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>📊 HỆ THỐNG THEO DÕI THI ĐUA</h2>
        <div style={styles.tabGroup}>
          <button onClick={() => setTab('score')} style={tab === 'score' ? styles.tabActive : styles.tabInactive}>Bảng Tổng Hợp</button>
          <button onClick={() => setTab('bonus')} style={tab === 'bonus' ? styles.tabActive : styles.tabInactive}>Chi Tiết Cộng</button>
          <button onClick={() => setTab('penalty')} style={tab === 'penalty' ? styles.tabActive : styles.tabInactive}>Chi Tiết Trừ</button>
        </div>
      </header>

      <div style={styles.filterBar}>
        <div style={{ width: '150px' }}>
          <Select
            options={weekOptions}
            value={weekOptions.find(w => w.value === selectedWeek) || null}
            onChange={opt => setSelectedWeek(opt?.value ?? null)}
            isClearable
            placeholder="📅 Tuần"
          />
        </div>
        <input
          type="text"
          placeholder="🔍 Tìm tên học sinh..."
          style={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div style={styles.card}>
        {loading ? (
          <div style={styles.loading}>Đang tải dữ liệu...</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.theadRow}>
                  {tab === 'score' ? (
                    <>
                      <th style={styles.th}>Học sinh</th>
                      <th style={styles.th}>Tuần</th>
                      <th style={styles.th}>Biến động (Hiệu số)</th>
                      <th style={styles.th}>Điểm hiện tại</th>
                    </>
                  ) : (
                    <>
                      {isAdmin && <th style={styles.th}>Xử lý</th>}
                      <th style={styles.th}>Học sinh</th>
                      <th style={styles.th}>Nội dung</th>
                      <th style={styles.th}>Điểm</th>
                      <th style={styles.th}>Thứ</th>
                      <th style={styles.th}>Ngày</th>
                      <th style={styles.th}>Môn</th>
                      <th style={styles.th}>Tiết</th>
                      <th style={styles.th}>Buổi</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {tab === 'score' ? (
                  processedScores.map(s => {
                    const delta = formatDelta(s.delta_point);
                    return (
                      <tr key={`${s.student_id}-${s.week}`} style={styles.tr}>
                        <td style={styles.td}><strong>{s.student?.name}</strong></td>
                        <td style={styles.td}>Tuần {s.week}</td>
                        <td style={{ ...styles.td, color: delta.color, fontWeight: 'bold' }}>{delta.text}</td>
                        <td style={{ ...styles.td, fontWeight: 'bold', fontSize: '1rem' }}>{s.final_point}</td>
                      </tr>
                    );
                  })
                ) : (
                  filteredDetails.map(o => (
                    <tr key={o.id} style={styles.tr}>
                      {isAdmin && (
                        <td style={styles.td}>
                          <button onClick={() => handleDelete(o.id)} style={styles.deleteBtn}>🗑</button>
                        </td>
                      )}
                      <td style={styles.td}>{o.student?.name}</td>
                      <td style={styles.td}>{o.offence?.name}</td>
                      <td style={{ ...styles.td, color: (o.offence?.deducted_point ?? 0) > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                        {formatDelta(o.offence?.deducted_point ?? 0).text}
                      </td>
                      <td style={{ ...styles.td, color: '#4f46e5', fontWeight: '600' }}>{getDayOfWeek(o.day)}</td>
                      <td style={styles.td}>{o.day}</td>
                      {/* Hiển thị tên Môn thay vì ID */}
                      <td style={styles.td}>{o.sub_id ? (subjects[o.sub_id] || o.sub_id) : '—'}</td>
                      <td style={styles.td}>{o.period_id || '—'}</td>
                      {/* Hiển thị tên Buổi thay vì ID */}
                      <td style={styles.td}>{o.session_id ? (sessions[o.session_id] || o.session_id) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  header: { marginBottom: '20px', textAlign: 'center' },
  title: { fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '15px' },
  tabGroup: { display: 'flex', gap: '5px', background: '#f1f5f9', padding: '5px', borderRadius: '10px' },
  tabActive: { flex: 1, padding: '10px', border: 'none', background: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  tabInactive: { flex: 1, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' },
  filterBar: { display: 'flex', gap: '10px', marginBottom: '15px' },
  searchInput: { flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' },
  card: { background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  theadRow: { background: '#f8fafc' },
  th: { padding: '12px', textAlign: 'left', color: '#475569', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px', color: '#334155', whiteSpace: 'nowrap' },
  deleteBtn: { color: '#ef4444', background: '#fee2e2', border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer' },
  loading: { padding: '50px', textAlign: 'center', color: '#64748b' }
};

export default ScoreTable;