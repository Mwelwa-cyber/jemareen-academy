import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";

const C = {
  primary: "#1E40AF",
  secondary: "#059669",
  accent: "#F59E0B",
  bg: "#EFF6FF",
  white: "#FFFFFF",
  error: "#DC2626",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      setError("Wrong email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Demo login helpers
  const demoLogin = async (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, demoEmail, demoPass);
      navigate("/");
    } catch {
      setError("Demo account not set up yet. Please register first.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72,
            borderRadius: "50%",
            background: C.primary,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: 28, fontWeight: 800, color: C.accent,
          }}>
            EP
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: C.primary }}>ExamPrep Zambia</h1>
          <p style={{ margin: "6px 0 0", color: "#6B7280", fontSize: 14 }}>
            Grade 5–7 Learning Platform
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: C.white,
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
        }}>
          <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 700, color: "#1F2937" }}>
            Sign In
          </h2>

          {error && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA",
              borderRadius: 8, padding: "10px 14px",
              color: C.error, fontSize: 14, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "10px 14px",
                  border: "1.5px solid #D1D5DB",
                  borderRadius: 8, fontSize: 15,
                  outline: "none",
                  transition: "border 0.2s",
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "10px 14px",
                  border: "1.5px solid #D1D5DB",
                  borderRadius: 8, fontSize: 15,
                  outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                background: loading ? "#93C5FD" : C.primary,
                color: C.white,
                border: "none",
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#6B7280" }}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: C.primary, fontWeight: 700, textDecoration: "none" }}>
              Register here
            </Link>
          </div>
        </div>

        {/* Demo accounts hint */}
        <div style={{
          background: "rgba(255,255,255,0.7)",
          borderRadius: 12,
          padding: "16px 20px",
          marginTop: 16,
          border: "1px solid #BFDBFE",
        }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.primary }}>
            👋 Demo Accounts (register these emails first):
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "Student", email: "student@demo.zm", pass: "demo1234" },
              { label: "Admin", email: "admin@demo.zm", pass: "admin1234" },
              { label: "Teacher", email: "teacher@demo.zm", pass: "teacher1234" },
            ].map(d => (
              <button
                key={d.email}
                onClick={() => demoLogin(d.email, d.pass)}
                style={{
                  background: "#EFF6FF", border: "1px solid #BFDBFE",
                  borderRadius: 6, padding: "6px 10px",
                  fontSize: 12, cursor: "pointer", textAlign: "left",
                  color: C.primary, fontWeight: 600,
                }}
              >
                {d.label}: {d.email} / {d.pass}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
