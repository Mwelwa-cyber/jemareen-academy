import { useState, useEffect, useMemo } from "react";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const PETTY_CATS = [
  { id:"transport",   label:"Transport",     icon:"🚌", color:"#06b6d4" },
  { id:"refreshments",label:"Refreshments",  icon:"☕", color:"#f59e0b" },
  { id:"printing",    label:"Printing",      icon:"🖨️", color:"#7B2D8B" },
  { id:"cleaning",    label:"Cleaning",      icon:"🧹", color:"#10b981" },
  { id:"hardware",    label:"Hardware/Tools",icon:"🔩", color:"#64748b" },
  { id:"postage",     label:"Postage/Airtime",icon:"📱",color:"#ec4899" },
  { id:"other",       label:"Other",         icon:"📋", color:"#94a3b8" },
];

const fmt = n => `K${Number(n || 0).toLocaleString()}`;

export default function PettyCash({ user }) {
  const [entries, setEntries]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [filterType, setFilterType]= useState("all");
  const [toast, setToast]         = useState(null);

  const [newEntry, setNewEntry] = useState({
    type: "expense", category:"transport", description:"", amount:"",
    date: new Date().toISOString().split("T")[0], receipt:"", paidTo:""
  });
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpNote,   setTopUpNote]   = useState("");

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(null),3000); };

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db,"pettyCash"), orderBy("date","desc"), orderBy("createdAt","desc")),
      snap => { setEntries(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const stats = useMemo(() => {
    const totalTopUps   = entries.filter(e=>e.type==="topup").reduce((a,e)=>a+Number(e.amount||0),0);
    const totalSpent    = entries.filter(e=>e.type==="expense").reduce((a,e)=>a+Number(e.amount||0),0);
    const balance       = totalTopUps - totalSpent;
    const todayStr      = new Date().toISOString().split("T")[0];
    const todaySpent    = entries.filter(e=>e.type==="expense"&&e.date===todayStr).reduce((a,e)=>a+Number(e.amount||0),0);
    const thisMonth     = new Date().toLocaleString("default",{month:"long"});
    const monthSpent    = entries.filter(e=>e.type==="expense"&&e.date?.includes(new Date().getFullYear())&&e.date?.slice(5,7)===String(new Date().getMonth()+1).padStart(2,"0")).reduce((a,e)=>a+Number(e.amount||0),0);
    return { totalTopUps, totalSpent, balance, todaySpent, monthSpent };
  }, [entries]);

  const filtered = useMemo(() => {
    let rows = entries;
    if (filterCat  !== "all") rows = rows.filter(e=>e.category===filterCat);
    if (filterType !== "all") rows = rows.filter(e=>e.type===filterType);
    return rows;
  }, [entries, filterCat, filterType]);

  const catTotals = useMemo(() => PETTY_CATS.map(cat => ({
    ...cat,
    total: entries.filter(e=>e.type==="expense"&&e.category===cat.id).reduce((a,e)=>a+Number(e.amount||0),0)
  })).filter(c=>c.total>0).sort((a,b)=>b.total-a.total), [entries]);

  const handleAddExpense = async () => {
    if (!newEntry.description || !newEntry.amount) { showToast("Fill description and amount."); return; }
    if (Number(newEntry.amount) > stats.balance) { showToast("⚠️ Amount exceeds petty cash balance!"); return; }
    try {
      await addDoc(collection(db,"pettyCash"), {
        ...newEntry, amount: parseFloat(newEntry.amount),
        addedBy: user?.email, createdAt: serverTimestamp(),
      });
      setShowAdd(false);
      setNewEntry({type:"expense",category:"transport",description:"",amount:"",date:new Date().toISOString().split("T")[0],receipt:"",paidTo:""});
      showToast("Petty cash expense recorded!");
    } catch { showToast("Failed to save."); }
  };

  const handleTopUp = async () => {
    if (!topUpAmount) { showToast("Enter top-up amount."); return; }
    try {
      await addDoc(collection(db,"pettyCash"), {
        type:"topup", category:"topup",
        description: topUpNote || "Petty cash top-up",
        amount: parseFloat(topUpAmount),
        date: new Date().toISOString().split("T")[0],
        addedBy: user?.email, createdAt: serverTimestamp(),
      });
      setShowTopUp(false);
      setTopUpAmount("");
      setTopUpNote("");
      showToast(`Petty cash topped up by ${fmt(topUpAmount)}!`);
    } catch { showToast("Failed to save."); }
  };

  if (loading) return <div style={{color:"#94a3b8",padding:40,textAlign:"center"}}>Loading petty cash…</div>;

  return (
    <div style={{fontFamily:"'Outfit',sans-serif"}}>
      <style>{`
        .pc-card{background:#fff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);}
        .pc-btn{border:none;border-radius:12px;padding:13px 18px;font-family:inherit;font-weight:700;font-size:14px;cursor:pointer;transition:all .18s;}
        .pc-btn:active{transform:scale(.97);}
        .pc-inp{width:100%;background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:14px;font-family:inherit;font-size:16px;color:#1e293b;outline:none;transition:border-color .2s;-webkit-appearance:none;}
        .pc-inp:focus{border-color:#7B2D8B;background:#fff;}
        select.pc-inp option{background:#fff;}
        .pc-pill{border:none;border-radius:99px;padding:8px 16px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap;}
        .pc-pill:active{transform:scale(.96);}
        .pc-overlay{position:fixed;inset:0;background:rgba(15,23,42,.6);display:flex;align-items:flex-end;justify-content:center;z-index:200;backdrop-filter:blur(6px);}
        .pc-modal{background:#fff;border-radius:24px 24px 0 0;padding:12px 20px 52px;width:100%;max-height:94vh;overflow-y:auto;}
        .pc-modal-handle{width:44px;height:4px;background:#e2e8f0;border-radius:99px;margin:0 auto 18px;}
        @media(min-width:640px){.pc-overlay{align-items:center;}.pc-modal{border-radius:22px;max-width:460px;padding:32px;width:auto;}.pc-modal-handle{display:none;}}
        .pc-row:hover td{background:#f8fafc;}
        .pc-grid{display:grid;grid-template-columns:1fr;gap:16px;}
        @media(min-width:768px){.pc-grid{grid-template-columns:1fr 280px;}}
      `}</style>

      {/* Action buttons */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <button className="pc-btn" onClick={()=>setShowAdd(true)} style={{background:"#7B2D8B",color:"#fff"}}>+ Record Expense</button>
        <button className="pc-btn" onClick={()=>setShowTopUp(true)} style={{background:"#10b981",color:"#fff"}}>💰 Top Up</button>
      </div>

      {/* Balance card — stacked on mobile */}
      <div className="pc-card" style={{marginBottom:16,background:"linear-gradient(135deg,#1e293b,#334155)",overflow:"hidden"}}>
        <div style={{padding:"20px 20px 16px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,.45)",letterSpacing:".1em",textTransform:"uppercase",marginBottom:6}}>Petty Cash Balance</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:800,color:stats.balance>=0?"#fbbf24":"#f87171"}}>{fmt(stats.balance)}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginTop:4}}>{stats.balance<500?"⚠️ Balance low — top up soon":"✓ Balance healthy"}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",padding:"14px 16px",gap:8}}>
          {[
            {label:"Today",     val:fmt(stats.todaySpent),  color:"#f87171"},
            {label:"Month",     val:fmt(stats.monthSpent),  color:"#fbbf24"},
            {label:"Topped Up", val:fmt(stats.totalTopUps), color:"#34d399"},
            {label:"All Spent", val:fmt(stats.totalSpent),  color:"#818cf8"},
          ].map(s=>(
            <div key={s.label} style={{textAlign:"center"}}>
              <div style={{fontSize:14,fontWeight:800,color:s.color}}>{s.val}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pc-grid">
        {/* Ledger */}
        <div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            {[{id:"all",label:"All"},{id:"expense",label:"Expenses"},{id:"topup",label:"Top-Ups"}].map(f=>(
              <button key={f.id} className="pc-pill" onClick={()=>setFilterType(f.id)}
                style={{background:filterType===f.id?"#7B2D8B":"#F0E8F5",color:filterType===f.id?"#fff":"#64748b",border:"1px solid "+(filterType===f.id?"#7B2D8B":"#e2e8f0")}}>
                {f.label}
              </button>
            ))}
            <select className="pc-inp" style={{width:"auto",fontSize:12}} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
              <option value="all">All Categories</option>
              {PETTY_CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </div>

          <div className="pc-card" style={{overflow:"hidden"}}>
            {filtered.length === 0 ? (
              <div style={{padding:48,textAlign:"center",color:"#94a3b8"}}>
                <div style={{fontSize:36,marginBottom:12}}>💰</div>
                <div style={{fontWeight:600,marginBottom:8}}>No petty cash entries yet</div>
                <button className="pc-btn" onClick={()=>setShowTopUp(true)} style={{background:"#10b981",color:"#fff",marginRight:8}}>Top Up First</button>
                <button className="pc-btn" onClick={()=>setShowAdd(true)} style={{background:"#7B2D8B",color:"#fff"}}>Add Expense</button>
              </div>
            ) : (
              <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
                <thead>
                  <tr style={{borderBottom:"1px solid #f1f5f9",background:"#fafafa"}}>
                    {["Date","Type","Description","Category","Amount","Balance","By"].map(h=>(
                      <th key={h} style={{padding:"11px 14px",textAlign:"left",fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(()=>{
                    let running = 0;
                    const withBalance = [...filtered].reverse().map(e=>{
                      if (e.type==="topup") running += Number(e.amount||0);
                      else running -= Number(e.amount||0);
                      return {...e, runningBalance: running};
                    }).reverse();
                    return withBalance.map((e,i)=>{
                      const cat = PETTY_CATS.find(c=>c.id===e.category);
                      const isTopUp = e.type==="topup";
                      return (
                        <tr key={e.id} className="pc-row" style={{borderBottom:i<withBalance.length-1?"1px solid #f8fafc":"none"}}>
                          <td style={{padding:"11px 14px",fontSize:12,color:"#64748b",whiteSpace:"nowrap"}}>{e.date}</td>
                          <td style={{padding:"11px 14px"}}>
                            <span style={{background:isTopUp?"#d1fae5":"#fee2e2",color:isTopUp?"#065f46":"#991b1b",borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700}}>
                              {isTopUp?"↑ Top Up":"↓ Expense"}
                            </span>
                          </td>
                          <td style={{padding:"11px 14px",fontSize:13,color:"#1e293b",fontWeight:500}}>
                            {e.description}
                            {e.paidTo&&<div style={{fontSize:11,color:"#94a3b8"}}>To: {e.paidTo}</div>}
                            {e.receipt&&<div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace"}}>{e.receipt}</div>}
                          </td>
                          <td style={{padding:"11px 14px"}}>
                            {cat && !isTopUp && <span style={{background:cat.color+"18",color:cat.color,borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700}}>{cat.icon} {cat.label}</span>}
                          </td>
                          <td style={{padding:"11px 14px",fontSize:14,fontWeight:800,color:isTopUp?"#10b981":"#f43f5e"}}>
                            {isTopUp?"+":"-"}{fmt(e.amount)}
                          </td>
                          <td style={{padding:"11px 14px",fontSize:13,fontWeight:700,color:e.runningBalance>=0?"#1e293b":"#f43f5e"}}>
                            {fmt(e.runningBalance)}
                          </td>
                          <td style={{padding:"11px 14px",fontSize:11,color:"#94a3b8"}}>{(e.addedBy||"").split("@")[0]}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table></div>
            )}
          </div>
        </div>

        {/* Category breakdown */}
        <div>
          <div className="pc-card" style={{padding:22,marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:16}}>Spending by Category</div>
            {catTotals.length===0 && <div style={{color:"#94a3b8",fontSize:13,textAlign:"center",padding:16}}>No expenses yet.</div>}
            {catTotals.map(cat=>{
              const pct = stats.totalSpent>0?Math.round(cat.total/stats.totalSpent*100):0;
              return (
                <div key={cat.id} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:12,color:"#475569"}}>{cat.icon} {cat.label}</span>
                    <span style={{fontSize:12,color:"#94a3b8"}}>{fmt(cat.total)}</span>
                  </div>
                  <div style={{background:"#e2e8f0",borderRadius:99,height:6,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:99,background:cat.color,width:`${pct}%`,transition:"width .7s"}} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent transactions */}
          <div className="pc-card" style={{padding:22}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Recent 5 Transactions</div>
            {entries.slice(0,5).map(e=>{
              const cat = PETTY_CATS.find(c=>c.id===e.category);
              const isTopUp = e.type==="topup";
              return (
                <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f8fafc"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:"#1e293b"}}>{e.description.slice(0,28)}</div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>{e.date} {cat&&!isTopUp?`· ${cat.icon} ${cat.label}`:""}</div>
                  </div>
                  <span style={{fontSize:13,fontWeight:800,color:isTopUp?"#10b981":"#f43f5e"}}>{isTopUp?"+":"-"}{fmt(e.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ADD EXPENSE MODAL ── */}
      {showAdd && (
        <div className="pc-overlay" onClick={()=>setShowAdd(false)}>
          <div className="pc-modal" onClick={e=>e.stopPropagation()}>
              <div className="pc-modal-handle"/>
              <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,marginBottom:6}}>💰 Record Petty Cash Expense</div>
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:12,marginBottom:20,fontSize:13,color:"#065f46",display:"flex",justifyContent:"space-between"}}>
              <span>Available balance:</span><strong>{fmt(stats.balance)}</strong>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>Category *</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {PETTY_CATS.map(c=>(
                    <div key={c.id} onClick={()=>setNewEntry(p=>({...p,category:c.id}))}
                      style={{border:`2px solid ${newEntry.category===c.id?c.color:"#e2e8f0"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",background:newEntry.category===c.id?c.color+"10":"#FEFCFF",transition:"all .15s"}}>
                      <div style={{fontSize:16}}>{c.icon}</div>
                      <div style={{fontSize:12,fontWeight:700,color:newEntry.category===c.id?c.color:"#475569",marginTop:2}}>{c.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Description *</label>
                <input className="pc-inp" placeholder="e.g. Taxi fare to town" value={newEntry.description} onChange={e=>setNewEntry(p=>({...p,description:e.target.value}))} /></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Amount (ZMW) *</label>
                  <input className="pc-inp" type="number" placeholder="e.g. 50" value={newEntry.amount} onChange={e=>setNewEntry(p=>({...p,amount:e.target.value}))} /></div>
                <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Date</label>
                  <input className="pc-inp" type="date" value={newEntry.date} onChange={e=>setNewEntry(p=>({...p,date:e.target.value}))} /></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Paid To</label>
                  <input className="pc-inp" placeholder="e.g. Mr. Daka" value={newEntry.paidTo} onChange={e=>setNewEntry(p=>({...p,paidTo:e.target.value}))} /></div>
                <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Receipt No.</label>
                  <input className="pc-inp" placeholder="e.g. PCR-001" value={newEntry.receipt} onChange={e=>setNewEntry(p=>({...p,receipt:e.target.value}))} /></div>
              </div>
              {newEntry.amount && Number(newEntry.amount) > stats.balance && (
                <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:10,padding:12,fontSize:13,color:"#991b1b",fontWeight:600}}>
                  ⚠️ This amount exceeds your petty cash balance of {fmt(stats.balance)}. Please top up first.
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,marginTop:24}}>
              <button className="pc-btn" onClick={()=>setShowAdd(false)} style={{background:"#F0E8F5",color:"#64748b",flex:1}}>Cancel</button>
              <button className="pc-btn" onClick={handleAddExpense} style={{background:"#7B2D8B",color:"#fff",flex:2}}>Record Expense</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOP UP MODAL ── */}
      {showTopUp && (
        <div className="pc-overlay" onClick={()=>setShowTopUp(false)}>
          <div className="pc-modal" onClick={e=>e.stopPropagation()} style={{textAlign:"center"}}>
              <div className="pc-modal-handle"/>
            <div style={{fontSize:48,marginBottom:14}}>💰</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,marginBottom:4}}>Top Up Petty Cash</div>
            <p style={{fontSize:13,color:"#64748b",marginBottom:20}}>Current balance: <strong style={{color:"#10b981"}}>{fmt(stats.balance)}</strong></p>
            <div style={{display:"flex",flexDirection:"column",gap:12,textAlign:"left"}}>
              <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Amount to Add (ZMW) *</label>
                <input className="pc-inp" type="number" placeholder="e.g. 500" value={topUpAmount} onChange={e=>setTopUpAmount(e.target.value)} /></div>
              <div><label style={{fontSize:11,fontWeight:700,color:"#94a3b8",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Note (optional)</label>
                <input className="pc-inp" placeholder="e.g. From main account — March" value={topUpNote} onChange={e=>setTopUpNote(e.target.value)} /></div>
              {topUpAmount && (
                <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:12,fontSize:14,color:"#065f46",fontWeight:700,textAlign:"center"}}>
                  New balance will be: {fmt(stats.balance + Number(topUpAmount))}
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button className="pc-btn" onClick={()=>setShowTopUp(false)} style={{background:"#F0E8F5",color:"#64748b",flex:1}}>Cancel</button>
              <button className="pc-btn" onClick={handleTopUp} style={{background:"#10b981",color:"#fff",flex:2}}>✓ Top Up</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{position:"fixed",bottom:22,right:22,zIndex:300,background:"#1e293b",color:"#e2e8f0",borderRadius:12,padding:"13px 20px",fontSize:13,fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,.2)",display:"flex",alignItems:"center",gap:10,animation:"slideUp .3s ease"}}>
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
          {toast}
        </div>
      )}
    </div>
  );
}
