import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

import Header from "./components/shared/Header";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";
import StudentDashboard from "./components/student/Dashboard";
import PaperLibrary from "./components/papers/PaperLibrary";
import QuizMode from "./components/quiz/QuizMode";
import Results from "./components/quiz/Results";
import AdminPanel from "./components/admin/AdminPanel";
import TeacherView from "./components/teacher/TeacherView";

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "#EFF6FF",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "#1E40AF",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          fontSize: 24, fontWeight: 800, color: "#F59E0B",
          animation: "spin 1.5s linear infinite",
        }}>
          EP
        </div>
        <div style={{ color: "#6B7280", fontSize: 14 }}>Loading ExamPrep Zambia...</div>
      </div>
    </div>
  );
}

function ProtectedRoute({ user, role, allowedRoles, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;
  return children;
}

// Home page (landing or dashboard redirect based on role)
function Home({ user, role }) {
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "teacher") return <Navigate to="/teacher" replace />;
  return <StudentDashboard user={user} />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (snap.exists()) setRole(snap.data().role || "student");
        } catch {
          setRole("student");
        }
      } else {
        setUser(null);
        setRole("student");
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#EFF6FF", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
        {user && <Header user={user} role={role} />}

        <Routes>
          {/* Public */}
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

          {/* Student routes */}
          <Route path="/" element={
            <ProtectedRoute user={user} role={role}>
              <Home user={user} role={role} />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute user={user} role={role} allowedRoles={["student"]}>
              <StudentDashboard user={user} />
            </ProtectedRoute>
          } />
          <Route path="/papers" element={
            <ProtectedRoute user={user} role={role}>
              <PaperLibrary />
            </ProtectedRoute>
          } />
          <Route path="/topics" element={
            <ProtectedRoute user={user} role={role}>
              <PaperLibrary showTopics={true} />
            </ProtectedRoute>
          } />
          <Route path="/quiz/:paperId" element={
            <ProtectedRoute user={user} role={role}>
              <QuizMode user={user} />
            </ProtectedRoute>
          } />
          <Route path="/results/:resultId" element={
            <ProtectedRoute user={user} role={role}>
              <Results />
            </ProtectedRoute>
          } />

          {/* Admin routes */}
          <Route path="/admin" element={
            <ProtectedRoute user={user} role={role} allowedRoles={["admin"]}>
              <AdminPanel />
            </ProtectedRoute>
          } />
          <Route path="/admin/questions" element={
            <ProtectedRoute user={user} role={role} allowedRoles={["admin"]}>
              <AdminPanel />
            </ProtectedRoute>
          } />
          <Route path="/admin/learners" element={
            <ProtectedRoute user={user} role={role} allowedRoles={["admin"]}>
              <AdminPanel />
            </ProtectedRoute>
          } />

          {/* Teacher routes */}
          <Route path="/teacher" element={
            <ProtectedRoute user={user} role={role} allowedRoles={["teacher", "admin"]}>
              <TeacherView user={user} />
            </ProtectedRoute>
          } />
          <Route path="/teacher/class" element={
            <ProtectedRoute user={user} role={role} allowedRoles={["teacher", "admin"]}>
              <TeacherView user={user} />
            </ProtectedRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
