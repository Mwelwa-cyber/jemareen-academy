import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { SUBJECTS, BADGES } from "../../data/sampleData";

const C = {
  primary: "#1E40AF",
  secondary: "#059669",
  accent: "#F59E0B",
  white: "#FFFFFF",
  bg: "#EFF6FF",
  text: "#1F2937",
  muted: "#6B7280",
};

const subjectColors = {
  "Mathematics": "#3B82F6",
  "English": "#8B5CF6",
  "Science": "#10B981",
  "Social Studies": "#F59E0B",
  "C.T.S.": "#EF4444",
};

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12,
      padding: "18px 20px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      display: "flex", alignItems: "center", gap: 14,
      border: `2px solid ${color}20`,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${color}15`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

export default function StudentDashboard({ user }) {
  const [profile, setProfile] = useState(null);
  const [recentResults, setRecentResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) return;
      try {
        const profSnap = await getDoc(doc(db, "users", user.uid));
        if (profSnap.exists()) setProfile(profSnap.data());

        const q = query(
          collection(db, "results"),
          where("userId", "==", user.uid),
          orderBy("completedAt", "desc"),
          limit(5)
        );
        const snap = await getDocs(q);
        setRecentResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Compute subject performance from recent results
  const subjectScores = {};
  recentResults.forEach(r => {
    if (!subjectScores[r.subject]) subjectScores[r.subject] = { total: 0, count: 0 };
    subjectScores[r.subject].total += r.percentage || 0;
    subjectScores[r.subject].count += 1;
  });

  const avgScore = recentResults.length
    ? Math.round(recentResults.reduce((a, b) => a + (b.percentage || 0), 0) / recentResults.length)
    : 0;

  const earnedBadges = profile?.badges || [];

  const weakSubjects = Object.entries(subjectScores)
    .filter(([, v]) => v.total / v.count < 60)
    .map(([s]) => s);

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Loading your dashboard...</div>
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>
      {/* Welcome */}
      <div style={{
        background: `linear-gradient(135deg, ${C.primary} 0%, #1D4ED8 100%)`,
        borderRadius: 16, padding: "24px 28px",
        color: C.white, marginBottom: 24,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
            Welcome back, {profile?.name || user?.displayName || "Student"}! 👋
          </h1>
          <p style={{ margin: "6px 0 0", opacity: 0.85, fontSize: 14 }}>
            Grade {profile?.grade} · Keep up the great work!
          </p>
        </div>
        <div style={{
          background: "rgba(255,255,255,0.15)",
          borderRadius: 12, padding: "12px 20px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>🌟 {profile?.points || 0}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Total Points</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 14, marginBottom: 24,
      }}>
        <StatCard label="Quizzes Done" value={recentResults.length} icon="📝" color={C.primary} />
        <StatCard label="Avg Score" value={`${avgScore}%`} icon="📊" color={C.secondary} />
        <StatCard label="Badges" value={earnedBadges.length} icon="🏆" color={C.accent} />
        <StatCard label="Subjects" value={Object.keys(subjectScores).length} icon="📚" color="#8B5CF6" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Quick Actions */}
        <div style={{
          background: C.white, borderRadius: 14,
          padding: "20px 22px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: C.text }}>
            🚀 Quick Start
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link to="/papers" style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", borderRadius: 10,
              background: "#EFF6FF",
              textDecoration: "none", color: C.primary,
              fontWeight: 600, fontSize: 14,
              border: "1.5px solid #BFDBFE",
            }}>
              📄 Browse Past Papers
            </Link>
            <Link to="/topics" style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", borderRadius: 10,
              background: "#F0FDF4",
              textDecoration: "none", color: C.secondary,
              fontWeight: 600, fontSize: 14,
              border: "1.5px solid #BBF7D0",
            }}>
              📚 Topic Quizzes
            </Link>
            <Link to="/papers?mode=mock" style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", borderRadius: 10,
              background: "#FFFBEB",
              textDecoration: "none", color: "#92400E",
              fontWeight: 600, fontSize: 14,
              border: "1.5px solid #FDE68A",
            }}>
              ⏱️ Mock Exam Mode
            </Link>
          </div>
        </div>

        {/* Subject Performance */}
        <div style={{
          background: C.white, borderRadius: 14,
          padding: "20px 22px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: C.text }}>
            📊 Subject Performance
          </h2>
          {Object.keys(subjectScores).length === 0 ? (
            <div style={{ color: C.muted, fontSize: 14, textAlign: "center", paddingTop: 20 }}>
              <div style={{ fontSize: 32 }}>📝</div>
              <p>Complete quizzes to see your performance!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(subjectScores).map(([subj, data]) => {
                const avg = Math.round(data.total / data.count);
                const color = subjectColors[subj] || C.primary;
                return (
                  <div key={subj}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: C.text }}>{subj}</span>
                      <span style={{ fontWeight: 700, color }}>{avg}%</span>
                    </div>
                    <div style={{ height: 8, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${avg}%`,
                        background: color, borderRadius: 4,
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Weak Areas */}
      {weakSubjects.length > 0 && (
        <div style={{
          background: "#FFFBEB", border: "1.5px solid #FDE68A",
          borderRadius: 12, padding: "16px 20px", marginBottom: 20,
        }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#92400E" }}>
            💡 Focus Areas — Needs Improvement
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {weakSubjects.map(s => (
              <span key={s} style={{
                background: "#FEF3C7", border: "1px solid #FCD34D",
                borderRadius: 20, padding: "4px 12px",
                fontSize: 13, fontWeight: 600, color: "#92400E",
              }}>
                {s}
              </span>
            ))}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "#78350F" }}>
            Practice these subjects more to improve your scores!
          </p>
        </div>
      )}

      {/* Recent Quiz History */}
      <div style={{
        background: C.white, borderRadius: 14,
        padding: "20px 22px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        marginBottom: 24,
      }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: C.text }}>
          🕐 Recent Quiz History
        </h2>
        {recentResults.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, padding: "20px 0" }}>
            <div style={{ fontSize: 40 }}>🎯</div>
            <p>No quizzes yet. Start your first quiz!</p>
            <Link to="/papers" style={{
              display: "inline-block",
              padding: "10px 20px",
              background: C.primary, color: C.white,
              borderRadius: 8, textDecoration: "none",
              fontWeight: 700, fontSize: 14,
            }}>
              Browse Papers
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recentResults.map(r => (
              <div key={r.id} style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: "#F9FAFB",
                borderRadius: 10, flexWrap: "wrap", gap: 8,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{r.paperTitle}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {r.subject} · {r.mode === "exam" ? "Exam Mode" : "Practice Mode"}
                  </div>
                </div>
                <div style={{
                  fontWeight: 800, fontSize: 18,
                  color: r.percentage >= 70 ? C.secondary : r.percentage >= 50 ? C.accent : "#EF4444",
                }}>
                  {r.percentage}%
                  <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textAlign: "right" }}>
                    {r.score}/{r.total}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Badges */}
      <div style={{
        background: C.white, borderRadius: 14,
        padding: "20px 22px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: C.text }}>
          🏆 Badges
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {BADGES.map(badge => {
            const earned = earnedBadges.includes(badge.id);
            return (
              <div key={badge.id} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 4, padding: "12px 16px",
                borderRadius: 12,
                background: earned ? "#FFFBEB" : "#F9FAFB",
                border: `2px solid ${earned ? "#FCD34D" : "#E5E7EB"}`,
                opacity: earned ? 1 : 0.5,
                minWidth: 90, textAlign: "center",
              }}>
                <div style={{ fontSize: 28 }}>{badge.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: earned ? "#92400E" : C.muted }}>
                  {badge.name}
                </div>
                {earned && <div style={{ fontSize: 10, color: "#92400E" }}>Earned!</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
