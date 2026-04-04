import { useState, useEffect, useMemo } from "react";
import { signOut } from "firebase/auth";
import Finance from "./Finance";
import WhatsApp from "./WhatsApp";
import AnnualSummary from "./AnnualSummary";
import PettyCash from "./PettyCash";
import { LOGO } from "../App";
import {
  collection, addDoc, updateDoc, deleteDoc, setDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "firebase/firestore";
import { auth, db } from "../firebase";

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
  {id:"dashboard", icon:"▣", label:"Dashboard"},
  {id:"payments",  icon:"◈", label:"Payments"},
  {id:"learners",  icon:"◉", label:"Learners"},
  {id:"reminders", icon:"◎", label:"Reminders"},
  {id:"analytics", icon:"◲", label:"Analytics"},
  {id:"fees",      icon:"◆", label:"Fee Setup"},
  {id:"finance",   icon:"💼", label:"Finance"},
  {id:"whatsapp",  icon:"💬", label:"WhatsApp"},
  {id:"annual",    icon:"📅", label:"Annual"},
  {id:"pettycash", icon:"💰", label:"Petty Cash"},
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
  const [delConfirm, setDelConfirm]         = useState(null);

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
    return () => { unsubLearners(); unsubPayments(); unsubFees(); };
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
      const status = getStatus(totalPaid, fee, arrears);
      return { ...learner, fee, totalPaid, arrears, balance, status, lastPayment, termPayments };
    });
  }, [learners, payments, fees, activeTerm]);

  const termData = enriched;

  const stats = useMemo(() => {
    const expected   = termData.reduce((a,l) => a + l.fee + l.arrears, 0);
    const collected  = termData.reduce((a,l) => a + l.totalPaid, 0);
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
    const collected = gl.reduce((a,l)=>a+l.totalPaid,0);
    const expected  = gl.reduce((a,l)=>a+l.fee+l.arrears,0);
    return { grade, total:gl.length, paid:gl.filter(l=>l.status==="paid").length, collected, expected, rate: expected>0?Math.round(collected/expected*100):0 };
  }), [termData]);

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
    } catch { showToast("Failed to add learner.", "err"); }
  };

  const handleDeleteLearner = async (id) => {
    try {
      await deleteDoc(doc(db,"learners",id));
      setDelConfirm(null);
      showToast("Learner removed.");
    } catch { showToast("Could not delete.", "err"); }
  };

  const handleRecordPayment = async () => {
    if (!newPayment.learnerId || !newPayment.amount) {
      showToast("Select a learner and enter amount.", "err"); return;
    }
    const learner = learners.find(l => l.id === newPayment.learnerId);
    try {
      await addDoc(collection(db,"payments"), {
        learnerId:  newPayment.learnerId,
        learnerName: learner?.name || "",
        grade:       learner?.grade || "",
        term:        activeTerm,
        amount:      parseFloat(newPayment.amount),
        method:      newPayment.method,
        date:        newPayment.date,
        notes:       newPayment.notes,
        recordedBy:  user.email,
        createdAt:   serverTimestamp(),
      });
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
    } catch { showToast("Failed to save fees.", "err"); }
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

  const generateAIInsight = async () => {
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
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:800,
          system:"You are a school finance advisor for a Zambian primary school called Jemareen Academy. Analyze payment data and give 3-4 short, actionable paragraphs. Be warm, practical, and direct. Plain text only.",
          messages:[{role:"user",content:`Analyze this data: ${JSON.stringify(summary)}`}]
        })
      });
      const data = await res.json();
      setAiInsight(data.content?.[0]?.text || "Could not generate insight.");
    } catch { setAiInsight("AI insight unavailable. Check your internet connection."); }
    setAiLoading(false);
  };

  const handleLogout = async () => { await signOut(auth); };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#f4f6fb",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:16}}>🏫</div>
        <div style={{fontSize:16,color:"#94a3b8",fontWeight:600}}>Loading Jemareen Academy…</div>
      </div>
    </div>
  );

  const BOTTOM_NAV = [
    {id:"dashboard",icon:"▣",label:"Home"},
    {id:"payments", icon:"◈",label:"Pay"},
    {id:"learners", icon:"◉",label:"Learners"},
    {id:"whatsapp", icon:"💬",label:"WhatsApp"},
    {id:"more",     icon:"☰", label:"More"},
  ];

  return (
    <div style={{fontFamily:"'Outfit',sans-serif",minHeight:"100vh",background:"#FAF7FD",color:"#1e293b"}}>
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
        .mobile-hdr{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid #f1f5f9;padding:13px 16px;display:flex;align-items:center;gap:12px;}
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
        .d-aside{display:none;position:fixed;top:0;left:0;height:100vh;width:224px;background:#3D1445;border-right:none;flex-direction:column;padding:0;z-index:50;overflow-y:auto;}
      `}</style>

      {/* DESKTOP SIDEBAR */}
      <aside className="d-aside">
        <div style={{padding:"18px 16px 14px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src={LOGO} alt="Logo" style={{width:42,height:42,flexShrink:0,filter:"drop-shadow(0 2px 8px rgba(0,0,0,.3))"}}/>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:800,color:"#fff",lineHeight:1.25}}>Jemareen<br/>Academy</div>
              <div style={{fontSize:9,color:"#D4A820",marginTop:2,letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>EduPay Finance</div>
            </div>
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:10,fontStyle:"italic",lineHeight:1.5}}>"Bringing out the best in children"</div>
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
            <button onClick={()=>setSidebarOpen(false)} style={{border:"none",background:"rgba(255,255,255,.08)",borderRadius:8,fontSize:22,cursor:"pointer",color:"#fff",lineHeight:1,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
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
        <button onClick={()=>setSidebarOpen(true)} style={{border:"none",background:"#EDE4F5",borderRadius:10,fontSize:18,cursor:"pointer",color:"#7B2D8B",padding:"8px 10px",lineHeight:1}}>☰</button>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
          <img src={LOGO} alt="Logo" style={{width:30,height:30,flexShrink:0}}/>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:800,color:"#1e293b"}}>{NAV.find(n=>n.id===activeTab)?.label||"Dashboard"}</div>
            <div style={{fontSize:10,color:"#94a3b8"}}>{activeTerm}</div>
          </div>
        </div>
        {activeTab==="learners"  && <button className="btn" onClick={()=>setShowAddLearner(true)}  style={{background:"#7B2D8B",color:"#fff",padding:"9px 16px",fontSize:13}}>+ Add</button>}
        {activeTab==="payments"  && <button className="btn" onClick={()=>setShowAddPayment(true)}  style={{background:"#7B2D8B",color:"#fff",padding:"9px 16px",fontSize:13}}>+ Pay</button>}
        {activeTab==="reminders" && <button className="btn" onClick={handleBulkRemind}             style={{background:"#f59e0b",color:"#fff",padding:"9px 16px",fontSize:13}}>⚡ All</button>}
        {activeTab==="fees"      && <button className="btn" onClick={()=>{setEditFeeVals({});setShowEditFees(true);}} style={{background:"#7B2D8B",color:"#fff",padding:"9px 16px",fontSize:13}}>Edit</button>}
      </div>

      {/* MAIN */}
      <main className="pg">

        {/* DASHBOARD */}
        {activeTab==="dashboard" && <>
          <div className="g2" style={{marginBottom:14}}>
            {[
              {label:"Expected",    val:fmt(stats.expected),    sub:`${activeTerm}`,  accent:"#7B2D8B"},
              {label:"Collected",   val:fmt(stats.collected),   sub:`${stats.rate}%`, accent:"#10b981"},
              {label:"Outstanding", val:fmt(stats.outstanding), sub:"remaining",      accent:"#f43f5e"},
              {label:"Arrears",     val:fmt(stats.arrears),     sub:"carried fwd",    accent:"#f59e0b"},
            ].map(k=>(
              <div key={k.label} className="card" style={{padding:16}}>
                <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>{k.label}</div>
                <div style={{fontSize:20,fontWeight:800,color:k.accent,fontFamily:"'Playfair Display',serif"}}>{k.val}</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:20,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:15}}>Collection Progress</div>
              <div style={{fontWeight:800,fontSize:20,color:"#7B2D8B"}}>{stats.rate}%</div>
            </div>
            <div className="bar" style={{marginBottom:16}}><div className="bf" style={{width:`${stats.rate}%`,background:"linear-gradient(90deg,#7B2D8B,#10b981)"}}/></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {Object.entries(STATUS_CFG).map(([k,v])=>(
                <div key={k} style={{background:v.bg,borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
                  <div style={{fontSize:18,fontWeight:800,color:v.color}}>{stats[k]||0}</div>
                  <div style={{fontSize:10,color:v.color,fontWeight:600,marginTop:2}}>{v.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{padding:18,marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>Quick Actions</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                {label:"+ Add Learner",    action:()=>setShowAddLearner(true),  color:"#7B2D8B"},
                {label:"+ Record Payment", action:()=>setShowAddPayment(true),  color:"#10b981"},
                {label:"💬 WhatsApp",      action:()=>setActiveTab("whatsapp"), color:"#25D366"},
                {label:"📅 Annual Report", action:()=>setActiveTab("annual"),   color:"#f59e0b"},
              ].map(a=>(
                <button key={a.label} className="btn" onClick={a.action} style={{background:a.color+"14",color:a.color,border:`1px solid ${a.color}22`,textAlign:"left",fontSize:13,padding:"13px 14px"}}>{a.label}</button>
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
          <button className="btn" onClick={()=>setShowAddPayment(true)} style={{background:"#7B2D8B",color:"#fff",width:"100%",marginBottom:12,fontSize:15,padding:"14px"}}>
            💳 Record New Payment
          </button>
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
          <div className="clist">
            {filtered.map(l=>{
              const cfg=STATUS_CFG[l.status];
              return (
                <div key={l.id} className="lcard" onClick={()=>setShowReceipt(l)}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                    <div style={{width:42,height:42,borderRadius:"50%",background:avatarColor(l.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>{initials(l.name)}</div>
                    <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700}}>{l.name}</div><div style={{fontSize:12,color:"#94a3b8"}}>{l.grade} · {l.parent}</div></div>
                    <span className="tag" style={{background:cfg.bg,color:cfg.color}}>{cfg.label}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:l.status!=="paid"?12:0}}>
                    {[["Fee",fmt(l.fee),"#475569","#FFFFFF"],["Paid",fmt(l.totalPaid),"#10b981","#f0fdf4"],["Balance",fmt(l.balance),l.balance>0?"#f43f5e":"#94a3b8",l.balance>0?"#fff5f5":"#FFFFFF"]].map(([lab,val,col,bg])=>(
                      <div key={lab} style={{textAlign:"center",background:bg,borderRadius:10,padding:"9px 4px"}}>
                        <div style={{fontSize:14,fontWeight:700,color:col}}>{val}</div>
                        <div style={{fontSize:10,color:"#94a3b8"}}>{lab}</div>
                      </div>
                    ))}
                  </div>
                  {l.status!=="paid"&&<button className="btn" onClick={e=>{e.stopPropagation();handleSendReminder(l.id);}} style={{width:"100%",background:remindersSent.includes(l.id+activeTerm)?"#d1fae5":"#F3EDF7",color:remindersSent.includes(l.id+activeTerm)?"#065f46":"#64748b",fontSize:13}}>{remindersSent.includes(l.id+activeTerm)?"✓ Reminder Sent":"Send Reminder"}</button>}
                </div>
              );
            })}
            {filtered.length===0&&<div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>No records match.</div>}
          </div>
        </>}

        {/* LEARNERS */}
        {activeTab==="learners" && <>
          <button className="btn" onClick={()=>setShowAddLearner(true)} style={{background:"#7B2D8B",color:"#fff",width:"100%",marginBottom:14,fontSize:15,padding:"15px"}}>+ Add New Learner</button>
          <div className="clist">
            {enriched.map(l=>{
              const cfg=STATUS_CFG[l.status];
              return (
                <div key={l.id} className="lcard">
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                    <div style={{width:44,height:44,borderRadius:"50%",background:avatarColor(l.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#fff",flexShrink:0}}>{initials(l.name)}</div>
                    <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700}}>{l.name}</div><div style={{fontSize:12,color:"#94a3b8"}}>{l.grade}</div></div>
                    <span className="tag" style={{background:cfg.bg,color:cfg.color}}>{cfg.label}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                    <div><div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em"}}>Parent</div><div style={{fontSize:14,fontWeight:500,marginTop:2}}>{l.parent}</div></div>
                    <div><div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em"}}>Phone</div><div style={{fontSize:14,fontWeight:500,marginTop:2}}>{l.phone}</div></div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderTop:"1px solid #f1f5f9",marginBottom:10}}>
                    <span style={{fontSize:14,fontWeight:700,color:"#10b981"}}>Paid: {fmt(l.totalPaid)}</span>
                    <span style={{fontSize:14,fontWeight:700,color:l.balance>0?"#f43f5e":"#94a3b8"}}>Bal: {fmt(l.balance)}</span>
                  </div>
                  <button className="btn" onClick={()=>setDelConfirm(l)} style={{width:"100%",background:"#fee2e2",color:"#ef4444",fontSize:13}}>Remove Learner</button>
                </div>
              );
            })}
            {enriched.length===0&&<div className="card" style={{padding:48,textAlign:"center",color:"#94a3b8"}}><div style={{fontSize:40,marginBottom:12}}>👩‍🎓</div><div style={{fontWeight:600,marginBottom:10}}>No learners yet</div><button className="btn" onClick={()=>setShowAddLearner(true)} style={{background:"#7B2D8B",color:"#fff"}}>Add First Learner</button></div>}
          </div>
        </>}

        {/* REMINDERS */}
        {activeTab==="reminders" && <>
          <button className="btn" onClick={handleBulkRemind} style={{background:"#f59e0b",color:"#fff",width:"100%",marginBottom:12,fontSize:15,padding:"15px"}}>⚡ Send All Reminders</button>
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
            {filtered.filter(l=>l.status!=="paid").length===0&&<div className="card" style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:14}}>🎉 All learners paid up!</div>}
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
              <div><div style={{fontWeight:700,fontSize:15}}>✦ AI Insights</div><div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Powered by Claude AI</div></div>
              <button className="btn" onClick={generateAIInsight} style={{background:"#7B2D8B",color:"#fff",fontSize:13,padding:"10px 16px"}}>{aiLoading?"…":"Generate"}</button>
            </div>
            {aiLoading&&<div style={{color:"#94a3b8",fontSize:13,padding:"10px 0"}}>🔍 Analyzing…</div>}
            {aiInsight&&!aiLoading&&<div style={{background:"#FBF7FD",border:"1px solid #e0e7ff",borderRadius:12,padding:16,fontSize:14,lineHeight:1.8,color:"#374151"}}>{aiInsight}</div>}
            {!aiInsight&&!aiLoading&&<div style={{textAlign:"center",padding:"14px 0",color:"#94a3b8",fontSize:13}}>Tap Generate for AI recommendations.</div>}
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
              <span style={{fontSize:22}}>{n.icon}</span>
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
                    Fee: <strong style={{color:"#1e293b"}}>{fmt(l.fee)}</strong> · Paid: <strong style={{color:"#10b981"}}>{fmt(l.totalPaid)}</strong> · Balance: <strong style={{color:"#f43f5e"}}>{fmt(l.balance)}</strong>{l.arrears>0?` · Arrears: ${fmt(l.arrears)}`:""}
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
                  ["Term Fee",     fmt(l.fee)],
                  ["Arrears",      l.arrears>0?fmt(l.arrears):"None"],
                  ["Total Owed",   fmt(l.fee+l.arrears)],
                  ["Amount Paid",  fmt(l.totalPaid)],
                  ["Balance Due",  fmt(l.balance)],
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
              <button className="btn" onClick={()=>setShowReceipt(null)} style={{width:"100%",background:"#7B2D8B",color:"#fff"}}>Close</button>
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

      {/* ── DELETE CONFIRM ────────────────────────────── */}
      {delConfirm && (
        <div className="overlay" onClick={()=>setDelConfirm(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:360,textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:14}}>⚠️</div>
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
            <span style={{color:"#10b981"}}>✓</span>{toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
