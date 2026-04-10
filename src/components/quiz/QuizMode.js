import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, arrayUnion, increment } from "firebase/firestore";
import { db } from "../../firebase";
import { sampleQuestions, samplePapers } from "../../data/sampleData";

const C = {
  primary: "#1E40AF",
  secondary: "#059669",
  accent: "#F59E0B",
  white: "#FFFFFF",
  bg: "#EFF6FF",
  text: "#1F2937",
  muted: "#6B7280",
  error: "#DC2626",
  correct: "#059669",
  wrong: "#DC2626",
};

function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 4 }}>
        <span>Question {current} of {total}</span>
        <span>{pct}% complete</span>
      </div>
      <div style={{ height: 8, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${C.primary}, #3B82F6)`,
          borderRadius: 4, transition: "width 0.4s",
        }} />
      </div>
    </div>
  );
}

function Timer({ seconds, isPractice }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isLow = seconds < 60;

  if (isPractice) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 14px",
      background: isLow ? "#FEE2E2" : "#EFF6FF",
      borderRadius: 8,
      color: isLow ? C.error : C.primary,
      fontWeight: 700, fontSize: 15,
      border: `1.5px solid ${isLow ? "#FECACA" : "#BFDBFE"}`,
      animation: isLow ? "pulse 1s infinite" : "none",
    }}>
      ⏱️ {mins}:{secs.toString().padStart(2, "0")}
    </div>
  );
}

export default function QuizMode({ user }) {
  const { paperId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get("mode") || "practice";
  const isPractice = mode === "practice";

  const paper = samplePapers.find(p => p.id === paperId);
  const questions = sampleQuestions[paperId] || [];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [shortInput, setShortInput] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeLeft, setTimeLeft] = useState(paper ? paper.timeLimit * 60 : 3600);
  const [submitted, setSubmitted] = useState(false);
  const [quizDone, setQuizDone] = useState(false);

  const finishQuiz = useCallback(async (finalAnswers) => {
    setQuizDone(true);
    let score = 0;
    let total = 0;

    questions.forEach(q => {
      total += q.marks;
      const ans = finalAnswers[q.id];
      if (q.type === "mcq" && ans === q.correct) score += q.marks;
      else if (q.type === "true_false" && ans === q.correct) score += q.marks;
      else if (q.type === "short_answer" &&
        typeof ans === "string" &&
        ans.trim().toLowerCase() === q.correct.toLowerCase()) score += q.marks;
    });

    const percentage = Math.round((score / total) * 100);
    const resultData = {
      userId: user?.uid,
      paperId,
      paperTitle: paper?.title || paperId,
      subject: paper?.subject || "Unknown",
      grade: paper?.grade,
      mode,
      score,
      total,
      percentage,
      answers: finalAnswers,
      completedAt: serverTimestamp(),
    };

    try {
      const ref = await addDoc(collection(db, "results"), resultData);
      // Award points
      if (user?.uid) {
        const userRef = doc(db, "users", user.uid);
        const pointsEarned = Math.round(percentage / 10) * 5;
        await updateDoc(userRef, {
          points: increment(pointsEarned),
        });
        // Award badges
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data() || {};
        const badges = userData.badges || [];
        const newBadges = [];
        if (!badges.includes("first_quiz")) newBadges.push("first_quiz");
        if (percentage === 100 && !badges.includes("perfect_score")) newBadges.push("perfect_score");
        if (paper?.subject === "Mathematics" && percentage >= 80 && !badges.includes("math_star")) newBadges.push("math_star");
        if (paper?.subject === "Science" && percentage >= 80 && !badges.includes("science_star")) newBadges.push("science_star");
        if (paper?.subject === "English" && percentage >= 80 && !badges.includes("english_star")) newBadges.push("english_star");
        if (newBadges.length > 0) {
          await updateDoc(userRef, { badges: arrayUnion(...newBadges) });
        }
      }
      navigate(`/results/${ref.id}`, { state: { ...resultData, answers: finalAnswers, questions } });
    } catch (e) {
      console.error(e);
      navigate(`/results/local`, { state: { ...resultData, answers: finalAnswers, questions } });
    }
  }, [questions, paper, paperId, mode, user, navigate]);

  // Countdown timer for exam mode
  useEffect(() => {
    if (isPractice || quizDone) return;
    if (timeLeft <= 0) {
      finishQuiz(answers);
      return;
    }
    const t = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, isPractice, quizDone, answers, finishQuiz]);

  if (!paper || questions.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 48 }}>📭</div>
        <h2 style={{ color: C.text }}>Questions Coming Soon</h2>
        <p style={{ color: C.muted }}>This paper's questions haven't been added yet.</p>
        <button onClick={() => navigate("/papers")} style={{
          padding: "10px 24px", background: C.primary, color: C.white,
          border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer",
        }}>
          Back to Papers
        </button>
      </div>
    );
  }

  const q = questions[currentIdx];
  const userAnswer = answers[q.id];
  const isAnswered = userAnswer !== undefined;

  const handleMCQAnswer = (idx) => {
    if (showFeedback) return;
    const newAnswers = { ...answers, [q.id]: idx };
    setAnswers(newAnswers);
    if (isPractice) setShowFeedback(true);
  };

  const handleTFAnswer = (val) => {
    if (showFeedback) return;
    const newAnswers = { ...answers, [q.id]: val };
    setAnswers(newAnswers);
    if (isPractice) setShowFeedback(true);
  };

  const handleShortSubmit = () => {
    if (!shortInput.trim()) return;
    const newAnswers = { ...answers, [q.id]: shortInput.trim() };
    setAnswers(newAnswers);
    setShortInput("");
    if (isPractice) setShowFeedback(true);
  };

  const goNext = () => {
    setShowFeedback(false);
    setShortInput("");
    if (currentIdx + 1 >= questions.length) {
      finishQuiz(answers);
    } else {
      setCurrentIdx(i => i + 1);
    }
  };

  const handleExamSubmit = () => {
    if (!submitted) {
      setSubmitted(true);
      finishQuiz(answers);
    }
  };

  const isCorrect = q.type === "mcq"
    ? userAnswer === q.correct
    : q.type === "true_false"
    ? userAnswer === q.correct
    : typeof userAnswer === "string" && userAnswer.trim().toLowerCase() === q.correct.toLowerCase();

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      padding: "16px",
    }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header */}
        <div style={{
          background: C.white,
          borderRadius: 14, padding: "16px 20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{paper.title}</div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {isPractice ? "✏️ Practice Mode" : "⏱️ Exam Mode"}
              </div>
            </div>
            <Timer seconds={timeLeft} isPractice={isPractice} />
          </div>
          <ProgressBar current={currentIdx + 1} total={questions.length} />
        </div>

        {/* Question Card */}
        <div style={{
          background: C.white,
          borderRadius: 16, padding: "24px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          marginBottom: 16,
        }}>
          {/* Topic badge */}
          <div style={{ marginBottom: 12 }}>
            <span style={{
              background: "#EFF6FF", color: C.primary,
              borderRadius: 6, padding: "3px 10px",
              fontSize: 12, fontWeight: 700,
            }}>
              {q.topic}
            </span>
            <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>
              {q.marks} mark{q.marks !== 1 ? "s" : ""}
            </span>
          </div>

          <p style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: "0 0 20px", lineHeight: 1.5 }}>
            {q.question}
          </p>

          {/* MCQ */}
          {q.type === "mcq" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {q.options.map((opt, idx) => {
                let bg = C.white, border = "#D1D5DB", textColor = C.text;
                if (isAnswered && isPractice && showFeedback) {
                  if (idx === q.correct) { bg = "#F0FDF4"; border = "#86EFAC"; textColor = "#166534"; }
                  else if (idx === userAnswer && idx !== q.correct) { bg = "#FEF2F2"; border = "#FCA5A5"; textColor = C.error; }
                } else if (userAnswer === idx) {
                  bg = "#EFF6FF"; border = C.primary; textColor = C.primary;
                }
                return (
                  <button key={idx} onClick={() => handleMCQAnswer(idx)} style={{
                    padding: "12px 16px",
                    background: bg,
                    border: `2px solid ${border}`,
                    borderRadius: 10, cursor: showFeedback ? "default" : "pointer",
                    textAlign: "left", fontSize: 15, color: textColor,
                    fontWeight: userAnswer === idx ? 700 : 500,
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: userAnswer === idx ? (isAnswered && showFeedback ? (idx === q.correct ? "#BBF7D0" : "#FECACA") : "#BFDBFE") : "#F3F4F6",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, flexShrink: 0,
                      color: userAnswer === idx ? (isAnswered && showFeedback ? (idx === q.correct ? "#166534" : C.error) : C.primary) : C.muted,
                    }}>
                      {isAnswered && showFeedback && idx === q.correct ? "✓" : isAnswered && showFeedback && idx === userAnswer && idx !== q.correct ? "✗" : "ABCD"[idx]}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* True/False */}
          {q.type === "true_false" && (
            <div style={{ display: "flex", gap: 12 }}>
              {[true, false].map(val => {
                let bg = C.white, border = "#D1D5DB", textColor = C.text;
                if (isAnswered && isPractice && showFeedback) {
                  if (val === q.correct) { bg = "#F0FDF4"; border = "#86EFAC"; textColor = "#166534"; }
                  else if (userAnswer === val && val !== q.correct) { bg = "#FEF2F2"; border = "#FCA5A5"; textColor = C.error; }
                } else if (userAnswer === val) {
                  bg = "#EFF6FF"; border = C.primary; textColor = C.primary;
                }
                return (
                  <button key={String(val)} onClick={() => handleTFAnswer(val)} style={{
                    flex: 1, padding: "16px",
                    background: bg, border: `2px solid ${border}`,
                    borderRadius: 10, cursor: showFeedback ? "default" : "pointer",
                    fontSize: 16, fontWeight: 700, color: textColor,
                  }}>
                    {val ? "✅ True" : "❌ False"}
                  </button>
                );
              })}
            </div>
          )}

          {/* Short Answer */}
          {q.type === "short_answer" && (
            <div>
              {isAnswered ? (
                <div style={{
                  padding: "12px 16px",
                  background: isPractice && showFeedback ? (isCorrect ? "#F0FDF4" : "#FEF2F2") : "#EFF6FF",
                  border: `2px solid ${isPractice && showFeedback ? (isCorrect ? "#86EFAC" : "#FCA5A5") : "#BFDBFE"}`,
                  borderRadius: 10,
                  fontSize: 15, fontWeight: 600,
                  color: isPractice && showFeedback ? (isCorrect ? "#166534" : C.error) : C.primary,
                }}>
                  Your answer: {userAnswer}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    value={shortInput}
                    onChange={e => setShortInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleShortSubmit()}
                    placeholder="Type your answer here..."
                    style={{
                      flex: 1, padding: "12px 16px",
                      border: "2px solid #D1D5DB",
                      borderRadius: 10, fontSize: 15, outline: "none",
                    }}
                  />
                  <button onClick={handleShortSubmit} style={{
                    padding: "12px 20px",
                    background: C.primary, color: C.white,
                    border: "none", borderRadius: 10,
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}>
                    Submit
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Feedback (Practice Mode) */}
          {isPractice && showFeedback && isAnswered && (
            <div style={{
              marginTop: 16,
              padding: "14px 16px",
              background: isCorrect ? "#F0FDF4" : "#FEF2F2",
              border: `1.5px solid ${isCorrect ? "#86EFAC" : "#FCA5A5"}`,
              borderRadius: 10,
            }}>
              <div style={{
                fontWeight: 700, fontSize: 15, marginBottom: 6,
                color: isCorrect ? "#166534" : C.error,
              }}>
                {isCorrect ? "🎉 Correct!" : "❌ Not quite right."}
              </div>
              {!isCorrect && q.type !== "short_answer" && (
                <div style={{ fontSize: 13, color: "#166534", marginBottom: 6 }}>
                  Correct answer: <strong>
                    {q.type === "mcq" ? q.options[q.correct] : q.correct.toString()}
                  </strong>
                </div>
              )}
              {!isCorrect && q.type === "short_answer" && (
                <div style={{ fontSize: 13, color: "#166534", marginBottom: 6 }}>
                  Correct answer: <strong>{q.correct}</strong>
                </div>
              )}
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                💡 {q.explanation}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/papers")}
            style={{
              padding: "10px 18px",
              background: C.white, color: C.muted,
              border: "1.5px solid #E5E7EB",
              borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14,
            }}
          >
            ← Exit Quiz
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            {isPractice && (
              <button
                onClick={goNext}
                disabled={!isAnswered}
                style={{
                  padding: "10px 24px",
                  background: isAnswered ? C.primary : "#E5E7EB",
                  color: isAnswered ? C.white : C.muted,
                  border: "none", borderRadius: 8,
                  fontWeight: 700, cursor: isAnswered ? "pointer" : "not-allowed",
                  fontSize: 15,
                }}
              >
                {currentIdx + 1 >= questions.length ? "Finish Quiz 🏁" : "Next →"}
              </button>
            )}
            {!isPractice && currentIdx < questions.length - 1 && (
              <button
                onClick={() => { setCurrentIdx(i => i + 1); setShortInput(""); }}
                style={{
                  padding: "10px 24px",
                  background: C.primary, color: C.white,
                  border: "none", borderRadius: 8,
                  fontWeight: 700, cursor: "pointer", fontSize: 15,
                }}
              >
                Next →
              </button>
            )}
            {!isPractice && currentIdx === questions.length - 1 && (
              <button
                onClick={handleExamSubmit}
                disabled={submitted}
                style={{
                  padding: "10px 24px",
                  background: C.secondary, color: C.white,
                  border: "none", borderRadius: 8,
                  fontWeight: 700, cursor: "pointer", fontSize: 15,
                }}
              >
                Submit Exam 🏁
              </button>
            )}
          </div>
        </div>

        {/* Exam mode: answer status dots */}
        {!isPractice && (
          <div style={{
            marginTop: 16,
            background: C.white, borderRadius: 12,
            padding: "14px 18px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 600 }}>
              Question Navigator
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentIdx(i); setShortInput(""); }}
                  style={{
                    width: 32, height: 32,
                    borderRadius: 6,
                    background: i === currentIdx ? C.primary : answers[questions[i].id] !== undefined ? "#BBF7D0" : "#F3F4F6",
                    color: i === currentIdx ? C.white : answers[questions[i].id] !== undefined ? "#166534" : C.muted,
                    border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
