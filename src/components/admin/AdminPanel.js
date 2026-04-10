import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  serverTimestamp, query, orderBy, limit,
} from "firebase/firestore";
import { db } from "../../firebase";
import { GRADES, SUBJECTS, TERMS, samplePapers } from "../../data/sampleData";

const C = {
  primary: "#1E40AF",
  secondary: "#059669",
  accent: "#F59E0B",
  white: "#FFFFFF",
  bg: "#EFF6FF",
  text: "#1F2937",
  muted: "#6B7280",
  error: "#DC2626",
};

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  padding: "9px 12px",
  border: "1.5px solid #D1D5DB",
  borderRadius: 8, fontSize: 14, outline: "none",
  background: C.white,
};

const labelStyle = {
  display: "block", fontSize: 13,
  fontWeight: 600, color: "#374151", marginBottom: 4,
};

function StatBox({ icon, label, value, color }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12,
      padding: "16px 20px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: `${color}15`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState("overview");
  const [learners, setLearners] = useState([]);
  const [results, setResults] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Add Question form
  const [qForm, setQForm] = useState({
    paperId: "g5-math-t1-2023",
    type: "mcq",
    topic: "",
    question: "",
    options: ["", "", "", ""],
    correct: 0,
    correctText: "",
    explanation: "",
    marks: 2,
  });
  const [qSuccess, setQSuccess] = useState("");
  const [qError, setQError] = useState("");
  const [saving, setSaving] = useState(false);

  // Add Paper form
  const [pForm, setPForm] = useState({
    grade: 5, subject: "Mathematics", term: "Term 1", year: 2024,
    timeLimit: 60, totalMarks: 50, questionCount: 20,
  });
  const [pSuccess, setPSuccess] = useState("");
  const [pSaving, setPSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (tab !== "learners" && tab !== "overview") return;
      setLoadingData(true);
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        setLearners(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === "student"));

        const q = query(collection(db, "results"), orderBy("completedAt", "desc"), limit(20));
        const resSnap = await getDocs(q);
        setResults(resSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [tab]);

  const handleSaveQuestion = async () => {
    if (!qForm.question.trim() || !qForm.topic.trim()) {
      setQError("Please fill in question and topic.");
      return;
    }
    setSaving(true);
    setQError("");
    try {
      await addDoc(collection(db, "questions"), {
        ...qForm,
        options: qForm.type === "mcq" ? qForm.options : [],
        correct: qForm.type === "short_answer" ? qForm.correctText : qForm.correct,
        createdAt: serverTimestamp(),
      });
      setQSuccess("Question saved successfully!");
      setQForm({ ...qForm, question: "", topic: "", options: ["","","",""], explanation: "", correctText: "" });
    } catch {
      setQError("Failed to save. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePaper = async () => {
    setPSaving(true);
    try {
      const paperId = `g${pForm.grade}-${pForm.subject.toLowerCase().replace(/\s/g,"-")}-t${pForm.term.slice(-1)}-${pForm.year}`;
      await addDoc(collection(db, "papers"), {
        ...pForm,
        id: paperId,
        title: `Grade ${pForm.grade} ${pForm.subject} - ${pForm.term} ${pForm.year}`,
        createdAt: serverTimestamp(),
      });
      setPSuccess("Paper added successfully!");
    } catch {
      setPSuccess("Error saving. Try again.");
    } finally {
      setPSaving(false);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: "🏠" },
    { id: "questions", label: "Add Question", icon: "❓" },
    { id: "papers", label: "Add Paper", icon: "📄" },
    { id: "learners", label: "Learners", icon: "👥" },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: C.text }}>
          ⚙️ Admin Panel
        </h1>
        <p style={{ margin: 0, color: C.muted, fontSize: 14 }}>Manage papers, questions, and learner data</p>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 24,
        background: C.white, borderRadius: 12, padding: 6,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        flexWrap: "wrap",
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, minWidth: 100,
            padding: "9px 16px",
            background: tab === t.id ? C.primary : "transparent",
            color: tab === t.id ? C.white : C.muted,
            border: "none", borderRadius: 8,
            fontWeight: 700, cursor: "pointer",
            fontSize: 13, transition: "all 0.2s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14, marginBottom: 24,
          }}>
            <StatBox icon="📄" label="Sample Papers" value={samplePapers.length} color={C.primary} />
            <StatBox icon="👥" label="Learners" value={learners.length} color={C.secondary} />
            <StatBox icon="📝" label="Recent Results" value={results.length} color={C.accent} />
            <StatBox icon="📊" label="Avg Score" value={
              results.length
                ? `${Math.round(results.reduce((a, b) => a + (b.percentage || 0), 0) / results.length)}%`
                : "—"
            } color="#8B5CF6" />
          </div>

          <div style={{
            background: C.white, borderRadius: 14,
            padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
          }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>📈 Recent Quiz Results</h2>
            {results.length === 0 ? (
              <p style={{ color: C.muted, textAlign: "center", padding: "20px 0" }}>No results yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      {["Paper", "Subject", "Mode", "Score", "%"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: C.muted, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice(0, 10).map(r => (
                      <tr key={r.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 500 }}>{r.paperTitle?.slice(0, 30)}...</td>
                        <td style={{ padding: "8px 12px", color: C.muted }}>{r.subject}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{
                            background: r.mode === "exam" ? "#EFF6FF" : "#F0FDF4",
                            color: r.mode === "exam" ? C.primary : C.secondary,
                            borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                          }}>{r.mode}</span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>{r.score}/{r.total}</td>
                        <td style={{ padding: "8px 12px", fontWeight: 700,
                          color: r.percentage >= 70 ? C.secondary : r.percentage >= 50 ? C.accent : C.error }}>
                          {r.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Question */}
      {tab === "questions" && (
        <div style={{
          background: C.white, borderRadius: 14,
          padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700 }}>➕ Add New Question</h2>

          {qSuccess && (
            <div style={{
              background: "#F0FDF4", border: "1px solid #86EFAC",
              borderRadius: 8, padding: "10px 14px", color: "#166534",
              fontSize: 14, marginBottom: 14,
            }}>{qSuccess}</div>
          )}
          {qError && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA",
              borderRadius: 8, padding: "10px 14px", color: C.error,
              fontSize: 14, marginBottom: 14,
            }}>{qError}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Paper</label>
              <select value={qForm.paperId} onChange={e => setQForm({ ...qForm, paperId: e.target.value })}
                style={inputStyle}>
                {samplePapers.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Question Type</label>
              <select value={qForm.type} onChange={e => setQForm({ ...qForm, type: e.target.value })}
                style={inputStyle}>
                <option value="mcq">Multiple Choice</option>
                <option value="true_false">True / False</option>
                <option value="short_answer">Short Answer</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Topic</label>
              <input value={qForm.topic} onChange={e => setQForm({ ...qForm, topic: e.target.value })}
                placeholder="e.g. Fractions" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Marks</label>
              <input type="number" min={1} max={10} value={qForm.marks}
                onChange={e => setQForm({ ...qForm, marks: parseInt(e.target.value) })}
                style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Question</label>
            <textarea value={qForm.question} onChange={e => setQForm({ ...qForm, question: e.target.value })}
              placeholder="Enter the question..." rows={3}
              style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          {qForm.type === "mcq" && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Options (select correct one)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {qForm.options.map((opt, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="radio" name="correct" checked={qForm.correct === i}
                      onChange={() => setQForm({ ...qForm, correct: i })} />
                    <input value={opt}
                      onChange={e => {
                        const opts = [...qForm.options];
                        opts[i] = e.target.value;
                        setQForm({ ...qForm, options: opts });
                      }}
                      placeholder={`Option ${["A","B","C","D"][i]}`}
                      style={{ ...inputStyle }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {qForm.type === "true_false" && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Correct Answer</label>
              <div style={{ display: "flex", gap: 12 }}>
                {[true, false].map(v => (
                  <label key={String(v)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" name="tf" checked={qForm.correct === v}
                      onChange={() => setQForm({ ...qForm, correct: v })} />
                    <span style={{ fontWeight: 600 }}>{v ? "True" : "False"}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {qForm.type === "short_answer" && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Correct Answer</label>
              <input value={qForm.correctText}
                onChange={e => setQForm({ ...qForm, correctText: e.target.value })}
                placeholder="Expected answer (lowercase)" style={inputStyle} />
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Explanation</label>
            <textarea value={qForm.explanation}
              onChange={e => setQForm({ ...qForm, explanation: e.target.value })}
              placeholder="Explain why this is the correct answer..." rows={2}
              style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <button onClick={handleSaveQuestion} disabled={saving} style={{
            padding: "11px 28px",
            background: saving ? "#93C5FD" : C.primary,
            color: C.white, border: "none",
            borderRadius: 8, fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer", fontSize: 15,
          }}>
            {saving ? "Saving..." : "Save Question"}
          </button>
        </div>
      )}

      {/* Add Paper */}
      {tab === "papers" && (
        <div style={{
          background: C.white, borderRadius: 14,
          padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700 }}>📄 Add New Paper</h2>

          {pSuccess && (
            <div style={{
              background: "#F0FDF4", border: "1px solid #86EFAC",
              borderRadius: 8, padding: "10px 14px", color: "#166534",
              fontSize: 14, marginBottom: 14,
            }}>{pSuccess}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Grade</label>
              <select value={pForm.grade} onChange={e => setPForm({ ...pForm, grade: parseInt(e.target.value) })}
                style={inputStyle}>
                {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Subject</label>
              <select value={pForm.subject} onChange={e => setPForm({ ...pForm, subject: e.target.value })}
                style={inputStyle}>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Term</label>
              <select value={pForm.term} onChange={e => setPForm({ ...pForm, term: e.target.value })}
                style={inputStyle}>
                {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
            <div>
              <label style={labelStyle}>Year</label>
              <input type="number" value={pForm.year}
                onChange={e => setPForm({ ...pForm, year: parseInt(e.target.value) })}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Time (min)</label>
              <input type="number" value={pForm.timeLimit}
                onChange={e => setPForm({ ...pForm, timeLimit: parseInt(e.target.value) })}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Total Marks</label>
              <input type="number" value={pForm.totalMarks}
                onChange={e => setPForm({ ...pForm, totalMarks: parseInt(e.target.value) })}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Questions</label>
              <input type="number" value={pForm.questionCount}
                onChange={e => setPForm({ ...pForm, questionCount: parseInt(e.target.value) })}
                style={inputStyle} />
            </div>
          </div>

          <button onClick={handleSavePaper} disabled={pSaving} style={{
            padding: "11px 28px",
            background: pSaving ? "#93C5FD" : C.secondary,
            color: C.white, border: "none",
            borderRadius: 8, fontWeight: 700,
            cursor: pSaving ? "not-allowed" : "pointer", fontSize: 15,
          }}>
            {pSaving ? "Saving..." : "Add Paper"}
          </button>
        </div>
      )}

      {/* Learners */}
      {tab === "learners" && (
        <div style={{
          background: C.white, borderRadius: 14,
          padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700 }}>👥 Registered Learners</h2>
          {loadingData ? (
            <p style={{ color: C.muted }}>Loading...</p>
          ) : learners.length === 0 ? (
            <p style={{ color: C.muted, textAlign: "center", padding: "20px 0" }}>
              No learners registered yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#F9FAFB" }}>
                    {["Name", "Email", "Grade", "Points", "Badges"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: C.muted, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {learners.map(l => (
                    <tr key={l.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{l.name}</td>
                      <td style={{ padding: "10px 12px", color: C.muted }}>{l.email}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          background: "#EFF6FF", color: C.primary,
                          borderRadius: 4, padding: "2px 8px", fontWeight: 700, fontSize: 12,
                        }}>Grade {l.grade}</span>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: C.accent }}>
                        🌟 {l.points || 0}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{(l.badges || []).length} badges</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
