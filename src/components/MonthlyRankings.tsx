import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from "../lib/supabase";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  ArrowUpDown,
  Trophy,
  User,
  Hash,
  Activity,
  CalendarDays
} from 'lucide-react';

/* =======================
    Types (Giữ nguyên)
======================= */
interface Student {
  id: number;
  name: string;
  class: string;
}
interface WeeklyScore {
  student_id: number;
  week: number;
  final_point: number;
}
interface Week {
  week: number;
  month: number;
}
interface RankingRow {
  id: number;
  name: string;
  class: string;
  current_point: number;
  current_rank: number;
  rank_change: number;
}

const MonthlyRankings: React.FC = () => {
  const [data, setData] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableMonths, setAvailableMonths] = useState<number[]>([]);
  const [currentMonth, setCurrentMonth] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof RankingRow;
    direction: 'asc' | 'desc';
  }>({
    key: 'current_rank',
    direction: 'asc',
  });

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  /* =======================
      Fetch & Calculate (Giữ nguyên logic)
  ======================= */
  const fetchData = async () => {
    setLoading(true);
    try {
      const [weeksRes, scoresRes, studentsRes] = await Promise.all([
        supabase.from('week').select('*'),
        supabase.from('weekly_score').select('*'),
        supabase.from('student').select('id, name, class'),
      ]);

      const weeks: Week[] = weeksRes.data ?? [];
      const scores: WeeklyScore[] = scoresRes.data ?? [];
      const students: Student[] = studentsRes.data ?? [];

      const months = Array.from(new Set(weeks.map(w => w.month))).sort((a, b) => a - b);
      setAvailableMonths(months);

      if (currentMonth === null && months.length > 0) {
        setCurrentMonth(months[months.length - 1]);
        setLoading(false);
        return;
      }
      if (currentMonth === null) {
        setLoading(false);
        return;
      }

      const weekToMonth: Record<number, number> = {};
      weeks.forEach(w => { weekToMonth[w.week] = w.month; });

      const monthlyTotal: Record<number, Record<number, number>> = {};
      scores.forEach(s => {
        const month = weekToMonth[s.week];
        if (!month) return;
        if (!monthlyTotal[s.student_id]) monthlyTotal[s.student_id] = {};
        monthlyTotal[s.student_id][month] = (monthlyTotal[s.student_id][month] || 0) + s.final_point;
      });

      const getRankings = (month: number): Record<number, number> => {
        return [...students]
          .map(stu => ({
            id: stu.id,
            total: monthlyTotal[stu.id]?.[month] ?? 0,
          }))
          .sort((a, b) => b.total - a.total)
          .reduce<Record<number, number>>((acc, cur, idx) => {
            acc[cur.id] = idx + 1;
            return acc;
          }, {});
      };

      const currentRanks = getRankings(currentMonth);
      const prevRanks = months.includes(currentMonth - 1) ? getRankings(currentMonth - 1) : {};

      const finalData: RankingRow[] = students.map(stu => {
        const curPoint = monthlyTotal[stu.id]?.[currentMonth] ?? 0;
        const curRank = currentRanks[stu.id] ?? 9999;
        const prevRank = prevRanks[stu.id];
        return {
          id: stu.id,
          name: stu.name,
          class: stu.class,
          current_point: curPoint,
          current_rank: curRank,
          rank_change: prevRank === undefined ? 0 : prevRank - curRank,
        };
      });

      setData(finalData);
    } catch (err) {
      console.error("Lỗi BXH tháng:", err);
    } finally {
      setLoading(false);
    }
  };

  const sortedData = useMemo(() => {
    const items = [...data];
    const { key, direction } = sortConfig;
    items.sort((a, b) => {
      const A = a[key];
      const B = b[key];
      let cmp = (typeof A === 'string' && typeof B === 'string') ? A.localeCompare(B) : Number(A) - Number(B);
      return direction === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [data, sortConfig]);

  const requestSort = (key: keyof RankingRow) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  if (loading || currentMonth === null) {
    return (
      <div style={styles.loading}>
        <div className="spinner"></div>
        <p style={{ marginTop: 15, color: '#64748b', fontWeight: 500 }}>Đang đồng bộ dữ liệu xếp hạng...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* HEADER SECTION */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={styles.iconContainer}>
            <Trophy color="#fff" size={24} fill="#fff" />
          </div>
          <div>
            <h2 style={styles.title}>Bảng Xếp Hạng Tháng</h2>
            <div style={styles.subtitle}>
              <CalendarDays size={14} /> Thống kê thi đua học sinh
            </div>
          </div>
        </div>

        <div style={styles.controlGroup}>
          <label style={styles.label}>Chọn kỳ báo cáo</label>
          <select
            value={currentMonth}
            onChange={e => setCurrentMonth(Number(e.target.value))}
            style={styles.select}
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th} onClick={() => requestSort('current_rank')}>
                <div style={styles.thContent}><Hash size={14} /> Hạng <ArrowUpDown size={12} /></div>
              </th>
              <th style={styles.th} onClick={() => requestSort('name')}>
                <div style={styles.thContent}><User size={14} /> Học sinh <ArrowUpDown size={12} /></div>
              </th>
              <th style={styles.th} onClick={() => requestSort('current_point')}>
                <div style={styles.thContent}><Activity size={14} /> Tổng điểm <ArrowUpDown size={12} /></div>
              </th>
              <th style={styles.th}>
                <div style={styles.thContent}>Thay đổi</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item) => (
              <tr key={item.id} style={styles.tr}>
                <td style={styles.td}>
                  <div style={styles.rankBadge(item.current_rank)}>
                    {item.current_rank}
                  </div>
                </td>
                <td style={styles.td}>
                  <div style={styles.studentInfo}>
                    <span style={styles.studentName}>{item.name}</span>
                    <span style={styles.studentId}>Lớp: {item.class} • ID: #{item.id}</span>
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={styles.pointText}>{item.current_point.toLocaleString()}</span>
                </td>
                <td style={styles.td}>
                  {renderRankChange(item.rank_change)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const renderRankChange = (change: number) => {
  if (change > 0)
    return (
      <div style={{ ...styles.badgeChange, backgroundColor: '#ecfdf5', color: '#059669' }}>
        <ArrowUp size={12} strokeWidth={3} /> {change} bậc
      </div>
    );
  if (change < 0)
    return (
      <div style={{ ...styles.badgeChange, backgroundColor: '#fef2f2', color: '#dc2626' }}>
        <ArrowDown size={12} strokeWidth={3} /> {Math.abs(change)} bậc
      </div>
    );
  return (
    <div style={{ ...styles.badgeChange, backgroundColor: '#f8fafc', color: '#94a3b8' }}>
      <Minus size={12} strokeWidth={3} /> Ổn định
    </div>
  );
};

const styles: any = {
  container: {
    background: '#ffffff',
    padding: '32px',
    borderRadius: '24px',
    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
    border: '1px solid #f1f5f9',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '32px',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px'
  },
  iconContainer: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    padding: '12px',
    borderRadius: '16px',
  },
  title: { 
    margin: 0, 
    fontSize: '22px', 
    fontWeight: 800, 
    color: '#1e293b',
    letterSpacing: '-0.01em'
  },
  subtitle: {
    color: '#64748b',
    fontSize: '13px',
    marginTop: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: '140px'
  },
  label: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    paddingLeft: '2px'
  },
  select: {
    padding: '10px 14px',
    borderRadius: '12px',
    border: '2px solid #f1f5f9',
    background: '#f8fafc',
    color: '#1e293b',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none', // Bỏ mũi tên mặc định của trình duyệt
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    backgroundSize: '16px',
    paddingRight: '36px'
  },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    cursor: 'pointer',
    borderBottom: '2px solid #f8fafc',
  },
  thContent: { display: 'flex', alignItems: 'center', gap: '8px' },
  td: { padding: '16px', background: '#fff', borderBottom: '1px solid #f8fafc' },
  tr: { transition: 'background-color 0.2s' },
  rankBadge: (r: number) => {
    let bg = '#f1f5f9';
    let color = '#475569';
    if (r === 1) { bg = '#fffbeb'; color = '#b45309'; }
    if (r === 2) { bg = '#f8fafc'; color = '#64748b'; }
    if (r === 3) { bg = '#fff7ed'; color = '#c2410c'; }
    return {
      display: 'inline-flex',
      width: '34px', height: '34px',
      justifyContent: 'center', alignItems: 'center',
      borderRadius: '10px',
      fontWeight: 800,
      background: bg,
      color: color,
      border: r <= 3 ? `1px solid ${color}30` : 'none',
    };
  },
  studentInfo: { display: 'flex', flexDirection: 'column' },
  studentName: { fontWeight: 700, color: '#1e293b', fontSize: '15px' },
  studentId: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },
  pointText: { fontWeight: 800, color: '#2563eb', fontSize: '16px' },
  badgeChange: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
  },
  loading: {
    padding: '100px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center'
  },
};

export default MonthlyRankings;