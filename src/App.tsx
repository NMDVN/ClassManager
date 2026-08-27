import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./lib/supabase";

import LoginForm from "./components/LoginForm";
import ScoreTable from "./components/ScoreTable";
import RecordInputPage from "./components/RecordInputPage";
import MonthlyRankings from "./components/MonthlyRankings";
import AdminTools from "./components/AdminTools";
import AdminOffenceManager from "./components/AdminOffenceManager";
import ScheduleManager from "./components/ScheduleManager";

import {
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Menu,
  X,
  LogIn,
  BarChart3,
  CalendarDays,
  FileSpreadsheet
} from "lucide-react";

import type { Session } from "@supabase/supabase-js";

// ================== TYPES ==================
interface ScoreItem {
  student_id: number;
  week: number;
  final_point: number;
  student?: { name: string };
}

interface OffenceLogItem {
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

// ================== PAGE ANIMATION ==================
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};

function App() {
  // ================== STATE ==================
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [offences, setOffences] = useState<OffenceLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState<boolean>(() => 
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [isSidebarOpen, setSidebarOpen] = useState<boolean>(() => 
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );

  // ================== RESIZE LISTENER ==================
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ================== FETCH DATA ==================
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [scoreRes, offenceRes] = await Promise.all([
        supabase
          .from("weekly_score")
          .select(`*, student(name)`)
          .order("final_point", { ascending: false }),

        supabase
          .from("offence_log")
          .select(`*, student(name), offence:offence_catalog(name, deducted_point)`)
          .order("day", { ascending: false })
      ]);

      setScores(scoreRes.data || []);
      setOffences(offenceRes.data || []);
    } catch (e) {
      console.error("Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRole = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", uid)
      .single();

    setRole(data?.role ?? null);
  }, []);

  // ================== AUTH & INITIAL DATA ==================
  useEffect(() => {
    let ignore = false;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (ignore) return;
      setSession(session);
      if (session) {
        const { data } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (!ignore) setRole(data?.role ?? null);
      }
    }
    void init();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, [fetchRole]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const [scoreRes, offenceRes] = await Promise.all([
          supabase
            .from("weekly_score")
            .select(`*, student(name)`)
            .order("final_point", { ascending: false }),

          supabase
            .from("offence_log")
            .select(`*, student(name), offence:offence_catalog(name, deducted_point)`)
            .order("day", { ascending: false })
        ]);

        if (!ignore) {
          setScores(scoreRes.data || []);
          setOffences(offenceRes.data || []);
        }
      } catch (e) {
        console.error("Fetch Error:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Lỗi đăng xuất:", error.message);
  };

  // ================== ROLE LOGIC ==================
  const isSuperAdmin = useMemo(
    () => role === "superadmin",
    [role]
  );

  const closeSidebarOnMobile = () => {
    if (isMobile) setSidebarOpen(false);
  };

  // ================== RENDER ==================
  return (
    <Router>
      <div style={styles.appLayout}>
        {/* ================= BACKDROP FOR MOBILE ================= */}
        {isMobile && isSidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={styles.mobileBackdrop}
          />
        )}

        {/* ================= SIDEBAR ================= */}
        <motion.nav
          initial={false}
          animate={{
            width: isMobile ? 260 : isSidebarOpen ? 260 : 80,
            x: isMobile ? (isSidebarOpen ? 0 : -280) : 0
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{
            ...styles.sidebar,
            ...(isMobile ? styles.sidebarMobile : {})
          }}
        >
          <div style={styles.logoSection}>
            <ShieldCheck size={32} color="#2563eb" strokeWidth={2.5} />
            {(isSidebarOpen || isMobile) && (
              <span style={styles.logoText}>QUẢN LÝ</span>
            )}
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                style={styles.mobileCloseBtn}
              >
                <X size={20} />
              </button>
            )}
          </div>

          <div style={styles.navLinks}>
            <NavLink
              to="/"
              icon={<LayoutDashboard size={20} />}
              label="Bảng điều khiển"
              isOpen={isSidebarOpen || isMobile}
              onClick={closeSidebarOnMobile}
            />

            {session && (
              <NavLink
                to="/record-input"
                icon={<FileSpreadsheet size={20} />}
                label="Nhập liệu ghi chép"
                isOpen={isSidebarOpen || isMobile}
                onClick={closeSidebarOnMobile}
              />
            )}

            <NavLink
              to="/monthly"
              icon={<BarChart3 size={20} />}
              label="Xếp hạng tháng"
              isOpen={isSidebarOpen || isMobile}
              onClick={closeSidebarOnMobile}
            />

            {isSuperAdmin && (
              <>
                <NavLink
                  to="/admin/offences"
                  icon={<ShieldCheck size={20} />}
                  label="Quản lý lỗi"
                  isOpen={isSidebarOpen || isMobile}
                  onClick={closeSidebarOnMobile}
                />
                <NavLink
                  to="/admin/timetable"
                  icon={<CalendarDays size={20} />}
                  label="Thời khóa biểu"
                  isOpen={isSidebarOpen || isMobile}
                  onClick={closeSidebarOnMobile}
                />
              </>
            )}

            {!session ? (
              <NavLink
                to="/login"
                icon={<LogIn size={20} />}
                label="Đăng nhập"
                isOpen={isSidebarOpen || isMobile}
                onClick={closeSidebarOnMobile}
              />
            ) : (
              <div
                style={{
                  marginTop: "auto",
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: "10px"
                }}
              >
                <button
                  onClick={() => {
                    handleLogout();
                    closeSidebarOnMobile();
                  }}
                  style={styles.logoutBtn}
                >
                  <LogOut size={20} />
                  {(isSidebarOpen || isMobile) && <span>Đăng xuất</span>}
                </button>
              </div>
            )}
          </div>

          {!isMobile && (
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              style={styles.toggleBtn}
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
        </motion.nav>

        {/* ================= MAIN ================= */}
        <main
          style={{
            ...styles.mainContent,
            marginLeft: isMobile ? 0 : isSidebarOpen ? 260 : 80
          }}
        >
          <header style={{ ...styles.topBar, padding: isMobile ? "12px 16px" : "16px 32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  style={styles.hamburgerBtn}
                  aria-label="Open menu"
                >
                  <Menu size={22} color="#1e293b" />
                </button>
              )}
              <div>
                <h2 style={{ ...styles.headerTitle, fontSize: isMobile ? "1.05rem" : "1.2rem" }}>
                  Hệ Thống Thi Đua
                </h2>
                <p style={styles.headerSub}>
                  {session
                    ? `Chào, ${session.user.email}`
                    : "Chế độ xem công khai"}
                </p>
              </div>
            </div>

            <div style={styles.topBarRight}>
              {role && (
                <div style={styles.roleBadge}>{role.toUpperCase()}</div>
              )}
            </div>
          </header>

          <div style={{ ...styles.pageWrapper, padding: isMobile ? "12px 12px 24px" : "24px 32px" }}>
            <AnimatePresence mode="wait">
              <Routes>
                {/* ================= DASHBOARD ================= */}
                <Route
                  path="/"
                  element={
                    <motion.div
                      key="dashboard"
                      variants={pageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      style={getDashboardGridStyle(Boolean(session && isSuperAdmin), isMobile)}
                    >
                      {/* ===== LEFT COLUMN ===== */}
                      {session && isSuperAdmin && (
                        <div style={{ ...styles.formContainer, position: isMobile ? "static" : "sticky" }}>
                          <AdminTools onUpdate={fetchAllData} />
                        </div>
                      )}

                      {/* ===== RIGHT COLUMN ===== */}
                      <div style={styles.tableContainer}>
                        <ScoreTable
                          scores={scores}
                          offences={offences}
                          loading={loading}
                          role={role}
                          sessionId={session?.user.id ?? null}
                          refreshData={fetchAllData}
                        />
                      </div>
                    </motion.div>
                  }
                />

                {/* ================= RECORD INPUT ================= */}
                <Route
                  path="/record-input"
                  element={
                    session ? (
                      <motion.div
                        key="record-input"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                      >
                        <RecordInputPage onUpdate={fetchAllData} />
                      </motion.div>
                    ) : (
                      <Navigate to="/login" />
                    )
                  }
                />

                {/* ================= MONTHLY ================= */}
                <Route
                  path="/monthly"
                  element={
                    <motion.div
                      key="monthly"
                      variants={pageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      <MonthlyRankings />
                    </motion.div>
                  }
                />

                {/* ================= ADMIN OFFENCES ================= */}
                <Route
                  path="/admin/offences"
                  element={
                    isSuperAdmin ? (
                      <motion.div
                        key="admin-offences"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                      >
                        <AdminOffenceManager />
                      </motion.div>
                    ) : (
                      <Navigate to="/" />
                    )
                  }
                />

                {/* ================= TIMETABLE (SUPER ADMIN ONLY) ================= */}
                <Route
                  path="/admin/timetable"
                  element={
                    isSuperAdmin ? (
                      <motion.div
                        key="admin-timetable"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                      >
                        <ScheduleManager />
                      </motion.div>
                    ) : (
                      <Navigate to="/" />
                    )
                  }
                />

                {/* ================= LOGIN ================= */}
                <Route
                  path="/login"
                  element={
                    session ? (
                      <Navigate to="/" />
                    ) : (
                      <motion.div
                        key="login"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        style={styles.loginCenter}
                      >
                        <LoginForm onLoginSuccess={() => {}} />
                      </motion.div>
                    )
                  }
                />
              </Routes>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </Router>
  );
}

// ================== NAV LINK ==================
interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isOpen: boolean;
  onClick?: () => void;
}

const NavLink = ({ to, icon, label, isOpen, onClick }: NavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      style={{ ...styles.navItem, ...(isActive ? styles.navActive : {}) }}
    >
      {icon}
      {isOpen && (
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {label}
        </motion.span>
      )}
      {isActive && isOpen && (
        <ChevronRight size={14} style={{ marginLeft: "auto" }} />
      )}
    </Link>
  );
};

// ================== STYLES ==================
const getDashboardGridStyle = (isAdmin: boolean, isMobile: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: (!isMobile && isAdmin) ? "380px 1fr" : "1fr",
  gap: isMobile ? "16px" : "24px"
});

const styles: Record<string, React.CSSProperties> = {
  appLayout: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    fontFamily: "'Roboto', sans-serif",
    position: "relative"
  },
  mobileBackdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    zIndex: 99,
    backdropFilter: "blur(2px)"
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
  sidebarMobile: {
    boxShadow: "4px 0 24px rgba(0,0,0,0.12)"
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
  mobileCloseBtn: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#64748b",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  hamburgerBtn: {
    background: "#f1f5f9",
    border: "none",
    padding: "8px",
    borderRadius: "8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
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
    transition: "margin-left 0.3s",
    minWidth: 0
  },
  topBar: {
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
    gap: "10px"
  },
  headerTitle: {
    margin: 0,
    fontWeight: "700"
  },
  headerSub: {
    margin: 0,
    fontSize: "0.8rem",
    color: "#94a3b8",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "180px"
  },
  roleBadge: {
    padding: "4px 10px",
    borderRadius: "20px",
    background: "#f1f5f9",
    fontSize: "0.68rem",
    fontWeight: "800",
    color: "#2563eb"
  },
  pageWrapper: { width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box" },
  formContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    position: "sticky",
    top: "90px"
  },
  tableContainer: {
    minWidth: 0,
    backgroundColor: "#fff",
    borderRadius: "16px",
    overflow: "hidden"
  },
  loginCenter: { maxWidth: "400px", margin: "40px auto", width: "100%", padding: "0 12px" },
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
    cursor: "pointer",
    padding: "6px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }
};

export default App;
