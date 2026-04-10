import { useLocation, useNavigate, Link } from "react-router-dom";

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

function getGrade(pct) {
  if (pct >= 90) return { letter: "A+", label: "Outstanding!", color: "#059669", emoji: "🏆" };
  if (pct >= 80) return { letter: "A", label: "Excellent!", color: "#059669", emoji: "🌟" };
  if (pct >= 70) return { letter: "B", label: "Good work!", color: "#2563EB", emoji: "👍" };
  if (pct >= 60) return { letter: "C", label: "Keep trying!", color: "#D97706", emoji: "📚" };
  if (pct >= 50) return { letter: "D", label: "Keep practising!", color: "#EA580C", emoji: "💪" };
  return { letter: "F", label: "Needs improvement", color: "#DC2626", emoji: "📖" };
}

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state;

  if (!state) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 48 }}>😕</div>
        <h2>No results found</h2>
        <Link to="/papers" style={{
          padding: "10px 24px", background: C.primary, color: C.white,
          borderRadius: 8, textDecoration: "none", fontWeight: 700,
        }}>
          Go to Papers
        </Link>
      </div>
    );
  }

  const { score, total, percentage, paperTitle, subject, mode, answers, questions } = state;
  const grade = getGrade(percentage);
  const correct = questions?.filter(q => {
    const ans = answers?.[q.id];
    if (q.type === "mcq") return ans === q.correct;
    if (q.type === "true_false") return ans === q.correct;
    if (q.type === "short_answer") return typeof ans === "string" && ans.trim().toLowerCase() === q.correct.toLowerCase();
    return false;
  }) || [];
  const wrong = questions?.filter(q => !correct.includes(q)) || [];

  // Group wrong answers by topic
  const weakTopics = [...new Set(wrong.map(q => q.topic))];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "24px 16px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>

        {/* Score Card */}
        <div style={{
          background: `linear-gradient(135deg, ${grade.color} 0%, ${grade.color}CC 100%)`,
          borderRadius: 20, padding: "32px",
          textAlign: "center", color: C.white,
          marginBottom: 20,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        }}>
          <div style={{ fontSize: 56 }}>{grade.emoji}</div>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1 }}>{percentage}%</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{grade.letter} — {grade.label}</div>
          <div style={{ marginTop: 12, opacity: 0.9, fontSize: 16 }}>
            You scored <strong>{score} out of {total}</strong> marks
          </div>
          <div style={{ marginTop: 4, opacity: 0.8, fontSize: 14 }}>
            {paperTitle} · {mode === "exam" ? "Exam Mode" : "Practice Mode"}
          </div>
        </div>

        {/* Stats Row */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12, marginBottom: 20,
        }}>
          {[
            { label: "Correct", value: correct.length, color: C.secondary, icon: "✅" },
            { label: "Wrong", value: wrong.length, color: C.error, icon: "❌" },
            { label: "Unanswered", value: (questions?.length || 0) - correct.length - wrong.length, color: C.muted, icon: "⬜" },
          ].map(s => (
            <div key={s.label} style={{
              background: C.white, borderRadius: 12,
              padding: "16px", textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
              border: `2px solid ${s.color}20`,
            }}>
              <div style={{ fontSize: 24 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: C.muted }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Weak Topics */}
        {weakTopics.length > 0 && (
          <div style={{
            background: "#FFFBEB", border: "1.5px solid #FDE68A",
            borderRadius: 12, padding: "16px 20px",
            marginBottom: 20,
          }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "#92400E" }}>
              💡 Areas to Revise
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {weakTopics.map(t => (
                <span key={t} style={{
                  background: "#FEF3C7", border: "1px solid #FCD34D",
                  borderRadius: 20, padding: "4px 14px",
                  fontSize: 13, fontWeight: 600, color: "#92400E",
                }}>
                  {t}
                </span>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#78350F" }}>
              Focus on these topics in your next practice session!
            </p>
          </div>
        )}

        {/* Answer Review */}
        {questions && questions.length > 0 && (
          <div style={{
            background: C.white, borderRadius: 14,
            padding: "20px", marginBottom: 20,
            boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
          }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: C.text }}>
              📋 Answer Review
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {questions.map((q, i) => {
                const ans = answers?.[q.id];
                const isCorrect = q.type === "mcq" ? ans === q.correct
                  : q.type === "true_false" ? ans === q.correct
                  : typeof ans === "string" && ans.trim().toLowerCase() === q.correct.toLowerCase();
                const unanswered = ans === undefined;

                return (
                  <div key={q.id} style={{
                    borderLeft: `4px solid ${unanswered ? C.muted : isCorrect ? C.secondary : C.error}`,
                    paddingLeft: 14,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.text, flex: 1, paddingRight: 8 }}>
                        {i + 1}. {q.question}
                      </div>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>
                        {unanswered ? "⬜" : isCorrect ? "✅" : "❌"}
                      </span>
                    </div>

                    {q.type === "mcq" && (
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        {!unanswered && !isCorrect && (
                          <div style={{ color: C.error }}>Your answer: {q.options[ans]}</div>
                        )}
                        <div style={{ color: C.secondary }}>Correct: {q.options[q.correct]}</div>
                      </div>
                    )}
                    {q.type === "true_false" && (
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        {!unanswered && !isCorrect && (
                          <div style={{ color: C.error }}>Your answer: {ans ? "True" : "False"}</div>
                        )}
                        <div style={{ color: C.secondary }}>Correct: {q.correct ? "True" : "False"}</div>
                      </div>
                    )}
                    {q.type === "short_answer" && (
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        {!unanswered && !isCorrect && (
                          <div style={{ color: C.error }}>Your answer: {ans}</div>
                        )}
                        <div style={{ color: C.secondary }}>Correct: {q.correct}</div>
                      </div>
                    )}

                    <div style={{
                      marginTop: 6, fontSize: 12, color: "#6B7280",
                      background: "#F9FAFB", borderRadius: 6, padding: "6px 10px",
                    }}>
                      💡 {q.explanation}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => navigate(-1)} style={{
            flex: 1, minWidth: 120,
            padding: "12px",
            background: C.white, color: C.primary,
            border: "2px solid #BFDBFE",
            borderRadius: 10, fontWeight: 700,
            cursor: "pointer", fontSize: 15,
          }}>
            🔄 Try Again
          </button>
          <Link to="/papers" style={{
            flex: 1, minWidth: 120,
            padding: "12px",
            background: C.secondary, color: C.white,
            border: "none",
            borderRadius: 10, fontWeight: 700,
            cursor: "pointer", fontSize: 15,
            textDecoration: "none", textAlign: "center",
          }}>
            📄 More Papers
          </Link>
          <Link to="/dashboard" style={{
            flex: 1, minWidth: 120,
            padding: "12px",
            background: C.primary, color: C.white,
            border: "none",
            borderRadius: 10, fontWeight: 700,
            cursor: "pointer", fontSize: 15,
            textDecoration: "none", textAlign: "center",
          }}>
            📈 My Progress
          </Link>
        </div>
      </div>
    </div>
  );
}
