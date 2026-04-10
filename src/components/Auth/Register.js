import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { GRADES } from "../../data/sampleData";

const C = {
  primary: "#1E40AF",
  accent: "#F59E0B",
  white: "#FFFFFF",
  error: "#DC2626",
};

export default function Register() {
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
    grade: "5", role: "student",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await updateProfile(user, { displayName: form.name });
      await setDoc(doc(db, "users", user.uid), {
        name: form.name,
        email: form.email,
        grade: parseInt(form.grade),
        role: form.role,
        points: 0,
        badges: [],
        quizHistory: [],
        createdAt: serverTimestamp(),
      });
      navigate("/");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please sign in.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    padding: "10px 14px",
    border: "1.5px solid #D1D5DB",
    borderRadius: 8, fontSize: 15, outline: "none",
  };
  const labelStyle = {
    display: "block", fontSize: 14, fontWeight: 600,
    color: "#374151", marginBottom: 6,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: C.primary,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
            fontSize: 24, fontWeight: 800, color: C.accent,
          }}>EP</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.primary }}>Join ExamPrep Zambia</h1>
        </div>

        <div style={{
          background: C.white, borderRadius: 16,
          padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
        }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#1F2937" }}>
            Create Account
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

          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Full Name</label>
              <input name="name" value={form.name} onChange={handleChange}
                placeholder="Your full name" required style={inputStyle} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email Address</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="your@email.com" required style={inputStyle} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Grade</label>
                <select name="grade" value={form.grade} onChange={handleChange}
                  style={{ ...inputStyle, background: C.white }}>
                  {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <select name="role" value={form.role} onChange={handleChange}
                  style={{ ...inputStyle, background: C.white }}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange}
                placeholder="Min. 6 characters" required style={inputStyle} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Confirm Password</label>
              <input type="password" name="confirmPassword" value={form.confirmPassword}
                onChange={handleChange} placeholder="Repeat password" required style={inputStyle} />
            </div>

            <button
              type="submit" disabled={loading}
              style={{
                width: "100%", padding: "12px",
                background: loading ? "#93C5FD" : C.primary,
                color: C.white, border: "none",
                borderRadius: 10, fontSize: 16, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 18, fontSize: 14, color: "#6B7280" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: C.primary, fontWeight: 700, textDecoration: "none" }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
