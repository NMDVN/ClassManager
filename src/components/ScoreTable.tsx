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

const dayNameCache = new Map<string, string>();

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
  const [sortBy, setSortBy] = useState<'id' | 'point'>('point');
  
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<Record<string, string>>({});

  const isAdmin = useMemo(() => role === 'admin' || role === 'superadmin', [role]);

  useEffect(() => {
    const fetchMasters = async () => {
      const [subRes, sesRes] = await Promise.all([
        supabase.from('subject').select('id, name'),
        supabase.from('session').select('id, name')
      ]);

      if (subRes.data) {
        const subMap: Record<string, string> = {};
        subRes.data.forEach(curr => { subMap[curr.id] = curr.name; });
        setSubjects(subMap);
      }
      if (sesRes.data) {
        const sesMap: Record<string, string> = {};
        sesRes.data.forEach(curr => { sesMap[curr.id] = curr.name; });
        setSessions(sesMap);
      }
    };
    fetchMasters();
  }, []);

  const getDayOfWeek = useCallback((dateString: string) => {
    if (!dateString) return '—';
    const cached = dayNameCache.get(dateString);
    if (cached !== undefined) return cached;

    const date = new Date(dateString.replace(/-/g, '/'));
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const res = isNaN(date.getTime()) ? '—' : days[date.getDay()];
    dayNameCache.set(dateString, res);
    return res;
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

  const sortOptions = [
    { value: 'point', label: 'Sắp xếp: Điểm số' },
    { value: 'id', label: 'Sắp xếp: Tên' },
  ];

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

    const mapped = result.map(s => ({
      ...s,
      delta_point: deltaPointMap.get(`${s.student_id}-${s.week}`) || 0,
    }));

    if (sortBy === 'point') {
      mapped.sort((a, b) => b.final_point - a.final_point);
      // Thuật toán Standard Competition Ranking (1, 2, 2, 4...)
      let currentRank = 1;
      return mapped.map((s, i, arr) => {
        if (i > 0 && s.final_point < arr[i - 1].final_point) {
          currentRank = i + 1;
        }
        return { ...s, displayRank: currentRank };
      });
    } else {
      mapped.sort((a, b) => a.student_id - b.student_id);
      return mapped.map((s, i) => ({ ...s, displayRank: i + 1 }));
    }
  }, [scores, selectedWeek, deltaPointMap, searchQuery, sortBy]);

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

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.rpc('delete_offence', { p_id: deleteConfirmId, p_user: sessionId, p_role: role });
    setIsDeleting(false);
    if (error) {
      setDeleteError('Lỗi: ' + error.message);
    } else {
      setDeleteConfirmId(null);
      refreshData();
    }
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
        <div style={{ flex: '1 1 130px', minWidth: '120px' }}>
          <Select
            options={weekOptions}
            value={weekOptions.find(w => w.value === selectedWeek) || null}
            onChange={opt => setSelectedWeek(opt?.value ?? null)}
            isClearable
            placeholder="📅 Tuần"
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            menuPosition="fixed"
            styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
          />
        </div>
        
        {tab === 'score' && (
          <div style={{ flex: '1 1 160px', minWidth: '140px' }}>
            <Select
              options={sortOptions}
              value={sortOptions.find(o => o.value === sortBy)}
              onChange={opt => setSortBy(opt?.value === 'id' ? 'id' : 'point')}
              isSearchable={false}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              menuPosition="fixed"
              styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
            />
          </div>
        )}

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
                      <th style={{ ...styles.th, width: '60px', textAlign: 'center' }}>
                        {sortBy === 'point' ? 'Hạng' : 'STT'}
                      </th>
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
                  processedScores.map((s) => {
                    const delta = formatDelta(s.delta_point);
                    return (
                      <tr key={`${s.student_id}-${s.week}`} style={styles.tr}>
                        <td style={{ ...styles.td, textAlign: 'center', color: sortBy === 'point' ? '#1e293b' : '#94a3b8', fontWeight: sortBy === 'point' ? 'bold' : 'normal' }}>
                          {s.displayRank}
                        </td>
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
                          <button onClick={() => { setDeleteError(null); setDeleteConfirmId(o.id); }} style={styles.deleteBtn} title="Xóa ghi nhận này">🗑</button>
                        </td>
                      )}
                      <td style={styles.td}>{o.student?.name}</td>
                      <td style={styles.td}>{o.offence?.name}</td>
                      <td style={{ ...styles.td, color: (o.offence?.deducted_point ?? 0) > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                        {formatDelta(o.offence?.deducted_point ?? 0).text}
                      </td>
                      <td style={{ ...styles.td, color: '#4f46e5', fontWeight: '600' }}>{getDayOfWeek(o.day)}</td>
                      <td style={styles.td}>{o.day}</td>
                      <td style={styles.td}>{o.sub_id ? (subjects[o.sub_id] || o.sub_id) : '—'}</td>
                      <td style={styles.td}>{o.period_id || '—'}</td>
                      <td style={styles.td}>{o.session_id ? (sessions[o.session_id] || o.session_id) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId !== null && (
        <div style={modalStyles.overlay} onClick={() => setDeleteConfirmId(null)}>
          <div style={modalStyles.content} onClick={e => e.stopPropagation()}>
            <h3 style={modalStyles.title}>⚠️ Xác Nhận Xóa</h3>
            <p style={modalStyles.text}>
              Bạn có chắc chắn muốn xóa vi phạm / vi phạm điểm này? Hành động này không thể hoàn tác.
            </p>
            {deleteError && (
              <div style={modalStyles.errorMsg}>{deleteError}</div>
            )}
            <div style={modalStyles.btnGroup}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={isDeleting}
                style={modalStyles.cancelBtn}
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                style={modalStyles.confirmBtn}
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px 12px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Roboto', system-ui, sans-serif", boxSizing: 'border-box' },
  header: { marginBottom: '16px', textAlign: 'center' },
  title: { fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px' },
  tabGroup: { display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', flexWrap: 'wrap' },
  tabActive: { flex: '1 1 90px', padding: '8px 10px', border: 'none', background: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', color: '#2563eb' },
  tabInactive: { flex: '1 1 90px', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', fontSize: '13px', fontWeight: '500' },
  filterBar: { display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap' },
  searchInput: { flex: '2 1 160px', minWidth: '140px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', height: '38px', boxSizing: 'border-box', fontSize: '14px', backgroundColor: '#f8fafc' },
  card: { background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
  tableWrapper: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  theadRow: { background: '#f8fafc' },
  th: { padding: '10px 12px', textAlign: 'left', color: '#475569', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: '700' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 12px', color: '#334155', whiteSpace: 'nowrap' },
  deleteBtn: { color: '#ef4444', background: '#fee2e2', border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer' },
  loading: { padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: '14px' }
};

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px'
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '420px',
    width: '100%',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    boxSizing: 'border-box'
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '18px',
    fontWeight: 700,
    color: '#0f172a'
  },
  text: {
    margin: '0 0 20px 0',
    fontSize: '14px',
    color: '#475569',
    lineHeight: '1.5'
  },
  errorMsg: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px'
  },
  btnGroup: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end'
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#334155',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer'
  },
  confirmBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer'
  }
};

export default ScoreTable;
