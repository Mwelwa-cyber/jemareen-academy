import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";
import { SUBJECTS } from "../../data/sampleData";

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

const subjectColors = {
  "Mathematics": "#3B82F6",
  "English": "#8B5CF6",
  "Science": "#10B981",
  "Social Studies": "#F59E0B",
  "C.T.S.": "#EF4444",
};

export default function TeacherView({ user }) {
  const [learners, setLearners] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        setLearners(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === "student"));

        const q = query(collection(db, "results"), orderBy("completedAt", "desc"), limit(100));
        const resSnap = await getDocs(q);
        setResults(resSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Build per-subject stats
  const subjectStats = {};
  SUBJECTS.forEach(s => {
    const subjectResults = results.filter(r => r.subject === s);
    if (subjectResults.length === 0) return;
    const avg = Math.round(subjectResults.reduce((a, b) => a + (b.percentage || 0), 0) / subjectResults.length);
    const weakLearners = [];
    subjectResults.forEach(r => {
      if (r.percentage < 60) {
        const learner = learners.find(l => l.id === r.userId);
        if (learner && !weakLearners.find(w => w.id === r.userId)) {
          weakLearners.push({ id: r.userId, name: learner.name, score: r.percentage });
        }
      }
    });
    subjectStats[s] = { avg, count: subjectResults.length, weakLearners };
  });

  const filteredResults = subjectFilter
    ? results.filter(r => r.subject === subjectFilter)
    : results;

  // Per-learner performance
  const learnerPerf = learners.map(l => {
    const lResults = results.filter(r => r.userId === l.id);
    const avg = lResults.length
      ? Math.round(lResults.reduce((a, b) => a + (b.percentage || 0), 0) / lResults.length)
      : null;
    return { ...l, quizCount: lResults.length, avgScore: avg };
  });

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
      Loading class data...
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: C.text }}>
          👨‍🏫 Teacher Dashboard
        </h1>
        <p style={{ margin: 0, color: C.muted, fontSize: 14 }}>
          Monitor class performance and identify learners who need support
        </p>
      </div>

      {/* Quick Stats */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12, marginBottom: 24,
      }}>
        {[
          { label: "Total Learners", value: learners.length, icon: "👥", color: C.primary },
          { label: "Quizzes Taken", value: results.length, icon: "📝", color: C.secondary },
          {
            label: "Class Avg", icon: "📊", color: C.accent,
            value: results.length
              ? `${Math.round(results.reduce((a, b) => a + (b.percentage || 0), 0) / results.length)}%`
              : "—",
          },
          {
            label: "Need Support",
            value: learnerPerf.filter(l => l.avgScore !== null && l.avgScore < 60).length,
            icon: "⚠️", color: C.error,
          },
        ].map(s => (
          <div key={s.label} style={{
            background: C.white, borderRadius: 12,
            padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Subject Performance */}
      <div style={{
        background: C.white, borderRadius: 14,
        padding: "20px", marginBottom: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>📊 Subject Performance</h2>
        {Object.keys(subjectStats).length === 0 ? (
          <p style={{ color: C.muted, textAlign: "center", padding: "20px 0" }}>
            No quiz data available yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(subjectStats).map(([subj, data]) => {
              const color = subjectColors[subj] || C.primary;
              return (
                <div key={subj}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{subj}</span>
                      <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>{data.count} attempts</span>
                    </div>
                    <span style={{ fontWeight: 800, color, fontSize: 16 }}>{data.avg}%</span>
                  </div>
                  <div style={{ height: 10, background: "#F3F4F6", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${data.avg}%`,
                      background: color, borderRadius: 5, transition: "width 0.6s",
                    }} />
                  </div>
                  {data.weakLearners.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <span style={{ fontSize: 12, color: C.error, fontWeight: 600 }}>⚠️ Weak learners:</span>
                      {data.weakLearners.map(w => (
                        <span key={w.id} style={{
                          background: "#FEF2F2", border: "1px solid #FECACA",
                          borderRadius: 4, padding: "2px 8px",
                          fontSize: 11, color: C.error, fontWeight: 600,
                        }}>
                          {w.name} ({w.score}%)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Learner Table */}
      <div style={{
        background: C.white, borderRadius: 14,
        padding: "20px", marginBottom: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>👥 All Learners</h2>
        {learnerPerf.length === 0 ? (
          <p style={{ color: C.muted, textAlign: "center", padding: "20px 0" }}>No learners yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {["Name", "Grade", "Quizzes", "Avg Score", "Status"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: C.muted, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {learnerPerf.map(l => {
                  const status = l.avgScore === null ? "No data"
                    : l.avgScore >= 70 ? "On track"
                    : l.avgScore >= 50 ? "Needs attention"
                    : "Needs support";
                  const statusColor = l.avgScore === null ? C.muted
                    : l.avgScore >= 70 ? C.secondary
                    : l.avgScore >= 50 ? C.accent
                    : C.error;
                  return (
                    <tr key={l.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{l.name}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          background: "#EFF6FF", color: C.primary,
                          borderRadius: 4, padding: "2px 8px", fontWeight: 700, fontSize: 12,
                        }}>Grade {l.grade}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: C.muted }}>{l.quizCount}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 15,
                        color: l.avgScore !== null ? (l.avgScore >= 70 ? C.secondary : l.avgScore >= 50 ? C.accent : C.error) : C.muted }}>
                        {l.avgScore !== null ? `${l.avgScore}%` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          background: `${statusColor}15`,
                          color: statusColor,
                          borderRadius: 20, padding: "3px 10px",
                          fontSize: 11, fontWeight: 700,
                        }}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div style={{
        background: C.white, borderRadius: 14,
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📋 Recent Quiz Activity</h2>
          <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} style={{
            padding: "6px 10px", border: "1.5px solid #D1D5DB",
            borderRadius: 6, fontSize: 12, background: C.white, cursor: "pointer",
          }}>
            <option value="">All Subjects</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {filteredResults.length === 0 ? (
          <p style={{ color: C.muted, textAlign: "center", padding: "20px 0" }}>No activity yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredResults.slice(0, 15).map(r => {
              const learner = learners.find(l => l.id === r.userId);
              return (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: "#F9FAFB",
                  borderRadius: 8, flexWrap: "wrap", gap: 8,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>
                      {learner?.name || "Unknown"} — {r.subject}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>{r.paperTitle}</div>
                  </div>
                  <div style={{
                    fontWeight: 800, fontSize: 16,
                    color: r.percentage >= 70 ? C.secondary : r.percentage >= 50 ? C.accent : C.error,
                  }}>
                    {r.percentage}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
