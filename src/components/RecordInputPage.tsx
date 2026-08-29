import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Select from 'react-select';
import { 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw, 
  Copy, 
  Search, 
  Calendar, 
  AlertCircle,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { ImageImportModal } from './ImageImportModal';
import {
  getDayOfWeek,
  getTimetableDay,
  getTimetableSessionValue,
  getTimetablePeriodValue
} from '../utils/timetableHelpers';

// --- Types ---
interface StudentItem {
  id: number;
  name: string;
  class: string;
}

interface OffenceCatalogItem {
  id: number;
  name: string;
  deducted_point: number;
}

interface GenericItem {
  id: number;
  name: string;
}

interface WeekItem {
  week: number;
}

interface ListsState {
  student: StudentItem[];
  offence_catalog: OffenceCatalogItem[];
  period: GenericItem[];
  session: GenericItem[];
  subject: GenericItem[];
  week: WeekItem[];
}

export interface GridRow {
  key: string;               // Local temporary UUID/key for rendering
  id?: number;               // Database record ID (if fetched or existing)
  student_id: string;        // String for form inputs
  offence_id: string;
  sub_id: string;
  period_id: string;
  session_id: string;
  day: string;
  week: number;
  isNew?: boolean;           // True if user created locally
  isModified?: boolean;      // True if modified
  inferredSubject?: string;  // Subject name inferred from Timetable
}

export interface RecordInputPageProps {
  onUpdate?: () => Promise<void>;
}

const DAY_OF_WEEK_NAMES: Record<number, string> = {
  0: 'Chủ Nhật',
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy'
};

// --- Filter Helper ---
function getFilteredRows(
  rows: GridRow[],
  dayFilter: string,
  searchTerm: string,
  studentNameMap: Map<string, string>,
  offenceNameMap: Map<string, string>,
  subjectNameMap: Map<string, string>
): GridRow[] {
  const term = searchTerm.trim().toLowerCase();

  return rows.filter(r => {
    // 1. Day tab filter
    if (dayFilter !== 'all') {
      if (!r.day) return false;
      if (dayFilter.startsWith('day_')) {
        const targetDayNum = parseInt(dayFilter.replace('day_', ''), 10);
        const jsDay = getDayOfWeek(r.day);
        if (jsDay === null || jsDay !== targetDayNum) return false;
      } else if (r.day !== dayFilter) {
        return false;
      }
    }

    // 2. Keyword search filter
    if (term) {
      const studentName = studentNameMap.get(r.student_id) || '';
      const offenceName = offenceNameMap.get(r.offence_id) || '';
      const subjectName = subjectNameMap.get(r.sub_id) || '';
      
      const matched = (
        studentName.includes(term) ||
        offenceName.includes(term) ||
        subjectName.toLowerCase().includes(term) ||
        r.student_id.includes(term) ||
        r.day.includes(term) ||
        String(r.week).includes(term)
      );
      if (!matched) return false;
    }

    return true;
  });
}

const RecordInputPage: React.FC<RecordInputPageProps> = ({ onUpdate }) => {
  // --- Master Lists State ---
  const [lists, setLists] = useState<ListsState>({
    student: [],
    offence_catalog: [],
    period: [],
    session: [],
    subject: [],
    week: []
  });

  const listsRef = useRef(lists);
  useEffect(() => {
    listsRef.current = lists;
  }, [lists]);

  const [loading, setLoading] = useState(true);
  const [loadingWeekData, setLoadingWeekData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- Active Week & View Controls ---
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [dayFilter, setDayFilter] = useState<string>('all'); // 'all' or 'YYYY-MM-DD' or weekday number

  // --- Search & Selection ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // --- AI Image Import State ---
  const [showAiModal, setShowAiModal] = useState(false);

  // --- Custom GUI Confirmation Modal State ---
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // --- Global Row Default Presets ---
  const [defaults, setDefaults] = useState({
    day: new Date().toISOString().split('T')[0],
    session_id: '1',
    period_id: '1',
    sub_id: ''
  });

  const defaultsRef = useRef(defaults);
  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);

  // --- Timetable Index Reference ---
  // Key format: `${week}_${timetableDay}_${session}_${period}` -> subject_id (e.g. "1_2_1_3" -> "1")
  const timetableIndexRef = useRef<Map<string, string>>(new Map());

  // --- Grid Rows State ---
  const [rows, setRows] = useState<GridRow[]>([]);

  // Create a fresh row with defaults
  const createNewRow = useCallback((override?: Partial<GridRow>, customDefaults?: typeof defaults, weekOverride?: number): GridRow => {
    const d = customDefaults || defaultsRef.current;
    return {
      key: Math.random().toString(36).substring(2, 9),
      student_id: override?.student_id || '',
      offence_id: override?.offence_id || '',
      sub_id: override?.sub_id || d.sub_id || '',
      period_id: override?.period_id || d.period_id || '',
      session_id: override?.session_id || d.session_id || '',
      day: override?.day || d.day || new Date().toISOString().split('T')[0],
      week: override?.week ?? weekOverride ?? selectedWeek,
      isNew: true,
      isModified: false
    };
  }, [selectedWeek]);

  // --- Auto-infer Subject from Timetable (Single Shared Function) ---
  const inferSubject = useCallback((row: {
    week?: number | string;
    day?: string;
    session_id?: string | number;
    period_id?: string | number;
  }): string => {
    const week = Number(row.week || selectedWeek || 1);
    const day = row.day ? String(row.day) : '';
    const timetableDay = getTimetableDay(day);
    const session = getTimetableSessionValue(row.session_id);
    const period = getTimetablePeriodValue(row.period_id);

    let key = '';
    let subjectId = '';

    if (week && timetableDay && session && period) {
      key = `${week}_${timetableDay}_${session}_${period}`;
      subjectId = timetableIndexRef.current.get(key) || '';
    }

    return subjectId;
  }, [selectedWeek]);

  // --- Load Records for Specific Week ---
  const loadWeekRecords = useCallback(async (weekNum: number) => {
    setLoadingWeekData(true);
    try {
      const { data, error } = await supabase
        .from('offence_log')
        .select('*')
        .eq('week', weekNum)
        .order('day', { ascending: true })
        .order('session_id', { ascending: true })
        .order('period_id', { ascending: true })
        .order('id', { ascending: true });

      if (error) {
        console.error('Lỗi khi tải bản ghi tuần:', error);
        return;
      }

      if (data && data.length > 0) {
        const mappedRows: GridRow[] = data.map((item: {
          id: number;
          student_id?: number;
          offence_id?: number;
          sub_id?: number;
          period_id?: number;
          session_id?: number;
          day?: string;
          week?: number;
        }) => {
          const rowDay = item.day || new Date().toISOString().split('T')[0];
          const rowWeek = item.week || weekNum;
          const rowSession = item.session_id ? String(item.session_id) : '';
          const rowPeriod = item.period_id ? String(item.period_id) : '';

          let subId = (item.sub_id !== null && item.sub_id !== undefined && String(item.sub_id) !== '')
            ? String(item.sub_id)
            : '';

          if (!subId && rowDay && rowSession && rowPeriod) {
            subId = inferSubject({
              day: rowDay,
              week: rowWeek,
              session_id: rowSession,
              period_id: rowPeriod
            });
          }

          return {
            key: `db_${item.id}`,
            id: item.id,
            student_id: item.student_id ? String(item.student_id) : '',
            offence_id: item.offence_id ? String(item.offence_id) : '',
            sub_id: subId,
            period_id: rowPeriod,
            session_id: rowSession,
            day: rowDay,
            week: rowWeek,
            isNew: false,
            isModified: false
          };
        });
        setRows(mappedRows);
      } else {
        setRows([]);
      }
      setSelectedKeys([]);
    } catch (err) {
      console.error('Lỗi hệ thống khi tải tuần:', err);
    } finally {
      setLoadingWeekData(false);
    }
  }, [inferSubject]);

  // --- Fetch Master Catalogs & Initialize ---
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [st, ca, pe, se, su, we, tt] = await Promise.all([
        supabase.from('student').select('id, name, class').order('id', { ascending: true }),
        supabase.from('offence_catalog').select('id, name, deducted_point').order('name'),
        supabase.from('period').select('id, name').order('id'),
        supabase.from('session').select('id, name').order('id'),
        supabase.from('subject').select('id, name').order('name'),
        supabase.from('week').select('week, month').order('week'),
        supabase.from('timetable').select('*')
      ]);

      if (tt.error) {
        console.warn('Lưu ý: Không thể tải bảng timetable hoặc bảng chưa có dữ liệu:', tt.error);
      }

      const fetchedLists: ListsState = {
        student: st.data ?? [],
        offence_catalog: ca.data ?? [],
        period: pe.data ?? [],
        session: se.data ?? [],
        subject: su.data ?? [],
        week: we.data ?? []
      };

      setLists(fetchedLists);

      // Build single unified Timetable index: `${week}_${timetableDay}_${session}_${period}` -> subject_id
      const ttIndex = new Map<string, string>();
      if (tt.data && tt.data.length > 0) {
        tt.data.forEach((item: {
          week?: number | string;
          day?: number | string;
          session?: number | string;
          period?: number | string;
          subject_id?: number | string;
          sub_id?: number | string;
        }) => {
          const w = Number(item.week);
          const d = getTimetableDay(item.day);
          const s = getTimetableSessionValue(item.session);
          const p = getTimetablePeriodValue(item.period);
          const rawSubId = item.subject_id !== null && item.subject_id !== undefined
            ? String(item.subject_id).trim()
            : (item.sub_id !== null && item.sub_id !== undefined ? String(item.sub_id).trim() : '');

          if (w && d && s && p && rawSubId) {
            ttIndex.set(`${w}_${d}_${s}_${p}`, rawSubId);
          }
        });
      }
      timetableIndexRef.current = ttIndex;

      // Default week setup
      const initialWeek = fetchedLists.week.length > 0 ? fetchedLists.week[0].week : 1;
      setSelectedWeek(initialWeek);

      // Load records for default week
      await loadWeekRecords(initialWeek);

    } catch (err: unknown) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [loadWeekRecords]);

  useEffect(() => {
    let isCancelled = false;
    const init = async () => {
      await fetchAllData();
    };
    if (!isCancelled) {
      init();
    }
    return () => {
      isCancelled = true;
    };
  }, [fetchAllData]);

  // --- Indexed Options and Maps for O(1) UI Lookups ---
  const { 
    studentOptions, 
    studentOptionMap, 
    offenceOptions, 
    offenceOptionMap, 
    studentNameMap, 
    offenceNameMap, 
    offencePointsMap,
    subjectNameMap 
  } = useMemo(() => {
    const sOpts: Array<{ value: string; label: string }> = [];
    const sOptMap = new Map<string, { value: string; label: string }>();
    const sNMap = new Map<string, string>();

    lists.student.forEach(s => {
      const sId = String(s.id);
      const opt = { value: sId, label: `${s.name} (ID: ${s.id})` };
      sOpts.push(opt);
      sOptMap.set(sId, opt);
      sNMap.set(sId, s.name.toLowerCase());
    });

    const oOpts: Array<{ value: string; label: string }> = [];
    const oOptMap = new Map<string, { value: string; label: string }>();
    const oNMap = new Map<string, string>();
    const oPtsMap = new Map<string, number>();

    lists.offence_catalog.forEach(c => {
      const cId = String(c.id);
      const points = c.deducted_point;
      const isBonus = points < 0;
      const sign = isBonus ? '+' : '-';
      const absPts = Math.abs(points);
      
      const opt = { 
        value: cId, 
        label: `${c.name} (${sign}${absPts}đ)` 
      };
      oOpts.push(opt);
      oOptMap.set(cId, opt);
      oNMap.set(cId, c.name.toLowerCase());
      oPtsMap.set(cId, points);
    });

    const subNMap = new Map<string, string>();
    lists.subject.forEach(s => {
      subNMap.set(String(s.id), s.name);
    });

    return {
      studentOptions: sOpts,
      studentOptionMap: sOptMap,
      offenceOptions: oOpts,
      offenceOptionMap: oOptMap,
      studentNameMap: sNMap,
      offenceNameMap: oNMap,
      offencePointsMap: oPtsMap,
      subjectNameMap: subNMap
    };
  }, [lists.student, lists.offence_catalog, lists.subject]);

  // --- Unsaved Tracking ---
  const unsavedCount = useMemo(() => rows.filter(r => r.isNew || r.isModified).length, [rows]);
  const readyToSaveCount = useMemo(() => rows.filter(r => (r.isNew || r.isModified) && r.student_id && r.offence_id).length, [rows]);

  // --- Handle Week Change with Unsaved Confirmation ---
  const handleChangeWeek = (newWeek: number) => {
    if (newWeek === selectedWeek) return;

    if (unsavedCount > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Chuyển tuần khi có thay đổi chưa lưu',
        message: `Bạn đang có ${unsavedCount} dòng ghi chép chưa lưu trong Tuần ${selectedWeek}. Bạn có muốn lưu trước khi chuyển sang Tuần ${newWeek} không?`,
        confirmText: 'Lưu & Chuyển tuần',
        cancelText: 'Bỏ qua & Chuyển',
        isDanger: false,
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          await handleBatchSave();
          setSelectedWeek(newWeek);
          await loadWeekRecords(newWeek);
        }
      });
    } else {
      setSelectedWeek(newWeek);
      loadWeekRecords(newWeek);
    }
  };

  // --- Row Manipulation Handlers (Batch Processed in Memory) ---
  const handleAddRow = useCallback((count = 1) => {
    const d = defaultsRef.current;
    const newItems: GridRow[] = [];
    for (let i = 0; i < count; i++) {
      const row = createNewRow(undefined, d, selectedWeek);
      row.sub_id = inferSubject(row);
      newItems.push(row);
    }

    setRows(prev => [...newItems, ...prev]);
  }, [createNewRow, inferSubject, selectedWeek]);

  const handleUpdateRowCell = useCallback((key: string, field: keyof GridRow, value: string | number | boolean) => {
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r;

      const updated: GridRow = {
        ...r,
        [field]: value,
        isModified: !r.isNew
      };

      // Auto-infer subject if any of the 4 key conditions updated (day, session_id, period_id, week)
      if (field === 'day' || field === 'week' || field === 'session_id' || field === 'period_id') {
        updated.sub_id = inferSubject(updated);
      }

      return updated;
    }));
  }, [inferSubject]);

  const handleDuplicateRow = (rowToCopy: GridRow) => {
    const duplicated: GridRow = {
      ...rowToCopy,
      key: Math.random().toString(36).substring(2, 9),
      id: undefined,
      isNew: true,
      isModified: false
    };
    setRows(prev => [duplicated, ...prev]);
  };

  const handleDeleteSelected = () => {
    if (selectedKeys.length === 0) return;

    const count = selectedKeys.length;
    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận xóa hàng',
      message: `Bạn có chắc chắn muốn xóa ${count} hàng đã chọn? Hành động này sẽ xóa các bản ghi được chọn khỏi hệ thống.`,
      confirmText: 'Xóa ngay',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));

        const dbIdsToDelete = rows
          .filter(r => selectedKeys.includes(r.key) && r.id !== undefined)
          .map(r => r.id!);

        if (dbIdsToDelete.length > 0) {
          const { error } = await supabase.from('offence_log').delete().in('id', dbIdsToDelete);
          if (error) {
            console.error('Lỗi khi xóa:', error);
            return;
          }
        }

        setRows(prev => prev.filter(r => !selectedKeys.includes(r.key)));
        setSelectedKeys([]);
        if (onUpdate) await onUpdate();
      }
    });
  };

  const handleDeleteSingleRow = (row: GridRow) => {
    if (row.id) {
      setConfirmModal({
        isOpen: true,
        title: 'Xác nhận xóa hàng',
        message: 'Hàng này đã được lưu trong cơ sở dữ liệu. Bạn có chắc chắn muốn xóa?',
        confirmText: 'Xóa',
        cancelText: 'Hủy',
        isDanger: true,
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          const { error } = await supabase.from('offence_log').delete().eq('id', row.id!);
          if (error) {
            console.error('Lỗi khi xóa:', error);
            return;
          }
          setRows(prev => prev.filter(r => r.key !== row.key));
          setSelectedKeys(prev => prev.filter(k => k !== row.key));
          if (onUpdate) await onUpdate();
        }
      });
    } else {
      setRows(prev => prev.filter(r => r.key !== row.key));
      setSelectedKeys(prev => prev.filter(k => k !== row.key));
    }
  };

  // --- Selection Handlers ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedKeys(filteredRows.map(r => r.key));
    } else {
      setSelectedKeys([]);
    }
  };

  const handleToggleSelectRow = (key: string) => {
    setSelectedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // --- True Batch Save All Changes (Minimum Network Roundtrips) ---
  const handleBatchSave = useCallback(async () => {
    const validRowsToSave = rows.filter(r => r.student_id && r.offence_id && (r.isNew || r.isModified));

    if (validRowsToSave.length === 0) return;

    setIsSaving(true);

    try {
      const newRows = validRowsToSave.filter(r => r.isNew || !r.id);
      const modifiedRows = validRowsToSave.filter(r => !r.isNew && r.id && r.isModified);

      const insertedIdMap = new Map<string, number>();

      // 1. Batch Insert new rows in 1 single network call
      if (newRows.length > 0) {
        const insertPayload = newRows.map(r => ({
          student_id: Number(r.student_id),
          offence_id: Number(r.offence_id),
          sub_id: r.sub_id ? Number(r.sub_id) : null,
          period_id: r.period_id ? Number(r.period_id) : null,
          session_id: r.session_id ? Number(r.session_id) : null,
          week: r.week ? Number(r.week) : selectedWeek,
          day: r.day || null
        }));

        const { data, error: insertErr } = await supabase.from('offence_log').insert(insertPayload).select('id');
        if (insertErr) throw insertErr;

        if (data && data.length === newRows.length) {
          newRows.forEach((r, idx) => {
            insertedIdMap.set(r.key, data[idx].id);
          });
        }
      }

      // 2. Batch Upsert (Update) modified rows in 1 single network call
      if (modifiedRows.length > 0) {
        const updatePayload = modifiedRows.map(r => ({
          id: r.id!,
          student_id: Number(r.student_id),
          offence_id: Number(r.offence_id),
          sub_id: r.sub_id ? Number(r.sub_id) : null,
          period_id: r.period_id ? Number(r.period_id) : null,
          session_id: r.session_id ? Number(r.session_id) : null,
          week: r.week ? Number(r.week) : selectedWeek,
          day: r.day || null
        }));

        const { error: updateErr } = await supabase.from('offence_log').upsert(updatePayload);
        if (updateErr) throw updateErr;
      }

      // 3. Update local state directly in 1 pass
      const savedKeys = new Set(validRowsToSave.map(r => r.key));
      setRows(prev => prev.map(r => {
        if (!savedKeys.has(r.key)) return r;
        const dbId = insertedIdMap.get(r.key) || r.id;
        return {
          ...r,
          id: dbId,
          isNew: false,
          isModified: false
        };
      }));

      if (onUpdate) await onUpdate();
    } catch (err: unknown) {
      console.error('Lỗi khi lưu dữ liệu:', err);
    } finally {
      setIsSaving(false);
    }
  }, [rows, selectedWeek, onUpdate]);

  // --- Keyboard Shortcuts (Ctrl+S / Cmd+S to Save) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (readyToSaveCount > 0 && !isSaving) {
          handleBatchSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readyToSaveCount, isSaving, handleBatchSave]);

  // --- Filtered Rows (Search + Day Tab Filter) ---
  const filteredRows = getFilteredRows(rows, dayFilter, searchTerm, studentNameMap, offenceNameMap, subjectNameMap);

  if (loading) {
    return (
      <div style={loadingBoxStyle}>
        <RefreshCw className="animate-spin" size={26} color="#059669" />
        <span style={{ fontSize: '15px', fontWeight: 600 }}>Đang mở bảng nhập liệu Excel...</span>
      </div>
    );
  }



  return (
    <div style={containerStyle}>
      {/* ================= TOP CONTROLLER & WEEK PICKER ================= */}
      <div style={sheetHeaderCardStyle}>
        <div style={headerTopRowStyle}>
          <div style={brandTitleStyle}>
            <div>
              <h2 style={sheetTitleStyle}>Nhập liệu ghi chép</h2>
              <p style={sheetSubtextStyle}>Nhập và chỉnh sửa vi phạm / điểm cộng theo tuần</p>
            </div>
          </div>
        </div>

        {/* Week Selector Bar & Global Defaults */}
        <div style={weekSelectorNavStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} color="#059669" /> Chọn tuần làm việc:
            </span>

            <select
              value={selectedWeek}
              onChange={e => handleChangeWeek(Number(e.target.value))}
              style={weekDropdownStyle}
            >
              {lists.week.map(w => (
                <option key={w.week} value={w.week}>
                  Tuần {w.week}
                </option>
              ))}
            </select>

            {loadingWeekData && (
              <span style={{ fontSize: '12px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                <RefreshCw size={13} className="animate-spin" /> Đang tải Tuần {selectedWeek}...
              </span>
            )}
          </div>

          {/* Defaults for new rows */}
          <div style={defaultPresetsMiniStyle}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Mặc định hàng mới:</span>
            
            <input 
              type="date" 
              style={presetInputMini} 
              value={defaults.day} 
              onChange={e => setDefaults({ ...defaults, day: e.target.value })} 
              title="Ngày mặc định khi tạo hàng mới"
            />

            <select 
              style={presetSelectMini} 
              value={defaults.session_id} 
              onChange={e => setDefaults({ ...defaults, session_id: e.target.value })}
              title="Buổi mặc định khi tạo hàng mới"
            >
              {lists.session.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <select 
              style={presetSelectMini} 
              value={defaults.period_id} 
              onChange={e => setDefaults({ ...defaults, period_id: e.target.value })}
              title="Tiết mặc định khi tạo hàng mới"
            >
              {lists.period.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ================= TOOLBAR & SEARCH ================= */}
      <div style={toolbarStyle}>
        <div style={toolbarLeftGroup}>
          <button 
            type="button" 
            onClick={() => handleAddRow(1)} 
            style={btnPrimaryStyle}
            title="Thêm 1 hàng mới vào bảng (phím tắt Enter/Alt+N)"
          >
            <Plus size={16} /> Thêm 1 hàng
          </button>

          <button 
            type="button" 
            onClick={() => handleAddRow(5)} 
            style={btnSecondaryStyle}
            title="Thêm 5 hàng mới cùng lúc để nhập nhanh"
          >
            +5 hàng
          </button>

          <button 
            type="button" 
            onClick={() => setShowAiModal(true)} 
            style={btnAiOcrStyle}
            title="Tự động nhận diện ghi chép vi phạm từ ảnh chụp"
          >
            Nhập bằng ảnh
          </button>

          {selectedKeys.length > 0 && (
            <button 
              type="button" 
              onClick={handleDeleteSelected} 
              style={btnDangerStyle}
            >
              <Trash2 size={15} /> Xóa {selectedKeys.length} hàng đã chọn
            </button>
          )}
        </div>

        <div style={toolbarRightGroup}>
          {/* Search Box */}
          <div style={searchBoxStyle}>
            <Search size={14} color="#64748b" />
            <input 
              type="text" 
              placeholder="Tìm tên học sinh, lỗi, môn..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={searchInputStyle}
            />
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => setSearchTerm('')} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>

          <button 
            type="button" 
            onClick={() => loadWeekRecords(selectedWeek)} 
            style={btnIconStyle}
            title="Tải lại toàn bộ dữ liệu tuần này"
          >
            <RefreshCw size={15} />
          </button>

          <button 
            type="button" 
            onClick={handleBatchSave} 
            disabled={isSaving || readyToSaveCount === 0} 
            style={{ 
              ...btnSaveStyle,
              backgroundColor: readyToSaveCount > 0 ? '#059669' : '#cbd5e1',
              cursor: readyToSaveCount > 0 ? 'pointer' : 'not-allowed'
            }}
            title="Lưu tất cả thay đổi (Ctrl+S / Cmd+S)"
          >
            <Save size={16} /> 
            {isSaving ? 'Đang lưu...' : `Lưu tất cả (${readyToSaveCount})`}
          </button>
        </div>
      </div>

      {/* ================= DAY-OF-WEEK QUICK FILTER TABS ================= */}
      <div style={dayFilterBarContainer}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '6px 12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
            <Filter size={13} /> Lọc theo ngày:
          </span>

          <button
            type="button"
            onClick={() => setDayFilter('all')}
            style={dayFilter === 'all' ? dayTabActiveStyle : dayTabInactiveStyle}
          >
            Tất cả ngày ({rows.length})
          </button>

          {[1, 2, 3, 4, 5, 6, 0].map(dayNum => {
            const countOnDay = rows.filter(r => {
              if (!r.day) return false;
              const p = r.day.split('-');
              if (p.length !== 3) return false;
              const y = parseInt(p[0], 10);
              const m = parseInt(p[1], 10) - 1;
              const d = parseInt(p[2], 10);
              if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
              const dt = new Date(y, m, d);
              return !isNaN(dt.getTime()) && dt.getDay() === dayNum;
            }).length;

            const isSelected = dayFilter === `day_${dayNum}`;

            return (
              <button
                key={dayNum}
                type="button"
                onClick={() => setDayFilter(isSelected ? 'all' : `day_${dayNum}`)}
                style={isSelected ? dayTabActiveStyle : dayTabInactiveStyle}
              >
                {DAY_OF_WEEK_NAMES[dayNum]} {countOnDay > 0 ? `(${countOnDay})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= EXCEL GRID SPREADSHEET ================= */}
      <div style={tableWrapperStyle}>
        <table style={{ ...tableStyle, minWidth: '1280px' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '38px', minWidth: '38px', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={filteredRows.length > 0 && selectedKeys.length === filteredRows.length} 
                  onChange={handleSelectAll} 
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ ...thStyle, width: '45px', minWidth: '45px', textAlign: 'center' }}>STT</th>
              <th style={{ ...thStyle, width: '85px', minWidth: '85px', textAlign: 'center' }}>Trạng thái</th>
              <th style={{ ...thStyle, minWidth: '200px' }}>
                Học sinh <span style={{ color: '#ef4444' }}>*</span>
              </th>
              <th style={{ ...thStyle, minWidth: '220px' }}>
                Vi phạm / Điểm cộng <span style={{ color: '#ef4444' }}>*</span>
              </th>
              <th style={{ ...thStyle, minWidth: '130px' }}>Môn học</th>
              <th style={{ ...thStyle, width: '115px', minWidth: '115px' }}>Tiết</th>
              <th style={{ ...thStyle, width: '110px', minWidth: '110px' }}>Buổi</th>
              <th style={{ ...thStyle, width: '150px', minWidth: '150px' }}>Ngày</th>
              <th style={{ ...thStyle, width: '95px', minWidth: '95px' }}>Tuần</th>
              <th style={{ ...thStyle, width: '80px', minWidth: '80px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={11} style={emptyTdStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                      Tuần {selectedWeek} chưa có bản ghi nào {dayFilter !== 'all' ? 'cho ngày đã lọc' : ''}.
                    </p>
                    <button 
                      type="button" 
                      onClick={() => handleAddRow(1)} 
                      style={{ ...btnPrimaryStyle, padding: '6px 12px', fontSize: '12px' }}
                    >
                      <Plus size={14} /> Thêm hàng mới ngay
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => {
                const isSelected = selectedKeys.includes(row.key);
                const selectedStudent = studentOptionMap.get(row.student_id) || null;
                const selectedOffence = offenceOptionMap.get(row.offence_id) || null;
                const pts = offencePointsMap.get(row.offence_id);

                // Row background tinting for instant clarity
                let rowBg = '#ffffff';
                if (isSelected) {
                  rowBg = '#ecfdf5';
                } else if (row.isNew) {
                  rowBg = '#f8fafc';
                } else if (row.isModified) {
                  rowBg = '#fefce8';
                }

                return (
                  <tr 
                    key={row.key} 
                    style={{
                      ...trStyle,
                      backgroundColor: rowBg,
                      borderLeft: row.isNew 
                        ? '3px solid #10b981' 
                        : (row.isModified ? '3px solid #eab308' : '3px solid transparent')
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => handleToggleSelectRow(row.key)} 
                        style={{ cursor: 'pointer' }}
                      />
                    </td>

                    {/* STT */}
                    <td style={{ ...tdStyle, textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                      {index + 1}
                    </td>

                    {/* Status Badge */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {row.isNew && (
                        <span style={badgeNewStyle} title="Hàng mới chưa lưu">
                          Mới
                        </span>
                      )}
                      {!row.isNew && row.isModified && (
                        <span style={badgeModifiedStyle} title="Đã chỉnh sửa chưa lưu">
                          Đã sửa
                        </span>
                      )}
                      {!row.isNew && !row.isModified && (
                        <span style={badgeSavedStyle} title="Đã lưu an toàn">
                          <CheckCircle2 size={11} /> Đã lưu
                        </span>
                      )}
                    </td>

                    {/* Student Select */}
                    <td style={tdStyle}>
                      <Select
                        options={studentOptions}
                        placeholder="Tìm & chọn học sinh..."
                        isSearchable
                        value={selectedStudent}
                        onChange={(opt: { value: string; label: string } | null) => handleUpdateRowCell(row.key, 'student_id', opt?.value || '')}
                        styles={cellSelectStyles}
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        noOptionsMessage={() => "Không tìm thấy học sinh"}
                      />
                    </td>

                    {/* Offence Catalog Select */}
                    <td style={tdStyle}>
                      <div style={{ position: 'relative' }}>
                        <Select
                          options={offenceOptions}
                          placeholder="Chọn lỗi / điểm cộng..."
                          isSearchable
                          value={selectedOffence}
                          onChange={(opt: { value: string; label: string } | null) => handleUpdateRowCell(row.key, 'offence_id', opt?.value || '')}
                          styles={cellSelectStyles}
                          menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                          menuPosition="fixed"
                          noOptionsMessage={() => "Không tìm thấy nội dung"}
                        />
                        {pts !== undefined && (
                          <span style={{
                            position: 'absolute',
                            right: '34px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: pts < 0 ? '#dcfce7' : '#fee2e2',
                            color: pts < 0 ? '#15803d' : '#b91c1c',
                            pointerEvents: 'none'
                          }}>
                            {pts < 0 ? `+${Math.abs(pts)}đ` : `-${pts}đ`}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Subject Select */}
                    <td style={tdStyle}>
                      <select 
                        style={cellInputStyle} 
                        value={row.sub_id} 
                        onChange={e => handleUpdateRowCell(row.key, 'sub_id', e.target.value)}
                      >
                        <option value="">-- Môn --</option>
                        {lists.subject.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Period Select */}
                    <td style={tdStyle}>
                      <select 
                        style={cellInputStyle} 
                        value={row.period_id} 
                        onChange={e => handleUpdateRowCell(row.key, 'period_id', e.target.value)}
                      >
                        <option value="">-- Tiết --</option>
                        {lists.period.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Session Select */}
                    <td style={tdStyle}>
                      <select 
                        style={cellInputStyle} 
                        value={row.session_id} 
                        onChange={e => handleUpdateRowCell(row.key, 'session_id', e.target.value)}
                      >
                        <option value="">-- Buổi --</option>
                        {lists.session.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Day Input Date */}
                    <td style={tdStyle}>
                      <input 
                        type="date" 
                        style={cellInputStyle} 
                        value={row.day} 
                        onChange={e => handleUpdateRowCell(row.key, 'day', e.target.value)}
                      />
                    </td>

                    {/* Week Select */}
                    <td style={tdStyle}>
                      <select 
                        style={cellInputStyle} 
                        value={row.week} 
                        onChange={e => handleUpdateRowCell(row.key, 'week', Number(e.target.value))}
                      >
                        {lists.week.map(w => (
                          <option key={w.week} value={w.week}>T.{w.week}</option>
                        ))}
                      </select>
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <button 
                          type="button" 
                          onClick={() => handleDuplicateRow(row)} 
                          style={cellIconBtn}
                          title="Nhân bản hàng này"
                        >
                          <Copy size={13} color="#0284c7" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleDeleteSingleRow(row)} 
                          style={cellIconBtn}
                          title="Xóa hàng này"
                        >
                          <Trash2 size={13} color="#ef4444" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ================= FOOTER SUMMARY BAR ================= */}
      <div style={footerSummaryStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span>Đang xem: <strong style={{ color: '#059669' }}>Tuần {selectedWeek}</strong></span>
          <span>Tổng số hàng: <strong>{rows.length}</strong></span>
          <span>Chưa lưu: <strong style={{ color: unsavedCount > 0 ? '#eab308' : '#10b981' }}>{unsavedCount}</strong></span>
          <span>Hợp lệ sẵn sàng lưu: <strong style={{ color: readyToSaveCount > 0 ? '#10b981' : '#64748b' }}>{readyToSaveCount}</strong></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            💡 Mẹo: Nhấn <strong>Ctrl + S</strong> để lưu nhanh toàn bộ thay đổi.
          </span>
        </div>
      </div>

      {/* ================= AI OCR INPUT MODAL ================= */}
      <ImageImportModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        selectedWeek={selectedWeek}
        studentsList={lists.student}
        offencesList={lists.offence_catalog}
        defaultSessionId={defaults.session_id}
        defaultPeriodId={defaults.period_id}
        defaultDay={defaults.day}
        onRecordsExtracted={(newRows) => {
          setRows(prev => [...newRows, ...prev]);
        }}
        inferSubject={inferSubject}
        createNewRow={createNewRow}
      />

      {/* ================= CONFIRMATION MODAL ================= */}
      {confirmModal.isOpen && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '440px' }}>
            <div style={modalHeaderStyle}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', color: '#0f172a' }}>
                <AlertCircle size={20} color={confirmModal.isDanger ? '#dc2626' : '#0284c7'} />
                {confirmModal.title}
              </h4>
              <button onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} style={closeModalBtn}>✕</button>
            </div>

            <p style={{ fontSize: '14px', color: '#334155', margin: '16px 0', lineHeight: '1.5' }}>
              {confirmModal.message}
            </p>

            <div style={modalFooterStyle}>
              <button 
                type="button" 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                style={btnSecondaryStyle}
              >
                {confirmModal.cancelText || 'Hủy'}
              </button>
              <button 
                type="button" 
                onClick={() => confirmModal.onConfirm()} 
                style={confirmModal.isDanger ? btnDangerStyle : btnPrimaryStyle}
              >
                {confirmModal.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Modern Clean Excel-Like Styles ---
const containerStyle: React.CSSProperties = {
  maxWidth: '100%',
  margin: '0 auto',
  padding: '16px',
  fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  boxSizing: 'border-box'
};

const sheetHeaderCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px 12px 0 0',
  padding: '16px 20px 12px 20px',
  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
};

const headerTopRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '16px',
  marginBottom: '14px'
};

const brandTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px'
};

const sheetTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
  margin: 0
};

const sheetSubtextStyle: React.CSSProperties = {
  margin: '4px 0 0 0',
  fontSize: '13px',
  color: '#64748b'
};

const weekSelectorNavStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: '12px',
  borderTop: '1px solid #f1f5f9',
  flexWrap: 'wrap',
  gap: '12px'
};



const weekDropdownStyle: React.CSSProperties = {
  backgroundColor: '#059669',
  color: '#ffffff',
  border: 'none',
  borderRadius: '6px',
  padding: '5px 12px',
  fontSize: '13px',
  fontWeight: 700,
  outline: 'none',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
};

const defaultPresetsMiniStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: '#f8fafc',
  padding: '4px 10px',
  borderRadius: '6px',
  border: '1px solid #e2e8f0',
  flexWrap: 'wrap'
};

const presetInputMini: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  padding: '3px 8px',
  fontSize: '12.5px',
  outline: 'none',
  color: '#334155',
  minWidth: '130px'
};

const presetSelectMini: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  padding: '3px 8px',
  fontSize: '12.5px',
  outline: 'none',
  color: '#334155',
  minWidth: '85px'
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#1e293b',
  padding: '10px 16px',
  borderLeft: '1px solid #334155',
  borderRight: '1px solid #334155',
  borderBottom: '1px solid #334155',
  flexWrap: 'wrap',
  gap: '10px'
};

const toolbarLeftGroup: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap'
};

const toolbarRightGroup: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap'
};

const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: '#059669',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '7px 12px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: '0.2s'
};

const btnSecondaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: '#334155',
  color: '#f8fafc',
  border: '1px solid #475569',
  borderRadius: '6px',
  padding: '7px 12px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer'
};

const btnAiOcrStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: '#0284c7',
  color: '#ffffff',
  border: '1px solid #0369a1',
  borderRadius: '6px',
  padding: '7px 12px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer'
};

const btnDangerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: '#dc2626',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '7px 12px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer'
};

const btnIconStyle: React.CSSProperties = {
  backgroundColor: '#334155',
  color: '#f8fafc',
  border: '1px solid #475569',
  borderRadius: '6px',
  padding: '7px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const btnSaveStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '7px 16px',
  fontSize: '13px',
  fontWeight: 700,
  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  transition: '0.2s'
};

const searchBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: '#0f172a',
  border: '1px solid #475569',
  borderRadius: '6px',
  padding: '4px 10px'
};

const searchInputStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  border: 'none',
  color: '#fff',
  fontSize: '13px',
  outline: 'none',
  width: '180px'
};

const dayFilterBarContainer: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  borderLeft: '1px solid #e2e8f0',
  borderRight: '1px solid #e2e8f0',
  borderBottom: '1px solid #e2e8f0'
};

const dayTabActiveStyle: React.CSSProperties = {
  backgroundColor: '#059669',
  color: '#ffffff',
  border: 'none',
  borderRadius: '16px',
  padding: '3px 10px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

const dayTabInactiveStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  color: '#475569',
  border: '1px solid #cbd5e1',
  borderRadius: '16px',
  padding: '3px 10px',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

const tableWrapperStyle: React.CSSProperties = {
  overflowX: 'auto',
  borderLeft: '1px solid #e2e8f0',
  borderRight: '1px solid #e2e8f0',
  borderBottom: '1px solid #e2e8f0',
  backgroundColor: '#fff'
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px'
};

const thStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  color: '#334155',
  padding: '10px 10px',
  borderBottom: '2px solid #cbd5e1',
  fontWeight: 700,
  fontSize: '12px',
  textAlign: 'left',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap'
};

const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #e2e8f0',
  transition: 'background-color 0.15s ease'
};

const tdStyle: React.CSSProperties = {
  padding: '5px 6px',
  verticalAlign: 'middle'
};

const emptyTdStyle: React.CSSProperties = {
  padding: '40px',
  textAlign: 'center',
  color: '#64748b',
  backgroundColor: '#f8fafc',
  fontSize: '14px'
};

const cellInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 7px',
  borderRadius: '4px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  backgroundColor: '#fff',
  outline: 'none',
  boxSizing: 'border-box'
};

const cellIconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const badgeNewStyle: React.CSSProperties = {
  backgroundColor: '#dcfce7',
  color: '#15803d',
  fontSize: '11px',
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: '10px',
  whiteSpace: 'nowrap'
};

const badgeModifiedStyle: React.CSSProperties = {
  backgroundColor: '#fef9c3',
  color: '#854d0e',
  fontSize: '11px',
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: '10px',
  whiteSpace: 'nowrap'
};

const badgeSavedStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  color: '#64748b',
  fontSize: '11px',
  fontWeight: 500,
  whiteSpace: 'nowrap'
};

const footerSummaryStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderTop: 'none',
  padding: '10px 16px',
  borderRadius: '0 0 12px 12px',
  fontSize: '13px',
  color: '#475569',
  flexWrap: 'wrap',
  gap: '10px'
};

const loadingBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  padding: '60px 20px',
  color: '#059669',
  fontWeight: 600
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '16px'
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  width: '100%',
  maxWidth: '550px',
  borderRadius: '12px',
  padding: '20px',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid #e2e8f0',
  paddingBottom: '12px'
};

const closeModalBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '18px',
  cursor: 'pointer',
  color: '#64748b'
};

const modalFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '10px',
  marginTop: '16px'
};

const cellSelectStyles = {
  control: (base: Record<string, unknown>) => ({
    ...base,
    borderRadius: '4px',
    borderColor: '#cbd5e1',
    minHeight: '30px',
    height: '30px',
    fontSize: '12.5px',
    boxShadow: 'none',
    backgroundColor: '#ffffff'
  }),
  valueContainer: (base: Record<string, unknown>) => ({
    ...base,
    padding: '0 6px'
  }),
  input: (base: Record<string, unknown>) => ({
    ...base,
    margin: 0,
    padding: 0
  }),
  indicatorsContainer: (base: Record<string, unknown>) => ({
    ...base,
    height: '30px'
  }),
  option: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    fontSize: '12.5px',
    padding: '6px 10px',
    backgroundColor: state.isFocused ? '#ecfdf5' : '#fff',
    color: state.isFocused ? '#047857' : '#1e293b'
  }),
  menuPortal: (base: Record<string, unknown>) => ({
    ...base,
    zIndex: 9999
  })
};

export default RecordInputPage;
