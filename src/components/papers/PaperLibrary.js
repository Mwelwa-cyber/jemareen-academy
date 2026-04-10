import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { samplePapers, GRADES, SUBJECTS, TERMS, topicQuizzes } from "../../data/sampleData";

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
  "Mathematics": { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  "English": { bg: "#F5F3FF", border: "#DDD6FE", text: "#7C3AED" },
  "Science": { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" },
  "Social Studies": { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  "C.T.S.": { bg: "#FFF1F2", border: "#FECDD3", text: "#BE123C" },
};

function PaperCard({ paper, onStart }) {
  const col = subjectColors[paper.subject] || { bg: "#F9FAFB", border: "#E5E7EB", text: C.muted };
  return (
    <div style={{
      background: C.white, borderRadius: 14,
      border: `2px solid ${col.border}`,
      padding: "18px 20px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span style={{
            display: "inline-block",
            background: col.bg,
            border: `1px solid ${col.border}`,
            color: col.text,
            borderRadius: 6, padding: "3px 10px",
            fontSize: 12, fontWeight: 700, marginBottom: 8,
          }}>
            {paper.subject}
          </span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>
            {paper.title}
          </h3>
        </div>
        <span style={{
          background: "#EFF6FF", color: C.primary,
          borderRadius: 8, padding: "4px 10px",
          fontSize: 12, fontWeight: 700,
        }}>
          Grade {paper.grade}
        </span>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { icon: "❓", label: `${paper.questionCount} Questions` },
          { icon: "⭐", label: `${paper.totalMarks} Marks` },
          { icon: "⏱️", label: `${paper.timeLimit} min` },
          { icon: "📅", label: paper.term },
        ].map(m => (
          <span key={m.label} style={{
            fontSize: 12, color: C.muted, fontWeight: 500,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            {m.icon} {m.label}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={() => onStart(paper, "practice")}
          style={{
            flex: 1, padding: "9px 0",
            background: C.secondary, color: C.white,
            border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          ✏️ Practice
        </button>
        <button
          onClick={() => onStart(paper, "exam")}
          style={{
            flex: 1, padding: "9px 0",
            background: C.primary, color: C.white,
            border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          ⏱️ Exam Mode
        </button>
      </div>
    </div>
  );
}

function TopicCard({ quiz, onStart }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12,
      border: "1.5px solid #E5E7EB",
      padding: "14px 16px",
      display: "flex", alignItems: "center", gap: 14,
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      <div style={{ fontSize: 28 }}>{quiz.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{quiz.title}</div>
        <div style={{ fontSize: 12, color: C.muted }}>
          {quiz.subject} · Grade {quiz.grade} · {quiz.questionCount} Qs
        </div>
      </div>
      <button
        onClick={() => onStart(quiz)}
        style={{
          padding: "8px 14px",
          background: C.accent, color: "#92400E",
          border: "none", borderRadius: 8,
          fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}
      >
        Start
      </button>
    </div>
  );
}

export default function PaperLibrary({ showTopics = false }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ grade: "", subject: "", term: "", search: "" });

  const filtered = samplePapers.filter(p => {
    if (filters.grade && p.grade !== parseInt(filters.grade)) return false;
    if (filters.subject && p.subject !== filters.subject) return false;
    if (filters.term && p.term !== filters.term) return false;
    if (filters.search && !p.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const selectStyle = {
    padding: "9px 12px",
    border: "1.5px solid #D1D5DB",
    borderRadius: 8, fontSize: 13,
    background: C.white, color: C.text,
    outline: "none", cursor: "pointer",
  };

  const handleStart = (paper, mode) => {
    navigate(`/quiz/${paper.id}?mode=${mode}`);
  };

  const handleTopicStart = (quiz) => {
    navigate(`/quiz/topic-${quiz.id}?mode=practice`);
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, color: C.text }}>
          {showTopics ? "📚 Topic Quizzes" : "📄 Past Papers Library"}
        </h1>
        <p style={{ margin: 0, color: C.muted, fontSize: 14 }}>
          {showTopics
            ? "Practice specific topics to strengthen your knowledge"
            : "Browse past exam papers by grade and subject"}
        </p>
      </div>

      {!showTopics && (
        <>
          {/* Filters */}
          <div style={{
            background: C.white, borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            marginBottom: 20,
            display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
          }}>
            <input
              placeholder="🔍 Search papers..."
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              style={{
                ...selectStyle, flex: 1, minWidth: 160,
              }}
            />
            <select value={filters.grade} onChange={e => setFilters({ ...filters, grade: e.target.value })}
              style={selectStyle}>
              <option value="">All Grades</option>
              {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
            </select>
            <select value={filters.subject} onChange={e => setFilters({ ...filters, subject: e.target.value })}
              style={selectStyle}>
              <option value="">All Subjects</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.term} onChange={e => setFilters({ ...filters, term: e.target.value })}
              style={selectStyle}>
              <option value="">All Terms</option>
              {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(filters.grade || filters.subject || filters.term || filters.search) && (
              <button
                onClick={() => setFilters({ grade: "", subject: "", term: "", search: "" })}
                style={{
                  padding: "9px 14px",
                  background: "#FEE2E2", color: "#DC2626",
                  border: "none", borderRadius: 8,
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Count */}
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 16, fontWeight: 500 }}>
            Showing {filtered.length} paper{filtered.length !== 1 ? "s" : ""}
          </div>

          {/* Papers Grid */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
              <div style={{ fontSize: 40 }}>🔍</div>
              <p>No papers found. Try different filters.</p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}>
              {filtered.map(p => (
                <PaperCard key={p.id} paper={p} onStart={handleStart} />
              ))}
            </div>
          )}
        </>
      )}

      {showTopics && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {topicQuizzes.map(q => (
            <TopicCard key={q.id} quiz={q} onStart={handleTopicStart} />
          ))}
        </div>
      )}
    </div>
  );
}
