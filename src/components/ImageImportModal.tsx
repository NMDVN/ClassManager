import React, { useState } from 'react';
import { Upload, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import {
  processRawRecords,
  STUDENTS,
  OFFENCES,
  type ItemWithAlias,
  type RawRecordFromAI
} from '../lib/aiMatcher';
import type { GridRow } from './RecordInputPage';

export interface ImageImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedWeek: number;
  studentsList: Array<{ id: number; name: string; class: string }>;
  offencesList: Array<{ id: number; name: string; deducted_point: number }>;
  defaultSessionId: string;
  defaultPeriodId: string;
  defaultDay: string;
  onRecordsExtracted: (newRows: GridRow[]) => void;
  inferSubject: (row: Partial<GridRow>) => string | null;
  createNewRow: (override?: Partial<GridRow>, customDefaults?: { day: string; session_id: string; period_id: string; sub_id: string }, weekOverride?: number) => GridRow;
}

export const ImageImportModal: React.FC<ImageImportModalProps> = ({
  isOpen,
  onClose,
  selectedWeek,
  studentsList,
  offencesList,
  defaultSessionId,
  defaultPeriodId,
  defaultDay,
  onRecordsExtracted,
  inferSubject,
  createNewRow
}) => {
  const [aiImagePreview, setAiImagePreview] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setAiImagePreview('');
    setAiError(null);
    onClose();
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setAiError('Vui lòng chọn tệp hình ảnh (PNG, JPG, JPEG, WEBP).');
      return;
    }
    setAiError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setAiImagePreview(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProcessImage = async () => {
    if (!aiImagePreview) return;
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/mistral/extract-offence-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: aiImagePreview
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Xử lý hình ảnh thất bại.');
      }

      const rawRecords: RawRecordFromAI[] = data.records || [];
      if (rawRecords.length === 0) {
        throw new Error('Không tìm thấy bản ghi vi phạm nào trong hình ảnh.');
      }

      const supabaseStudents: ItemWithAlias[] = studentsList.map(s => ({
        id: s.id,
        name: s.name,
        alias: [s.name]
      }));

      const supabaseOffences: ItemWithAlias[] = offencesList.map(o => ({
        id: o.id,
        name: o.name,
        alias: [o.name]
      }));

      const combinedStudents = [...STUDENTS];
      supabaseStudents.forEach(ss => {
        if (!combinedStudents.some(cs => cs.id === ss.id)) {
          combinedStudents.push(ss);
        }
      });

      const combinedOffences = [...OFFENCES];
      supabaseOffences.forEach(so => {
        if (!combinedOffences.some(co => co.id === so.id)) {
          combinedOffences.push(so);
        }
      });

      const processed = processRawRecords(rawRecords, combinedStudents, combinedOffences);

      const customDefaults = {
        day: defaultDay,
        session_id: defaultSessionId,
        period_id: defaultPeriodId,
        sub_id: ''
      };

      const newGridRows: GridRow[] = [];

      processed.records.forEach(pr => {
        let foundStudentId = '';
        if (pr.student_id != null) {
          const stMatch = studentsList.find(s => s.id === pr.student_id);
          if (stMatch) {
            foundStudentId = String(stMatch.id);
          } else {
            const pySt = STUDENTS.find(s => s.id === pr.student_id);
            if (pySt) {
              const matchedByName = studentsList.find(s => s.name.trim().toLowerCase() === pySt.name.trim().toLowerCase());
              if (matchedByName) foundStudentId = String(matchedByName.id);
            }
          }
        }

        let foundOffenceId = '';
        if (pr.offence_id != null) {
          const offMatch = offencesList.find(o => o.id === pr.offence_id);
          if (offMatch) {
            foundOffenceId = String(offMatch.id);
          } else {
            const pyOff = OFFENCES.find(o => o.id === pr.offence_id);
            if (pyOff) {
              const matchedByName = offencesList.find(o => o.name.trim().toLowerCase() === pyOff.name.trim().toLowerCase());
              if (matchedByName) foundOffenceId = String(matchedByName.id);
            }
          }
        }

        let foundPeriodId = defaultPeriodId;
        if (pr.time_id != null) {
          foundPeriodId = String(pr.time_id);
        }

        let foundSessionId = defaultSessionId;
        if (pr.session_id != null) {
          foundSessionId = String(pr.session_id);
        }

        const row = createNewRow({
          student_id: foundStudentId,
          offence_id: foundOffenceId,
          period_id: foundPeriodId,
          session_id: foundSessionId,
          day: pr.date || defaultDay,
          week: pr.week || processed.week || selectedWeek
        }, customDefaults, selectedWeek);

        if (row.week && row.day && row.session_id && row.period_id && !row.sub_id) {
          const inferredSub = inferSubject(row);
          if (inferredSub) {
            row.sub_id = inferredSub;
          }
        }

        newGridRows.push(row);
      });

      if (newGridRows.length > 0) {
        onRecordsExtracted(newGridRows);
        handleClose();
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setAiError(e.message || 'Xảy ra lỗi khi phân tích ảnh.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={{ ...modalContentStyle, maxWidth: '560px' }}>
        <div style={modalHeaderStyle}>
          <h4 style={{ margin: 0, fontSize: '16px', color: '#0369a1', fontWeight: 700 }}>
            Nhập bằng ảnh
          </h4>
          <button onClick={handleClose} style={closeModalBtn}>✕</button>
        </div>

        <p style={{ fontSize: '13px', color: '#64748b', margin: '10px 0 14px 0', lineHeight: '1.5' }}>
          Tính năng nhận diện từ ảnh có thể chưa chính xác 100%. Vui lòng kiểm tra và chỉnh sửa lại thông tin trong bảng sau khi đưa vào.
        </p>

        {/* Drop Zone */}
        <div 
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '10px',
            padding: '20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
            marginBottom: '14px'
          }}
          onClick={() => {
            const el = document.getElementById('ai-file-input');
            if (el) el.click();
          }}
        >
          <input 
            id="ai-file-input"
            type="file" 
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
          />
          
          {aiImagePreview ? (
            <div>
              <img 
                src={aiImagePreview} 
                alt="Preview" 
                style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '6px', objectFit: 'contain', margin: '0 auto' }} 
              />
              <p style={{ fontSize: '12px', color: '#0284c7', marginTop: '8px', fontWeight: 600 }}>
                Bấm để chọn ảnh khác
              </p>
            </div>
          ) : (
            <div>
              <Upload size={32} color="#64748b" style={{ margin: '0 auto 8px auto' }} />
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: 0 }}>
                Kéo thả hoặc bấm để tải ảnh lên
              </p>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                Hỗ trợ định dạng PNG, JPG, JPEG, WEBP
              </p>
            </div>
          )}
        </div>

        {aiError && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 12px', color: '#dc2626', fontSize: '13px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{aiError}</span>
          </div>
        )}

        <div style={modalFooterStyle}>
          <button 
            type="button" 
            onClick={handleClose} 
            style={btnSecondaryStyle}
            disabled={aiLoading}
          >
            Hủy
          </button>
          <button 
            type="button" 
            onClick={handleProcessImage} 
            disabled={!aiImagePreview || aiLoading}
            style={{
              ...btnPrimaryStyle,
              backgroundColor: (!aiImagePreview || aiLoading) ? '#cbd5e1' : '#0284c7',
              cursor: (!aiImagePreview || aiLoading) ? 'not-allowed' : 'pointer'
            }}
          >
            {aiLoading ? (
              <>
                <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Đang xử lý...
              </>
            ) : (
              <>
                <Sparkles size={15} /> Đưa vào bảng Tuần {selectedWeek}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Styles for Modal ---
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '16px'
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  width: '100%',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  padding: '20px',
  animation: 'fadeIn 0.2s ease-out'
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingBottom: '12px',
  borderBottom: '1px solid #e2e8f0'
};

const closeModalBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '18px',
  color: '#64748b',
  cursor: 'pointer',
  padding: '4px'
};

const modalFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  paddingTop: '14px',
  borderTop: '1px solid #e2e8f0'
};

const btnSecondaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: '#ffffff',
  color: '#334155',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer'
};

const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: '#ffffff',
  border: 'none',
  borderRadius: '6px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 600
};
