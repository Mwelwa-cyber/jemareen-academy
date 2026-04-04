import { useMemo } from "react";

const TERMS = ["Term 1 2026", "Term 2 2026", "Term 3 2026"];
const TERM_SHORT = ["T1", "T2", "T3"];
const fmt = n => `K${Number(n || 0).toLocaleString()}`;
const TERM_COLORS = ["#7B2D8B", "#10b981", "#f59e0b"];

export default function AnnualSummary({ payments, salaryPayments, expenses }) {

  const termData = useMemo(() => TERMS.map((term, i) => {
    const termPayments = payments.filter(p => p.term === term);
    const feeIncome    = termPayments.reduce((a, p) => a + Number(p.amount || 0), 0);
    const termSalaries = salaryPayments.filter(p => p.term === term && p.paid);
    const salariesPaid = termSalaries.reduce((a, p) => a + Number(p.net || 0), 0);
    const napsaPaid    = termSalaries.reduce((a, p) => a + Number(p.napsa || 0), 0);
    const advancesPaid = termSalaries.reduce((a, p) => a + Number(p.advance || 0), 0);
    const termExpenses = expenses.filter(e => e.term === term);
    const opsTotal     = termExpenses.reduce((a, e) => a + Number(e.amount || 0), 0);
    const totalOut     = salariesPaid + napsaPaid + advancesPaid + opsTotal;
    const netPos       = feeIncome - totalOut;
    return { term, color: TERM_COLORS[i], feeIncome, salariesPaid, napsaPaid, advancesPaid, opsTotal, totalOut, netPos, txCount: termPayments.length, expCount: termExpenses.length };
  }), [payments, salaryPayments, expenses]);

  const annual = useMemo(() => ({
    feeIncome:    termData.reduce((a, t) => a + t.feeIncome, 0),
    salariesPaid: termData.reduce((a, t) => a + t.salariesPaid, 0),
    napsaPaid:    termData.reduce((a, t) => a + t.napsaPaid, 0),
    opsTotal:     termData.reduce((a, t) => a + t.opsTotal, 0),
    totalOut:     termData.reduce((a, t) => a + t.totalOut, 0),
    netPos:       termData.reduce((a, t) => a + t.netPos, 0),
  }), [termData]);

  const maxBar = Math.max(...termData.map(t => Math.max(t.feeIncome, t.totalOut)), 1);

  return (
    <div style={{ fontFamily: "'Outfit',sans-serif" }}>
      <style>{`
        .an-card{background:#fff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);margin-bottom:14px;}
        .an-kpi{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}
        @media(min-width:640px){.an-kpi{grid-template-columns:repeat(4,1fr);}}
        .an-terms{display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:14px;}
        @media(min-width:640px){.an-terms{grid-template-columns:repeat(3,1fr);}}
        .an-cols{display:grid;grid-template-columns:1fr;gap:16px;}
        @media(min-width:640px){.an-cols{grid-template-columns:1fr 1fr;}}
        .an-bar{background:#e2e8f0;border-radius:99px;height:10px;overflow:hidden;}
        .an-bf{height:100%;border-radius:99px;transition:width .8s cubic-bezier(.4,0,.2,1);}
        .an-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f8fafc;font-size:14px;}
      `}</style>

      {/* Year header */}
      <div className="an-card" style={{ background:"linear-gradient(135deg,#1c1405,#2d1f0a)", padding:"20px 20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.45)", letterSpacing:".1em", textTransform:"uppercase", marginBottom:6 }}>Jemareen Academy</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:"#fff" }}>Annual Summary</div>
            <div style={{ fontSize:13, color:"#fbbf24", marginTop:2 }}>Academic Year 2026 · All 3 Terms</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.45)", marginBottom:4 }}>Net Position</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:800, color: annual.netPos >= 0 ? "#34d399" : "#f87171" }}>
              {annual.netPos >= 0 ? "+" : ""}{fmt(annual.netPos)}
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.4)" }}>{annual.netPos >= 0 ? "Surplus ✅" : "Deficit ⚠️"}</div>
          </div>
        </div>
      </div>

      {/* Annual KPI cards */}
      <div className="an-kpi">
        {[
          { label:"Fees Collected", val:fmt(annual.feeIncome),    accent:"#10b981" },
          { label:"Salaries Paid",  val:fmt(annual.salariesPaid), accent:"#7B2D8B" },
          { label:"Operations",     val:fmt(annual.opsTotal),     accent:"#f59e0b" },
          { label:"Total Outflow",  val:fmt(annual.totalOut),     accent:"#f43f5e" },
        ].map(k => (
          <div key={k.label} className="an-card" style={{ padding:"16px", marginBottom:0 }}>
            <div style={{ fontSize:10, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".07em", marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:k.accent, fontFamily:"'Playfair Display',serif" }}>{k.val}</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>Full year</div>
          </div>
        ))}
      </div>

      {/* Term cards — stack on mobile, 3-col on desktop */}
      <div className="an-terms">
        {termData.map(t => {
          const surplus = t.netPos >= 0;
          return (
            <div key={t.term} className="an-card" style={{ borderTop:`4px solid ${t.color}`, padding:"18px" }}>
              <div style={{ fontWeight:800, fontSize:15, color:t.color, marginBottom:2 }}>{t.term}</div>
              <div style={{ fontSize:11, color:"#94a3b8", marginBottom:14 }}>{t.txCount} payments · {t.expCount} expenses</div>
              {[
                { label:"Fee Income",    val:t.feeIncome,    color:"#10b981" },
                { label:"Salaries",      val:t.salariesPaid, color:"#7B2D8B" },
                { label:"NAPSA",         val:t.napsaPaid,    color:"#f59e0b" },
                { label:"Operations",    val:t.opsTotal,     color:"#f43f5e" },
                { label:"Total Out",     val:t.totalOut,     color:"#475569" },
              ].map(r => (
                <div key={r.label} className="an-row">
                  <span style={{ color:"#64748b" }}>{r.label}</span>
                  <span style={{ fontWeight:700, color:r.color }}>{fmt(r.val)}</span>
                </div>
              ))}
              <div style={{ marginTop:12, padding:"12px 14px", background:surplus?"#f0fdf4":"#fff5f5", borderRadius:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:13, fontWeight:700, color:surplus?"#065f46":"#991b1b" }}>{surplus?"Surplus":"Deficit"}</span>
                <span style={{ fontSize:18, fontWeight:800, color:surplus?"#10b981":"#f43f5e", fontFamily:"'Playfair Display',serif" }}>
                  {surplus?"+":""}{fmt(t.netPos)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual comparison bars */}
      <div className="an-card" style={{ padding:"20px" }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:18 }}>Income vs Expenditure</div>
        {termData.map((t, i) => (
          <div key={t.term} style={{ marginBottom:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ fontSize:14, fontWeight:700, color:t.color }}>{TERM_SHORT[i]} — {t.term}</span>
              <span style={{ fontSize:13, fontWeight:700, color:t.netPos>=0?"#10b981":"#f43f5e" }}>
                {t.netPos>=0?"+":""}{fmt(t.netPos)}
              </span>
            </div>
            <div style={{ marginBottom:5 }}>
              <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>📥 Income: {fmt(t.feeIncome)}</div>
              <div className="an-bar"><div className="an-bf" style={{ width:`${Math.round(t.feeIncome/maxBar*100)}%`, background:"#10b981" }} /></div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>📤 Expenditure: {fmt(t.totalOut)}</div>
              <div className="an-bar"><div className="an-bf" style={{ width:`${Math.round(t.totalOut/maxBar*100)}%`, background:"#f43f5e" }} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Full year table — scrollable on mobile */}
      <div className="an-card" style={{ padding:"20px" }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>Full Year Table</div>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:460 }}>
            <thead>
              <tr style={{ borderBottom:"2px solid #f1f5f9" }}>
                <th style={{ padding:"10px 12px", textAlign:"left", fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".07em" }}>Line Item</th>
                {TERMS.map((t,i) => <th key={t} style={{ padding:"10px 12px", textAlign:"right", fontSize:11, color:TERM_COLORS[i], fontWeight:800 }}>{TERM_SHORT[i]}</th>)}
                <th style={{ padding:"10px 12px", textAlign:"right", fontSize:11, color:"#1e293b", fontWeight:800, borderLeft:"2px solid #f1f5f9" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label:"Fee Income",     key:"feeIncome",    annual:annual.feeIncome,    color:"#10b981", bold:true  },
                { label:"Net Salaries",   key:"salariesPaid", annual:annual.salariesPaid, color:"#7B2D8B"             },
                { label:"NAPSA",          key:"napsaPaid",    annual:annual.napsaPaid,    color:"#f59e0b"             },
                { label:"Operations",     key:"opsTotal",     annual:annual.opsTotal,     color:"#f43f5e"             },
                { label:"Total Out",      key:"totalOut",     annual:annual.totalOut,     color:"#f43f5e", bold:true  },
                { label:"Net Position",   key:"netPos",       annual:annual.netPos,       color:annual.netPos>=0?"#10b981":"#f43f5e", bold:true },
              ].map(row => (
                <tr key={row.label} style={{ borderBottom:"1px solid #f8fafc", background:row.bold?"#fafafa":"#fff" }}>
                  <td style={{ padding:"11px 12px", fontSize:14, fontWeight:row.bold?700:400, color:"#475569" }}>{row.label}</td>
                  {termData.map(t => (
                    <td key={t.term} style={{ padding:"11px 12px", textAlign:"right", fontSize:14, fontWeight:row.bold?800:500, color:row.color }}>
                      {fmt(t[row.key])}
                    </td>
                  ))}
                  <td style={{ padding:"11px 12px", textAlign:"right", fontSize:14, fontWeight:800, color:row.color, borderLeft:"2px solid #f1f5f9" }}>
                    {row.key==="netPos"&&annual.netPos>0?"+":" "}{fmt(row.annual)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
