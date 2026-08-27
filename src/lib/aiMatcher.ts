// ============================================================
// DATABASE DEFINITIONS (FROM PYTHON CODE)
// ============================================================

export interface ItemWithAlias {
  id: number;
  name: string;
  alias?: string[];
}

export const STUDENTS: ItemWithAlias[] = [
  { id: 101, name: "Chu Minh Anh", alias: ["Minh Anh"] },
  { id: 102, name: "Hoàng Trang Anh", alias: ["Tr.Anh", "Trang Anh"] },
  { id: 103, name: "Nguyễn Nhật Anh", alias: ["N.Anh"] },
  { id: 104, name: "Nguyễn Tú Anh", alias: ["Tú Anh"] },
  { id: 105, name: "Phan Vũ Châu Anh", alias: ["C.Anh"] },
  { id: 106, name: "Trần Vũ Mai Anh", alias: ["Mai Anh"] },
  { id: 107, name: "Hoàng Minh Châu", alias: ["H.Châu"] },
  { id: 108, name: "Nguyễn Ngọc Minh Châu", alias: ["N.Châu", "Ng.Châu"] },
  { id: 109, name: "Phạm Thùy Dương", alias: ["T.Dương"] },
  { id: 110, name: "Vũ Đăng Dương", alias: ["Đ.Dương"] },
  { id: 111, name: "Phạm Hoàng Đạt", alias: ["Đạt"] },
  { id: 112, name: "Cấn Quang Đức", alias: ["Cấn", "C.Đức"] },
  { id: 113, name: "Hoàng Minh Đức", alias: ["H.Đức"] },
  { id: 114, name: "Nguyễn Minh Đức", alias: ["Ng.Đức"] },
  { id: 115, name: "Trương Thị Vân Giang", alias: ["Giang", "V.Giang", "Vân Giang"] },
  { id: 116, name: "Phùng Thu Hà", alias: ["T.Hà", "Hà"] },
  { id: 117, name: "Đỗ Mạnh Hải", alias: ["Mạnh Hải"] },
  { id: 118, name: "Nguyễn Minh Hải", alias: ["Minh Hải"] },
  { id: 119, name: "Đặng Gia Huy", alias: ["G.Huy", "Huy"] },
  { id: 120, name: "Lưu Quang Khánh", alias: ["Khánh", "Q.Khánh"] },
  { id: 121, name: "Trần Huy Anh Khôi", alias: ["A.Khôi"] },
  { id: 122, name: "Vũ Thành Khôi", alias: ["T.Khôi"] },
  { id: 123, name: "Nguyễn Hương Lan", alias: ["H.Lan"] },
  { id: 124, name: "Nguyễn Phạm Tuyết Lan", alias: ["T.Lan", "Tuyết Lan"] },
  { id: 125, name: "Nguyễn Thanh Loan", alias: ["Loan"] },
  { id: 126, name: "Trần Hải Long", alias: ["Long"] },
  { id: 127, name: "Đào Quang Minh", alias: ["Q.Minh"] },
  { id: 128, name: "Nguyễn Đình Minh", alias: ["Đ.Minh"] },
  { id: 129, name: "Nguyễn Khánh Minh", alias: ["K.Minh"] },
  { id: 130, name: "Nguyễn Tiến Gia Minh", alias: ["G.Minh"] },
  { id: 131, name: "Lê Trà My", alias: ["My"] },
  { id: 132, name: "Nguyễn Khánh Nam", alias: ["K.Nam"] },
  { id: 133, name: "Nguyễn Phương Nam", alias: ["P.Nam"] },
  { id: 134, name: "Nguyễn Thu Ngân", alias: ["Ngân", "T.Ngân"] },
  { id: 135, name: "Trương Tuấn Nghĩa", alias: ["Nghĩa"] },
  { id: 136, name: "Nguyễn Ánh Ngọc", alias: ["A.Ngọc"] },
  { id: 137, name: "Nguyễn Bảo Ngọc", alias: ["B.Ngọc"] },
  { id: 138, name: "Nguyễn Khánh Ngọc", alias: ["K.Ngọc"] },
  { id: 139, name: "Lê Hồng Nhung", alias: ["H.Nhung"] },
  { id: 140, name: "Lê Trang Nhung", alias: ["T.Nhung"] },
  { id: 141, name: "Phạm Mạnh Quân", alias: ["Quân"] },
  { id: 142, name: "Ngô Phương Thảo", alias: ["Thảo"] },
  { id: 143, name: "Lương Ngọc Mai Thy", alias: ["Thy", "Mai Thy"] },
  { id: 144, name: "Phạm Hoàng Yến Trang", alias: ["Trang", "Yến Trang"] },
  { id: 145, name: "Hoàng Bảo Trâm", alias: ["H.Trâm"] },
  { id: 146, name: "Tống Phạm Bảo Trâm", alias: ["T.Trâm"] },
  { id: 147, name: "Trần Minh Trí", alias: ["Trí"] },
  { id: 148, name: "Nguyễn Phú Trọng", alias: ["Trọng"] },
  { id: 149, name: "Nguyễn Cẩm Tú", alias: ["Tú"] },
  { id: 150, name: "Lương Mạnh Tùng", alias: ["Tùng"] },
  { id: 151, name: "Phạm Phương Vy", alias: ["Vy"] },
  { id: 152, name: "Nguyễn Hoàng Yến", alias: ["Yến"] }
];

export const SESSIONS: ItemWithAlias[] = [
  { id: 1, name: "Buổi sáng" },
  { id: 2, name: "Buổi chiều" }
];

export const TIMES: ItemWithAlias[] = [
  { id: 1, name: "Tiết 1", alias: ["T1"] },
  { id: 2, name: "Tiết 2", alias: ["T2"] },
  { id: 3, name: "Tiết 3", alias: ["T3"] },
  { id: 4, name: "Tiết 4", alias: ["T4"] },
  { id: 5, name: "Tiết 5", alias: ["T5"] },
  { id: 6, name: "Sau ra chơi", alias: [] },
  { id: 7, name: "Truy bài", alias: ["TB"] }
];

export const OFFENCES: ItemWithAlias[] = [
  { id: 1, name: "Không đeo khăn quàng đỏ", alias: ["KĐKĐ"] },
  { id: 2, name: "Mặc sai đồng phục", alias: [] },
  { id: 3, name: "Đeo sai giày, dép (không có sự xin phép của phụ huynh)", alias: [] },
  { id: 4, name: "Tiết thể dục trang phục, dụng cụ không đầy đủ", alias: [] },
  { id: 5, name: "Mang quà vặt lên lớp", alias: [] },
  { id: 6, name: "Nói chuyện riêng trong giờ (GV nhắc)", alias: ["MTT", "Mất trật tự"] },
  { id: 7, name: "Nói bậy, chửi tục trong giờ", alias: [] },
  { id: 8, name: "Nói tự do trong giờ", alias: [] },
  { id: 9, name: "Ra khỏi chỗ tự do", alias: ["ĐC", "RKC", "đổi chỗ"] },
  { id: 10, name: "Không làm/quên BTVN, soạn bài", alias: [] },
  { id: 11, name: "Tháo giày dép và đi ra khỏi chỗ bằng chân đất", alias: [] },
  { id: 12, name: "Xả rác bừa bãi", alias: [] },
  { id: 13, name: "Ngủ trong giờ", alias: [] },
  { id: 14, name: "Chưa nghiêm túc trong giờ chào cờ", alias: [] },
  { id: 15, name: "Cãi nhau, đánh nhau", alias: [] },
  { id: 16, name: "Trốn tiết", alias: [] },
  { id: 17, name: "Ghi SĐB, SNK", alias: [] },
  { id: 18, name: "Không trực nhật, không xóa bảng", alias: [] },
  { id: 19, name: "Đi học muộn", alias: [] },
  { id: 20, name: "Nộp muộn (bài tập, giấy tờ, kế hoạch)", alias: [] },
  { id: 21, name: "Giơ tay xung phong phát biểu", alias: [] },
  { id: 22, name: "Tham gia vào các hoạt động của lớp", alias: [] },
  { id: 23, name: "Được khen ở SĐB/SNK", alias: [] },
  { id: 24, name: "Nộp kế hoạch nhỏ", alias: [] },
  { id: 25, name: "Vào lớp muộn", alias: ["VLM"] },
  { id: 26, name: "Chơi bài", alias: [] }
];

// ============================================================
// PROCESSING FUNCTIONS
// ============================================================

export function norm(s: string | null | undefined): string {
  if (!s) return "";
  let str = String(s).toLowerCase().trim();
  str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  str = str.replace(/đ/g, "d").replace(/Đ/g, "d");
  str = str.replace(/[^a-z0-9\s]/g, " ");
  str = str.replace(/\s+/g, " ");
  return str.trim();
}

function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;
  const v0 = new Int32Array(s2.length + 1);
  const v1 = new Int32Array(s2.length + 1);
  for (let i = 0; i <= s2.length; i++) v0[i] = i;
  for (let i = 0; i < s1.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= s2.length; j++) v0[j] = v1[j];
  }
  return v1[s2.length];
}

export function calcRatio(s1: string, s2: string): number {
  if (s1 === s2) return 100;
  const lenSum = s1.length + s2.length;
  if (lenSum === 0) return 100;
  const dist = levenshteinDistance(s1, s2);
  return Math.round(((lenSum - dist) / lenSum) * 100);
}

export function calcPartialRatio(s1: string, s2: string): number {
  if (s1 === s2) return 100;
  let shorter = s1;
  let longer = s2;
  if (s1.length > s2.length) {
    shorter = s2;
    longer = s1;
  }
  if (shorter.length === 0) return 0;
  if (longer.includes(shorter)) return 100;
  let maxScore = 0;
  for (let i = 0; i <= longer.length - shorter.length; i++) {
    const sub = longer.slice(i, i + shorter.length);
    const sc = calcRatio(shorter, sub);
    if (sc > maxScore) maxScore = sc;
    if (maxScore === 100) break;
  }
  return maxScore;
}

export function calcTokenSortRatio(s1: string, s2: string): number {
  const t1 = s1.split(/\s+/).filter(Boolean).sort().join(" ");
  const t2 = s2.split(/\s+/).filter(Boolean).sort().join(" ");
  return calcRatio(t1, t2);
}

export function calcWRatio(s1: string, s2: string): number {
  if (s1 === s2) return 100;
  const baseRatio = calcRatio(s1, s2);
  const pRatio = calcPartialRatio(s1, s2);
  const tRatio = calcTokenSortRatio(s1, s2);
  return Math.max(baseRatio, pRatio, tRatio);
}

export function buildIndex(data: ItemWithAlias[]) {
  const exact: Record<string, number> = {};
  const choices: Record<string, number> = {};

  for (const row of data) {
    const values = [row.name, ...(row.alias || [])];
    for (const val of values) {
      const key = norm(val);
      if (!key) continue;
      exact[key] = row.id;
      choices[key] = row.id;
    }
  }
  return { exact, choices };
}

export const studentIndex = buildIndex(STUDENTS);
export const sessionIndex = buildIndex(SESSIONS);
export const timeIndex = buildIndex(TIMES);
export const offenceIndex = buildIndex(OFFENCES);

export function match(
  raw: string | null | undefined,
  exact: Record<string, number>,
  choices: Record<string, number>,
  threshold = 70,
  useWRatio = true
): { id: number | null; score: number } {
  if (!raw) return { id: null, score: 0 };
  const key = norm(raw);
  if (!key) return { id: null, score: 0 };

  if (exact[key] !== undefined) {
    return { id: exact[key], score: 100 };
  }

  const choiceKeys = Object.keys(choices);
  if (choiceKeys.length === 0) return { id: null, score: 0 };

  let bestMatch: string | null = null;
  let bestScore = -1;

  for (const choice of choiceKeys) {
    const score = useWRatio ? calcWRatio(key, choice) : calcRatio(key, choice);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = choice;
      if (bestScore === 100) break;
    }
  }

  if (bestMatch && bestScore >= threshold) {
    return { id: choices[bestMatch] ?? null, score: bestScore };
  }

  return { id: null, score: bestScore > 0 ? bestScore : 0 };
}

export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const cleaned = String(raw).replace(/[^0-9/]/g, "");
    const parts = cleaned.split("/");
    if (parts.length !== 2) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(day) || isNaN(month) || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const year = month >= 9 ? 2026 : 2027;
    const padD = String(day).padStart(2, "0");
    const padM = String(month).padStart(2, "0");
    return `${year}-${padM}-${padD}`;
  } catch {
    return null;
  }
}

export interface RawRecordFromAI {
  s?: string | null; // raw student
  o?: string | null; // raw offence
  t?: string | null; // raw time / period
  b?: string | null; // raw session
  d?: string | null; // date e.g. "5/9"
  w?: number | null; // week
}

export interface NormalizedRecordResult {
  student_id: number | null;
  offence_id: number | null;
  time_id: number | null;
  session_id: number | null;
  week: number | null;
  date: string | null;
  studentScore: number;
  offenceScore: number;
  timeScore: number;
  sessionScore: number;
  raw: RawRecordFromAI;
}

export function processRawRecords(
  records: RawRecordFromAI[],
  customStudents?: ItemWithAlias[],
  customOffences?: ItemWithAlias[]
): { week: number | null; records: NormalizedRecordResult[] } {
  const weekCounts: Record<number, number> = {};
  for (const r of records) {
    if (r.w != null) {
      weekCounts[r.w] = (weekCounts[r.w] || 0) + 1;
    }
  }

  let mostFrequentWeek: number | null = null;
  let maxCount = 0;
  for (const [wStr, cnt] of Object.entries(weekCounts)) {
    if (cnt > maxCount) {
      maxCount = cnt;
      mostFrequentWeek = Number(wStr);
    }
  }

  const stIndex = customStudents ? buildIndex(customStudents) : studentIndex;
  const offIndex = customOffences ? buildIndex(customOffences) : offenceIndex;

  const results: NormalizedRecordResult[] = records.map(r => {
    const stMatch = match(r.s, stIndex.exact, stIndex.choices, 70, true);
    const offMatch = match(r.o, offIndex.exact, offIndex.choices, 55, true);
    const tMatch = match(r.t, timeIndex.exact, timeIndex.choices, 60, false);
    const sMatch = match(r.b, sessionIndex.exact, sessionIndex.choices, 70, false);

    return {
      student_id: stMatch.id,
      offence_id: offMatch.id,
      time_id: tMatch.id,
      session_id: sMatch.id,
      week: r.w ?? mostFrequentWeek,
      date: normalizeDate(r.d),
      studentScore: stMatch.score,
      offenceScore: offMatch.score,
      timeScore: tMatch.score,
      sessionScore: sMatch.score,
      raw: r
    };
  });

  return { week: mostFrequentWeek, records: results };
}
