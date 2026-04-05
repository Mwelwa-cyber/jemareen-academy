import { useState, useEffect, useMemo } from "react";
import { signOut } from "firebase/auth";
import Finance from "./Finance";
import WhatsApp from "./WhatsApp";
import AnnualSummary from "./AnnualSummary";
import PettyCash from "./PettyCash";
import { LOGO } from "../App";
import {
  collection, addDoc, updateDoc, deleteDoc, setDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp, limit
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  IconDashboard, IconPayments, IconLearners, IconBell, IconChart,
  IconFees, IconFinance, IconChat, IconCalendar, IconWallet,
  IconHome, IconMenu, IconX, IconBolt, IconWarning, IconCheck,
  IconSchool, IconList,
} from "./Icons";

const GRADES = ["Baby Class","Reception","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7"];
const TERMS  = ["Term 1 2026","Term 2 2026","Term 3 2026"];
const METHODS = ["Mobile Money","Bank Transfer","Cash","Cheque"];

const DEFAULT_FEES = {
  "Baby Class":1800,"Reception":2000,"Grade 1":2200,"Grade 2":2200,
  "Grade 3":2400,"Grade 4":2400,"Grade 5":2600,"Grade 6":2600,"Grade 7":2800
};

const STATUS_CFG = {
  paid:    {label:"Paid",    color:"#10b981", bg:"rgba(16,185,129,0.12)"},
  partial: {label:"Partial", color:"#f59e0b", bg:"rgba(245,158,11,0.12)"},
  unpaid:  {label:"Unpaid",  color:"#60a5fa", bg:"rgba(96,165,250,0.12)"},
  overdue: {label:"Overdue", color:"#f43f5e", bg:"rgba(244,63,94,0.12)"},
};

const AVATAR_COLORS = ["#7B2D8B","#10b981","#f59e0b","#ef4444","#3b82f6","#9B3DAB","#06b6d4","#ec4899","#14b8a6"];
const avatarColor = (id) => AVATAR_COLORS[id ? id.charCodeAt(id.length-1) % AVATAR_COLORS.length : 0];
const initials = (name) => (name||"").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
const fmt = (n) => `K${Number(n||0).toLocaleString()}`;

const getStatus = (paid, fee, arrears) => {
  if (!paid || paid === 0) return arrears > 0 ? "overdue" : "unpaid";
  if (paid >= fee + arrears) return "paid";
  return "partial";
};

const NAV = [
  {id:"dashboard", icon:<IconDashboard size={18}/>, label:"Dashboard"},
  {id:"payments",  icon:<IconPayments  size={18}/>, label:"Payments"},
  {id:"learners",  icon:<IconLearners  size={18}/>, label:"Learners"},
  {id:"reminders", icon:<IconBell      size={18}/>, label:"Reminders"},
  {id:"analytics", icon:<IconChart     size={18}/>, label:"Analytics"},
  {id:"fees",      icon:<IconFees      size={18}/>, label:"Fee Setup"},
  {id:"finance",   icon:<IconFinance   size={18}/>, label:"Finance"},
  {id:"whatsapp",  icon:<IconChat      size={18}/>, label:"WhatsApp"},
  {id:"annual",    icon:<IconCalendar  size={18}/>, label:"Annual"},
  {id:"pettycash", icon:<IconWallet    size={18}/>, label:"Petty Cash"},
  {id:"audit",     icon:<IconList      size={18}/>, label:"Audit Log"},
];

export default function Dashboard({ user }) {
  const [activeTab, setActiveTab]       = useState("dashboard");
  const [activeTerm, setActiveTerm]     = useState("Term 1 2026");
  const [learners, setLearners]         = useState([]);
  const [payments, setPayments]         = useState([]);
  const [fees, setFees]                 = useState(DEFAULT_FEES);
  const [loading, setLoading]           = useState(true);

  // Modals & UI state
  const [showAddLearner, setShowAddLearner] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showEditFees, setShowEditFees]     = useState(false);
  const [showReceipt, setShowReceipt]       = useState(null);
  const [gradeFilter, setGradeFilter]       = useState("All Grades");
  const [statusFilter, setStatusFilter]     = useState("all");
  const [searchQ, setSearchQ]               = useState("");
  const [toast, setToast]                   = useState(null);
  const [remindersSent, setRemindersSent]   = useState([]);
  const [aiInsight, setAiInsight]           = useState(null);
  const [aiLoading, setAiLoading]           = useState(false);
  const [geminiKey, setGeminiKey]           = useState(() => localStorage.getItem("jemareen_gemini_key") || "");
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [delConfirm, setDelConfirm]         = useState(null);

  const [isOnline, setIsOnline]           = useState(navigator.onLine);
  const [pendingPayments, setPendingPayments] = useState(() => {
    try { return JSON.parse(localStorage.getItem("jemareen_pending") || "[]"); } catch { return []; }
  });
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [auditLogs, setAuditLogs]         = useState([]);
  const [showHistory, setShowHistory]     = useState(null);   // learner object
  const [delPayConfirm, setDelPayConfirm] = useState(null);   // payment object to delete

  // New state variables
  const [expandedGrades, setExpandedGrades] = useState(() => new Set([...GRADES, ...GRADES.map(g=>g+"_l")]));
  const toggleGrade = (g) => setExpandedGrades(prev => { const s=new Set(prev); s.has(g)?s.delete(g):s.add(g); return s; });
  const [editLearner, setEditLearner] = useState(null);
  const [editLearnerVals, setEditLearnerVals] = useState({});
  const [learnerSearch, setLearnerSearch] = useState("");

  // Form state
  const [newLearner, setNewLearner] = useState({name:"",grade:"Baby Class",parent:"",phone:"",email:""});
  const [newPayment, setNewPayment] = useState({learnerId:"",amount:"",method:"Mobile Money",date:new Date().toISOString().split("T")[0],notes:""});
  const [editFeeVals, setEditFeeVals] = useState({});

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3200); };

  // ── REAL-TIME FIRESTORE LISTENERS ──────────────────────────────────────
  useEffect(() => {
    const unsubLearners = onSnapshot(
      query(collection(db,"learners"), orderBy("name")),
      (snap) => {
        setLearners(snap.docs.map(d => ({id:d.id, ...d.data()})));
        setLoading(false);
      },
      () => setLoading(false)
    );
    const unsubPayments = onSnapshot(
      query(collection(db,"payments"), orderBy("createdAt","desc")),
      (snap) => setPayments(snap.docs.map(d => ({id:d.id, ...d.data()})))
    );
    const unsubFees = onSnapshot(doc(db,"settings","fees"), (snap) => {
      if (snap.exists()) setFees({...DEFAULT_FEES, ...snap.data()});
    });
    const unsubAudit = onSnapshot(
      query(collection(db,"auditLogs"), orderBy("timestamp","desc"), limit(150)),
      snap => setAuditLogs(snap.docs.map(d => ({id:d.id, ...d.data()})))
    );
    return () => { unsubLearners(); unsubPayments(); unsubFees(); unsubAudit(); };
  }, []);

  // ── ONLINE / OFFLINE ────────────────────────────────────────────────────
  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  syncOfflinePayments(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ENRICHED DATA ──────────────────────────────────────────────────────
  const enriched = useMemo(() => {
    return learners.map(learner => {
      const fee = fees[learner.grade] || 0;
      const termPayments = payments.filter(p => p.learnerId === learner.id && p.term === activeTerm);
      const totalPaid = termPayments.reduce((a,p) => a + (p.amount||0), 0);
      const lastPayment = termPayments[0] || null;
      // Check for arrears (previous term unpaid)
      const prevIdx = TERMS.indexOf(activeTerm) - 1;
      const prevTerm = prevIdx >= 0 ? TERMS[prevIdx] : null;
      const prevPayments = prevTerm ? payments.filter(p => p.learnerId === learner.id && p.term === prevTerm) : [];
      const prevPaid = prevPayments.reduce((a,p) => a+(p.amount||0), 0);
      const prevFee = fees[learner.grade] || 0;
      const arrears = prevTerm ? Math.max(0, prevFee - prevPaid) : 0;
      const balance = Math.max(0, fee + arrears - totalPaid);
      // Cap displayed paid at what was actually owed — prevents showing paid > fee
      const paidDisplay = Math.min(totalPaid, fee + arrears);
      const status = getStatus(totalPaid, fee, arrears);
      return { ...learner, fee, totalPaid, paidDisplay, arrears, balance, status, lastPayment, termPayments };
    });
  }, [learners, payments, fees, activeTerm]);

  const termData = enriched;

  const stats = useMemo(() => {
    const expected   = termData.reduce((a,l) => a + l.fee + l.arrears, 0);
    const collected  = termData.reduce((a,l) => a + l.paidDisplay, 0);
    const outstanding= termData.reduce((a,l) => a + l.balance, 0);
    const arrears    = termData.reduce((a,l) => a + l.arrears, 0);
    return {
      expected, collected, outstanding, arrears,
      paid:    termData.filter(l=>l.status==="paid").length,
      partial: termData.filter(l=>l.status==="partial").length,
      unpaid:  termData.filter(l=>l.status==="unpaid").length,
      overdue: termData.filter(l=>l.status==="overdue").length,
      rate: expected > 0 ? Math.round(collected/expected*100) : 0,
    };
  }, [termData]);

  const filtered = useMemo(() => {
    let rows = termData;
    if (gradeFilter !== "All Grades") rows = rows.filter(l => l.grade === gradeFilter);
    if (statusFilter !== "all") rows = rows.filter(l => l.status === statusFilter);
    if (searchQ) rows = rows.filter(l =>
      l.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
      l.parent?.toLowerCase().includes(searchQ.toLowerCase())
    );
    return rows;
  }, [termData, gradeFilter, statusFilter, searchQ]);

  const gradeBreakdown = useMemo(() => GRADES.map(grade => {
    const gl = termData.filter(l => l.grade === grade);
    const collected = gl.reduce((a,l)=>a+l.paidDisplay,0);
    const expected  = gl.reduce((a,l)=>a+l.fee+l.arrears,0);
    return { grade, total:gl.length, paid:gl.filter(l=>l.status==="paid").length, collected, expected, rate: expected>0?Math.round(collected/expected*100):0 };
  }), [termData]);

  const groupedByGrade = useMemo(() =>
    GRADES.map(grade => ({
      grade,
      learners: filtered.filter(l => l.grade === grade),
      stats: (() => {
        const gl = filtered.filter(l => l.grade === grade);
        const collected = gl.reduce((a,l)=>a+l.paidDisplay,0);
        const expected = gl.reduce((a,l)=>a+l.fee+l.arrears,0);
        return { total: gl.length, paid: gl.filter(l=>l.status==="paid").length, collected, expected, rate: expected>0?Math.round(collected/expected*100):0 };
      })()
    })).filter(g => g.learners.length > 0),
  [filtered]);

  const filteredLearners = useMemo(() => {
    let rows = enriched;
    if (gradeFilter !== "All Grades") rows = rows.filter(l => l.grade === gradeFilter);
    if (learnerSearch) rows = rows.filter(l => l.name?.toLowerCase().includes(learnerSearch.toLowerCase()) || l.parent?.toLowerCase().includes(learnerSearch.toLowerCase()));
    return rows;
  }, [enriched, gradeFilter, learnerSearch]);

  const groupedLearners = useMemo(() =>
    GRADES.map(grade => ({
      grade,
      learners: filteredLearners.filter(l => l.grade === grade)
    })).filter(g => g.learners.length > 0),
  [filteredLearners]);

  // ── FIREBASE ACTIONS ───────────────────────────────────────────────────
  const handleAddLearner = async () => {
    if (!newLearner.name || !newLearner.parent || !newLearner.phone) {
      showToast("Fill in name, parent, and phone.", "err"); return;
    }
    try {
      await addDoc(collection(db,"learners"), {
        ...newLearner,
        createdAt: serverTimestamp(),
        createdBy: user.email,
      });
      setShowAddLearner(false);
      setNewLearner({name:"",grade:"Baby Class",parent:"",phone:"",email:""});
      showToast(`${newLearner.name} added successfully!`);
      await audit("LEARNER_ADDED", { name: newLearner.name, grade: newLearner.grade });
    } catch { showToast("Failed to add learner.", "err"); }
  };

  const handleDeleteLearner = async (id) => {
    const target = learners.find(l=>l.id===id);
    try {
      await deleteDoc(doc(db,"learners",id));
      await audit("LEARNER_DELETED", { name: target?.name||id, grade: target?.grade||"" });
      setDelConfirm(null);
      showToast("Learner removed.");
    } catch { showToast("Could not delete.", "err"); }
  };

  const handleRecordPayment = async () => {
    if (!newPayment.learnerId || !newPayment.amount) {
      showToast("Select a learner and enter amount.", "err"); return;
    }
    const learner = learners.find(l => l.id === newPayment.learnerId);
    const paymentData = {
      learnerId:   newPayment.learnerId,
      learnerName: learner?.name || "",
      grade:       learner?.grade || "",
      term:        activeTerm,
      amount:      parseFloat(newPayment.amount),
      method:      newPayment.method,
      date:        newPayment.date,
      notes:       newPayment.notes,
      recordedBy:  user.email,
    };
    if (!isOnline) {
      const pending = JSON.parse(localStorage.getItem("jemareen_pending") || "[]");
      const entry = { ...paymentData, _offlineId: Date.now().toString(), createdAt: new Date().toISOString() };
      pending.push(entry);
      localStorage.setItem("jemareen_pending", JSON.stringify(pending));
      setPendingPayments(pending);
      setShowAddPayment(false);
      setNewPayment({learnerId:"",amount:"",method:"Mobile Money",date:new Date().toISOString().split("T")[0],notes:""});
      showToast("Saved offline — will sync when connected.");
      return;
    }
    try {
      await addDoc(collection(db,"payments"), { ...paymentData, createdAt: serverTimestamp() });
      await audit("PAYMENT_ADDED", { learnerName: paymentData.learnerName, amount: paymentData.amount, grade: paymentData.grade, method: paymentData.method });
      setShowAddPayment(false);
      setNewPayment({learnerId:"",amount:"",method:"Mobile Money",date:new Date().toISOString().split("T")[0],notes:""});
      showToast("Payment recorded!");
    } catch { showToast("Failed to save payment.", "err"); }
  };

  const handleSaveFees = async () => {
    try {
      const merged = { ...fees, ...editFeeVals };
      try {
        await updateDoc(doc(db,"settings","fees"), merged);
      } catch {
        await setDoc(doc(db,"settings","fees"), merged);
      }
      setFees(merged);
      setShowEditFees(false);
      setEditFeeVals({});
      showToast("Fee structure saved!");
      await audit("FEES_UPDATED", { fees: merged });
    } catch { showToast("Failed to save fees.", "err"); }
  };

  const handleEditLearner = async () => {
    if (!editLearnerVals.name || !editLearnerVals.phone) { showToast("Name and phone required.","err"); return; }
    try {
      await updateDoc(doc(db,"learners",editLearner.id), editLearnerVals);
      setEditLearner(null); setEditLearnerVals({});
      showToast("Learner updated!");
      await audit("LEARNER_EDITED", { name: editLearner.name, changes: editLearnerVals });
    } catch { showToast("Failed to update.","err"); }
  };

  const handleSendReminder = (learnerId) => {
    setRemindersSent(prev => [...prev, learnerId + activeTerm]);
    const l = learners.find(l=>l.id===learnerId);
    showToast(`Reminder logged for ${l?.parent}`);
  };

  const handleBulkRemind = () => {
    const targets = filtered.filter(l => l.status !== "paid" && !remindersSent.includes(l.id+activeTerm));
    targets.forEach(l => setRemindersSent(prev=>[...prev, l.id+activeTerm]));
    showToast(`${targets.length} reminders sent!`);
  };

  // ── AUDIT HELPER ────────────────────────────────────────────────────────
  const audit = async (action, details) => {
    try {
      await addDoc(collection(db,"auditLogs"), {
        action, details,
        performedBy: user?.email || "unknown",
        term: activeTerm,
        timestamp: serverTimestamp(),
      });
    } catch {}
  };

  // ── OFFLINE SYNC ────────────────────────────────────────────────────────
  const syncOfflinePayments = async () => {
    const pending = JSON.parse(localStorage.getItem("jemareen_pending") || "[]");
    if (!pending.length) return;
    setSyncingOffline(true);
    let synced = 0;
    for (const p of pending) {
      try {
        const { _offlineId, ...data } = p;
        await addDoc(collection(db,"payments"), { ...data, createdAt: serverTimestamp(), syncedFromOffline: true });
        await audit("PAYMENT_SYNCED_OFFLINE", { learnerName: p.learnerName, amount: p.amount, grade: p.grade });
        synced++;
      } catch {}
    }
    localStorage.removeItem("jemareen_pending");
    setPendingPayments([]);
    setSyncingOffline(false);
    if (synced) showToast(`${synced} offline payment${synced>1?"s":""} synced!`);
  };

  // ── DELETE PAYMENT ───────────────────────────────────────────────────────
  const handleDeletePayment = async (paymentId, paymentData) => {
    try {
      await deleteDoc(doc(db,"payments",paymentId));
      await audit("PAYMENT_DELETED", { learnerName: paymentData.learnerName, amount: paymentData.amount, term: paymentData.term });
      setDelPayConfirm(null);
      showToast("Payment removed.");
    } catch { showToast("Could not delete payment.","err"); }
  };



  const generateAIInsight = async () => {
    if (!geminiKey) { showToast("Add your Gemini API key first.", "err"); return; }
    setAiLoading(true); setAiInsight(null);
    try {
      const summary = {
        term: activeTerm, school: "Jemareen Academy",
        totalLearners: learners.length,
        collectionRate: stats.rate,
        paid: stats.paid, partial: stats.partial,
        unpaid: stats.unpaid, overdue: stats.overdue,
        outstanding: stats.outstanding,
        gradeBreakdown: gradeBreakdown.map(g=>({grade:g.grade,rate:g.rate,total:g.total})),
      };
      const prompt = `You are a school finance advisor for a Zambian primary school called Jemareen Academy. Analyze this payment data and give 3-4 short, actionable paragraphs. Be warm, practical, and direct. Plain text only.\n\nData: ${JSON.stringify(summary)}`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
          }),
        }
      );
      const data = await res.json();
      if (data.error) { setAiInsight(`Error: ${data.error.message}`); setAiLoading(false); return; }
      setAiInsight(data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.");
    } catch { setAiInsight("AI unavailable. Check your internet connection."); }
    setAiLoading(false);
  };

  const handleLogout = async () => { await signOut(auth); };

  const [sidebarOpen, setSidebarOpen] = useState(false);



  if (loading) return (
    <div style={{minHeight:"100vh",background:"#F7F3FA",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Outfit',sans-serif"}}>
      <style>{`@keyframes _ldspin{to{transform:rotate(360deg)}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{width:48,height:48,border:"4px solid rgba(123,45,139,.15)",borderTopColor:"#7B2D8B",borderRadius:"50%",animation:"_ldspin .8s linear infinite",margin:"0 auto 16px"}}/>
        <div style={{fontSize:15,color:"#94a3b8",fontWeight:600}}>Loading Jemareen Academy…</div>
      </div>
    </div>
  );

  const BOTTOM_NAV = [
    {id:"dashboard",icon:<IconHome      size={22}/>,label:"Home"},
    {id:"payments", icon:<IconPayments  size={22}/>,label:"Pay"},
    {id:"learners", icon:<IconLearners  size={22}/>,label:"Learners"},
    {id:"whatsapp", icon:<IconChat      size={22}/>,label:"WhatsApp"},
    {id:"more",     icon:<IconMenu      size={22}/>,label:"More"},
  ];

  return (
    <div style={{fontFamily:"'Outfit',sans-serif",minHeight:"100vh",background:"#FAF7FD",color:"#1e293b",paddingTop: (!isOnline || pendingPayments.length>0) ? 36 : 0}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}
        .nb{background:none;border:none;cursor:pointer;font-family:inherit;transition:all .18s;width:100%;text-align:left;}
        .btn{border:none;border-radius:12px;padding:12px 18px;font-family:inherit;font-weight:700;font-size:14px;cursor:pointer;transition:all .18s;}
        .btn:active{transform:scale(.97);}
        .card{background:#fff;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);}
        .inp{width:100%;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;font-family:inherit;font-size:16px;color:#1e293b;outline:none;transition:border-color .2s;-webkit-appearance:none;appearance:none;}
        .inp:focus{border-color:#7B2D8B;}
        select.inp option{background:#fff;}
        textarea.inp{resize:vertical;line-height:1.6;}
        .pill{border:none;border-radius:99px;padding:8px 16px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap;}
        .overlay{position:fixed;inset:0;background:rgba(15,23,42,.6);display:flex;align-items:flex-end;justify-content:center;z-index:200;backdrop-filter:blur(4px);}
        .modal{background:#fff;border-radius:24px 24px 0 0;padding:12px 20px 52px;width:100%;max-height:94vh;overflow-y:auto;}
        .modal-handle{width:44px;height:4px;background:#e2e8f0;border-radius:99px;margin:0 auto 18px;}
        .bar{background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;}
        .bf{height:100%;border-radius:99px;transition:width .7s cubic-bezier(.4,0,.2,1);}
        .tag{display:inline-flex;align-items:center;border-radius:99px;padding:4px 12px;font-size:12px;font-weight:700;}
        .toast-w{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:300;animation:toastUp .3s ease;white-space:nowrap;}
        @keyframes toastUp{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes drawerIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        .drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99;backdrop-filter:blur(2px);}
        .drawer{position:fixed;top:0;left:0;height:100vh;width:285px;background:#fff;z-index:100;display:flex;flex-direction:column;box-shadow:4px 0 32px rgba(0,0,0,.15);animation:drawerIn .25s ease;}
        .mobile-hdr{position:sticky;top:0;z-index:40;background:#fff;box-shadow:0 1px 12px rgba(61,20,69,.08);padding:13px 16px;display:flex;align-items:center;gap:12px;}
        .bottom-bar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1.5px solid #f1f5f9;display:flex;z-index:40;padding-bottom:env(safe-area-inset-bottom,0px);}
        .bottom-bar button{flex:1;border:none;background:none;font-family:inherit;cursor:pointer;padding:10px 2px 8px;display:flex;flex-direction:column;align-items:center;gap:3px;}
        .pg{padding:14px 14px 100px;}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .clist{display:flex;flex-direction:column;gap:10px;}
        .lcard{background:#fff;border-radius:16px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);}
        .srow{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #f8fafc;}
        input,select,textarea{font-size:16px!important;}
        @media(min-width:1024px){
          .mobile-hdr{display:none!important;}
          .bottom-bar{display:none!important;}
          .d-aside{display:flex!important;}
          .pg{margin-left:224px;padding:28px 32px 32px;}
          .g2{grid-template-columns:repeat(4,1fr);}
          .overlay{align-items:center;}
          .modal{border-radius:22px;max-width:460px;padding:32px;width:auto;}
          .modal-handle{display:none;}
          .toast-w{bottom:22px;left:auto;right:22px;transform:none;}
          @keyframes toastUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        }
        .d-aside{display:none;position:fixed;top:0;left:0;height:100vh;width:224px;background:linear-gradient(180deg,#22073A 0%,#3D1445 45%,#2d0e3d 100%);border-right:none;flex-direction:column;padding:0;z-index:50;overflow-y:auto;box-shadow:4px 0 28px rgba(0,0,0,.22);}
      `}</style>

      {/* OFFLINE / SYNC BANNER */}
      {(!isOnline || syncingOffline || pendingPayments.length>0) && (
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:999,background:syncingOffline?"#7B2D8B":isOnline&&pendingPayments.length>0?"#f59e0b":"#374151",color:"#fff",fontSize:12,fontWeight:600,textAlign:"center",padding:"8px 16px",letterSpacing:".03em"}}>
          {syncingOffline ? "⟳ Syncing offline payments…" : !isOnline ? `Offline mode — ${pendingPayments.length} payment${pendingPayments.length!==1?"s":""} queued` : `${pendingPayments.length} pending payment${pendingPayments.length!==1?"s":""} — tap to sync`}
          {isOnline && pendingPayments.length>0 && !syncingOffline && (
            <button onClick={syncOfflinePayments} style={{marginLeft:10,background:"rgba(255,255,255,.2)",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,padding:"3px 10px",cursor:"pointer"}}>Sync Now</button>
          )}
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="d-aside">
        <div style={{padding:"20px 16px 16px",borderBottom:"1px solid rgba(255,255,255,.07)",background:"rgba(0,0,0,.12)"}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:46,height:46,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"1.5px solid rgba(255,255,255,.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 0 20px rgba(212,168,32,.2)"}}>
              <img src={LOGO} alt="Logo" style={{width:34,height:34,filter:"drop-shadow(0 2px 6px rgba(0,0,0,.3))"}}/>
            </div>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:800,color:"#fff",lineHeight:1.25}}>Jemareen<br/>Academy</div>
              <div style={{fontSize:9,color:"#D4A820",marginTop:3,letterSpacing:".09em",textTransform:"uppercase",fontWeight:700}}>EduPay Finance</div>
            </div>
          </div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:10,fontStyle:"italic",lineHeight:1.5,letterSpacing:".01em"}}>"Bringing out the best in children"</div>
        </div>
        <div style={{padding:"10px 10px 6px"}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,.3)",letterSpacing:".1em",textTransform:"uppercase",padding:"0 10px",marginBottom:4}}>Term</div>
          {TERMS.map(t=>(
            <button key={t} className="nb" onClick={()=>setActiveTerm(t)} style={{padding:"7px 10px",borderRadius:8,fontSize:12,color:activeTerm===t?"#D4A820":"rgba(255,255,255,.5)",background:activeTerm===t?"rgba(212,168,32,.1)":"none",marginBottom:2,fontWeight:activeTerm===t?700:400}}>{t}</button>
          ))}
        </div>
        <div style={{height:1,background:"rgba(255,255,255,.06)",margin:"0 16px"}}/>
        <div style={{padding:"6px 10px",flex:1,overflowY:"auto"}}>
          {NAV.map(n=>(
            <button key={n.id} className="nb" onClick={()=>setActiveTab(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 10px",borderRadius:10,marginBottom:2,color:activeTab===n.id?"#D4A820":"rgba(255,255,255,.55)",background:activeTab===n.id?"rgba(212,168,32,.08)":"none",fontSize:13,fontWeight:activeTab===n.id?700:400,borderLeft:activeTab===n.id?"3px solid #D4A820":"3px solid transparent"}}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </div>
        <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:2}}>Signed in as</div>
          <div style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.6)",marginBottom:10,wordBreak:"break-all"}}>{user?.email}</div>
          <button className="btn" onClick={handleLogout} style={{background:"rgba(244,63,94,.15)",color:"#f87171",width:"100%",fontSize:12,padding:"9px",border:"1px solid rgba(244,63,94,.2)"}}>Sign Out</button>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {sidebarOpen && <>
        <div className="drawer-overlay" onClick={()=>setSidebarOpen(false)}/>
        <div className="drawer" style={{background:"#3D1445"}}>
          <div style={{padding:"18px 18px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <img src={LOGO} alt="Logo" style={{width:36,height:36}}/>
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:800,color:"#fff"}}>Jemareen Academy</div>
                <div style={{fontSize:10,color:"#D4A820",textTransform:"uppercase",letterSpacing:".06em",fontWeight:600}}>EduPay Finance</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:3,fontStyle:"italic"}}>"Bringing out the best in children"</div>
              </div>
            </div>
            <button onClick={()=>setSidebarOpen(false)} style={{border:"none",background:"rgba(255,255,255,.08)",borderRadius:8,cursor:"pointer",color:"#fff",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center"}}><IconX size={18}/></button>
          </div>
          <div style={{padding:"12px 10px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".08em",padding:"0 10px",marginBottom:6}}>Active Term</div>
            {TERMS.map(t=>(
              <button key={t} className="nb" onClick={()=>{setActiveTerm(t);setSidebarOpen(false);}} style={{padding:"11px 12px",borderRadius:10,fontSize:15,color:activeTerm===t?"#D4A820":"rgba(255,255,255,.55)",background:activeTerm===t?"rgba(212,168,32,.1)":"none",marginBottom:3,fontWeight:activeTerm===t?700:400}}>{t}</button>
            ))}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"8px 10px"}}>
            {NAV.map(n=>(
              <button key={n.id} className="nb" onClick={()=>{setActiveTab(n.id);setSidebarOpen(false);}} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 12px",borderRadius:12,marginBottom:3,color:activeTab===n.id?"#D4A820":"rgba(255,255,255,.6)",background:activeTab===n.id?"rgba(212,168,32,.08)":"none",fontSize:15,fontWeight:activeTab===n.id?700:400,borderLeft:activeTab===n.id?"3px solid #D4A820":"3px solid transparent"}}>
                <span style={{fontSize:20}}>{n.icon}</span>{n.label}
              </button>
            ))}
          </div>
          <div style={{padding:"16px 18px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:8,wordBreak:"break-all"}}>{user?.email}</div>
            <button className="btn" onClick={handleLogout} style={{background:"rgba(244,63,94,.15)",color:"#f87171",width:"100%",fontSize:14,border:"1px solid rgba(244,63,94,.2)"}}>Sign Out</button>
          </div>
        </div>
      </>}

      {/* MOBILE HEADER */}
      <div className="mobile-hdr">
        <button onClick={()=>setSidebarOpen(true)} style={{border:"none",background:"#EDE4F5",borderRadius:10,cursor:"pointer",color:"#7B2D8B",padding:"9px",display:"flex",alignItems:"center"}}><IconMenu size={20}/></button>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
          <img src={LOGO} alt="Logo" style={{width:30,height:30,flexShrink:0}}/>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:800,color:"#1e293b"}}>{NAV.find(n=>n.id===activeTab)?.label||"Dashboard"}</div>
            <div style={{fontSize:10,color:"#94a3b8"}}>{activeTerm}</div>
          </div>
        </div>
                {activeTab==="learners"  && <button className="btn" onClick={()=>setShowAddLearner(true)}  style={{background:"#7B2D8B",color:"#fff",padding:"9px 16px",fontSize:13}}>+ Add</button>}
        {activeTab==="payments"  && <button className="btn" onClick={()=>setShowAddPayment(true)}  style={{background:"#7B2D8B",color:"#fff",padding:"9px 16px",fontSize:13}}>+ Pay</button>}
        {activeTab==="reminders" && <button className="btn" onClick={handleBulkRemind}             style={{background:"#f59e0b",color:"#fff",padding:"9px 16px",fontSize:13,display:"flex",alignItems:"center",gap:6}}><IconBolt size={14}/>Send All</button>}
        {activeTab==="fees"      && <button className="btn" onClick={()=>{setEditFeeVals({});setShowEditFees(true);}} style={{background:"#7B2D8B",color:"#fff",padding:"9px 16px",fontSize:13}}>Edit</button>}
        {!["learners","payments","reminders","fees"].includes(activeTab) && (
          <button onClick={handleLogout} style={{border:"none",background:"#fee2e2",borderRadius:10,cursor:"pointer",color:"#ef4444",padding:"9px 13px",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        )}
      </div>

      {/* MAIN */}
      <main className="pg">

        {/* DASHBOARD */}
        {activeTab==="dashboard" && <>
          <div className="g2" style={{marginBottom:14}}>
            {[
              {label:"Expected",    val:fmt(stats.expected),    sub:`${activeTerm}`,  accent:"#7B2D8B"},
              {label:"Collected",   val:fmt(stats.collected),   sub:`${stats.rate}% collected`, accent:"#10b981"},
              {label:"Outstanding", val:fmt(stats.outstanding), sub:"remaining",      accent:"#f43f5e"},
              {label:"Arrears",     val:fmt(stats.arrears),     sub:"carried fwd",    accent:"#f59e0b"},
            ].map(k=>(
              <div key={k.label} className="card" style={{padding:"14px 14px 14px",borderTop:`3px solid ${k.accent}`,overflow:"hidden",position:"relative"}}>
                <div style={{position:"absolute",top:0,right:0,width:56,height:56,background:k.accent,opacity:.07,borderRadius:"0 0 0 56px",pointerEvents:"none"}}/>
                <div style={{fontSize:9,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".08em",marginBottom:7,fontWeight:600}}>{k.label}</div>
                <div style={{fontSize:18,fontWeight:800,color:k.accent,fontFamily:"'Playfair Display',serif",lineHeight:1.15}}>{k.val}</div>
                <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:20,marginBottom:14,overflow:"hidden",position:"relative"}}>
            <div style={{position:"absolute",top:0,right:0,width:120,height:80,background:"linear-gradient(135deg,rgba(123,45,139,.06),transparent)",pointerEvents:"none"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:"#1e293b"}}>Collection Progress</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{activeTerm}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,fontSize:26,color:"#7B2D8B",fontFamily:"'Playfair Display',serif",lineHeight:1}}>{stats.rate}%</div>
                <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>collected</div>
              </div>
            </div>
            <div style={{background:"#f1e8f7",borderRadius:99,height:10,overflow:"hidden",marginBottom:16}}>
              <div style={{height:"100%",borderRadius:99,background:"linear-gradient(90deg,#7B2D8B 0%,#B44AC0 50%,#10b981 100%)",width:`${stats.rate}%`,transition:"width .8s cubic-bezier(.4,0,.2,1)",boxShadow:"0 2px 8px rgba(123,45,139,.3)"}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {Object.entries(STATUS_CFG).map(([k,v])=>(
                <div key={k} style={{background:v.bg,borderRadius:12,padding:"10px 6px",textAlign:"center",borderTop:`2px solid ${v.color}22`}}>
                  <div style={{fontSize:20,fontWeight:800,color:v.color,lineHeight:1}}>{stats[k]||0}</div>
                  <div style={{fontSize:10,color:v.color,fontWeight:600,marginTop:3}}>{v.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{padding:18,marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:12,color:"#1e293b"}}>Quick Actions</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                            {[
                {label:"Add Learner",    action:()=>setShowAddLearner(true),  color:"#7B2D8B"},
                {label:"Record Payment", action:()=>setShowAddPayment(true),  color:"#10b981"},
                {label:"WhatsApp",      action:()=>setActiveTab("whatsapp"), color:"#25D366"},
                {label:"Annual Report", action:()=>setActiveTab("annual"),   color:"#f59e0b"},
              ].map(a=>(
                <button key={a.label} className="btn" onClick={a.action} style={{background:a.color+"18",color:a.color,border:`1.5px solid ${a.color}33`,textAlign:"left",fontSize:13,padding:"13px 14px",borderRadius:14,fontWeight:700}}>{a.label}</button>
              ))}
            </div>
          </div>
          <div className="card" style={{padding:18}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>By Grade</div>
            {gradeBreakdown.map(g=>(
              <div key={g.grade} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:13,fontWeight:500,color:"#475569"}}>{g.grade}</span>
                  <span style={{fontSize:12}}>{fmt(g.collected)} · <span style={{color:g.rate>=80?"#10b981":g.rate>=50?"#f59e0b":"#f43f5e",fontWeight:700}}>{g.rate}%</span></span>
                </div>
                <div className="bar"><div className="bf" style={{width:`${g.rate}%`,background:g.rate>=80?"#10b981":g.rate>=50?"#f59e0b":"#f43f5e"}}/></div>
              </div>
            ))}
            {learners.length===0 && <div style={{textAlign:"center",color:"#94a3b8",fontSize:14,padding:16}}>Add learners to get started.</div>}
          </div>
        </>}

        {/* PAYMENTS */}
        {activeTab==="payments" && <>
          <button className="btn" onClick={()=>setShowAddPayment(true)} style={{background:"#7B2D8B",color:"#fff",width:"100%",marginBottom:12,fontSize:15,padding:"14px"}}>Record New Payment</button>
          <input className="inp" style={{marginBottom:10}} placeholder="Search learner or parent…" value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:6,marginBottom:12}}>
            <select className="inp" style={{minWidth:148,flex:"0 0 auto",fontSize:"14px!important"}} value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)}>
              <option>All Grades</option>{GRADES.map(g=><option key={g}>{g}</option>)}
            </select>
            {["all","paid","partial","unpaid","overdue"].map(s=>(
              <button key={s} className="pill" onClick={()=>setStatusFilter(s)} style={{flex:"0 0 auto",background:statusFilter===s?(s==="all"?"#7B2D8B":STATUS_CFG[s]?.color||"#7B2D8B")+"22":"#F3EDF7",color:statusFilter===s?(s==="all"?"#7B2D8B":STATUS_CFG[s]?.color):"#64748b",border:`1px solid ${statusFilter===s?(s==="all"?"#7B2D8B":STATUS_CFG[s]?.color)+"44":"#e2e8f0"}`}}>
                {s==="all"?"All":STATUS_CFG[s]?.label}
              </button>
            ))}
          </div>
          {groupedByGrade.length===0 && <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>No records match.</div>}
          {groupedByGrade.map(({grade,learners:gLearners,stats:gs})=>(
            <div key={grade} style={{marginBottom:14}}>
              {/* Grade Header */}
              <button className="nb" onClick={()=>toggleGrade(grade)} style={{width:"100%",marginBottom:expandedGrades.has(grade)?8:0}}>
                <div style={{background:"linear-gradient(135deg,#22073A,#3D1445)",borderRadius:expandedGrades.has(grade)?"14px 14px 0 0":"14px",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{background:"rgba(255,255,255,.12)",borderRadius:8,padding:"4px 10px"}}>
                      <span style={{fontSize:13,fontWeight:800,color:"#D4A820"}}>{grade}</span>
                    </div>
                    <span style={{fontSize:12,color:"rgba(255,255,255,.55)"}}>{gLearners.length} learner{gLearners.length!==1?"s":""}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:700,color:gs.rate>=80?"#10b981":gs.rate>=50?"#f59e0b":"#f87171"}}>{gs.rate}%</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>collected</div>
                    </div>
                    <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <span style={{color:"rgba(255,255,255,.6)",fontSize:16,lineHeight:1,transition:"transform .2s",display:"block",transform:expandedGrades.has(grade)?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
                    </div>
                  </div>
                </div>
                {/* Grade mini progress bar */}
                <div style={{height:4,background:"rgba(34,7,58,.15)",borderRadius:expandedGrades.has(grade)?"0":"0 0 4px 4px",overflow:"hidden",display:expandedGrades.has(grade)?"block":"none"}}>
                  <div style={{height:"100%",background:gs.rate>=80?"#10b981":gs.rate>=50?"#f59e0b":"#f87171",width:`${gs.rate}%`,transition:"width .8s"}}/>
                </div>
              </button>
              {/* Learner cards */}
              {expandedGrades.has(grade) && (
                <div style={{border:"1px solid #e2e8f0",borderTop:"none",borderRadius:"0 0 14px 14px",overflow:"hidden",background:"#fff"}}>
                  {gLearners.map((l,i)=>{
                    const cfg=STATUS_CFG[l.status];
                    return (
                      <div key={l.id} style={{padding:"14px 16px",borderBottom:i<gLearners.length-1?"1px solid #f1f5f9":"none",cursor:"pointer",transition:"background .15s"}}
                        onClick={()=>setShowReceipt(l)}
                        onMouseEnter={e=>e.currentTarget.style.background="#FAF7FD"}
                        onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:40,height:40,borderRadius:"50%",background:avatarColor(l.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>{initials(l.name)}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:14,fontWeight:700,color:"#1e293b",marginBottom:2}}>{l.name}</div>
                            <div style={{fontSize:11,color:"#94a3b8"}}>{l.parent||"—"} {l.phone?`· ${l.phone}`:""}</div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <span className="tag" style={{background:cfg.bg,color:cfg.color,marginBottom:4,display:"block"}}>{cfg.label}</span>
                            <div style={{fontSize:12,color:"#94a3b8"}}>{fmt(l.paidDisplay)}<span style={{color:"#e2e8f0"}}>/</span><span style={{color:l.balance>0?"#f43f5e":"#94a3b8"}}>{fmt(l.fee)}</span></div>
                          </div>
                        </div>
                        {l.balance>0&&(
                          <div style={{marginTop:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <div style={{flex:1,height:4,background:"#f1f5f9",borderRadius:99,overflow:"hidden",marginRight:12}}>
                              <div style={{height:"100%",background:l.paidDisplay/l.fee>=.8?"#10b981":l.paidDisplay/l.fee>=.5?"#f59e0b":"#f87171",width:`${Math.min(100,(l.paidDisplay/(l.fee+l.arrears||1))*100)}%`,borderRadius:99,transition:"width .5s"}}/>
                            </div>
                            <button className="btn" onClick={e=>{e.stopPropagation();handleSendReminder(l.id);}} style={{padding:"5px 12px",fontSize:11,background:remindersSent.includes(l.id+activeTerm)?"#d1fae5":"#fef3c7",color:remindersSent.includes(l.id+activeTerm)?"#065f46":"#92400e",borderRadius:8}}>
                              {remindersSent.includes(l.id+activeTerm)?"✓ Sent":"Remind"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Grade summary footer */}
                  <div style={{background:"#FAFBFC",borderTop:"1px solid #f1f5f9",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,color:"#94a3b8",fontWeight:500}}>Collected: <strong style={{color:"#10b981"}}>{fmt(gs.collected)}</strong></span>
                    <span style={{fontSize:11,color:"#94a3b8",fontWeight:500}}>Outstanding: <strong style={{color:"#f43f5e"}}>{fmt(gs.expected-gs.collected)}</strong></span>
                    <span style={{fontSize:11,color:"#94a3b8",fontWeight:500}}>Paid: <strong style={{color:"#7B2D8B"}}>{gs.paid}/{gs.total}</strong></span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>}

        {/* LEARNERS */}
        {activeTab==="learners" && <>
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <input className="inp" placeholder="Search learners…" value={learnerSearch} onChange={e=>setLearnerSearch(e.target.value)} style={{flex:1}}/>
            <button className="btn" onClick={()=>setShowAddLearner(true)} style={{background:"#7B2D8B",color:"#fff",flexShrink:0,fontSize:14,padding:"12px 18px"}}>+ Add</button>
          </div>
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:6,marginBottom:12}}>
            <button className="pill" onClick={()=>setGradeFilter("All Grades")} style={{flex:"0 0 auto",background:gradeFilter==="All Grades"?"#7B2D8B22":"#F3EDF7",color:gradeFilter==="All Grades"?"#7B2D8B":"#64748b",border:`1px solid ${gradeFilter==="All Grades"?"#7B2D8B44":"#e2e8f0"}`}}>All</button>
            {GRADES.map(g=>(
              <button key={g} className="pill" onClick={()=>setGradeFilter(g==="All Grades"?"All Grades":g)} style={{flex:"0 0 auto",background:gradeFilter===g?"#7B2D8B22":"#F3EDF7",color:gradeFilter===g?"#7B2D8B":"#64748b",border:`1px solid ${gradeFilter===g?"#7B2D8B44":"#e2e8f0"}`,whiteSpace:"nowrap"}}>{g}</button>
            ))}
          </div>
          {groupedLearners.length===0&&<div className="card" style={{padding:48,textAlign:"center",color:"#94a3b8"}}><div style={{color:"#D4A820",display:"flex",justifyContent:"center",marginBottom:12}}><IconSchool size={44}/></div><div style={{fontWeight:600,marginBottom:10}}>No learners found</div><button className="btn" onClick={()=>setShowAddLearner(true)} style={{background:"#7B2D8B",color:"#fff"}}>Add First Learner</button></div>}
          {groupedLearners.map(({grade,learners:gLearners})=>(
            <div key={grade} style={{marginBottom:16}}>
              <button className="nb" onClick={()=>toggleGrade(grade+"_l")} style={{width:"100%",marginBottom:expandedGrades.has(grade+"_l")||!expandedGrades.has(grade+"_l")?8:0}}>
                <div style={{background:"linear-gradient(135deg,#22073A,#3D1445)",borderRadius:expandedGrades.has(grade+"_l")?"14px 14px 0 0":"14px",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:13,fontWeight:800,color:"#D4A820"}}>{grade}</span>
                    <span style={{fontSize:12,color:"rgba(255,255,255,.5)",background:"rgba(255,255,255,.08)",borderRadius:99,padding:"2px 8px"}}>{gLearners.length}</span>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {[["paid","#10b981"],["partial","#f59e0b"],["unpaid","#60a5fa"],["overdue","#f43f5e"]].map(([s,c])=>{
                      const cnt=gLearners.filter(l=>l.status===s).length;
                      return cnt>0?<span key={s} style={{fontSize:11,color:c,background:c+"22",borderRadius:99,padding:"2px 7px",fontWeight:700}}>{cnt}</span>:null;
                    })}
                    <span style={{color:"rgba(255,255,255,.5)",fontSize:14}}>▾</span>
                  </div>
                </div>
              </button>
              {(expandedGrades.has(grade+"_l")||!expandedGrades.has(grade+"_l")?true:false) && (
                <div style={{border:"1px solid #e2e8f0",borderTop:"none",borderRadius:"0 0 14px 14px",overflow:"hidden",background:"#fff"}}>
                  {gLearners.map((l,i)=>{
                    const cfg=STATUS_CFG[l.status];
                    return (
                      <div key={l.id} style={{padding:"14px 16px",borderBottom:i<gLearners.length-1?"1px solid #f1f5f9":"none"}}>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                          <div style={{width:42,height:42,borderRadius:"50%",background:avatarColor(l.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>{initials(l.name)}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:15,fontWeight:700,color:"#1e293b"}}>{l.name}</div>
                            <div style={{fontSize:12,color:"#94a3b8"}}>{l.parent||"No parent recorded"}{l.phone?` · ${l.phone}`:""}</div>
                          </div>
                          <span className="tag" style={{background:cfg.bg,color:cfg.color,flexShrink:0}}>{cfg.label}</span>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                          {[["Fee",fmt(l.fee),"#475569"],["Paid",fmt(l.paidDisplay),"#10b981"],["Balance",fmt(l.balance),l.balance>0?"#f43f5e":"#94a3b8"]].map(([lab,val,col])=>(
                            <div key={lab} style={{textAlign:"center",background:"#F8FAFC",borderRadius:10,padding:"8px 4px"}}>
                              <div style={{fontSize:13,fontWeight:700,color:col}}>{val}</div>
                              <div style={{fontSize:10,color:"#94a3b8"}}>{lab}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                          <button className="btn" onClick={()=>{setEditLearner(l);setEditLearnerVals({name:l.name,grade:l.grade,parent:l.parent||"",phone:l.phone||"",email:l.email||""});}} style={{flex:1,background:"#EDE4F5",color:"#7B2D8B",fontSize:12,padding:"9px"}}>Edit</button>
                          <button className="btn" onClick={()=>{setShowHistory(l);setActiveTab("history");}} style={{flex:1,background:"#e0f2fe",color:"#0369a1",fontSize:12,padding:"9px"}}>History</button>
                          <button className="btn" onClick={()=>setShowReceipt(l)} style={{flex:1,background:"#f0fdf4",color:"#10b981",fontSize:12,padding:"9px"}}>Receipt</button>
                          <button className="btn" onClick={()=>setDelConfirm(l)} style={{flex:1,background:"#fee2e2",color:"#ef4444",fontSize:12,padding:"9px"}}>Remove</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </>}

        {/* REMINDERS */}
        {activeTab==="reminders" && <>
          <button className="btn" onClick={handleBulkRemind} style={{background:"#f59e0b",color:"#fff",width:"100%",marginBottom:12,fontSize:15,padding:"15px",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><IconBolt size={16}/>Send All Reminders</button>
          <select className="inp" style={{marginBottom:14}} value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)}>
            <option>All Grades</option>{GRADES.map(g=><option key={g}>{g}</option>)}
          </select>
          <div className="clist">
            {filtered.filter(l=>l.status!=="paid").map(l=>{
              const cfg=STATUS_CFG[l.status];
              const sent=remindersSent.includes(l.id+activeTerm);
              return (
                <div key={l.id} className="lcard">
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                    <div style={{width:42,height:42,borderRadius:"50%",background:avatarColor(l.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>{initials(l.name)}</div>
                    <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700}}>{l.name}</div><div style={{fontSize:12,color:"#94a3b8"}}>{l.grade} · {l.parent} · {l.phone}</div></div>
                    <span className="tag" style={{background:cfg.bg,color:cfg.color}}>{cfg.label}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><div style={{fontSize:20,fontWeight:800,color:"#f43f5e"}}>{fmt(l.balance)}</div><div style={{fontSize:11,color:"#94a3b8"}}>outstanding</div></div>
                    <button className="btn" onClick={()=>handleSendReminder(l.id)} style={{background:sent?"#d1fae5":"#fef3c7",color:sent?"#065f46":"#92400e",border:`1px solid ${sent?"#6ee7b744":"#fde68a"}`,fontSize:13,padding:"11px 20px"}}>{sent?"✓ Sent":"Send Reminder"}</button>
                  </div>
                </div>
              );
            })}
            {filtered.filter(l=>l.status!=="paid").length===0&&<div className="card" style={{padding:40,textAlign:"center",fontSize:14}}><div style={{color:"#10b981",display:"flex",justifyContent:"center",marginBottom:10}}><IconCheck size={36}/></div><div style={{fontWeight:600,color:"#1e293b",marginBottom:4}}>All caught up!</div><div style={{color:"#94a3b8"}}>All learners are paid up for this term.</div></div>}
          </div>
        </>}

        {/* ANALYTICS */}
        {activeTab==="analytics" && <>
          <div className="g2" style={{marginBottom:14}}>
            {[{label:"Fully Paid",val:stats.paid,color:"#10b981"},{label:"Partial",val:stats.partial,color:"#f59e0b"},{label:"Unpaid",val:stats.unpaid,color:"#60a5fa"},{label:"Overdue",val:stats.overdue,color:"#f43f5e"}].map(s=>(
              <div key={s.label} className="card" style={{padding:18,textAlign:"center"}}>
                <div style={{fontSize:28,fontWeight:800,color:s.color,fontFamily:"'Playfair Display',serif"}}>{s.val}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:18,marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>Collection by Grade</div>
            {gradeBreakdown.map(g=>(
              <div key={g.grade} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:13,color:"#64748b"}}>{g.grade}</span><span style={{fontSize:13,fontWeight:700,color:g.rate>=80?"#10b981":g.rate>=50?"#f59e0b":"#f43f5e"}}>{g.rate}%</span></div>
                <div className="bar"><div className="bf" style={{width:`${g.rate}%`,background:g.rate>=80?"#10b981":g.rate>=50?"#f59e0b":"#f43f5e"}}/></div>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>AI Insights</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Powered by Google Gemini (free)</div>
              </div>
              {geminiKey && <button className="btn" onClick={generateAIInsight} disabled={aiLoading} style={{background:"#7B2D8B",color:"#fff",fontSize:13,padding:"10px 16px",opacity:aiLoading?.6:1}}>{aiLoading?"Analysing…":"Generate"}</button>}
            </div>
            {!geminiKey && (
              <div style={{background:"#FBF9FF",border:"1px solid #e9d5f7",borderRadius:14,padding:16}}>
                <div style={{fontSize:13,fontWeight:700,color:"#1e293b",marginBottom:6}}>Set up free AI (takes 1 minute)</div>
                <ol style={{fontSize:12,color:"#64748b",paddingLeft:18,lineHeight:2,marginBottom:14}}>
                  <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{color:"#7B2D8B",fontWeight:700}}>aistudio.google.com/app/apikey</a></li>
                  <li>Sign in with any Google account</li>
                  <li>Click <strong>"Create API key"</strong> — it's free</li>
                  <li>Paste it below and save</li>
                </ol>
                <div style={{display:"flex",gap:8}}>
                  <input className="inp" type="password" placeholder="Paste Gemini API key here…" value={geminiKeyInput} onChange={e=>setGeminiKeyInput(e.target.value)} style={{flex:1,fontSize:13,padding:"11px 14px"}}/>
                  <button className="btn" onClick={()=>{ if(geminiKeyInput.trim()){localStorage.setItem("jemareen_gemini_key",geminiKeyInput.trim());setGeminiKey(geminiKeyInput.trim());setGeminiKeyInput("");showToast("Gemini AI connected!");} }} style={{background:"#7B2D8B",color:"#fff",padding:"11px 18px",whiteSpace:"nowrap"}}>Save Key</button>
                </div>
              </div>
            )}
            {geminiKey && !aiInsight && !aiLoading && (
              <div style={{textAlign:"center",padding:"14px 0",color:"#94a3b8",fontSize:13}}>
                Tap Generate for AI recommendations.
                <div style={{marginTop:8}}><button onClick={()=>{localStorage.removeItem("jemareen_gemini_key");setGeminiKey("");}} style={{background:"none",border:"none",color:"#cbd5e1",fontSize:11,cursor:"pointer",textDecoration:"underline"}}>Remove key</button></div>
              </div>
            )}
            {aiLoading&&<div style={{color:"#94a3b8",fontSize:13,padding:"10px 0",display:"flex",alignItems:"center",gap:8}}><div style={{width:14,height:14,border:"2px solid rgba(123,45,139,.2)",borderTopColor:"#7B2D8B",borderRadius:"50%",animation:"_ldspin .7s linear infinite",flexShrink:0}}/>Analysing your data…</div>}
            {aiInsight&&!aiLoading&&<div style={{background:"#FBF7FD",border:"1px solid #e0e7ff",borderRadius:12,padding:16,fontSize:14,lineHeight:1.8,color:"#374151",whiteSpace:"pre-wrap"}}>{aiInsight}</div>}
          </div>
        </>}

        {/* FEES */}
        {activeTab==="fees" && <>
          <button className="btn" onClick={()=>{setEditFeeVals({});setShowEditFees(true);}} style={{background:"#7B2D8B",color:"#fff",width:"100%",marginBottom:14,fontSize:15,padding:"15px"}}>Edit Fee Structure</button>
          <div className="clist">
            {GRADES.map(g=>(
              <div key={g} className="lcard">
                <div style={{fontWeight:700,fontSize:16,marginBottom:10}}>{g}</div>
                {TERMS.map(t=>(
                  <div key={t} className="srow">
                    <span style={{fontSize:14,color:"#64748b"}}>{t}</span>
                    <span style={{fontSize:16,fontWeight:800,color:"#7B2D8B"}}>{fmt(fees[g]||0)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>}

        {/* PAYMENT HISTORY (per-learner modal trigger from learner card) */}
        {activeTab==="history" && showHistory && (() => {
          const l = enriched.find(x=>x.id===showHistory.id) || showHistory;
          const allPayments = payments.filter(p=>p.learnerId===l.id).sort((a,b)=>(b.date||"")>(a.date||"")?1:-1);
          const totalEver = allPayments.reduce((a,p)=>a+(p.amount||0),0);
          return (
            <>
              <button className="btn" onClick={()=>{setShowHistory(null);setActiveTab("learners");}} style={{background:"#F3EDF7",color:"#7B2D8B",marginBottom:14,fontSize:13,padding:"10px 18px"}}>← Back to Learners</button>
              <div className="card" style={{padding:18,marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                  <div style={{width:48,height:48,borderRadius:"50%",background:avatarColor(l.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff"}}>{initials(l.name)}</div>
                  <div>
                    <div style={{fontSize:17,fontWeight:800,color:"#1e293b"}}>{l.name}</div>
                    <div style={{fontSize:12,color:"#94a3b8"}}>{l.grade} · {l.parent||"No parent"} · {l.phone||"No phone"}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[["Total Received",fmt(totalEver),"#7B2D8B"],["Payments",allPayments.length+" records","#10b981"]].map(([lab,val,col])=>(
                    <div key={lab} style={{background:"#F8FAFC",borderRadius:10,padding:"12px",textAlign:"center"}}>
                      <div style={{fontSize:16,fontWeight:800,color:col}}>{val}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{lab}</div>
                    </div>
                  ))}
                </div>
              </div>
              {TERMS.map(term=>{
                const termPays = allPayments.filter(p=>p.term===term);
                if (!termPays.length) return null;
                const termTotal = termPays.reduce((a,p)=>a+(p.amount||0),0);
                const termFee = fees[l.grade]||0;
                return (
                  <div key={term} className="card" style={{marginBottom:12,overflow:"hidden"}}>
                    <div style={{background:"linear-gradient(135deg,#22073A,#3D1445)",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:13,fontWeight:700,color:"#D4A820"}}>{term}</span>
                      <span style={{fontSize:12,color:"rgba(255,255,255,.7)"}}>{fmt(termTotal)} / {fmt(termFee)}</span>
                    </div>
                    {termPays.map((p,i)=>(
                      <div key={p.id||i} style={{padding:"12px 16px",borderBottom:i<termPays.length-1?"1px solid #f1f5f9":"none",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:"#1e293b"}}>{fmt(p.amount)}</div>
                          <div style={{fontSize:11,color:"#94a3b8"}}>{p.date||"—"} · {p.method||"Cash"}{p.notes?` · ${p.notes}`:""}</div>
                          {p.syncedFromOffline&&<span style={{fontSize:10,background:"#ede4f5",color:"#7B2D8B",borderRadius:99,padding:"1px 7px",fontWeight:600}}>Offline sync</span>}
                        </div>
                        <button className="btn" onClick={()=>setDelPayConfirm(p)} style={{background:"#fee2e2",color:"#ef4444",fontSize:11,padding:"6px 12px"}}>Delete</button>}
                      </div>
                    ))}
                  </div>
                );
              })}
              {allPayments.length===0&&<div className="card" style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:14}}>No payment records found.</div>}
            </>
          );
        })()}

        {/* AUDIT LOG */}
        {activeTab==="audit" && <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:"#1e293b"}}>Audit Log</div>
              <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>Last {auditLogs.length} actions</div>
            </div>
          </div>
          {auditLogs.length===0&&<div className="card" style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:14}}>No audit events yet.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {auditLogs.map(log=>{
              const ts = log.timestamp?.toDate?.();
              const timeStr = ts ? ts.toLocaleString("en-ZM",{dateStyle:"short",timeStyle:"short"}) : "—";
              const cfg = {
                PAYMENT_ADDED:         {label:"Payment Added",      color:"#10b981", bg:"#f0fdf4"},
                PAYMENT_DELETED:       {label:"Payment Deleted",     color:"#f43f5e", bg:"#fff5f5"},
                PAYMENT_SYNCED_OFFLINE:{label:"Offline Synced",      color:"#7B2D8B", bg:"#faf5ff"},
                LEARNER_ADDED:         {label:"Learner Added",       color:"#3b82f6", bg:"#eff6ff"},
                LEARNER_DELETED:       {label:"Learner Removed",     color:"#f43f5e", bg:"#fff5f5"},
                LEARNER_EDITED:        {label:"Learner Updated",     color:"#f59e0b", bg:"#fffbeb"},
                FEES_UPDATED:          {label:"Fees Updated",        color:"#06b6d4", bg:"#ecfeff"},
              }[log.action] || {label:log.action, color:"#94a3b8", bg:"#f8fafc"};
              return (
                <div key={log.id} style={{background:cfg.bg,border:`1px solid ${cfg.color}22`,borderRadius:14,padding:"12px 16px",borderLeft:`4px solid ${cfg.color}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:700,color:cfg.color,background:cfg.color+"18",borderRadius:99,padding:"2px 10px"}}>{cfg.label}</span>
                    <span style={{fontSize:11,color:"#94a3b8"}}>{timeStr}</span>
                  </div>
                  <div style={{fontSize:13,color:"#1e293b",fontWeight:500,marginBottom:2}}>
                    {log.details?.learnerName||log.details?.name||""}
                    {log.details?.amount ? ` — ${fmt(log.details.amount)}` : ""}
                    {log.details?.grade ? ` (${log.details.grade})` : ""}
                  </div>
                  <div style={{fontSize:11,color:"#94a3b8"}}>By {log.performedBy||"—"} · {log.term||""}</div>
                </div>
              );
            })}
          </div>
        </>}

        {activeTab==="finance"   && <Finance user={user}/>}
        {activeTab==="whatsapp"  && <WhatsApp learners={enriched} feeStructure={fees} activeTerm={activeTerm} user={user}/>}
        {activeTab==="annual"    && <AnnualSummary payments={payments} salaryPayments={[]} expenses={[]} staff={learners} feeStructure={fees}/>}
        {activeTab==="pettycash" && <PettyCash user={user}/>}

      </main>

      {/* BOTTOM NAV */}
      <nav className="bottom-bar">
        {BOTTOM_NAV.map(n=>{
          const isActive=n.id==="more"?!["dashboard","payments","learners","whatsapp"].includes(activeTab):activeTab===n.id;
          return (
            <button key={n.id} onClick={()=>n.id==="more"?setSidebarOpen(true):setActiveTab(n.id)}>
              <span style={{color:isActive?"#7B2D8B":"#94a3b8"}}>{n.icon}</span>
              <span style={{fontSize:10,fontWeight:isActive?800:500,color:isActive?"#7B2D8B":"#94a3b8"}}>{n.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── ADD LEARNER MODAL ──────────────────────────── */}
      {showAddLearner && (
        <div className="overlay" onClick={()=>setShowAddLearner(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:800,marginBottom:6}}>Add Learner</div>
            <p style={{fontSize:13,color:"#94a3b8",marginBottom:22}}>Register a new learner at Jemareen Academy.</p>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[
                {label:"Full Name *",    key:"name",   type:"text",   ph:"e.g. Amara Nkosi"},
                {label:"Parent/Guardian *", key:"parent",type:"text", ph:"e.g. Grace Nkosi"},
                {label:"Phone Number *", key:"phone",  type:"tel",    ph:"e.g. +260 97 123 4567"},
                {label:"Email (optional)",key:"email", type:"email",  ph:"e.g. grace@email.com"},
              ].map(f=>(
                <div key={f.key}>
                  <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>{f.label}</label>
                  <input className="inp" type={f.type} placeholder={f.ph} value={newLearner[f.key]} onChange={e=>setNewLearner(p=>({...p,[f.key]:e.target.value}))} />
                </div>
              ))}
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Grade *</label>
                <select className="inp" value={newLearner.grade} onChange={e=>setNewLearner(p=>({...p,grade:e.target.value}))}>
                  {GRADES.map(g=><option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:24}}>
              <button className="btn" onClick={()=>setShowAddLearner(false)} style={{background:"#F3EDF7",color:"#64748b",flex:1}}>Cancel</button>
              <button className="btn" onClick={handleAddLearner} style={{background:"#7B2D8B",color:"#fff",flex:2}}>Add Learner</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD PAYMENT MODAL ─────────────────────────── */}
      {showAddPayment && (
        <div className="overlay" onClick={()=>setShowAddPayment(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:800,marginBottom:6}}>Record Payment</div>
            <p style={{fontSize:13,color:"#94a3b8",marginBottom:22}}>Log a fee payment for {activeTerm}.</p>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Grade Filter</label>
                <select className="inp" value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)}>
                  <option>All Grades</option>{GRADES.map(g=><option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Learner *</label>
                <select className="inp" value={newPayment.learnerId} onChange={e=>setNewPayment(p=>({...p,learnerId:e.target.value}))}>
                  <option value="">Select learner…</option>
                  {enriched.filter(l=>gradeFilter==="All Grades"||l.grade===gradeFilter).map(l=>(
                    <option key={l.id} value={l.id}>{l.name} — {l.grade} (Bal: {fmt(l.balance)})</option>
                  ))}
                </select>
              </div>
              {newPayment.learnerId && (()=>{
                const l=enriched.find(x=>x.id===newPayment.learnerId);
                return l?(
                  <div style={{background:"#FFFFFF",border:"1px solid #e2e8f0",borderRadius:10,padding:12,fontSize:12,color:"#64748b"}}>
                    Fee: <strong style={{color:"#1e293b"}}>{fmt(l.fee)}</strong> · Paid: <strong style={{color:"#10b981"}}>{fmt(l.paidDisplay)}</strong> · Balance: <strong style={{color:"#f43f5e"}}>{fmt(l.balance)}</strong>{l.arrears>0?` · Arrears: ${fmt(l.arrears)}`:""}
                  </div>
                ):null;
              })()}
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Amount (ZMW) *</label>
                <input className="inp" type="number" placeholder="e.g. 2200" value={newPayment.amount} onChange={e=>setNewPayment(p=>({...p,amount:e.target.value}))} />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Method</label>
                <select className="inp" value={newPayment.method} onChange={e=>setNewPayment(p=>({...p,method:e.target.value}))}>
                  {METHODS.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Date</label>
                <input className="inp" type="date" value={newPayment.date} onChange={e=>setNewPayment(p=>({...p,date:e.target.value}))} />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Notes (optional)</label>
                <input className="inp" placeholder="e.g. Receipt #0045" value={newPayment.notes} onChange={e=>setNewPayment(p=>({...p,notes:e.target.value}))} />
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:24}}>
              <button className="btn" onClick={()=>setShowAddPayment(false)} style={{background:"#F3EDF7",color:"#64748b",flex:1}}>Cancel</button>
              <button className="btn" onClick={handleRecordPayment} style={{background:"#7B2D8B",color:"#fff",flex:2}}>Confirm Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECEIPT MODAL ─────────────────────────────── */}
      {showReceipt && (()=>{
        const l=showReceipt;
        const cfg=STATUS_CFG[l.status];
        return (
          <div className="overlay" onClick={()=>setShowReceipt(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:400}}>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:800}}>Jemareen Academy</div>
                <div style={{fontSize:10,color:"#94a3b8",letterSpacing:".08em",textTransform:"uppercase",marginTop:2}}>Payment Receipt · {activeTerm}</div>
              </div>
              <div style={{background:"#FFFFFF",border:"1px solid #e2e8f0",borderRadius:14,padding:18,marginBottom:18}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                  <div style={{width:42,height:42,borderRadius:"50%",background:avatarColor(l.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff"}}>{initials(l.name)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:15}}>{l.name}</div>
                    <div style={{fontSize:12,color:"#94a3b8"}}>{l.grade}</div>
                  </div>
                  <span className="tag" style={{background:cfg.bg,color:cfg.color}}>{cfg.label}</span>
                </div>
                {[
                  ["Term Fee",      fmt(l.fee)],
                  ["Arrears",       l.arrears>0?fmt(l.arrears):"None"],
                  ["Total Owed",    fmt(l.fee+l.arrears)],
                  ["Amount Paid",   fmt(l.paidDisplay)],
                  ...(l.totalPaid>l.fee+l.arrears?[["Total Received", fmt(l.totalPaid)]]:[] ),
                  ["Balance Due",   fmt(l.balance)],
                  ["Last Payment", l.lastPayment?.date||"—"],
                  ["Method",       l.lastPayment?.method||"—"],
                  ["Parent",       l.parent],
                  ["Phone",        l.phone],
                ].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #e9ecf3"}}>
                    <span style={{fontSize:12,color:"#94a3b8"}}>{k}</span>
                    <span style={{fontSize:12,fontWeight:600,color:"#1e293b"}}>{v}</span>
                  </div>
                ))}
              </div>
              {l.termPayments && l.termPayments.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Payment History</div>
                  {l.termPayments.map((p,i)=>(
                    <div key={p.id||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:i%2===0?"#F8FAFC":"#fff",borderRadius:8,marginBottom:4}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{fmt(p.amount)}</div>
                        <div style={{fontSize:11,color:"#94a3b8"}}>{p.date||"—"} · {p.method||"—"}</div>
                      </div>
                      {p.notes&&<div style={{fontSize:11,color:"#94a3b8",maxWidth:"50%",textAlign:"right",wordBreak:"break-word"}}>{p.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",gap:8}}>
                <button className="btn" onClick={()=>{setShowReceipt(null);setShowAddPayment(true);setNewPayment(p=>({...p,learnerId:l.id}));}} style={{flex:1,background:"#EDE4F5",color:"#7B2D8B",fontSize:13}}>+ Pay</button>
                <button className="btn" onClick={()=>setShowReceipt(null)} style={{flex:2,background:"#7B2D8B",color:"#fff"}}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── EDIT FEES MODAL ───────────────────────────── */}
      {showEditFees && (
        <div className="overlay" onClick={()=>setShowEditFees(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{width:500}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:800,marginBottom:6}}>Edit Fee Structure</div>
            <p style={{fontSize:13,color:"#94a3b8",marginBottom:22}}>Changes apply to all terms equally. Fees are in ZMW.</p>
            <div style={{maxHeight:360,overflowY:"auto"}}>
              {GRADES.map(g=>(
                <div key={g} style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
                  <span style={{width:110,fontSize:13,fontWeight:600,color:"#475569",flexShrink:0}}>{g}</span>
                  <input className="inp" type="number" defaultValue={fees[g]||""} placeholder="0"
                    onChange={e=>setEditFeeVals(prev=>({...prev,[g]:parseFloat(e.target.value)||0}))} />
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10,marginTop:22}}>
              <button className="btn" onClick={()=>setShowEditFees(false)} style={{background:"#F3EDF7",color:"#64748b",flex:1}}>Cancel</button>
              <button className="btn" onClick={handleSaveFees} style={{background:"#7B2D8B",color:"#fff",flex:2}}>Save to Firebase</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT LEARNER MODAL ─────────────────────────────── */}
      {editLearner && (
        <div className="overlay" onClick={()=>setEditLearner(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:800,marginBottom:4}}>Edit Learner</div>
            <p style={{fontSize:12,color:"#94a3b8",marginBottom:20}}>Update details for {editLearner.name}</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[{label:"Full Name *",key:"name",type:"text"},{label:"Parent/Guardian",key:"parent",type:"text"},{label:"Phone",key:"phone",type:"tel"},{label:"Email",key:"email",type:"email"}].map(f=>(
                <div key={f.key}>
                  <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>{f.label}</label>
                  <input className="inp" type={f.type} value={editLearnerVals[f.key]||""} onChange={e=>setEditLearnerVals(p=>({...p,[f.key]:e.target.value}))}/>
                </div>
              ))}
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>Grade</label>
                <select className="inp" value={editLearnerVals.grade||""} onChange={e=>setEditLearnerVals(p=>({...p,grade:e.target.value}))}>
                  {GRADES.map(g=><option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button className="btn" onClick={()=>setEditLearner(null)} style={{background:"#F3EDF7",color:"#64748b",flex:1}}>Cancel</button>
              <button className="btn" onClick={handleEditLearner} style={{background:"#7B2D8B",color:"#fff",flex:2}}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE PAYMENT CONFIRM ──────────────────────────── */}
      {delPayConfirm && (
        <div className="overlay" onClick={()=>setDelPayConfirm(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:360,textAlign:"center"}}>
            <div className="modal-handle"/>
            <div style={{color:"#ef4444",display:"flex",justifyContent:"center",marginBottom:14}}><IconWarning size={40}/></div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:800,marginBottom:8}}>Delete Payment?</div>
            <p style={{fontSize:13,color:"#64748b",marginBottom:8}}>
              This will permanently remove the <strong>{fmt(delPayConfirm.amount)}</strong> payment recorded on <strong>{delPayConfirm.date}</strong>.
            </p>
            <p style={{fontSize:12,color:"#94a3b8",marginBottom:22}}>This action cannot be undone and will affect the learner's balance.</p>
            <div style={{display:"flex",gap:10}}>
              <button className="btn" onClick={()=>setDelPayConfirm(null)} style={{background:"#F3EDF7",color:"#64748b",flex:1}}>Cancel</button>
              <button className="btn" onClick={()=>handleDeletePayment(delPayConfirm.id, delPayConfirm)} style={{background:"#ef4444",color:"#fff",flex:1}}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ────────────────────────────── */}
      {delConfirm && (
        <div className="overlay" onClick={()=>setDelConfirm(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:360,textAlign:"center"}}>
            <div style={{color:"#ef4444",display:"flex",justifyContent:"center",marginBottom:14}}><IconWarning size={48}/></div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:800,marginBottom:8}}>Remove Learner?</div>
            <p style={{fontSize:13,color:"#64748b",marginBottom:24}}>This will permanently remove <strong>{delConfirm.name}</strong> and all their records from Jemareen Academy. This cannot be undone.</p>
            <div style={{display:"flex",gap:10}}>
              <button className="btn" onClick={()=>setDelConfirm(null)} style={{background:"#F3EDF7",color:"#64748b",flex:1}}>Cancel</button>
              <button className="btn" onClick={()=>handleDeleteLearner(delConfirm.id)} style={{background:"#ef4444",color:"#fff",flex:1}}>Yes, Remove</button>
            </div>
          </div>
        </div>
      )}


      {/* TOAST */}
      {toast && (
        <div className="toast-w">
          <div style={{background:"#1e293b",color:"#e2e8f0",borderRadius:12,padding:"13px 20px",fontSize:13,fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,.2)",display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:"#10b981",display:"inline-flex",alignItems:"center"}}><IconCheck size={14}/></span>{toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
