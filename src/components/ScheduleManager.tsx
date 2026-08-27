import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Loader2,
  FileCode,
  Download,
  Copy,
  Check,
  X,
  Camera,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Key,
  ScanLine,
  Eye,
  EyeOff,
  Trash2,
  ArrowRight,
  FileText
} from "lucide-react";

interface Subject {
  id: string | number;
  name: string;
  code?: string;
}

interface TimetableItem {
  id: string | number;
  week: number;
  day: number | string; // 2 -> 6 hoặc 'Thứ 2'..'Thứ 6'
  session: string; // 'Sáng' | 'Chiều'
  period: number; // 1 -> 5 (Sáng), 1 -> 4 (Chiều)
  subject_id: string | number | null;
  subject_name?: string;
}

const WEEKS = Array.from({ length: 36 }, (_, i) => i + 1);

const DAYS = [
  { key: 2, label: "Thứ 2" },
  { key: 3, label: "Thứ 3" },
  { key: 4, label: "Thứ 4" },
  { key: 5, label: "Thứ 5" },
  { key: 6, label: "Thứ 6" }
];

const ROWS = [
  { session: "Sáng", period: 1, label: "Sáng - Tiết 1" },
  { session: "Sáng", period: 2, label: "Sáng - Tiết 2" },
  { session: "Sáng", period: 3, label: "Sáng - Tiết 3" },
  { session: "Sáng", period: 4, label: "Sáng - Tiết 4" },
  { session: "Sáng", period: 5, label: "Sáng - Tiết 5" },
  { session: "Chiều", period: 1, label: "Chiều - Tiết 1" },
  { session: "Chiều", period: 2, label: "Chiều - Tiết 2" },
  { session: "Chiều", period: 3, label: "Chiều - Tiết 3" },
  { session: "Chiều", period: 4, label: "Chiều - Tiết 4" }
];

// Fallback subjects if DB is unseeded
const DEFAULT_SUBJECTS: Subject[] = [
  { id: "1", name: "Toán" },
  { id: "2", name: "Ngữ Văn" },
  { id: "3", name: "Tiếng Anh" },
  { id: "4", name: "Vật Lý" },
  { id: "5", name: "Hóa Học" },
  { id: "6", name: "Sinh Học" },
  { id: "7", name: "Lịch Sử" },
  { id: "8", name: "Địa Lý" },
  { id: "9", name: "GDCD" },
  { id: "10", name: "Tin Học" },
  { id: "11", name: "Công Nghệ" },
  { id: "12", name: "Thể Dục" },
  { id: "13", name: "Quốc Phòng" },
  { id: "14", name: "Chào Cờ / SHL" }
];

export default function ScheduleManager() {
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingSlot, setUpdatingSlot] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Import JSON Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [jsonText, setJsonText] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Export JSON Modal States
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportJsonText, setExportJsonText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Mistral AI Timetable OCR Scanning Modal States
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiInputMode, setAiInputMode] = useState<"upload" | "camera">("upload");
  const [aiImageBase64, setAiImageBase64] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [mistralKeyInput, setMistralKeyInput] = useState<string>(
    () => localStorage.getItem("MISTRAL_API_KEY") || ""
  );
  const [hasServerApiKey, setHasServerApiKey] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [aiStepMessage, setAiStepMessage] = useState<string>("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResultJson, setAiResultJson] = useState<Record<string, number[]> | null>(null);
  const [aiOcrMarkdown, setAiOcrMarkdown] = useState<string | null>(null);
  const [showOcrText, setShowOcrText] = useState<boolean>(false);
  const [copiedAiJson, setCopiedAiJson] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Check server-side Mistral API key availability
  useEffect(() => {
    fetch("/api/mistral/status")
      .then(res => res.json())
      .then(data => {
        if (data.hasEnvApiKey) setHasServerApiKey(true);
      })
      .catch(() => {});
  }, []);

  // Camera Management
  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setAiError(null);
    } catch (err) {
      console.error("Camera access error:", err);
      setAiError(
        "Không thể mở camera. Vui lòng cho phép quyền sử dụng camera trong trình duyệt hoặc sử dụng tính năng tải tệp ảnh."
      );
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setAiImageBase64(dataUrl);
      stopCamera();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAiError("Vui lòng chọn một tệp hình ảnh (ví dụ: .jpg, .png, .webp).");
      return;
    }
    const reader = new FileReader();
    reader.onload = event => {
      if (event.target?.result) {
        setAiImageBase64(String(event.target.result));
        setAiError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Build subject mapping string dynamically from current database subject list
  const buildSubjectMappingPrompt = () => {
    const mappingLines = subjects.map(s => `(${s.id}, '${s.name}')`).join(", ");
    return `BẢNG ÁNH XẠ SUBJECT_ID:\n\n0: Không có tiết / Ô trống / Chào cờ / Sinh hoạt lớp\n${mappingLines}`;
  };

  // Call Mistral AI OCR & Chat Completion via backend proxy
  const handleProcessAiImage = async () => {
    if (!aiImageBase64) {
      setAiError("Vui lòng tải ảnh lên hoặc chụp ảnh thời khóa biểu trước.");
      return;
    }

    const effectiveKey = mistralKeyInput.trim();
    if (!effectiveKey && !hasServerApiKey) {
      setAiError("Vui lòng nhập Mistral API Key để sử dụng tính năng này.");
      return;
    }

    if (effectiveKey) {
      localStorage.setItem("MISTRAL_API_KEY", effectiveKey);
    }

    setIsAiProcessing(true);
    setAiError(null);
    setAiStepMessage("Đang tải ảnh và gửi yêu cầu OCR đến Mistral AI...");

    try {
      const res = await fetch("/api/mistral/process-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: effectiveKey || undefined,
          imageBase64: aiImageBase64,
          promptMapping: buildSubjectMappingPrompt()
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể xử lý ảnh bằng Mistral AI.");
      }

      setAiOcrMarkdown(data.ocrMarkdown || null);
      setAiResultJson(data.timetableJson);
      setAiStepMessage("Trích xuất và quét thời khóa biểu bằng AI thành công!");
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setAiError(errorObj.message || "Đã xảy ra lỗi khi xử lý bằng Mistral AI.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleApplyAiJsonToSchedule = async () => {
    if (!aiResultJson) return;
    setIsAiModalOpen(false);
    stopCamera();

    // Direct apply to current selected week
    try {
      setIsImporting(true);
      const updatePromises = [];
      const requiredKeys = ["2", "3", "4", "5", "6"];

      for (const dayKeyStr of requiredKeys) {
        const dayNum = Number(dayKeyStr);
        const arr = aiResultJson[dayKeyStr] || [];

        for (let i = 0; i < 9; i++) {
          const sessionStr = i < 5 ? "Sáng" : "Chiều";
          const periodNum = i < 5 ? i + 1 : i - 4;
          const rawVal = arr[i] || 0;
          const subjectId = rawVal === 0 ? null : rawVal;

          const cellRecord = findCellRecord(dayNum, sessionStr, periodNum);

          if (cellRecord && cellRecord.id && !String(cellRecord.id).startsWith("w")) {
            updatePromises.push(
              supabase
                .from("timetable")
                .update({ subject_id: subjectId })
                .eq("id", cellRecord.id)
            );
          } else {
            const dayToMatch = cellRecord?.day || dayNum;
            const sessionToMatch = cellRecord?.session || sessionStr;

            updatePromises.push(
              supabase
                .from("timetable")
                .update({ subject_id: subjectId })
                .eq("week", selectedWeek)
                .eq("day", dayToMatch)
                .eq("session", sessionToMatch)
                .eq("period", periodNum)
            );
          }
        }
      }

      await Promise.all(updatePromises);
      setNotification({
        type: "success",
        message: `Đã áp dụng Thời Khóa Biểu do AI quét vào Tuần ${selectedWeek} thành công!`
      });
      await fetchTimetable(selectedWeek);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setNotification({
        type: "error",
        message: `Lỗi khi lưu thời khóa biểu: ${errorObj.message || "Không thể cập nhật CSDL"}`
      });
    } finally {
      setIsImporting(false);
    }
  };

  // 1. Timetable Fetch Callback

  // 2. Fetch Timetable for the Selected Week
  const fetchTimetable = useCallback(async (week: number) => {
    setLoading(true);
    setNotification(null);
    try {
      const { data, error } = await supabase
        .from("timetable")
        .select("*")
        .eq("week", week)
        .order("day", { ascending: true })
        .order("session", { ascending: true })
        .order("period", { ascending: true });

      if (!error && data) {
        setTimetable(data);
      } else {
        // Mock fallback records for seamless interaction if table empty
        const mockTimetable: TimetableItem[] = [];
        DAYS.forEach(d => {
          ROWS.forEach(r => {
            mockTimetable.push({
              id: `w${week}_d${d.key}_${r.session}_p${r.period}`,
              week: week,
              day: d.key,
              session: r.session,
              period: r.period,
              subject_id: null
            });
          });
        });
        setTimetable(mockTimetable);
      }
    } catch {
      // Create empty slots if offline
      const mockTimetable: TimetableItem[] = [];
      DAYS.forEach(d => {
        ROWS.forEach(r => {
          mockTimetable.push({
            id: `w${week}_d${d.key}_${r.session}_p${r.period}`,
            week: week,
            day: d.key,
            session: r.session,
            period: r.period,
            subject_id: null
          });
        });
      });
      setTimetable(mockTimetable);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const { data, error } = await supabase
          .from("subject_catalog")
          .select("id, name")
          .order("id", { ascending: true });

        if (ignore) return;
        if (!error && data && data.length > 0) {
          setSubjects(data);
        } else {
          setSubjects(DEFAULT_SUBJECTS);
        }
      } catch {
        if (!ignore) setSubjects(DEFAULT_SUBJECTS);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setNotification(null);
      try {
        const { data, error } = await supabase
          .from("timetable")
          .select("*")
          .eq("week", selectedWeek)
          .order("day", { ascending: true })
          .order("session", { ascending: true })
          .order("period", { ascending: true });

        if (ignore) return;
        if (!error && data) {
          setTimetable(data);
        } else {
          const mockTimetable: TimetableItem[] = [];
          DAYS.forEach(d => {
            ROWS.forEach(r => {
              mockTimetable.push({
                id: `w${selectedWeek}_d${d.key}_${r.session}_p${r.period}`,
                week: selectedWeek,
                day: d.key,
                session: r.session,
                period: r.period,
                subject_id: null
              });
            });
          });
          setTimetable(mockTimetable);
        }
      } catch {
        if (!ignore) {
          const mockTimetable: TimetableItem[] = [];
          DAYS.forEach(d => {
            ROWS.forEach(r => {
              mockTimetable.push({
                id: `w${selectedWeek}_d${d.key}_${r.session}_p${r.period}`,
                week: selectedWeek,
                day: d.key,
                session: r.session,
                period: r.period,
                subject_id: null
              });
            });
          });
          setTimetable(mockTimetable);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [selectedWeek]);

  // Helper to safely match session values (string or number)
  const isMatchingSession = (itemSession: unknown, targetSession: string): boolean => {
    if (itemSession === null || itemSession === undefined) return false;
    const str = String(itemSession).trim().toLowerCase();
    const target = targetSession.trim().toLowerCase();
    if (str === target) return true;
    if (target === "sáng" && (str === "1" || str === "morning" || str === "sang")) return true;
    if (target === "chiều" && (str === "2" || str === "afternoon" || str === "chieu")) return true;
    return false;
  };

  // Helper to find cell record in current timetable
  const findCellRecord = (dayKey: number, session: string, period: number): TimetableItem | undefined => {
    return timetable.find(
      item =>
        (Number(item.day) === dayKey ||
          item.day === `Thứ ${dayKey}` ||
          item.day === `Thứ ${dayKey === 2 ? "Hai" : dayKey === 3 ? "Ba" : dayKey === 4 ? "Tư" : dayKey === 5 ? "Năm" : "Sáu"}`) &&
        isMatchingSession(item.session, session) &&
        Number(item.period) === Number(period)
    );
  };

  // 3. Handle Subject Change (UPDATE subject_id)
  const handleSubjectChange = async (
    dayKey: number,
    session: string,
    period: number,
    newSubjectId: string
  ) => {
    const slotKey = `${dayKey}_${session}_${period}`;
    setUpdatingSlot(slotKey);
    setNotification(null);

    const record = findCellRecord(dayKey, session, period);
    const valToSave = newSubjectId === "" ? null : newSubjectId;

    // Optimistic UI update
    setTimetable(prev =>
      prev.map(item => {
        if (
          (Number(item.day) === dayKey || String(item.day).includes(String(dayKey))) &&
          isMatchingSession(item.session, session) &&
          Number(item.period) === Number(period)
        ) {
          return { ...item, subject_id: valToSave };
        }
        return item;
      })
    );

    try {
      if (record && record.id && !String(record.id).startsWith("w")) {
        // Direct UPDATE on existing timetable record
        const { error } = await supabase
          .from("timetable")
          .update({ subject_id: valToSave })
          .eq("id", record.id);

        if (error) throw error;
      } else {
        // If query by week, day, session, period directly for UPDATE
        const { error } = await supabase
          .from("timetable")
          .update({ subject_id: valToSave })
          .eq("week", selectedWeek)
          .eq("day", dayKey)
          .eq("session", session)
          .eq("period", period);

        if (error) {
          // If no row existed to update, perform upsert/insert gracefully
          await supabase.from("timetable").upsert(
            {
              week: selectedWeek,
              day: dayKey,
              session: session,
              period: period,
              subject_id: valToSave
            },
            { onConflict: "week,day,session,period" }
          );
        }
      }

      const updatedSubName = subjects.find(s => String(s.id) === String(newSubjectId))?.name || "Bỏ trống";
      setNotification({
        type: "success",
        message: `Đã cập nhật môn [${updatedSubName}] cho Thứ ${dayKey} - ${session} (Tiết ${period})`
      });
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setNotification({
        type: "error",
        message: `Lỗi cập nhật: ${errorObj.message || "Không thể kết nối cơ sở dữ liệu"}`
      });
    } finally {
      setUpdatingSlot(null);
    }
  };

  // 4. Validate JSON Input according to strict rules
  const validateImportJson = (text: string): { valid: true; data: Record<string, number[]> } | { valid: false; error: string } => {
    if (!text.trim()) {
      return { valid: false, error: "Vui lòng dán nội dung JSON vào ô bên dưới." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { valid: false, error: "Cú pháp JSON không hợp lệ. Vui lòng kiểm tra lại định dạng." };
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { valid: false, error: "JSON phải là một object (ví dụ: {\"2\": [...], \"3\": [...]})." };
    }

    const obj = parsed as Record<string, unknown>;
    const keys = Object.keys(obj);
    const requiredKeys = ["2", "3", "4", "5", "6"];

    if (keys.length !== requiredKeys.length) {
      return {
        valid: false,
        error: `JSON chỉ được chứa đúng 5 key: "2", "3", "4", "5", "6". Số lượng key hiện tại: ${keys.length}.`
      };
    }

    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        return {
          valid: false,
          error: `Thiếu key "${key}" (Thứ ${key}) trong JSON.`
        };
      }
    }

    for (const key of keys) {
      if (!requiredKeys.includes(key)) {
        return {
          valid: false,
          error: `Phát hiện key không hợp lệ: "${key}". Chỉ chấp nhận các key từ "2" đến "6".`
        };
      }
    }

    for (const key of requiredKeys) {
      const val = obj[key];
      if (!Array.isArray(val)) {
        return {
          valid: false,
          error: `Giá trị của key "${key}" (Thứ ${key}) phải là một mảng.`
        };
      }

      if (val.length !== 9) {
        return {
          valid: false,
          error: `Ngày thứ ${key} có ${val.length} tiết, yêu cầu phải có đúng 9 tiết.`
        };
      }

      for (let i = 0; i < val.length; i++) {
        const item = val[i];
        const sessionLabel = i < 5 ? `Sáng tiết ${i + 1}` : `Chiều tiết ${i - 4}`;

        if (typeof item !== "number" || !Number.isInteger(item)) {
          const valDisplay = typeof item === "string" ? `"${item}"` : String(item);
          return {
            valid: false,
            error: `Thứ ${key} (${sessionLabel}) có giá trị ${valDisplay}, chỉ chấp nhận số nguyên.`
          };
        }

        if (item < 0) {
          return {
            valid: false,
            error: `Thứ ${key} (${sessionLabel}) có giá trị ${item} nhỏ hơn 0. Tất cả subject_id phải >= 0.`
          };
        }
      }
    }

    return { valid: true, data: obj as Record<string, number[]> };
  };

  // 5. Handle Import JSON Submit (Batch UPDATE)
  const handleImportJson = async () => {
    setImportError(null);
    const result = validateImportJson(jsonText);
    if (!result.valid) {
      setImportError(result.error);
      return;
    }

    setIsImporting(true);
    try {
      const data = result.data;
      const requiredKeys = ["2", "3", "4", "5", "6"];
      const updatePromises = [];

      for (const dayKeyStr of requiredKeys) {
        const dayNum = Number(dayKeyStr);
        const arr = data[dayKeyStr];

        for (let i = 0; i < 9; i++) {
          const sessionStr = i < 5 ? "Sáng" : "Chiều";
          const periodNum = i < 5 ? i + 1 : i - 4;
          const rawVal = arr[i];
          const subjectId = rawVal === 0 ? null : rawVal; // 0 -> NULL in DB, > 0 -> subject_id

          const cellRecord = findCellRecord(dayNum, sessionStr, periodNum);

          if (cellRecord && cellRecord.id && !String(cellRecord.id).startsWith("w")) {
            updatePromises.push(
              supabase
                .from("timetable")
                .update({ subject_id: subjectId })
                .eq("id", cellRecord.id)
            );
          } else {
            const dayToMatch = cellRecord?.day || dayNum;
            const sessionToMatch = cellRecord?.session || sessionStr;

            updatePromises.push(
              supabase
                .from("timetable")
                .update({ subject_id: subjectId })
                .eq("week", selectedWeek)
                .eq("day", dayToMatch)
                .eq("session", sessionToMatch)
                .eq("period", periodNum)
            );
          }
        }
      }

      const results = await Promise.all(updatePromises);
      const firstError = results.find(r => r.error)?.error;

      if (firstError) {
        throw firstError;
      }

      setIsImportModalOpen(false);
      setJsonText("");
      setNotification({
        type: "success",
        message: `Import thời khóa biểu Tuần ${selectedWeek} thành công!`
      });

      await fetchTimetable(selectedWeek);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setImportError(`Lỗi lưu vào cơ sở dữ liệu: ${errorObj.message || "Không thể thực hiện cập nhật"}`);
    } finally {
      setIsImporting(false);
    }
  };

  // 6. Handle Export JSON Generation
  const handleOpenExport = () => {
    const requiredKeys = ["2", "3", "4", "5", "6"];
    const exportData: Record<string, number[]> = {};

    for (const dayKeyStr of requiredKeys) {
      const dayNum = Number(dayKeyStr);
      const dayPeriods: number[] = [];

      for (let i = 0; i < 9; i++) {
        const sessionStr = i < 5 ? "Sáng" : "Chiều";
        const periodNum = i < 5 ? i + 1 : i - 4;
        const cellRecord = findCellRecord(dayNum, sessionStr, periodNum);

        if (cellRecord && cellRecord.subject_id !== null && cellRecord.subject_id !== undefined && cellRecord.subject_id !== "") {
          const parsedId = Number(cellRecord.subject_id);
          dayPeriods.push(isNaN(parsedId) ? 0 : parsedId);
        } else {
          dayPeriods.push(0);
        }
      }

      exportData[dayKeyStr] = dayPeriods;
    }

    setExportJsonText(JSON.stringify(exportData, null, 2));
    setCopied(false);
    setIsExportModalOpen(true);
  };

  const handleCopyExportJson = () => {
    navigator.clipboard.writeText(exportJsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadExportJson = () => {
    const blob = new Blob([exportJsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thoikhoabieu_tuan_${selectedWeek}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>
      {/* HEADER SECTION */}
      <div style={styles.headerCard}>
        <div style={styles.headerLeft}>
          <div style={styles.iconCircle}>
            <CalendarDays size={24} color="#2563eb" />
          </div>
          <div>
            <h2 style={styles.title}>Quản Lý Thời Khóa Biểu</h2>
          </div>
        </div>

        {/* WEEK SELECTOR & IMPORT BUTTON */}
        <div style={styles.weekSelectorBox}>
          <label htmlFor="week-select" style={styles.weekLabel}>
            <BookOpen size={16} /> Chọn Tuần:
          </label>
          <select
            id="week-select"
            value={selectedWeek}
            onChange={e => setSelectedWeek(Number(e.target.value))}
            style={styles.weekSelect}
          >
            {WEEKS.map(w => (
              <option key={w} value={w}>
                Tuần {w}
              </option>
            ))}
          </select>
          <button
            onClick={() => fetchTimetable(selectedWeek)}
            style={styles.refreshBtn}
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => {
              setIsAiModalOpen(true);
              setAiError(null);
            }}
            style={styles.aiBtn}
            title="Chụp/Tải ảnh thời khóa biểu và xử lý bằng AI Mistral"
          >
            <Sparkles size={16} /> Quét TKB bằng AI
          </button>
          <button
            onClick={() => {
              setIsImportModalOpen(true);
              setImportError(null);
            }}
            style={styles.importBtn}
            title="Import thời khóa biểu từ mã JSON"
          >
            <FileCode size={16} /> Import JSON
          </button>
          <button
            onClick={handleOpenExport}
            style={styles.exportBtn}
            title="Export thời khóa biểu Tuần này ra mã JSON"
          >
            <Download size={16} /> Export JSON
          </button>
        </div>
      </div>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div
          style={{
            ...styles.notificationBox,
            backgroundColor: notification.type === "success" ? "#f0fdf4" : "#fef2f2",
            color: notification.type === "success" ? "#166534" : "#991b1b",
            borderColor: notification.type === "success" ? "#bbf7d0" : "#fecaca"
          }}
        >
          {notification.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* TIMETABLE TABLE CONTAINER */}
      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.loadingContainer}>
            <Loader2 size={32} color="#2563eb" className="animate-spin" />
            <span style={{ fontSize: "14px", color: "#64748b", fontWeight: 600 }}>
              Đang tải thời khóa biểu Tuần {selectedWeek}...
            </span>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: "160px", textAlign: "center" }}>
                    Buổi - Tiết
                  </th>
                  {DAYS.map(d => (
                    <th key={d.key} style={styles.th}>
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, idx) => {
                  const isSessionBoundary = idx === 5; // Start of Chiều

                  return (
                    <tr
                      key={`${row.session}_${row.period}`}
                      style={{
                        backgroundColor:
                          row.session === "Sáng" ? "#ffffff" : "#f8fafc",
                        borderTop: isSessionBoundary ? "2px solid #cbd5e1" : "1px solid #f1f5f9"
                      }}
                    >
                      {/* ROW LABEL */}
                      <td style={styles.rowHeaderTd}>
                        <div
                          style={{
                            ...styles.sessionTag,
                            backgroundColor:
                              row.session === "Sáng" ? "#dbeafe" : "#ffedd5",
                            color: row.session === "Sáng" ? "#1e40af" : "#9a3412"
                          }}
                        >
                          {row.label}
                        </div>
                      </td>

                      {/* DAYS COLUMNS */}
                      {DAYS.map(d => {
                        const cellRecord = findCellRecord(d.key, row.session, row.period);
                        const currentSubjectId = cellRecord?.subject_id
                          ? String(cellRecord.subject_id)
                          : "";
                        const slotKey = `${d.key}_${row.session}_${row.period}`;
                        const isUpdating = updatingSlot === slotKey;

                        return (
                          <td key={d.key} style={styles.cellTd}>
                            <div style={styles.selectWrapper}>
                              <select
                                value={currentSubjectId}
                                onChange={e =>
                                  handleSubjectChange(
                                    d.key,
                                    row.session,
                                    row.period,
                                    e.target.value
                                  )
                                }
                                disabled={isUpdating}
                                style={{
                                  ...styles.subjectSelect,
                                  backgroundColor: currentSubjectId
                                    ? "#eff6ff"
                                    : "#ffffff",
                                  borderColor: currentSubjectId
                                    ? "#93c5fd"
                                    : "#cbd5e1",
                                  color: currentSubjectId ? "#1e3a8a" : "#64748b",
                                  fontWeight: currentSubjectId ? 700 : 500
                                }}
                              >
                                <option value="">-- Bỏ trống --</option>
                                {subjects.map(s => (
                                  <option key={String(s.id)} value={String(s.id)}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                              {isUpdating && (
                                <div style={styles.spinnerOverlay}>
                                  <Loader2 size={14} color="#2563eb" className="animate-spin" />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* IMPORT JSON DIALOG MODAL */}
      {isImportModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsImportModalOpen(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={styles.modalIconCircle}>
                  <FileCode size={20} color="#2563eb" />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>Import JSON - Tuần {selectedWeek}</h3>
                  <p style={styles.modalSubtitle}>Dán mã JSON do AI OCR sinh ra để cập nhật thời khóa biểu</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportError(null);
                }}
                style={styles.closeBtn}
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {importError && (
                <div style={styles.errorBanner}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{importError}</span>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={styles.formLabel}>Mã JSON thời khóa biểu:</label>
                <textarea
                  rows={8}
                  value={jsonText}
                  onChange={e => {
                    setJsonText(e.target.value);
                    if (importError) setImportError(null);
                  }}
                  placeholder={`{\n  "2": [0,0,9,1,2,7,2,0,0],\n  "3": [2,8,4,3,14,2,11,0,0],\n  "4": [13,12,1,2,5,1,1,0,0],\n  "5": [1,12,4,3,3,7,0,0,0],\n  "6": [18,3,17,8,6,10,3,0,0]\n}`}
                  style={styles.monospaceTextarea}
                  autoFocus
                />
              </div>

              <div style={styles.exampleBox}>
                <div style={styles.exampleHeader}>
                  Ví dụ định dạng JSON hợp lệ:
                </div>
                <pre style={styles.examplePre}>
{`{
  "2": [0,0,9,1,2,7,2,0,0],
  "3": [2,8,4,3,14,2,11,0,0],
  "4": [13,12,1,2,5,1,1,0,0],
  "5": [1,12,4,3,3,7,0,0,0],
  "6": [18,3,17,8,6,10,3,0,0]
}`}
                </pre>
                <p style={styles.exampleNote}>
                  * Key: "2" đến "6" (Thứ 2 - Thứ 6). Mảng có đúng 9 số nguyên (5 tiết sáng, 4 tiết chiều). 0 = trống, &gt;0 = subject_id.
                </p>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportError(null);
                }}
                disabled={isImporting}
                style={styles.cancelBtn}
              >
                Hủy
              </button>
              <button
                onClick={handleImportJson}
                disabled={isImporting}
                style={styles.submitBtn}
              >
                {isImporting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Đang Import...
                  </>
                ) : (
                  "Import"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT JSON DIALOG MODAL */}
      {isExportModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsExportModalOpen(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ ...styles.modalIconCircle, backgroundColor: "#f0fdf4" }}>
                  <Download size={20} color="#16a34a" />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>Export JSON - Tuần {selectedWeek}</h3>
                  <p style={styles.modalSubtitle}>Mã JSON thời khóa biểu của Tuần {selectedWeek}</p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                style={styles.closeBtn}
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={styles.formLabel}>Mã JSON được sinh ra:</label>
                <textarea
                  rows={9}
                  readOnly
                  value={exportJsonText}
                  style={styles.monospaceTextarea}
                />
              </div>

              <div style={styles.exampleBox}>
                <p style={{ ...styles.exampleNote, margin: 0 }}>
                  * Định dạng gồm 5 thứ ("2" - "6"), mỗi thứ chứa mảng 9 số nguyên tương ứng với id môn học (5 tiết sáng, 4 tiết chiều, 0 = trống).
                </p>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={handleCopyExportJson}
                style={{
                  ...styles.cancelBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  borderColor: copied ? "#86efac" : "#cbd5e1",
                  backgroundColor: copied ? "#f0fdf4" : "#ffffff",
                  color: copied ? "#166534" : "#475569"
                }}
              >
                {copied ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
                {copied ? "Đã sao chép!" : "Sao chép JSON"}
              </button>
              <button
                onClick={handleDownloadExportJson}
                style={{
                  ...styles.submitBtn,
                  backgroundColor: "#16a34a"
                }}
              >
                <Download size={16} /> Tải về (.json)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MISTRAL AI OCR TIMETABLE SCANNER MODAL */}
      {isAiModalOpen && (
        <div style={styles.modalOverlay} onClick={() => { setIsAiModalOpen(false); stopCamera(); }}>
          <div style={{ ...styles.modalContent, maxWidth: "720px" }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ ...styles.modalIconCircle, backgroundColor: "#f0f9ff" }}>
                  <Sparkles size={20} color="#0284c7" />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>Quét Thời Khóa Biểu bằng AI (Mistral OCR)</h3>
                  <p style={styles.modalSubtitle}>Chụp hoặc tải ảnh thời khóa biểu để AI tự động đọc và xuất mã JSON</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAiModalOpen(false);
                  stopCamera();
                }}
                style={styles.closeBtn}
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* ERROR BANNER */}
              {aiError && (
                <div style={styles.errorBanner}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>{aiError}</span>
                </div>
              )}

              {/* MISTRAL API KEY CONFIG */}
              <div style={styles.aiConfigCard}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                  <label style={{ ...styles.formLabel, display: "flex", alignItems: "center", gap: "6px" }}>
                    <Key size={15} color="#0284c7" /> Mistral API Key:
                  </label>
                  {hasServerApiKey && (
                    <span style={styles.serverKeyBadge}>
                      <CheckCircle2 size={12} /> Đã sẵn sàng MISTRAL_API_KEY từ Server
                    </span>
                  )}
                </div>
                <div style={{ position: "relative", marginTop: "6px" }}>
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={mistralKeyInput}
                    onChange={e => setMistralKeyInput(e.target.value)}
                    placeholder={hasServerApiKey ? "(Sử dụng key mặc định từ server hoặc nhập key riêng tại đây)" : "Nhập API Key Mistral của bạn (ví dụ: g0R...)"}
                    style={{ ...styles.apiKeyInput, paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={styles.showKeyBtn}
                    title={showApiKey ? "Ẩn Key" : "Hiện Key"}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* INPUT MODE TABS */}
              <div style={styles.tabBar}>
                <button
                  onClick={() => {
                    setAiInputMode("upload");
                    stopCamera();
                  }}
                  style={{
                    ...styles.tabBtn,
                    ...(aiInputMode === "upload" ? styles.activeTabBtn : {})
                  }}
                >
                  <Upload size={16} /> Tải Tệp Ảnh
                </button>
                <button
                  onClick={() => {
                    setAiInputMode("camera");
                    startCamera();
                  }}
                  style={{
                    ...styles.tabBtn,
                    ...(aiInputMode === "camera" ? styles.activeTabBtn : {})
                  }}
                >
                  <Camera size={16} /> Chụp Ảnh Trực Tiếp
                </button>
              </div>

              {/* CAMERA MODE CONTAINER */}
              {aiInputMode === "camera" && (
                <div style={styles.cameraBox}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: "100%",
                      maxHeight: "300px",
                      borderRadius: "12px",
                      backgroundColor: "#000",
                      display: isCameraActive ? "block" : "none"
                    }}
                  />
                  <canvas ref={canvasRef} style={{ display: "none" }} />

                  {isCameraActive ? (
                    <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "10px" }}>
                      <button onClick={capturePhoto} style={styles.captureBtn}>
                        <ScanLine size={16} /> Chụp Ảnh Ngay
                      </button>
                      <button onClick={stopCamera} style={styles.secondaryBtn}>
                        Tắt Camera
                      </button>
                    </div>
                  ) : (
                    <button onClick={startCamera} style={styles.captureBtn}>
                      <Camera size={16} /> Mở Lại Camera
                    </button>
                  )}
                </div>
              )}

              {/* UPLOAD MODE CONTAINER */}
              {aiInputMode === "upload" && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith("image/")) {
                        const reader = new FileReader();
                        reader.onload = ev => {
                          if (ev.target?.result) setAiImageBase64(String(ev.target.result));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={styles.dropZone}
                  >
                    <div style={styles.dropZoneIconCircle}>
                      <ImageIcon size={28} color="#0284c7" />
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>
                      Nhấp vào đây để chọn tệp ảnh hoặc kéo thả thời khóa biểu
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      Hỗ trợ định dạng: JPG, PNG, WEBP...
                    </div>
                  </div>
                </div>
              )}

              {/* PREVIEW IMAGE IF SELECTED */}
              {aiImageBase64 && (
                <div style={styles.previewCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                      Ảnh Thời Khóa Biểu Đã Chọn:
                    </span>
                    <button
                      onClick={() => {
                        setAiImageBase64(null);
                        setAiResultJson(null);
                        setAiOcrMarkdown(null);
                      }}
                      style={styles.removeImageBtn}
                      title="Xóa ảnh này"
                    >
                      <Trash2 size={14} /> Xóa ảnh
                    </button>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={aiImageBase64}
                      alt="Thời khóa biểu preview"
                      style={{ maxHeight: "220px", maxWidth: "100%", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                  </div>
                </div>
              )}

              {/* PROCESS ACTION BUTTON */}
              {aiImageBase64 && !aiResultJson && (
                <div style={{ textAlign: "center", marginTop: "10px" }}>
                  <button
                    onClick={handleProcessAiImage}
                    disabled={isAiProcessing}
                    style={{
                      ...styles.processAiBtn,
                      opacity: isAiProcessing ? 0.7 : 1,
                      cursor: isAiProcessing ? "not-allowed" : "pointer"
                    }}
                  >
                    {isAiProcessing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>{aiStepMessage || "Đang gửi ảnh & xử lý AI..."}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        <span>Xử Lý &amp; Tạo JSON Bằng Mistral AI</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* AI RESULT SECTION */}
              {aiResultJson && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
                  <div style={styles.successBanner}>
                    <CheckCircle2 size={18} color="#16a34a" />
                    <span style={{ fontWeight: 700 }}>AI đã đọc ảnh và trích xuất JSON thành công!</span>
                  </div>

                  {/* TIMETABLE PREVIEW TABLE FROM AI RESULT */}
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", backgroundColor: "#f8fafc", fontWeight: 700, fontSize: "13px", borderBottom: "1px solid #e2e8f0" }}>
                      Xem trước Thời Khóa Biểu do AI kết xuất:
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#f1f5f9" }}>
                            <th style={{ padding: "8px", border: "1px solid #e2e8f0", width: "110px", textAlign: "center" }}>
                              Buổi - Tiết
                            </th>
                            {DAYS.map(d => (
                              <th key={d.key} style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                                {d.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ROWS.map((row, idx) => (
                            <tr key={`${row.session}_${row.period}`}>
                              <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", fontWeight: 700, backgroundColor: "#f8fafc", textAlign: "center" }}>
                                {row.label}
                              </td>
                              {DAYS.map(d => {
                                const arr = aiResultJson[String(d.key)] || [];
                                const subId = arr[idx] || 0;
                                const subName = subjects.find(s => String(s.id) === String(subId))?.name || (subId === 0 ? "Trống" : `Môn id:${subId}`);
                                return (
                                  <td
                                    key={d.key}
                                    style={{
                                      padding: "6px 8px",
                                      border: "1px solid #e2e8f0",
                                      textAlign: "center",
                                      backgroundColor: subId === 0 ? "#ffffff" : "#eff6ff",
                                      color: subId === 0 ? "#94a3b8" : "#1e40af",
                                      fontWeight: subId === 0 ? 400 : 700
                                    }}
                                  >
                                    {subName}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* EXTRACTED JSON CODE */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={styles.formLabel}>Mã JSON sinh ra từ AI:</label>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(aiResultJson, null, 2));
                          setCopiedAiJson(true);
                          setTimeout(() => setCopiedAiJson(false), 2000);
                        }}
                        style={styles.smallCopyBtn}
                      >
                        {copiedAiJson ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                        {copiedAiJson ? "Đã chép" : "Sao chép JSON"}
                      </button>
                    </div>
                    <textarea
                      rows={8}
                      readOnly
                      value={JSON.stringify(aiResultJson, null, 2)}
                      style={styles.monospaceTextarea}
                    />
                  </div>

                  {/* OCR MARKDOWN TOGGLE */}
                  {aiOcrMarkdown && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowOcrText(!showOcrText)}
                        style={styles.toggleOcrBtn}
                      >
                        <FileText size={14} />
                        {showOcrText ? "Ẩn văn bản OCR thô" : "Xem văn bản OCR do Mistral nhận diện"}
                      </button>
                      {showOcrText && (
                        <div style={{ marginTop: "6px" }}>
                          <textarea
                            rows={6}
                            readOnly
                            value={aiOcrMarkdown}
                            style={{ ...styles.monospaceTextarea, fontSize: "12px", backgroundColor: "#f1f5f9" }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => {
                  setIsAiModalOpen(false);
                  stopCamera();
                }}
                style={styles.cancelBtn}
              >
                Đóng
              </button>
              {aiResultJson && (
                <button
                  onClick={handleApplyAiJsonToSchedule}
                  style={{ ...styles.submitBtn, backgroundColor: "#0284c7" }}
                >
                  <ArrowRight size={16} /> Áp dụng vào Tuần {selectedWeek}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "100%",
    boxSizing: "border-box"
  },
  headerCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "16px",
    backgroundColor: "#ffffff",
    padding: "20px 24px",
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "14px"
  },
  iconCircle: {
    width: "48px",
    height: "48px",
    borderRadius: "14px",
    backgroundColor: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 800,
    color: "#0f172a"
  },
  adminBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    fontWeight: 800,
    color: "#2563eb",
    backgroundColor: "#dbeafe",
    padding: "3px 8px",
    borderRadius: "20px"
  },
  subtitle: {
    margin: "4px 0 0 0",
    fontSize: "13px",
    color: "#64748b"
  },
  weekSelectorBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "#f8fafc",
    padding: "8px 14px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    flexWrap: "wrap"
  },
  weekLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#334155"
  },
  weekSelect: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #94a3b8",
    fontSize: "14px",
    fontWeight: 700,
    color: "#0f172a",
    backgroundColor: "#ffffff",
    outline: "none",
    cursor: "pointer"
  },
  refreshBtn: {
    padding: "8px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    color: "#475569",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  importBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
  },
  exportBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#16a34a",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
  },
  notificationBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 18px",
    borderRadius: "12px",
    border: "1px solid",
    fontSize: "13px",
    fontWeight: 600,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
  },
  tableCard: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 20px",
    gap: "12px"
  },
  tableWrapper: {
    overflowX: "auto"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "800px"
  },
  th: {
    padding: "14px 12px",
    backgroundColor: "#f1f5f9",
    color: "#334155",
    fontWeight: 800,
    fontSize: "13px",
    borderBottom: "2px solid #cbd5e1",
    textAlign: "center"
  },
  rowHeaderTd: {
    padding: "10px 14px",
    borderRight: "1px solid #e2e8f0",
    textAlign: "center",
    verticalAlign: "middle"
  },
  sessionTag: {
    fontSize: "12px",
    fontWeight: 700,
    padding: "6px 10px",
    borderRadius: "8px",
    display: "inline-block"
  },
  cellTd: {
    padding: "8px 10px",
    borderRight: "1px solid #f1f5f9",
    verticalAlign: "middle"
  },
  selectWrapper: {
    position: "relative",
    width: "100%"
  },
  subjectSelect: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid",
    fontSize: "13px",
    outline: "none",
    cursor: "pointer",
    boxSizing: "border-box",
    transition: "all 0.15s ease"
  },
  spinnerOverlay: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none"
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "16px"
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "560px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column"
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc"
  },
  modalIconCircle: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    backgroundColor: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  modalTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 800,
    color: "#0f172a"
  },
  modalSubtitle: {
    margin: "2px 0 0 0",
    fontSize: "12px",
    color: "#64748b"
  },
  closeBtn: {
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    padding: "6px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  modalBody: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxHeight: "75vh",
    overflowY: "auto"
  },
  errorBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "12px 14px",
    borderRadius: "10px",
    backgroundColor: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    fontSize: "13px",
    fontWeight: 600
  },
  formLabel: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#334155"
  },
  monospaceTextarea: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    lineHeight: "1.5",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    outline: "none",
    resize: "vertical"
  },
  exampleBox: {
    backgroundColor: "#f1f5f9",
    borderRadius: "10px",
    padding: "12px 14px",
    border: "1px solid #e2e8f0"
  },
  exampleHeader: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#475569",
    marginBottom: "6px"
  },
  examplePre: {
    margin: 0,
    fontSize: "12px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    color: "#1e293b",
    backgroundColor: "#ffffff",
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #e2e8f0",
    overflowX: "auto"
  },
  exampleNote: {
    margin: "8px 0 0 0",
    fontSize: "11px",
    color: "#64748b",
    lineHeight: "1.4"
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "10px",
    padding: "14px 20px",
    borderTop: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc"
  },
  cancelBtn: {
    padding: "9px 16px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    color: "#475569",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer"
  },
  submitBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "9px 20px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
  },
  aiBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#0284c7",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
  },
  aiConfigCard: {
    backgroundColor: "#f0f9ff",
    border: "1px solid #bae6fd",
    borderRadius: "12px",
    padding: "14px"
  },
  serverKeyBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#166534",
    backgroundColor: "#dcfce7",
    padding: "2px 8px",
    borderRadius: "12px"
  },
  apiKeyInput: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "#ffffff"
  },
  showKeyBtn: {
    position: "absolute",
    right: "8px",
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    padding: "4px"
  },
  tabBar: {
    display: "flex",
    gap: "8px",
    backgroundColor: "#f1f5f9",
    padding: "4px",
    borderRadius: "10px"
  },
  tabBtn: {
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "transparent",
    color: "#64748b",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer"
  },
  activeTabBtn: {
    backgroundColor: "#ffffff",
    color: "#0284c7",
    fontWeight: 700,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
  },
  cameraBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "#0f172a",
    padding: "14px",
    borderRadius: "12px"
  },
  captureBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#0284c7",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer"
  },
  secondaryBtn: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    color: "#334155",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer"
  },
  dropZone: {
    border: "2px dashed #0284c7",
    borderRadius: "12px",
    backgroundColor: "#f0f9ff",
    padding: "24px 16px",
    textAlign: "center",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px"
  },
  dropZoneIconCircle: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "#e0f2fe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  previewCard: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "12px"
  },
  removeImageBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    color: "#ef4444",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 600
  },
  processAiBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 28px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "#0284c7",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 4px 6px -1px rgba(2, 132, 199, 0.3)"
  },
  successBanner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 14px",
    borderRadius: "10px",
    backgroundColor: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontSize: "13px"
  },
  smallCopyBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 10px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    fontSize: "12px",
    fontWeight: 600,
    color: "#475569",
    cursor: "pointer"
  },
  toggleOcrBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#0284c7",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "4px 0"
  }
};
