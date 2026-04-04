import { useState, useEffect, useMemo } from "react";
import {
  collection, addDoc, onSnapshot, updateDoc,
  query, orderBy, serverTimestamp, doc, setDoc
} from "firebase/firestore";
import { db } from "../firebase";

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const TERMS  = ["Term 1 2026","Term 2 2026","Term 3 2026"];
const ROLES  = ["Principal","Head Teacher","Class Teacher","Bursar","Admin Officer","Security","Cleaner","Cook"];
const METHODS= ["Mobile Money","Bank Transfer","Cash","Cheque"];

const EXP_CATEGORIES = [
  { id:"utilities",   label:"Utilities",         icon:"💡", color:"#f59e0b", desc:"Electricity, water, internet" },
  { id:"supplies",    label:"Supplies",           icon:"📦", color:"#7B2D8B", desc:"Stationery, books, materials" },
  { id:"maintenance", label:"Maintenance",        icon:"🔧", color:"#64748b", desc:"Repairs, cleaning, buildings" },
  { id:"transport",   label:"Transport",          icon:"🚌", color:"#06b6d4", desc:"Fuel, vehicle costs" },
  { id:"events",      label:"Events & Activities",icon:"🎉", color:"#ec4899", desc:"Sports day, prize giving" },
  { id:"staff",       label:"Staff Welfare",      icon:"👥", color:"#10b981", desc:"Tea, training, allowances" },
  { id:"other",       label:"Other",              icon:"📋", color:"#94a3b8", desc:"Miscellaneous expenses" },
];

const ROLE_COLORS = {
  "Principal":      ["#fef3c7","#92400e"],
  "Head Teacher":   ["#ede9fe","#4c1d95"],
  "Class Teacher":  ["#dbeafe","#1e40af"],
  "Bursar":         ["#d1fae5","#065f46"],
  "Admin Officer":  ["#fce7f3","#831843"],
  "Security":       ["#F0E8F5","#334155"],
  "Cleaner":        ["#fff7ed","#7c2d12"],
  "Cook":           ["#f0fdf4","#14532d"],
};

const AVATAR_COLORS = ["#7B2D8B","#10b981","#f59e0b","#ef4444","#3b82f6","#9B3DAB","#06b6d4","#ec4899","#14b8a6","#f97316"];
const avatarColor = id => AVATAR_COLORS[Math.abs((id||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % AVATAR_COLORS.length];
const initials = name => (name||"").split(" ").filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase();
const fmt = n => `K${Number(n||0).toLocaleString()}`;

const calcNAPSA   = gross => Math.round(gross * 0.05);
const calcAdvance = (advance) => Number(advance || 0);
const calcNet     = (gross, napsa, advance, loan) => gross - napsa - advance - (loan||0);

const FINANCE_NAV = [
  { id:"overview",    icon:"◈", label:"Overview"     },
  { id:"salaries",    icon:"💼", label:"Salaries"     },
  { id:"expenditure", icon:"📊", label:"Expenditure"  },
  { id:"budget",      icon:"🎯", label:"Budgets"      },
  { id:"summary",     icon:"⚖️", label:"Inc vs Exp"   },
  { id:"reports",     icon:"📋", label:"Reports"      },
];

// Default term budgets per category
const DEFAULT_BUDGETS = {
  utilities:   5000,
  supplies:    8000,
  maintenance: 10000,
  transport:   3000,
  events:      6000,
  staff:       2000,
  other:       3000,
};

export default function Finance({ user }) {
  // ── STATE ────────────────────────────────────────────────────────────────
  const [staff,          setStaff]          = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [expenses,       setExpenses]       = useState([]);
  const [budgets,        setBudgets]        = useState(DEFAULT_BUDGETS);
  const [feeIncome,      setFeeIncome]      = useState(0);
  const [loading,        setLoading]        = useState(true);

  const [activeTab,    setActiveTab]    = useState("overview");
  const [activeTerm,   setActiveTerm]   = useState("Term 1 2026");
  const [activeMonth,  setActiveMonth]  = useState(MONTHS[new Date().getMonth()]);
  const [activeYear,   setActiveYear]   = useState("2026");
  const [filterCat,    setFilterCat]    = useState("all");
  const [searchQ,      setSearchQ]      = useState("");
  const [toast,        setToast]        = useState(null);

  // Modals
  const [showAddStaff,   setShowAddStaff]   = useState(false);
  const [showEditStaff,  setShowEditStaff]  = useState(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showPaySalary,  setShowPaySalary]  = useState(null);
  const [showPayslip,    setShowPayslip]    = useState(null);
  const [showDelStaff,   setShowDelStaff]   = useState(null);
  const [showEditBudgets,setShowEditBudgets]= useState(false);
  const [editBudgets,    setEditBudgets]    = useState({});
  const [blockedWarning, setBlockedWarning] = useState(null);

  // Forms
  const [newStaff,   setNewStaff]   = useState({ name:"", role:"Class Teacher", gross:"", napsa:true, advance:"0", loan:"0" });
  const [editStaffForm, setEditStaffForm] = useState({ name:"", role:"Class Teacher", gross:"", napsa:true, advance:"0", loan:"0" });
  const [newExpense, setNewExpense] = useState({ category:"supplies", description:"", amount:"", date:new Date().toISOString().split("T")[0], receipt:"", approvedBy:"Principal", method:"Cash" });

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(null),3200); };

  // ── FIREBASE LISTENERS ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubStaff = onSnapshot(
      query(collection(db,"staff"), orderBy("name")),
      snap => { setStaff(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); },
      () => setLoading(false)
    );
    const unsubSalaries = onSnapshot(
      query(collection(db,"salaryPayments"), orderBy("createdAt","desc")),
      snap => setSalaryPayments(snap.docs.map(d=>({id:d.id,...d.data()})))
    );
    const unsubExpenses = onSnapshot(
      query(collection(db,"expenses"), orderBy("date","desc")),
      snap => setExpenses(snap.docs.map(d=>({id:d.id,...d.data()})))
    );
    const unsubBudgets = onSnapshot(doc(db,"settings","budgets"), snap => {
      if (snap.exists()) setBudgets({...DEFAULT_BUDGETS,...snap.data()});
    });
    // Listen to payments collection to compute fee income
    const unsubPayments = onSnapshot(
      query(collection(db,"payments"), orderBy("createdAt","desc")),
      snap => {
        const total = snap.docs.reduce((a,d)=>a+(d.data().amount||0),0);
        setFeeIncome(total);
      }
    );
    return () => { unsubStaff(); unsubSalaries(); unsubExpenses(); unsubBudgets(); unsubPayments(); };
  }, []);

  // ── COMPUTED ─────────────────────────────────────────────────────────────
  const activeStaff = useMemo(()=>staff.filter(s=>s.active!==false),[staff]);

  const termExpenses = useMemo(()=>expenses.filter(e=>e.term===activeTerm),[expenses,activeTerm]);
  const monthExpenses= useMemo(()=>termExpenses.filter(e=>e.month===activeMonth),[termExpenses,activeMonth]);
  const termSalaries = useMemo(()=>salaryPayments.filter(p=>p.term===activeTerm),[salaryPayments,activeTerm]);
  const monthSalaries= useMemo(()=>salaryPayments.filter(p=>p.month===activeMonth&&p.year===activeYear),[salaryPayments,activeMonth,activeYear]);

  const totalGrossPayroll = useMemo(()=>activeStaff.reduce((a,s)=>a+Number(s.gross||0),0),[activeStaff]);
  const totalNetPayroll   = useMemo(()=>activeStaff.reduce((a,s)=>{
    const napsa   = s.napsa ? calcNAPSA(Number(s.gross)) : 0;
    const advance = Number(s.advance||0);
    return a + calcNet(Number(s.gross), napsa, advance, Number(s.loan||0));
  },0),[activeStaff]);
  const totalNAPSA    = useMemo(()=>activeStaff.filter(s=>s.napsa).reduce((a,s)=>a+calcNAPSA(Number(s.gross||0)),0),[activeStaff]);
  const totalAdvances = useMemo(()=>activeStaff.reduce((a,s)=>a+Number(s.advance||0),0),[activeStaff]);
  const totalLoans    = useMemo(()=>activeStaff.reduce((a,s)=>a+Number(s.loan||0),0),[activeStaff]);

  const termExpTotal  = useMemo(()=>termExpenses.reduce((a,e)=>a+Number(e.amount||0),0),[termExpenses]);
  const monthExpTotal = useMemo(()=>monthExpenses.reduce((a,e)=>a+Number(e.amount||0),0),[monthExpenses]);
  const termSalPaid   = useMemo(()=>termSalaries.filter(p=>p.paid).reduce((a,p)=>a+Number(p.net||0),0),[termSalaries]);
  const monthSalPaid  = useMemo(()=>monthSalaries.filter(p=>p.paid).reduce((a,p)=>a+Number(p.net||0),0),[monthSalaries]);

  const catBreakdown = useMemo(()=>EXP_CATEGORIES.map(cat=>{
    const total = termExpenses.filter(e=>e.category===cat.id).reduce((a,e)=>a+Number(e.amount||0),0);
    const budget = budgets[cat.id] || 0;
    const pct    = budget > 0 ? Math.round(total/budget*100) : 0;
    const remaining = Math.max(0, budget - total);
    const over   = total > budget && budget > 0;
    const warn   = !over && pct >= 80 && budget > 0;
    return {...cat, total, budget, pct, remaining, over, warn};
  }).sort((a,b)=>b.total-a.total),[termExpenses, budgets]);

  const getBudgetStatus = (catId, amount) => {
    const cat = catBreakdown.find(c=>c.id===catId);
    if (!cat || cat.budget===0) return "ok";
    const newTotal = cat.total + amount;
    if (newTotal > cat.budget) return "blocked";
    if (newTotal/cat.budget >= 0.8) return "warn";
    return "ok";
  };

  const filteredExpenses = useMemo(()=>{
    let rows = termExpenses;
    if (filterCat!=="all") rows = rows.filter(e=>e.category===filterCat);
    if (searchQ) rows = rows.filter(e=>e.description?.toLowerCase().includes(searchQ.toLowerCase()));
    return rows;
  },[termExpenses,filterCat,searchQ]);

  const getPayStatus = staffId => {
    const p = salaryPayments.find(p=>p.staffId===staffId&&p.month===activeMonth&&p.year===activeYear);
    return p?.paid ? "paid" : p ? "pending" : "unpaid";
  };

  // ── ACTIONS ──────────────────────────────────────────────────────────────
  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.gross) { showToast("Fill in name and salary."); return; }
    try {
      await addDoc(collection(db,"staff"), {
        name:      newStaff.name,
        role:      newStaff.role,
        gross:     parseFloat(newStaff.gross),
        napsa:     newStaff.napsa,
        advance:   parseFloat(newStaff.advance||0),
        loan:      parseFloat(newStaff.loan||0),
        active:    true,
        addedBy:   user?.email,
        createdAt: serverTimestamp(),
      });
      setShowAddStaff(false);
      setNewStaff({name:"",role:"Class Teacher",gross:"",napsa:true,advance:"0",loan:"0"});
      showToast(`${newStaff.name} added to payroll!`);
    } catch { showToast("Failed to add staff member."); }
  };

  const handleEditStaff = async () => {
    if (!editStaffForm.name || !editStaffForm.gross) { showToast("Fill in name and salary."); return; }
    try {
      await updateDoc(doc(db,"staff", showEditStaff.id), {
        name:    editStaffForm.name,
        role:    editStaffForm.role,
        gross:   parseFloat(editStaffForm.gross),
        napsa:   editStaffForm.napsa,
        advance: parseFloat(editStaffForm.advance||0),
        loan:    parseFloat(editStaffForm.loan||0),
        updatedBy: user?.email,
        updatedAt: serverTimestamp(),
      });
      setShowEditStaff(null);
      showToast(`${editStaffForm.name} updated successfully!`);
    } catch { showToast("Failed to update staff member."); }
  };

  const handleRecordSalaryPayment = async (staffMember) => {
    const gross   = Number(staffMember.gross);
    const napsa   = staffMember.napsa ? calcNAPSA(gross) : 0;
    const advance = Number(staffMember.advance||0);
    const loan    = Number(staffMember.loan||0);
    const net     = calcNet(gross, napsa, advance, loan);
    try {
      await addDoc(collection(db,"salaryPayments"), {
        staffId:    staffMember.id,
        staffName:  staffMember.name,
        role:       staffMember.role,
        month:      activeMonth,
        year:       activeYear,
        term:       activeTerm,
        gross, napsa, advance, loan, net,
        paid:       true,
        date:       new Date().toISOString().split("T")[0],
        recordedBy: user?.email,
        createdAt:  serverTimestamp(),
      });
      setShowPaySalary(null);
      showToast(`Salary paid to ${staffMember.name}!`);
    } catch { showToast("Failed to record payment."); }
  };

  const handlePayAllSalaries = async () => {
    const unpaid = activeStaff.filter(s => getPayStatus(s.id) !== "paid");
    if (unpaid.length === 0) { showToast("All salaries already paid for this month!"); return; }
    try {
      await Promise.all(unpaid.map(s => {
        const gross   = Number(s.gross);
        const napsa   = s.napsa ? calcNAPSA(gross) : 0;
        const advance = Number(s.advance||0);
        const loan    = Number(s.loan||0);
        const net     = calcNet(gross, napsa, advance, loan);
        return addDoc(collection(db,"salaryPayments"), {
          staffId:s.id, staffName:s.name, role:s.role,
          month:activeMonth, year:activeYear, term:activeTerm,
          gross, napsa, advance, loan, net,
          paid:true, date:new Date().toISOString().split("T")[0],
          recordedBy:user?.email, createdAt:serverTimestamp(),
        });
      }));
      showToast(`${unpaid.length} salary payments recorded!`);
    } catch { showToast("Failed to process all salaries."); }
  };

  const handleSaveBudgets = async () => {
    try {
      const merged = { ...budgets, ...editBudgets };
      await setDoc(doc(db,"settings","budgets"), merged);
      setBudgets(merged);
      setShowEditBudgets(false);
      setEditBudgets({});
      showToast("Budget limits saved!");
    } catch { showToast("Failed to save budgets."); }
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.amount) { showToast("Fill description and amount."); return; }
    const amount = parseFloat(newExpense.amount);
    // Budget block check
    const budgetStatus = getBudgetStatus(newExpense.category, amount);
    if (budgetStatus === "blocked") {
      const cat = catBreakdown.find(c=>c.id===newExpense.category);
      setBlockedWarning({ cat, amount, remaining: cat?.remaining });
      return;
    }
    const date  = new Date(newExpense.date);
    const month = MONTHS[date.getMonth()];
    const year  = String(date.getFullYear());
    try {
      await addDoc(collection(db,"expenses"), {
        ...newExpense,
        amount,
        month, year,
        term:       activeTerm,
        addedBy:    user?.email,
        createdAt:  serverTimestamp(),
      });
      setShowAddExpense(false);
      setNewExpense({category:"supplies",description:"",amount:"",date:new Date().toISOString().split("T")[0],receipt:"",approvedBy:"Principal",method:"Cash"});
      // Warn after saving if close to limit
      if (budgetStatus === "warn") showToast("⚠️ Warning: This category is near its budget limit!");
      else showToast("Expense recorded!");
    } catch { showToast("Failed to save expense."); }
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",color:"#94a3b8",fontSize:14}}>
      Loading finance data…
    </div>
  );

  return (
    <div style={{fontFamily:"'Outfit',sans-serif"}}>
      <style>{`
        .fn-btn{border:none;border-radius:12px;padding:12px 20px;font-family:inherit;font-weight:700;font-size:14px;cursor:pointer;transition:all .18s;}
        .fn-btn:active{transform:scale(.97);}
        .fn-card{background:#fff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);}
        .fn-inp{width:100%;background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:14px;font-family:inherit;font-size:16px;color:#1e293b;outline:none;transition:border-color .2s;-webkit-appearance:none;appearance:none;}
        .fn-inp:focus{border-color:#7B2D8B;background:#fff;}
        select.fn-inp option{background:#fff;}
        textarea.fn-inp{resize:vertical;line-height:1.6;}
        .fn-pill{border:none;border-radius:99px;padding:8px 16px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap;}
        .fn-pill:active{transform:scale(.96);}
        .fn-overlay{position:fixed;inset:0;background:rgba(15,23,42,.6);display:flex;align-items:flex-end;justify-content:center;z-index:200;backdrop-filter:blur(6px);}
        .fn-modal{background:#fff;border-radius:24px 24px 0 0;padding:12px 20px 52px;width:100%;max-height:94vh;overflow-y:auto;}
        .fn-modal-handle{width:44px;height:4px;background:#e2e8f0;border-radius:99px;margin:0 auto 18px;}
        @media(min-width:640px){
          .fn-overlay{align-items:center;}
          .fn-modal{border-radius:22px;max-width:480px;padding:32px;width:auto;}
          .fn-modal-handle{display:none;}
        }
        .fn-bar{background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;}
        .fn-bf{height:100%;border-radius:99px;transition:width .7s cubic-bezier(.4,0,.2,1);}
        .fn-tag{display:inline-flex;align-items:center;border-radius:99px;padding:4px 12px;font-size:12px;font-weight:700;}
        .fn-row:hover td{background:#f8fafc;}
        .fn-nb{border:none;background:none;cursor:pointer;font-family:inherit;transition:all .15s;width:100%;text-align:left;}
        .fn-check{width:22px;height:22px;border-radius:6px;border:2px solid #d1d5db;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0;}
        .fn-check.on{background:#7B2D8B;border-color:#7B2D8B;}
        .fn-kpi{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        @media(min-width:768px){.fn-kpi{grid-template-columns:repeat(4,1fr);}}
        .fn-2col{display:grid;grid-template-columns:1fr;gap:14px;}
        @media(min-width:768px){.fn-2col{grid-template-columns:1fr 1fr;}}
      `}</style>

      {/* ── Sub-nav: horizontal scroll on mobile ─── */}
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginBottom:20,paddingBottom:4}}>
        <div style={{display:"flex",gap:6,background:"#fff",borderRadius:14,padding:6,boxShadow:"0 2px 8px rgba(0,0,0,.06)",width:"max-content",minWidth:"100%"}}>
          {FINANCE_NAV.map(n=>(
          <button key={n.id} className="fn-nb" onClick={()=>setActiveTab(n.id)}
            style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:10,fontSize:14,fontWeight:activeTab===n.id?700:500,color:activeTab===n.id?"#7B2D8B":"#64748b",background:activeTab===n.id?"#F3E8F7":"none",width:"auto",whiteSpace:"nowrap"}}>
            <span style={{fontSize:16}}>{n.icon}</span>{n.label}
          </button>
        ))}
        <div style={{width:1,background:"#F0E8F5",margin:"0 4px",flexShrink:0}} />
        <select className="fn-inp" style={{width:"auto",fontSize:14,border:"none",background:"none",padding:"10px 12px",borderRadius:10,flexShrink:0}} value={activeTerm} onChange={e=>setActiveTerm(e.target.value)}>
          {TERMS.map(t=><option key={t}>{t}</option>)}
        </select>
        <select className="fn-inp" style={{width:"auto",fontSize:14,border:"none",background:"none",padding:"10px 12px",borderRadius:10,flexShrink:0}} value={activeMonth} onChange={e=>setActiveMonth(e.target.value)}>
          {MONTHS.map(m=><option key={m}>{m}</option>)}
        </select>
        </div>
      </div>

      {/* Action buttons */}
      {(activeTab==="salaries" || activeTab==="expenditure") && (
        <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
          {activeTab==="salaries" && <>
            <button className="fn-btn" onClick={handlePayAllSalaries} style={{background:"#10b981",color:"#fff",flex:1,minWidth:140}}>✓ Pay All — {activeMonth}</button>
            <button className="fn-btn" onClick={()=>setShowAddStaff(true)} style={{background:"#7B2D8B",color:"#fff",flex:1,minWidth:140}}>+ Add Staff</button>
          </>}
          {activeTab==="expenditure" && <button className="fn-btn" onClick={()=>setShowAddExpense(true)} style={{background:"#7B2D8B",color:"#fff",width:"100%"}}>+ Record Expense</button>}
        </div>
      )}

      {/* ── OVERVIEW ──────────────────────────────────────── */}
      {activeTab==="overview" && <>
        <div className="fn-kpi" style={{marginBottom:16}}>
          {[
            {label:"Monthly Payroll",   val:fmt(totalGrossPayroll), sub:`${activeStaff.length} active staff`,    accent:"#7B2D8B", icon:"💼"},
            {label:"Net Salaries",      val:fmt(totalNetPayroll),   sub:"after all deductions",                  accent:"#10b981", icon:"✓"},
            {label:"Term Expenses",     val:fmt(termExpTotal),      sub:`${termExpenses.length} transactions`,   accent:"#f59e0b", icon:"📦"},
            {label:"Total Outflow",     val:fmt(termSalPaid+termExpTotal), sub:"salaries + expenses",            accent:"#f43f5e", icon:"📊"},
          ].map(k=>(
            <div key={k.label} className="fn-card" style={{padding:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".07em"}}>{k.label}</div>
                <div style={{width:30,height:30,borderRadius:8,background:k.accent+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{k.icon}</div>
              </div>
              <div style={{fontSize:22,fontWeight:800,color:k.accent,fontFamily:"Georgia,serif"}}>{k.val}</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="fn-2col" style={{marginBottom:14}}>
          <div className="fn-card" style={{padding:24}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>Payroll Breakdown — Monthly</div>
            {[
              {label:"Gross Salaries",    val:totalGrossPayroll, color:"#7B2D8B"},
              {label:"NAPSA (5%)",         val:totalNAPSA,        color:"#f59e0b"},
              {label:"Salary Advances",    val:totalAdvances,     color:"#9B3DAB"},
              {label:"Loan Deductions",    val:totalLoans,        color:"#94a3b8"},
              {label:"Net Take-Home Pay",  val:totalNetPayroll,   color:"#10b981"},
            ].map(r=>(
              <div key={r.label} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #f1f5f9"}}>
                <span style={{fontSize:13,color:"#64748b"}}>{r.label}</span>
                <span style={{fontSize:14,fontWeight:700,color:r.color}}>{fmt(r.val)}</span>
              </div>
            ))}
          </div>
          <div className="fn-card" style={{padding:24}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>Expenses by Category — {activeTerm}</div>
            {catBreakdown.length===0 && <div style={{color:"#94a3b8",fontSize:13,textAlign:"center",padding:20}}>No expenses recorded yet.</div>}
            {catBreakdown.map(cat=>{
              const pct = termExpTotal>0?Math.round(cat.total/termExpTotal*100):0;
              return (
                <div key={cat.id} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:13,color:"#475569"}}>{cat.icon} {cat.label}</span>
                    <span style={{fontSize:12,color:"#94a3b8"}}>{fmt(cat.total)} · {pct}%</span>
                  </div>
                  <div className="fn-bar"><div className="fn-bf" style={{width:`${pct}%`,background:cat.color}} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="fn-card" style={{padding:24}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>This Month — {activeMonth} {activeYear}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            {[
              {label:"Salaries Paid",   val:fmt(monthSalPaid), sub:`${monthSalaries.filter(p=>p.paid).length}/${activeStaff.length} staff`, color:"#10b981"},
              {label:"Expenses Spent",  val:fmt(monthExpTotal),sub:`${monthExpenses.length} transactions`,  color:"#f59e0b"},
              {label:"Total Month Out", val:fmt(monthSalPaid+monthExpTotal), sub:"combined",               color:"#f43f5e"},
            ].map(s=>(
              <div key={s.label} style={{background:"#FEFCFF",borderRadius:14,padding:18,textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:800,color:s.color,fontFamily:"Georgia,serif"}}>{s.val}</div>
                <div style={{fontSize:12,fontWeight:600,color:"#475569",marginTop:4}}>{s.label}</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </>}

      {/* ── SALARIES ──────────────────────────────────────── */}
      {activeTab==="salaries" && <>
        <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:13,color:"#64748b"}}>Salary status for <strong style={{color:"#1e293b"}}>{activeMonth} {activeYear}</strong></div>
          <div style={{flex:1}}/>
          <span className="fn-tag" style={{background:"rgba(16,185,129,.1)",color:"#10b981"}}>
            Paid: {activeStaff.filter(s=>getPayStatus(s.id)==="paid").length}/{activeStaff.length}
          </span>
          <span className="fn-tag" style={{background:"rgba(244,63,94,.1)",color:"#f43f5e"}}>
            Unpaid: {activeStaff.filter(s=>getPayStatus(s.id)!=="paid").length}
          </span>
        </div>

        <div className="fn-card" style={{overflow:"hidden",marginBottom:14}}>
          {activeStaff.length === 0 ? (
            <div style={{padding:48,textAlign:"center",color:"#94a3b8"}}>
              <div style={{fontSize:36,marginBottom:12}}>👥</div>
              <div style={{fontWeight:600,fontSize:15,marginBottom:8}}>No staff members yet</div>
              <button className="fn-btn" onClick={()=>setShowAddStaff(true)} style={{background:"#7B2D8B",color:"#fff"}}>Add First Staff Member</button>
            </div>
          ) : (
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:620}}>
              <thead>
                <tr style={{borderBottom:"1px solid #f1f5f9",background:"#fafafa"}}>
                  {["Staff Member","Role","Gross","NAPSA","Advance","Loan","Net Pay","Status","Actions"].map(h=>(
                    <th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeStaff.map((s,i)=>{
                  const gross   = Number(s.gross);
                  const napsa   = s.napsa ? calcNAPSA(gross) : 0;
                  const advance = Number(s.advance||0);
                  const loan    = Number(s.loan||0);
                  const net     = calcNet(gross,napsa,advance,loan);
                  const status  = getPayStatus(s.id);
                  const rc      = ROLE_COLORS[s.role]||["#F0E8F5","#475569"];
                  return (
                    <tr key={s.id} className="fn-row" style={{borderBottom:i<activeStaff.length-1?"1px solid #f8fafc":"none"}}>
                      <td style={{padding:"12px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:34,height:34,borderRadius:"50%",background:avatarColor(s.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0}}>{initials(s.name)}</div>
                          <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{s.name}</div>
                        </div>
                      </td>
                      <td style={{padding:"12px 14px"}}><span style={{background:rc[0],color:rc[1],borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700}}>{s.role}</span></td>
                      <td style={{padding:"12px 14px",fontSize:13,fontWeight:600}}>{fmt(gross)}</td>
                      <td style={{padding:"12px 14px",fontSize:13,color:napsa>0?"#f59e0b":"#cbd5e1"}}>{napsa>0?fmt(napsa):"—"}</td>
                      <td style={{padding:"12px 14px",fontSize:13,color:advance>0?"#9B3DAB":"#cbd5e1"}}>{advance>0?fmt(advance):"—"}</td>
                      <td style={{padding:"12px 14px",fontSize:13,color:loan>0?"#94a3b8":"#cbd5e1"}}>{loan>0?fmt(loan):"—"}</td>
                      <td style={{padding:"12px 14px",fontSize:14,fontWeight:800,color:"#10b981"}}>{fmt(net)}</td>
                      <td style={{padding:"12px 14px"}}>
                        <span className="fn-tag" style={{background:status==="paid"?"rgba(16,185,129,.12)":"rgba(244,63,94,.1)",color:status==="paid"?"#10b981":"#f43f5e"}}>
                          {status==="paid"?"✓ Paid":"Unpaid"}
                        </span>
                      </td>
                      <td style={{padding:"12px 14px"}}>
                        <div style={{display:"flex",gap:6}}>
                          <button className="fn-pill" onClick={()=>setShowPayslip({...s,napsa,advance,net})} style={{background:"#f0f4ff",color:"#7B2D8B",border:"1px solid #e0e7ff",fontSize:11}}>Payslip</button>
                          <button className="fn-pill" onClick={()=>{setShowEditStaff(s);setEditStaffForm({name:s.name,role:s.role,gross:String(s.gross),napsa:s.napsa,advance:String(s.advance||0),loan:String(s.loan||0)});}} style={{background:"#fef3c7",color:"#92400e",border:"1px solid #fde68a",fontSize:11}}>Edit</button>
                          {status!=="paid" && <button className="fn-pill" onClick={()=>setShowPaySalary(s)} style={{background:"#d1fae5",color:"#065f46",border:"1px solid #6ee7b7",fontSize:11}}>Pay</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
          )}
        </div>

        {/* Totals */}
        {activeStaff.length > 0 && (
          <div className="fn-card" style={{padding:"14px 20px",display:"flex",flexWrap:"wrap",gap:20,alignItems:"center"}}>
            <span style={{fontSize:13,color:"#64748b",fontWeight:600}}>Monthly Totals:</span>
            {[["Gross",totalGrossPayroll,"#7B2D8B"],["NAPSA",totalNAPSA,"#f59e0b"],["Advances",totalAdvances,"#9B3DAB"],["Loans",totalLoans,"#94a3b8"],["Net",totalNetPayroll,"#10b981"]].map(([l,v,c])=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:800,color:c,fontFamily:"Georgia,serif"}}>{fmt(v)}</div>
                <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em"}}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </>}

      {/* ── EXPENDITURE ───────────────────────────────────── */}
      {activeTab==="expenditure" && <>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
          <input className="fn-inp" style={{flex:1,minWidth:180}} placeholder="Search expenses…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
          <select className="fn-inp" style={{width:"auto"}} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
            <option value="all">All Categories</option>
            {EXP_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          <button className="fn-pill" onClick={()=>setFilterCat("all")} style={{background:filterCat==="all"?"#7B2D8B":"#F0E8F5",color:filterCat==="all"?"#fff":"#64748b",border:"1px solid "+(filterCat==="all"?"#7B2D8B":"#e2e8f0")}}>All</button>
          {EXP_CATEGORIES.map(c=>(
            <button key={c.id} className="fn-pill" onClick={()=>setFilterCat(c.id)} style={{background:filterCat===c.id?c.color+"22":"#F0E8F5",color:filterCat===c.id?c.color:"#64748b",border:`1px solid ${filterCat===c.id?c.color+"44":"#e2e8f0"}`}}>{c.icon} {c.label}</button>
          ))}
        </div>

        <div className="fn-card" style={{overflow:"hidden"}}>
          {filteredExpenses.length===0 ? (
            <div style={{padding:48,textAlign:"center",color:"#94a3b8"}}>
              <div style={{fontSize:36,marginBottom:12}}>📦</div>
              <div style={{fontWeight:600,fontSize:15,marginBottom:8}}>No expenses yet</div>
              <button className="fn-btn" onClick={()=>setShowAddExpense(true)} style={{background:"#7B2D8B",color:"#fff"}}>Record First Expense</button>
            </div>
          ) : (
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:580}}>
              <thead>
                <tr style={{borderBottom:"1px solid #f1f5f9",background:"#fafafa"}}>
                  {["Date","Category","Description","Amount","Method","Receipt","Approved By"].map(h=>(
                    <th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((e,i)=>{
                  const cat = EXP_CATEGORIES.find(c=>c.id===e.category)||EXP_CATEGORIES[6];
                  return (
                    <tr key={e.id} className="fn-row" style={{borderBottom:i<filteredExpenses.length-1?"1px solid #f8fafc":"none"}}>
                      <td style={{padding:"12px 14px",fontSize:12,color:"#64748b",whiteSpace:"nowrap"}}>{e.date}</td>
                      <td style={{padding:"12px 14px"}}><span style={{background:cat.color+"18",color:cat.color,borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{cat.icon} {cat.label}</span></td>
                      <td style={{padding:"12px 14px",fontSize:13,color:"#1e293b",fontWeight:500}}>{e.description}</td>
                      <td style={{padding:"12px 14px",fontSize:14,fontWeight:800,color:"#f43f5e",whiteSpace:"nowrap"}}>{fmt(e.amount)}</td>
                      <td style={{padding:"12px 14px",fontSize:12,color:"#64748b",whiteSpace:"nowrap"}}>{e.method||"—"}</td>
                      <td style={{padding:"12px 14px",fontSize:12,color:"#94a3b8",fontFamily:"monospace",whiteSpace:"nowrap"}}>{e.receipt||"—"}</td>
                      <td style={{padding:"12px 14px",fontSize:12,color:"#64748b",whiteSpace:"nowrap"}}>{e.approvedBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
        {filteredExpenses.length>0 && (
          <div className="fn-card" style={{padding:"14px 20px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,color:"#64748b"}}>{filteredExpenses.length} transactions shown</span>
            <div style={{display:"flex",gap:24}}>
              <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"#94a3b8"}}>Filtered total</div><div style={{fontSize:18,fontWeight:800,color:"#f43f5e",fontFamily:"Georgia,serif"}}>{fmt(filteredExpenses.reduce((a,e)=>a+Number(e.amount),0))}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"#94a3b8"}}>Full term</div><div style={{fontSize:18,fontWeight:800,color:"#7B2D8B",fontFamily:"Georgia,serif"}}>{fmt(termExpTotal)}</div></div>
            </div>
          </div>
        )}
      </>}

      {/* ── BUDGETS ───────────────────────────────────────── */}
      {activeTab==="budget" && <>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:"#1e293b"}}>Term Budget Limits — {activeTerm}</div>
            <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>Set spending limits per category. Red = over budget. Orange = 80%+ used.</div>
          </div>
          <button className="fn-btn" onClick={()=>{setEditBudgets({});setShowEditBudgets(true);}} style={{background:"#7B2D8B",color:"#fff"}}>Edit Budgets</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,marginBottom:18}}>
          {EXP_CATEGORIES.map(cat=>{
            const data = catBreakdown.find(c=>c.id===cat.id)||{...cat,total:0,budget:budgets[cat.id]||0,pct:0,remaining:budgets[cat.id]||0,over:false,warn:false};
            const budget = budgets[cat.id]||0;
            const barColor = data.over?"#f43f5e":data.warn?"#f59e0b":cat.color;
            const bgBorder = data.over?"#fee2e2":"#fff";
            const borderC  = data.over?"#fca5a5":data.warn?"#fde68a":"#e9ecf3";
            return (
              <div key={cat.id} className="fn-card" style={{padding:22,border:`2px solid ${borderC}`,background:bgBorder}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:22}}>{cat.icon}</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>{cat.label}</div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>{cat.desc}</div>
                    </div>
                  </div>
                  {data.over && <span style={{background:"#fee2e2",color:"#f43f5e",borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:800}}>⚠ Over Budget</span>}
                  {data.warn && !data.over && <span style={{background:"#fef3c7",color:"#92400e",borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:800}}>⚡ Near Limit</span>}
                </div>

                {/* Progress bar */}
                <div style={{marginBottom:12}}>
                  <div className="fn-bar">
                    <div className="fn-bf" style={{width:`${Math.min(data.pct,100)}%`,background:barColor}} />
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  <div style={{textAlign:"center",background:"#FEFCFF",borderRadius:10,padding:10}}>
                    <div style={{fontSize:14,fontWeight:800,color:"#f43f5e"}}>{fmt(data.total)}</div>
                    <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em"}}>Spent</div>
                  </div>
                  <div style={{textAlign:"center",background:"#FEFCFF",borderRadius:10,padding:10}}>
                    <div style={{fontSize:14,fontWeight:800,color:budget>0?"#7B2D8B":"#cbd5e1"}}>{budget>0?fmt(budget):"No limit"}</div>
                    <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em"}}>Budget</div>
                  </div>
                  <div style={{textAlign:"center",background:data.over?"#fee2e2":"#f0fdf4",borderRadius:10,padding:10}}>
                    <div style={{fontSize:14,fontWeight:800,color:data.over?"#f43f5e":"#10b981"}}>{data.over?`-${fmt(data.total-(budget||0))}`:fmt(data.remaining)}</div>
                    <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em"}}>{data.over?"Over":"Remaining"}</div>
                  </div>
                </div>
                <div style={{marginTop:10,fontSize:12,color:data.over?"#f43f5e":data.warn?"#92400e":"#94a3b8",textAlign:"center",fontWeight:data.over||data.warn?700:400}}>
                  {budget>0?`${Math.min(data.pct,100)}% of budget used`:"Set a budget limit above"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary totals */}
        <div className="fn-card" style={{padding:22,display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>Term Budget Summary:</span>
          {[
            {label:"Total Budget",   val:fmt(Object.values(budgets).reduce((a,b)=>a+b,0)), color:"#7B2D8B"},
            {label:"Total Spent",    val:fmt(termExpTotal),                                  color:"#f43f5e"},
            {label:"Total Remaining",val:fmt(Math.max(0,Object.values(budgets).reduce((a,b)=>a+b,0)-termExpTotal)), color:"#10b981"},
            {label:"Over-budget cats",val:`${catBreakdown.filter(c=>c.over).length}`,        color:"#f43f5e"},
          ].map(s=>(
            <div key={s.label} style={{textAlign:"center",flex:1,minWidth:120}}>
              <div style={{fontSize:20,fontWeight:800,color:s.color,fontFamily:"Georgia,serif"}}>{s.val}</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>{s.label}</div>
            </div>
          ))}
        </div>
      </>}

      {/* ── INCOME VS EXPENDITURE ─────────────────────────── */}
      {activeTab==="summary" && <>
        {/* Big comparison */}
        <div className="fn-2col" style={{marginBottom:18}}>
          <div className="fn-card" style={{padding:26,border:"2px solid #bbf7d0"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <div style={{width:44,height:44,borderRadius:12,background:"#d1fae5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📥</div>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:"#1e293b"}}>Total Income</div>
                <div style={{fontSize:12,color:"#94a3b8"}}>{activeTerm} · School Fees Collected</div>
              </div>
            </div>
            <div style={{fontSize:36,fontWeight:800,color:"#10b981",fontFamily:"Georgia,serif",marginBottom:8}}>{fmt(feeIncome)}</div>
            <div style={{fontSize:12,color:"#64748b",lineHeight:1.6}}>This is the total school fees collected from learner payments recorded in the system for this academic year.</div>
          </div>
          <div className="fn-card" style={{padding:26,border:"2px solid #fca5a5"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <div style={{width:44,height:44,borderRadius:12,background:"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📤</div>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:"#1e293b"}}>Total Expenditure</div>
                <div style={{fontSize:12,color:"#94a3b8"}}>{activeTerm} · Salaries + Operations</div>
              </div>
            </div>
            <div style={{fontSize:36,fontWeight:800,color:"#f43f5e",fontFamily:"Georgia,serif",marginBottom:8}}>{fmt(termSalPaid+termExpTotal)}</div>
            <div style={{fontSize:12,color:"#64748b",lineHeight:1.6}}>Combined total of all salary payments made and operational expenses recorded for {activeTerm}.</div>
          </div>
        </div>

        {/* Net position */}
        {(()=>{
          const net = feeIncome - (termSalPaid+termExpTotal);
          const surplus = net >= 0;
          return (
            <div className="fn-card" style={{padding:26,marginBottom:18,background:surplus?"#f0fdf4":"#fff5f5",border:`2px solid ${surplus?"#6ee7b7":"#fca5a5"}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:16,color:"#1e293b",marginBottom:4}}>{surplus?"✅ Surplus":"⚠️ Deficit"} Position</div>
                  <div style={{fontSize:13,color:"#64748b"}}>Income minus all expenditure for {activeTerm}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:36,fontWeight:800,color:surplus?"#10b981":"#f43f5e",fontFamily:"Georgia,serif"}}>{surplus?"+":""}{fmt(Math.abs(net))}</div>
                  <div style={{fontSize:12,color:"#94a3b8"}}>{surplus?"Available surplus":"Shortfall to cover"}</div>
                </div>
              </div>
              {/* Visual bar */}
              <div style={{marginTop:18}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:12,color:"#10b981",fontWeight:700}}>Income: {fmt(feeIncome)}</span>
                  <span style={{fontSize:12,color:"#f43f5e",fontWeight:700}}>Expenditure: {fmt(termSalPaid+termExpTotal)}</span>
                </div>
                <div style={{background:"#e2e8f0",borderRadius:99,height:12,overflow:"hidden",position:"relative"}}>
                  <div style={{height:"100%",borderRadius:99,background:"#10b981",width:`${Math.min(100,feeIncome>0?Math.round(feeIncome/(Math.max(feeIncome,termSalPaid+termExpTotal))*100):0)}%`,transition:"width .8s"}} />
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                  <span style={{fontSize:11,color:"#94a3b8"}}>Coverage ratio</span>
                  <span style={{fontSize:12,fontWeight:700,color:surplus?"#10b981":"#f43f5e"}}>
                    {feeIncome>0&&(termSalPaid+termExpTotal)>0?Math.round(feeIncome/(termSalPaid+termExpTotal)*100):0}%
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Breakdown */}
        <div className="fn-2col">
          <div className="fn-card" style={{padding:24}}>
            <div style={{fontWeight:700,fontSize:14,color:"#10b981",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#10b981"}}/>INCOME BREAKDOWN
            </div>
            {[
              {label:"School Fees Collected",   val:feeIncome,    pct:100},
              {label:"Other Income",             val:0,            pct:0},
            ].map(r=>(
              <div key={r.label} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #f1f5f9"}}>
                <span style={{fontSize:13,color:"#64748b"}}>{r.label}</span>
                <span style={{fontSize:14,fontWeight:700,color:"#10b981"}}>{fmt(r.val)}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0",fontWeight:800,fontSize:14}}>
              <span>Total Income</span><span style={{color:"#10b981"}}>{fmt(feeIncome)}</span>
            </div>
          </div>

          <div className="fn-card" style={{padding:24}}>
            <div style={{fontWeight:700,fontSize:14,color:"#f43f5e",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#f43f5e"}}/>EXPENDITURE BREAKDOWN
            </div>
            {[
              {label:"Net Salaries Paid",   val:termSalPaid,    color:"#7B2D8B"},
              {label:"NAPSA Contributions", val:termSalaries.reduce((a,p)=>a+Number(p.napsa||0),0), color:"#f59e0b"},
              {label:"Salary Advances",    val:termSalaries.reduce((a,p)=>a+Number(p.advance||0),0),  color:"#f43f5e"},
              ...catBreakdown.map(c=>({label:c.icon+" "+c.label, val:c.total, color:c.color})),
            ].map(r=>(
              <div key={r.label} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #f1f5f9"}}>
                <span style={{fontSize:13,color:"#64748b"}}>{r.label}</span>
                <span style={{fontSize:13,fontWeight:600,color:r.color||"#f43f5e"}}>{fmt(r.val)}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0",fontWeight:800,fontSize:14}}>
              <span>Total Expenditure</span><span style={{color:"#f43f5e"}}>{fmt(termSalPaid+termExpTotal)}</span>
            </div>
          </div>
        </div>
      </>}

      {/* ── REPORTS ───────────────────────────────────────── */}
      {activeTab==="reports" && <>
        <div className="fn-card" style={{padding:26,marginBottom:14}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,marginBottom:2}}>Term Financial Statement</div>
          <div style={{fontSize:13,color:"#94a3b8",marginBottom:22}}>{activeTerm} · Jemareen Academy · Generated {new Date().toLocaleDateString()}</div>
          <div className="fn-2col" style={{gap:20}}>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:"#10b981",marginBottom:12,display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:"#10b981"}}/>EXPENDITURE — SALARIES</div>
              {[
                {label:"Gross Salary Bill",     val:totalGrossPayroll * 3},
                {label:"NAPSA Contributions",   val:totalNAPSA * 3},
                {label:"Salary Advances",      val:totalAdvances * 3},
                {label:"Loan Deductions",        val:totalLoans * 3},
                {label:"Net Salaries Paid",      val:termSalPaid},
              ].map(r=>(
                <div key={r.label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                  <span style={{fontSize:13,color:"#64748b"}}>{r.label}</span>
                  <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{fmt(r.val)}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:"#f43f5e",marginBottom:12,display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:"#f43f5e"}}/>EXPENDITURE — OPERATIONS</div>
              {catBreakdown.length===0 && <div style={{color:"#94a3b8",fontSize:13}}>No expenses recorded.</div>}
              {catBreakdown.map(c=>(
                <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                  <span style={{fontSize:13,color:"#64748b"}}>{c.icon} {c.label}</span>
                  <span style={{fontSize:13,fontWeight:600,color:"#f43f5e"}}>{fmt(c.total)}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",fontWeight:800,fontSize:14}}>
                <span>Total Operational</span><span style={{color:"#f43f5e"}}>{fmt(termExpTotal)}</span>
              </div>
            </div>
          </div>
          <div style={{marginTop:20,padding:16,background:"#FEFCFF",borderRadius:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:700,fontSize:15,color:"#1e293b"}}>Total Term Outflow</span>
            <span style={{fontWeight:800,fontSize:22,color:"#f43f5e",fontFamily:"Georgia,serif"}}>{fmt(termSalPaid+termExpTotal)}</span>
          </div>
        </div>

        <div className="fn-card" style={{padding:24}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>Monthly Salary Payments — {activeTerm}</div>
          {MONTHS.map(month=>{
            const mPays = salaryPayments.filter(p=>p.month===month&&p.year===activeYear&&p.term===activeTerm&&p.paid);
            if(mPays.length===0) return null;
            return (
              <div key={month} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #f8fafc"}}>
                <span style={{fontSize:13,fontWeight:600,color:"#475569",width:90}}>{month}</span>
                <span style={{fontSize:12,color:"#94a3b8"}}>{mPays.length} staff paid</span>
                <span style={{fontSize:15,fontWeight:800,color:"#7B2D8B",fontFamily:"Georgia,serif"}}>{fmt(mPays.reduce((a,p)=>a+Number(p.net||0),0))}</span>
              </div>
            );
          })}
        </div>
      </>}

      {/* ── PAYSLIP MODAL ─────────────────────────────────── */}
      {showPayslip && (()=>{
        const s=showPayslip;
        return (
          <div className="fn-overlay" onClick={()=>setShowPayslip(null)}>
            <div className="fn-modal" onClick={e=>e.stopPropagation()} style={{maxWidth:380}}>
              <div className="fn-modal-handle"/>
              <div style={{textAlign:"center",background:"#1c1405",borderRadius:14,padding:20,marginBottom:20}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)",letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Jemareen Academy</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:"#fff"}}>Official Payslip</div>
                <div style={{fontSize:12,color:"#fbbf24",marginTop:2}}>{activeMonth} {activeYear}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                <div style={{width:44,height:44,borderRadius:"50%",background:avatarColor(s.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#fff"}}>{initials(s.name)}</div>
                <div><div style={{fontWeight:700,fontSize:16}}>{s.name}</div><div style={{fontSize:12,color:"#94a3b8"}}>{s.role}</div></div>
              </div>
              <div style={{background:"#FEFCFF",border:"1px solid #e2e8f0",borderRadius:14,overflow:"hidden",marginBottom:14}}>
                <div style={{padding:"10px 16px",background:"#F0E8F5",fontSize:11,fontWeight:800,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".07em"}}>Earnings</div>
                <div style={{padding:"0 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0"}}>
                    <span style={{fontSize:13,color:"#64748b"}}>Basic Salary</span>
                    <span style={{fontSize:13,fontWeight:700,color:"#10b981"}}>{fmt(s.gross)}</span>
                  </div>
                </div>
                <div style={{padding:"10px 16px",background:"#F0E8F5",fontSize:11,fontWeight:800,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".07em"}}>Deductions</div>
                <div style={{padding:"0 16px"}}>
                  {s.napsa>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #e9ecf3"}}><span style={{fontSize:13,color:"#64748b"}}>NAPSA (5%)</span><span style={{fontSize:13,fontWeight:600,color:"#f43f5e"}}>-{fmt(s.napsa)}</span></div>}
                  {Number(s.advance||0)>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #e9ecf3"}}><span style={{fontSize:13,color:"#64748b"}}>Salary Advance</span><span style={{fontSize:13,fontWeight:600,color:"#9B3DAB"}}>-{fmt(s.advance)}</span></div>}
                  {Number(s.loan)>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"10px 0"}}><span style={{fontSize:13,color:"#64748b"}}>Loan Repayment</span><span style={{fontSize:13,fontWeight:600,color:"#f43f5e"}}>-{fmt(s.loan)}</span></div>}
                </div>
                <div style={{padding:"14px 16px",background:"linear-gradient(135deg,#1e293b,#334155)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>NET PAY</span>
                  <span style={{fontSize:22,fontWeight:800,color:"#fbbf24",fontFamily:"Georgia,serif"}}>{fmt(s.net)}</span>
                </div>
              </div>
              <div style={{fontSize:11,color:"#94a3b8",textAlign:"center",marginBottom:14}}>Generated by EduPay · Jemareen Academy Finance System</div>
              <button className="fn-btn" onClick={()=>setShowPayslip(null)} style={{width:"100%",background:"#7B2D8B",color:"#fff"}}>Close</button>
            </div>
          </div>
        );
      })()}

      {/* ── ADD STAFF MODAL ────────────────────────────────── */}
      {showAddStaff && (
        <div className="fn-overlay" onClick={()=>setShowAddStaff(false)}>
          <div className="fn-modal" onClick={e=>e.stopPropagation()}>
              <div className="fn-modal-handle"/>
            <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,marginBottom:6}}>Add Staff Member</div>
            <p style={{fontSize:13,color:"#94a3b8",marginBottom:22}}>Add a new employee to Jemareen Academy's payroll.</p>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Full Name *</label>
                <input className="fn-inp" placeholder="e.g. Mrs. Grace Mwale" value={newStaff.name} onChange={e=>setNewStaff(p=>({...p,name:e.target.value}))} /></div>
              <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Role *</label>
                <select className="fn-inp" value={newStaff.role} onChange={e=>setNewStaff(p=>({...p,role:e.target.value}))}>{ROLES.map(r=><option key={r}>{r}</option>)}</select></div>
              <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Gross Monthly Salary (ZMW) *</label>
                <input className="fn-inp" type="number" placeholder="e.g. 4800" value={newStaff.gross} onChange={e=>setNewStaff(p=>({...p,gross:e.target.value}))} /></div>
              <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Monthly Loan Deduction (ZMW)</label>
                <input className="fn-inp" type="number" placeholder="0" value={newStaff.loan} onChange={e=>setNewStaff(p=>({...p,loan:e.target.value}))} /></div>
              <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Salary Advance (deducted on 15th)</label>
                <input className="fn-inp" type="number" placeholder="0" value={newStaff.advance} onChange={e=>setNewStaff(p=>({...p,advance:e.target.value}))} />
                <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Amount already paid mid-month — deducted from final pay</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",cursor:"pointer"}} onClick={()=>setNewStaff(p=>({...p,napsa:!p.napsa}))}>
                <div className={`fn-check ${newStaff.napsa?"on":""}`}>{newStaff.napsa&&<span style={{color:"#fff",fontSize:11,fontWeight:800}}>✓</span>}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>NAPSA (5%)</div>
                  {newStaff.gross&&<div style={{fontSize:11,color:"#94a3b8"}}>= {fmt(calcNAPSA(parseFloat(newStaff.gross)||0))}/month</div>}
                </div>
              </div>
              {newStaff.gross && (
                <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:14,display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:13,color:"#065f46"}}>Estimated Net Pay</span>
                  <span style={{fontSize:16,fontWeight:800,color:"#10b981",fontFamily:"Georgia,serif"}}>{fmt(calcNet(parseFloat(newStaff.gross)||0,newStaff.napsa?calcNAPSA(parseFloat(newStaff.gross)):0,parseFloat(newStaff.advance||0),parseFloat(newStaff.loan)||0))}</span>
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,marginTop:24}}>
              <button className="fn-btn" onClick={()=>setShowAddStaff(false)} style={{background:"#F0E8F5",color:"#64748b",flex:1}}>Cancel</button>
              <button className="fn-btn" onClick={handleAddStaff} style={{background:"#7B2D8B",color:"#fff",flex:2}}>Add to Payroll</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT STAFF MODAL ───────────────────────────────── */}
      {showEditStaff && (
        <div className="fn-overlay" onClick={()=>setShowEditStaff(null)}>
          <div className="fn-modal" onClick={e=>e.stopPropagation()}>
              <div className="fn-modal-handle"/>
            <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,marginBottom:6}}>✏️ Edit Staff Member</div>
            <p style={{fontSize:13,color:"#94a3b8",marginBottom:22}}>Update details for {showEditStaff.name}.</p>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Full Name *</label>
                <input className="fn-inp" placeholder="e.g. Mrs. Grace Mwale" value={editStaffForm.name} onChange={e=>setEditStaffForm(p=>({...p,name:e.target.value}))} />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Role *</label>
                <select className="fn-inp" value={editStaffForm.role} onChange={e=>setEditStaffForm(p=>({...p,role:e.target.value}))}>
                  {ROLES.map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Gross Monthly Salary (ZMW) *</label>
                <input className="fn-inp" type="number" placeholder="e.g. 4800" value={editStaffForm.gross} onChange={e=>setEditStaffForm(p=>({...p,gross:e.target.value}))} />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Salary Advance (deducted on 15th)</label>
                <input className="fn-inp" type="number" placeholder="0" value={editStaffForm.advance} onChange={e=>setEditStaffForm(p=>({...p,advance:e.target.value}))} />
                <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Amount paid mid-month — deducted from final salary</div>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Monthly Loan Deduction (ZMW)</label>
                <input className="fn-inp" type="number" placeholder="0" value={editStaffForm.loan} onChange={e=>setEditStaffForm(p=>({...p,loan:e.target.value}))} />
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",cursor:"pointer"}} onClick={()=>setEditStaffForm(p=>({...p,napsa:!p.napsa}))}>
                <div className={`fn-check ${editStaffForm.napsa?"on":""}`}>{editStaffForm.napsa&&<span style={{color:"#fff",fontSize:11,fontWeight:800}}>✓</span>}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>NAPSA (5%)</div>
                  {editStaffForm.gross&&<div style={{fontSize:11,color:"#94a3b8"}}>= {fmt(calcNAPSA(parseFloat(editStaffForm.gross)||0))}/month</div>}
                </div>
              </div>
              {editStaffForm.gross && (
                <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:14,display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:13,color:"#065f46"}}>Updated Net Pay</span>
                  <span style={{fontSize:16,fontWeight:800,color:"#10b981",fontFamily:"Georgia,serif"}}>
                    {fmt(calcNet(parseFloat(editStaffForm.gross)||0, editStaffForm.napsa?calcNAPSA(parseFloat(editStaffForm.gross)):0, parseFloat(editStaffForm.advance||0), parseFloat(editStaffForm.loan||0)))}
                  </span>
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,marginTop:24}}>
              <button className="fn-btn" onClick={()=>setShowEditStaff(null)} style={{background:"#F0E8F5",color:"#64748b",flex:1}}>Cancel</button>
              <button className="fn-btn" onClick={handleEditStaff} style={{background:"#7B2D8B",color:"#fff",flex:2}}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD EXPENSE MODAL ──────────────────────────────── */}
      {showAddExpense && (
        <div className="fn-overlay" onClick={()=>setShowAddExpense(false)}>
          <div className="fn-modal" onClick={e=>e.stopPropagation()}>
              <div className="fn-modal-handle"/>
            <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,marginBottom:6}}>Record Expense</div>
            <p style={{fontSize:13,color:"#94a3b8",marginBottom:18}}>Log a school expenditure for {activeTerm}.</p>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>Category *</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {EXP_CATEGORIES.map(c=>(
                    <div key={c.id} onClick={()=>setNewExpense(p=>({...p,category:c.id}))}
                      style={{border:`2px solid ${newExpense.category===c.id?c.color:"#e2e8f0"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",background:newExpense.category===c.id?c.color+"10":"#FEFCFF",transition:"all .15s"}}>
                      <div style={{fontSize:16,marginBottom:2}}>{c.icon}</div>
                      <div style={{fontSize:12,fontWeight:700,color:newExpense.category===c.id?c.color:"#475569"}}>{c.label}</div>
                      <div style={{fontSize:10,color:"#94a3b8"}}>{c.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Description *</label>
                <input className="fn-inp" placeholder="e.g. ZESCO electricity bill" value={newExpense.description} onChange={e=>setNewExpense(p=>({...p,description:e.target.value}))} /></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Amount (ZMW) *</label>
                  <input className="fn-inp" type="number" placeholder="e.g. 1850" value={newExpense.amount} onChange={e=>setNewExpense(p=>({...p,amount:e.target.value}))} /></div>
                <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Date</label>
                  <input className="fn-inp" type="date" value={newExpense.date} onChange={e=>setNewExpense(p=>({...p,date:e.target.value}))} /></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Payment Method</label>
                  <select className="fn-inp" value={newExpense.method} onChange={e=>setNewExpense(p=>({...p,method:e.target.value}))}>{METHODS.map(m=><option key={m}>{m}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Receipt No.</label>
                  <input className="fn-inp" placeholder="e.g. REC-011" value={newExpense.receipt} onChange={e=>setNewExpense(p=>({...p,receipt:e.target.value}))} /></div>
              </div>
              <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Approved By</label>
                <select className="fn-inp" value={newExpense.approvedBy} onChange={e=>setNewExpense(p=>({...p,approvedBy:e.target.value}))}>
                  <option>Principal</option><option>Bursar</option><option>Head Teacher</option>
                </select></div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:24}}>
              <button className="fn-btn" onClick={()=>setShowAddExpense(false)} style={{background:"#F0E8F5",color:"#64748b",flex:1}}>Cancel</button>
              <button className="fn-btn" onClick={handleAddExpense} style={{background:"#7B2D8B",color:"#fff",flex:2}}>Save to Firebase</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAY SALARY CONFIRM ─────────────────────────────── */}
      {showPaySalary && (()=>{
        const s=showPaySalary;
        const gross=Number(s.gross); const napsa=s.napsa?calcNAPSA(gross):0; const advance=Number(s.advance||0); const loan=Number(s.loan||0); const net=calcNet(gross,napsa,advance,loan);
        return (
          <div className="fn-overlay" onClick={()=>setShowPaySalary(null)}>
            <div className="fn-modal" onClick={e=>e.stopPropagation()} style={{maxWidth:380,textAlign:"center"}}>
              <div className="fn-modal-handle"/>
              <div style={{fontSize:40,marginBottom:14}}>💼</div>
              <div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,marginBottom:8}}>Confirm Payment</div>
              <div style={{background:"#FEFCFF",border:"1px solid #e2e8f0",borderRadius:14,padding:18,marginBottom:20,textAlign:"left"}}>
                <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{s.name}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginBottom:12}}>{s.role} · {activeMonth} {activeYear}</div>
                {[["Gross",fmt(gross)],["NAPSA",fmt(napsa)],["Advance",fmt(advance)],["Loan",fmt(loan)],["Net Pay",fmt(net)]].map(([k,v],i)=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<4?"1px solid #e9ecf3":"none",fontWeight:i===4?800:400}}>
                    <span style={{fontSize:13,color:i===4?"#1e293b":"#64748b"}}>{k}</span>
                    <span style={{fontSize:13,color:i===4?"#10b981":"#475569"}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button className="fn-btn" onClick={()=>setShowPaySalary(null)} style={{background:"#F0E8F5",color:"#64748b",flex:1}}>Cancel</button>
                <button className="fn-btn" onClick={()=>handleRecordSalaryPayment(showPaySalary)} style={{background:"#10b981",color:"#fff",flex:2}}>✓ Confirm & Save</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── EDIT BUDGETS MODAL ────────────────────────────── */}
      {showEditBudgets && (
        <div className="fn-overlay" onClick={()=>setShowEditBudgets(false)}>
          <div className="fn-modal" onClick={e=>e.stopPropagation()} style={{width:500}}>
              <div className="fn-modal-handle"/>
            <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,marginBottom:4}}>🎯 Set Budget Limits</div>
            <p style={{fontSize:13,color:"#94a3b8",marginBottom:22}}>Set a spending limit per category for {activeTerm}. The app will warn at 80% and block entries that exceed the limit.</p>
            <div style={{display:"flex",flexDirection:"column",gap:12,maxHeight:400,overflowY:"auto"}}>
              {EXP_CATEGORIES.map(cat => {
                const current = budgets[cat.id]||0;
                const spent = catBreakdown.find(c=>c.id===cat.id)?.total||0;
                return (
                  <div key={cat.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0",borderBottom:"1px solid #f1f5f9"}}>
                    <span style={{fontSize:20,width:28}}>{cat.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#1e293b",marginBottom:2}}>{cat.label}</div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>Currently spent: {fmt(spent)}</div>
                    </div>
                    <div style={{width:160}}>
                      <input className="fn-inp" type="number" placeholder="No limit"
                        defaultValue={current||""}
                        onChange={e=>setEditBudgets(prev=>({...prev,[cat.id]:parseFloat(e.target.value)||0}))}
                        style={{textAlign:"right"}} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:12,marginTop:16,fontSize:12,color:"#92400e"}}>
              💡 Set to 0 or leave blank to remove the budget limit for that category.
            </div>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button className="fn-btn" onClick={()=>setShowEditBudgets(false)} style={{background:"#F0E8F5",color:"#64748b",flex:1}}>Cancel</button>
              <button className="fn-btn" onClick={handleSaveBudgets} style={{background:"#7B2D8B",color:"#fff",flex:2}}>Save Budget Limits</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BUDGET BLOCKED WARNING ────────────────────────── */}
      {blockedWarning && (
        <div className="fn-overlay" onClick={()=>setBlockedWarning(null)}>
          <div className="fn-modal" onClick={e=>e.stopPropagation()} style={{maxWidth:380,textAlign:"center"}}>
              <div className="fn-modal-handle"/>
            <div style={{fontSize:52,marginBottom:14}}>🚫</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:"#f43f5e",marginBottom:8}}>Budget Limit Exceeded</div>
            <p style={{fontSize:13,color:"#64748b",marginBottom:20,lineHeight:1.7}}>
              This expense of <strong>{fmt(blockedWarning.amount)}</strong> would exceed the budget for <strong>{blockedWarning.cat?.label}</strong>.<br/>
              Only <strong style={{color:"#f43f5e"}}>{fmt(blockedWarning.remaining)}</strong> remains in this category's budget.
            </p>
            <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:12,padding:14,marginBottom:20,fontSize:13,color:"#991b1b"}}>
              To proceed, either reduce the amount to <strong>{fmt(blockedWarning.remaining)}</strong> or less, or increase the budget limit in the Budgets tab.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="fn-btn" onClick={()=>setBlockedWarning(null)} style={{background:"#F0E8F5",color:"#64748b",flex:1}}>Go Back</button>
              <button className="fn-btn" onClick={()=>{setBlockedWarning(null);setShowEditBudgets(true);}} style={{background:"#7B2D8B",color:"#fff",flex:2}}>Increase Budget</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{position:"fixed",bottom:22,right:22,zIndex:300,animation:"slideUp .3s ease"}}>
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div style={{background:"#1e293b",color:"#e2e8f0",borderRadius:12,padding:"13px 20px",fontSize:13,fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,.2)",display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:"#10b981"}}>✓</span>{toast}
          </div>
        </div>
      )}
    </div>
  );
}
