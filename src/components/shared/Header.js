import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";

const C = {
  primary: "#1E40AF",
  secondary: "#059669",
  accent: "#F59E0B",
  white: "#FFFFFF",
  bg: "#EFF6FF",
  text: "#1F2937",
  muted: "#6B7280",
};

export default function Header({ user, role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const navLinks = role === "admin"
    ? [
        { to: "/admin", label: "Dashboard", icon: "🏠" },
        { to: "/admin/questions", label: "Questions", icon: "❓" },
        { to: "/admin/learners", label: "Learners", icon: "👥" },
      ]
    : role === "teacher"
    ? [
        { to: "/teacher", label: "Dashboard", icon: "🏠" },
        { to: "/teacher/class", label: "Class View", icon: "📊" },
      ]
    : [
        { to: "/", label: "Home", icon: "🏠" },
        { to: "/papers", label: "Past Papers", icon: "📄" },
        { to: "/topics", label: "Topics", icon: "📚" },
        { to: "/dashboard", label: "My Progress", icon: "📈" },
      ];

  return (
    <header style={{
      background: `linear-gradient(135deg, ${C.primary} 0%, #1D4ED8 100%)`,
      color: C.white,
      padding: "0",
      boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 64,
      }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: C.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: "bold", color: C.primary,
          }}>
            EP
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.white, lineHeight: 1 }}>ExamPrep</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", lineHeight: 1 }}>Zambia</div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav style={{ display: "flex", gap: 4, alignItems: "center" }} className="desktop-nav">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              style={{
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: location.pathname === link.to ? C.accent : "rgba(255,255,255,0.85)",
                background: location.pathname === link.to ? "rgba(255,255,255,0.15)" : "transparent",
                transition: "all 0.2s",
              }}
            >
              <span style={{ marginRight: 4 }}>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* User & Logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: C.accent,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 14, color: C.primary,
              }}>
                {(user.displayName || user.email || "U")[0].toUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>
                  {user.displayName || user.email?.split("@")[0]}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>{role}</span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: C.white,
              padding: "7px 14px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              transition: "background 0.2s",
            }}
          >
            Logout
          </button>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: "none",
              background: "none",
              border: "none",
              color: C.white,
              fontSize: 24,
              cursor: "pointer",
              padding: 4,
            }}
            className="mobile-menu-btn"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <div style={{
          background: "#1D4ED8",
          padding: "8px 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }} className="mobile-nav">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              style={{
                textDecoration: "none",
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                color: location.pathname === link.to ? C.accent : C.white,
                background: location.pathname === link.to ? "rgba(255,255,255,0.1)" : "transparent",
              }}
            >
              {link.icon} {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
