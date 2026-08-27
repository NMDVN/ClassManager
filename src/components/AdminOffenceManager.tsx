import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

interface Offence {
  id: string;
  name: string;
  deducted_point: number;
  is_available: boolean;
}

type Status = { type: "success" | "error"; msg: string } | null;

export default function AdminOffenceManager() {
  const [offences, setOffences] = useState<Offence[]>([]);
  const [original, setOriginal] = useState<Offence[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);

  /* ================= FETCH ================= */

  const fetchOffences = useCallback(async () => {
    const { data, error } = await supabase
      .from("offence_catalog")
      .select("id, name, deducted_point, is_available")
      .order("name");

    if (!error && data) {
      setOffences(data);
      setOriginal(data);
    } else {
      setStatus({ type: "error", msg: error?.message || "Lỗi tải dữ liệu" });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      const { data, error } = await supabase
        .from("offence_catalog")
        .select("id, name, deducted_point, is_available")
        .order("name");

      if (ignore) return;
      if (!error && data) {
        setOffences(data);
        setOriginal(data);
      } else {
        setStatus({ type: "error", msg: error?.message || "Lỗi tải dữ liệu" });
      }
      setLoading(false);
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  /* ================= LOCAL UPDATE ================= */

  const updateLocal = <K extends keyof Offence>(
    id: string,
    field: K,
    value: Offence[K]
  ) => {
    setOffences(prev =>
      prev.map(o => (o.id === id ? { ...o, [field]: value } : o))
    );
  };

  const isChanged = (o: Offence) => {
    const old = original.find(x => x.id === o.id);
    if (!old) return true;
    return (
      old.name !== o.name ||
      old.deducted_point !== o.deducted_point ||
      old.is_available !== o.is_available
    );
  };

  /* ================= SAVE ================= */

  const save = async (o: Offence) => {
    setSavingId(o.id);
    setStatus(null);

    const { error } = await supabase
      .from("offence_catalog")
      .update({
        name: o.name,
        deducted_point: o.deducted_point,
        is_available: o.is_available
      })
      .eq("id", o.id);

    if (error) {
      setStatus({ type: "error", msg: error.message });
      setOffences(original); // rollback
    } else {
      setStatus({ type: "success", msg: "Đã lưu thay đổi" });
      fetchOffences();
    }

    setSavingId(null);
  };

  /* ================= CREATE ================= */

  const createNew = async () => {
    const { error } = await supabase.from("offence_catalog").insert({
      name: "Lỗi mới",
      deducted_point: -1,
      is_available: true
    });

    if (error) {
      setStatus({ type: "error", msg: error.message });
    } else {
      setStatus({ type: "success", msg: "Đã tạo lỗi mới" });
      fetchOffences();
    }
  };

  /* ================= RENDER ================= */

  if (loading) {
    return <div>⏳ Đang tải danh sách lỗi...</div>;
  }

  return (
    <div style={styles.tableContainer}>
      {/* HEADER */}
      <div style={{ padding: "16px", display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>🚨 Quản lý lỗi / cộng điểm</h3>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.8rem" }}>
            Chỉ Super Admin mới có quyền chỉnh sửa
          </p>
        </div>

        <button
          onClick={createNew}
          style={{
            padding: "8px 14px",
            borderRadius: "10px",
            border: "none",
            fontWeight: 600,
            background: "#16a34a",
            color: "#fff",
            cursor: "pointer",
            fontSize: "13px"
          }}
        >
          ➕ Thêm lỗi
        </button>
      </div>

      {/* STATUS */}
      {status && (
        <div
          style={{
            margin: "0 16px 12px",
            padding: "10px",
            borderRadius: "8px",
            fontSize: "13px",
            background:
              status.type === "error" ? "#fef2f2" : "#f0fdf4",
            color:
              status.type === "error" ? "#dc2626" : "#16a34a",
            border: `1px solid ${
              status.type === "error" ? "#fecaca" : "#bbf7d0"
            }`
          }}
        >
          {status.msg}
        </div>
      )}

      {/* TABLE */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table width="100%" style={{ borderCollapse: "collapse", fontSize: "13px", minWidth: "500px" }}>
          <thead>
            <tr style={{ color: "#64748b", textAlign: "left", background: "#f8fafc" }}>
              <th style={{ padding: "10px 14px" }}>Tên lỗi</th>
              <th style={{ padding: "10px", width: "90px" }}>Điểm</th>
              <th style={{ padding: "10px", width: "80px" }}>Cho nhập</th>
              <th style={{ padding: "10px 14px", width: "80px" }}></th>
            </tr>
          </thead>

          <tbody>
            {offences.map(o => (
              <tr
                key={o.id}
                style={{
                  borderTop: "1px solid #e2e8f0",
                  opacity: o.is_available ? 1 : 0.45
                }}
              >
                <td style={{ padding: "10px 14px" }}>
                  <input
                    value={o.name}
                    onChange={e => updateLocal(o.id, "name", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px"
                    }}
                  />
                </td>

                <td style={{ padding: "10px" }}>
                  <input
                    type="number"
                    value={o.deducted_point}
                    onChange={e =>
                      updateLocal(o.id, "deducted_point", Number(e.target.value))
                    }
                    style={{
                      width: "70px",
                      padding: "8px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px"
                    }}
                  />
                </td>

                <td style={{ padding: "10px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={o.is_available}
                    onChange={e =>
                      updateLocal(o.id, "is_available", e.target.checked)
                    }
                  />
                </td>

                <td style={{ padding: "10px 14px" }}>
                  <button
                    onClick={() => save(o)}
                    disabled={savingId === o.id || !isChanged(o)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: "none",
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: isChanged(o) ? "pointer" : "not-allowed",
                      background:
                        savingId === o.id
                          ? "#e2e8f0"
                          : isChanged(o)
                          ? "#2563eb"
                          : "#cbd5e1",
                      color: savingId === o.id ? "#64748b" : "#fff"
                    }}
                  >
                    {savingId === o.id ? "Đang lưu..." : "Lưu"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appLayout: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    fontFamily: "'Roboto', sans-serif"
  },
  sidebar: {
    backgroundColor: "#fff",
    borderRight: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    padding: "20px 15px",
    position: "fixed",
    height: "100vh",
    zIndex: 100,
    overflow: "hidden"
  },
  logoSection: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "30px",
    padding: "0 10px"
  },
  logoText: {
    fontSize: "1.4rem",
    fontWeight: "800",
    color: "#1e293b"
  },
  navLinks: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flex: 1
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    color: "#64748b",
    textDecoration: "none",
    borderRadius: "10px",
    fontWeight: "500"
  },
  navActive: {
    backgroundColor: "#eff6ff",
    color: "#2563eb"
  },
  mainContent: {
    flex: 1,
    transition: "margin-left 0.3s"
  },
  topBar: {
    padding: "16px 40px",
    backgroundColor: "#fff",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    position: "sticky",
    top: 0,
    zIndex: 90
  },
  topBarRight: {
    display: "flex",
    alignItems: "center",
    gap: "15px"
  },
  headerTitle: {
    margin: 0,
    fontSize: "1.2rem",
    fontWeight: "700"
  },
  headerSub: {
    margin: 0,
    fontSize: "0.8rem",
    color: "#94a3b8"
  },
  roleBadge: {
    padding: "5px 14px",
    borderRadius: "20px",
    background: "#f1f5f9",
    fontSize: "0.7rem",
    fontWeight: "800"
  },
  pageWrapper: { padding: "24px 40px" },
  dashboardGrid: (isAdmin: boolean) => ({
    display: "grid",
    gridTemplateColumns: isAdmin ? "360px 1fr" : "1fr",
    gap: "24px"
  }),
  formContainer: { position: "sticky", top: "100px" },
  tableContainer: {
    minWidth: 0,
    backgroundColor: "#fff",
    borderRadius: "16px"
  },
  loginCenter: { maxWidth: "400px", margin: "100px auto" },
  toggleBtn: {
    marginTop: "20px",
    padding: "10px",
    borderRadius: "10px",
    border: "none",
    background: "#f1f5f9",
    cursor: "pointer"
  },
  logoutBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    color: "#ef4444",
    border: "none",
    background: "#fef2f2",
    cursor: "pointer",
    fontWeight: "600",
    borderRadius: "10px"
  },
  iconLogout: {
    background: "none",
    border: "none",
    cursor: "pointer"
  }
};

export const ADMIN_OFFENCE_MANAGER_PATH = "/admin/offences";