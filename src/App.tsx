import { useEffect, useState, useCallback, useMemo } from "react";
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
import OffenceForm from "./components/OffenceForm";
import MonthlyRankings from "./components/MonthlyRankings";
import AdminTools from "./components/AdminTools";
import AdminOffenceManager from "./components/AdminOffenceManager";

import {
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Menu,
  X,
  LogIn,
  BarChart3
} from "lucide-react";

import type { Session } from "@supabase/supabase-js";

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
  const [scores, setScores] = useState<any[]>([]);
  const [offences, setOffences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

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

  // ================== AUTH ==================
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchRole(session.user.id);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchRole(session.user.id);
      else setRole(null);
    });

    fetchAllData();
    return () => subscription.unsubscribe();
  }, [fetchAllData, fetchRole]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) alert("Lỗi đăng xuất: " + error.message);
  };

  // ================== ROLE LOGIC ==================
  const isAdmin = useMemo(
    () => ["admin", "superadmin"].includes(role || ""),
    [role]
  );

  const isSuperAdmin = useMemo(
    () => role === "superadmin",
    [role]
  );

  // ================== RENDER ==================
  return (
    <Router>
      <div style={styles.appLayout}>
        {/* ================= SIDEBAR ================= */}
        <motion.nav
          initial={false}
          animate={{ width: isSidebarOpen ? 260 : 80 }}
          style={styles.sidebar}
        >
          <div style={styles.logoSection}>
            <ShieldCheck size={32} color="#2563eb" strokeWidth={2.5} />
            {isSidebarOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={styles.logoText}
              >
                QUẢN LÝ
              </motion.span>
            )}
          </div>

          <div style={styles.navLinks}>
            <NavLink
              to="/"
              icon={<LayoutDashboard size={20} />}
              label="Bảng điều khiển"
              isOpen={isSidebarOpen}
            />

            <NavLink
              to="/monthly"
              icon={<BarChart3 size={20} />}
              label="Xếp hạng tháng"
              isOpen={isSidebarOpen}
            />

            {isSuperAdmin && (
              <NavLink
                to="/admin/offences"
                icon={<ShieldCheck size={20} />}
                label="Quản lý lỗi"
                isOpen={isSidebarOpen}
                />
            )}

            {!session ? (
              <NavLink
                to="/login"
                icon={<LogIn size={20} />}
                label="Đăng nhập"
                isOpen={isSidebarOpen}
              />
            ) : (
              <div
                style={{
                  marginTop: "auto",
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: "10px"
                }}
              >
                <button onClick={handleLogout} style={styles.logoutBtn}>
                  <LogOut size={20} />
                  {isSidebarOpen && <span>Đăng xuất</span>}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            style={styles.toggleBtn}
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </motion.nav>

        {/* ================= MAIN ================= */}
        <main
          style={{
            ...styles.mainContent,
            marginLeft: isSidebarOpen ? 260 : 80
          }}
        >
          <header style={styles.topBar}>
            <div>
              <h2 style={styles.headerTitle}>Hệ Thống Thi Đua</h2>
              <p style={styles.headerSub}>
                {session
                  ? `Chào, ${session.user.email}`
                  : "Chế độ xem công khai"}
              </p>
            </div>

            <div style={styles.topBarRight}>
              {role && (
                <div style={styles.roleBadge}>{role.toUpperCase()}</div>
              )}
              {session && (
                <button
                  onClick={handleLogout}
                  style={styles.iconLogout}
                  title="Đăng xuất"
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </header>

          <div style={styles.pageWrapper}>
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
                      style={styles.dashboardGrid(isAdmin)}
                    >
                      {/* ===== LEFT COLUMN ===== */}
                      {session && isAdmin && (
                        <div style={styles.formContainer}>
                          {isSuperAdmin && (
                            <AdminTools onUpdate={fetchAllData} />
                          )}

                          <OffenceForm onUpdate={fetchAllData} />
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
const NavLink = ({ to, icon, label, isOpen }: any) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
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
const styles: any = {
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

export default App;
