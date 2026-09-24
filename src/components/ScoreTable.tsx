import React, { useMemo, useState, useCallback, useEffect } from 'react';
import Select from 'react-select';
import { Download, FileSpreadsheet, X } from 'lucide-react';
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

  const weekOptions = useMemo<{ value: number | null; label: string }[]>(() => {
    const weeks = Array.from(new Set([...scores.map(s => s.week), ...offences.map(o => o.week ?? 0)]))
      .filter(w => w > 0)
      .sort((a, b) => b - a);
    return [
      { value: null, label: '📅 Tất cả các tuần' },
      ...weeks.map(w => ({ value: w, label: `Tuần ${w}` }))
    ];
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

  const allPenalties = useMemo(() => {
    return offences.filter(o => (o.offence?.deducted_point ?? 0) > 0);
  }, [offences]);

  const allBonuses = useMemo(() => {
    return offences.filter(o => (o.offence?.deducted_point ?? 0) < 0);
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
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  const exportOffencesCSV = useCallback((items: OffenceLog[], fileName: string) => {
    if (!items || items.length === 0) {
      alert('Không có dữ liệu để xuất!');
      return;
    }

    const headers = [
      'STT',
      'Học sinh',
      'Nội dung vi phạm',
      'Điểm trừ',
      'Tuần',
      'Thứ',
      'Ngày vi phạm',
      'Môn học',
      'Tiết',
      'Buổi'
    ];

    const escapeCSV = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = items.map((o, idx) => [
      idx + 1,
      escapeCSV(o.student?.name || 'Chưa rõ'),
      escapeCSV(o.offence?.name || 'Không rõ lỗi'),
      escapeCSV(formatDelta(o.offence?.deducted_point ?? 0).text),
      escapeCSV(o.week ? `Tuần ${o.week}` : '—'),
      escapeCSV(getDayOfWeek(o.day)),
      escapeCSV(o.day || '—'),
      escapeCSV(o.sub_id ? (subjects[o.sub_id] || o.sub_id) : '—'),
      escapeCSV(o.period_id || '—'),
      escapeCSV(o.session_id ? (sessions[o.session_id] || o.session_id) : '—')
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [getDayOfWeek, formatDelta, subjects, sessions]);

  const exportScoresCSV = useCallback((items: typeof processedScores, fileName: string) => {
    if (!items || items.length === 0) {
      alert('Không có dữ liệu điểm để xuất!');
      return;
    }

    const headers = [
      'Hạng',
      'Học sinh',
      'Tuần',
      'Biến động điểm',
      'Điểm hiện tại'
    ];

    const escapeCSV = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = items.map((s) => [
      s.displayRank,
      escapeCSV(s.student?.name || 'Chưa rõ'),
      escapeCSV(`Tuần ${s.week}`),
      escapeCSV(formatDelta(s.delta_point).text),
      s.final_point
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [formatDelta]);

  const handleExportClick = () => {
    if (tab === 'penalty') {
      const isFiltered = Boolean(selectedWeek || searchQuery.trim());
      if (!isFiltered) {
        exportOffencesCSV(allPenalties, 'toan-bo-loi-vi-pham-hoc-sinh');
      } else {
        setShowExportModal(true);
      }
    } else if (tab === 'bonus') {
      const isFiltered = Boolean(selectedWeek || searchQuery.trim());
      if (!isFiltered) {
        exportOffencesCSV(allBonuses, 'danh-sach-diem-cong-hoc-sinh');
      } else {
        setShowExportModal(true);
      }
    } else {
      const weekName = selectedWeek ? `tuan-${selectedWeek}` : 'tat-ca-tuan';
      exportScoresCSV(processedScores, `bang-diem-thi-dua-${weekName}`);
    }
  };

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
          <button onClick={() => setTab('score')} style={tab === 'score' ? styles.tabActive : styles.tabInactive}>
            Bảng Tổng Hợp
          </button>
          <button onClick={() => setTab('bonus')} style={tab === 'bonus' ? styles.tabActive : styles.tabInactive}>
            Chi Tiết Cộng {allBonuses.length > 0 ? `(${allBonuses.length})` : ''}
          </button>
          <button onClick={() => setTab('penalty')} style={tab === 'penalty' ? styles.tabActive : styles.tabInactive}>
            Chi Tiết Trừ {allPenalties.length > 0 ? `(${allPenalties.length})` : ''}
          </button>
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

        {tab !== 'score' && (
          <div style={styles.countBadge}>
            {selectedWeek || searchQuery.trim() ? (
              <span>Hiển thị: <strong>{filteredDetails.length}</strong>/{tab === 'penalty' ? allPenalties.length : allBonuses.length}</span>
            ) : (
              <span>Tổng: <strong>{filteredDetails.length}</strong> mục</span>
            )}
          </div>
        )}

        <button
          onClick={handleExportClick}
          style={styles.exportBtn}
          title="Xuất file Excel/CSV tiếng Việt chuẩn UTF-8"
        >
          <Download size={15} />
          <span>{tab === 'penalty' ? 'Xuất danh sách lỗi' : tab === 'bonus' ? 'Xuất danh sách cộng' : 'Xuất bảng điểm'}</span>
        </button>
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
                  processedScores.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={styles.emptyCell}>
                        Không tìm thấy dữ liệu điểm số phù hợp
                      </td>
                    </tr>
                  ) : (
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
                  )
                ) : (
                  filteredDetails.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 8} style={styles.emptyCell}>
                        {tab === 'penalty' ? 'Không có lỗi vi phạm nào phù hợp với bộ lọc' : 'Không có điểm cộng nào phù hợp'}
                      </td>
                    </tr>
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
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EXPORT OPTIONS MODAL */}
      {showExportModal && (
        <div style={modalStyles.overlay} onClick={() => setShowExportModal(false)}>
          <div style={modalStyles.content} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ ...modalStyles.title, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} color="#2563eb" />
                <span>Xuất file Excel / CSV</span>
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <p style={modalStyles.text}>
              Bộ lọc đang được áp dụng ({selectedWeek ? `Tuần ${selectedWeek}` : ''}{selectedWeek && searchQuery ? ', ' : ''}{searchQuery ? `Học sinh "${searchQuery}"` : ''}). Bạn muốn xuất danh sách nào?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <button
                onClick={() => {
                  const prefix = tab === 'penalty' ? 'danh-sach-loi' : 'danh-sach-cong';
                  const weekLabel = selectedWeek ? `-tuan-${selectedWeek}` : '';
                  exportOffencesCSV(filteredDetails, `${prefix}${weekLabel}-dang-loc`);
                  setShowExportModal(false);
                }}
                style={modalStyles.exportOptionBtn}
              >
                <div style={{ fontWeight: 600 }}>1. Xuất theo danh sách đang lọc</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Bao gồm {filteredDetails.length} mục theo tiêu chí tìm kiếm hiện tại
                </div>
              </button>

              <button
                onClick={() => {
                  const targetList = tab === 'penalty' ? allPenalties : allBonuses;
                  const name = tab === 'penalty' ? 'toan-bo-loi-vi-pham-hoc-sinh' : 'toan-bo-diem-cong-hoc-sinh';
                  exportOffencesCSV(targetList, name);
                  setShowExportModal(false);
                }}
                style={modalStyles.exportOptionBtnPrimary}
              >
                <div style={{ fontWeight: 700, color: '#1d4ed8' }}>
                  2. Xuất toàn bộ tất cả ({tab === 'penalty' ? allPenalties.length : allBonuses.length} mục)
                </div>
                <div style={{ fontSize: '12px', color: '#3b82f6' }}>
                  Xuất toàn bộ lỗi của tất cả học sinh xuyên suốt các tuần
                </div>
              </button>
            </div>

            <div style={modalStyles.btnGroup}>
              <button
                onClick={() => setShowExportModal(false)}
                style={modalStyles.cancelBtn}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
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
  loading: { padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: '14px' },
  exportBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '0 14px',
    height: '38px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.2s',
    flexShrink: 0
  },
  countBadge: {
    fontSize: '13px',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    whiteSpace: 'nowrap'
  },
  emptyCell: {
    padding: '36px 16px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '14px',
    fontStyle: 'italic'
  }
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
    maxWidth: '460px',
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
  exportOptionBtn: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f8fafc',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  exportOptionBtnPrimary: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1.5px solid #93c5fd',
    backgroundColor: '#eff6ff',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
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
