// PrintExport.js — PDF & Print export for all Jemareen Academy documents
// Uses browser's built-in print/save-as-PDF — no extra libraries needed

const SCHOOL = "Jemareen Academy";
const ADDRESS = "Lusaka, Zambia";
const fmt = n => `K${Number(n || 0).toLocaleString()}`;

// ── SHARED PRINT STYLES ────────────────────────────────────────────────────
const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Outfit', sans-serif; color: #1e293b; background: #fff; padding: 32px; font-size: 13px; }
  h1 { font-size: 22px; font-weight: 800; }
  h2 { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #1e293b; color: #fff; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 3px solid #1c1405; }
  .school-name { font-size: 24px; font-weight: 800; color: #1c1405; }
  .school-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }
  .badge { display: inline-block; border-radius: 99px; padding: 3px 12px; font-size: 11px; font-weight: 700; }
  .green { background: #d1fae5; color: #065f46; }
  .red { background: #fee2e2; color: #991b1b; }
  .amber { background: #fef3c7; color: #92400e; }
  .blue { background: #dbeafe; color: #1e40af; }
  .total-row td { font-weight: 800; font-size: 14px; background: #f8fafc !important; border-top: 2px solid #1e293b; }
  .net-box { background: #1c1405; color: #fff; border-radius: 12px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
  .net-val { font-size: 24px; font-weight: 800; }
  .section { margin-bottom: 28px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print { body { padding: 20px; } }
`;

function openPrint(html) {
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${SCHOOL}</title><style>${BASE_STYLES}</style></head><body>${html}</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 600);
}

function schoolHeader(title, subtitle) {
  return `
    <div class="header">
      <div>
        <div class="school-name">🏫 ${SCHOOL}</div>
        <div class="school-sub">${ADDRESS} · EduPay Finance System</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:800;color:#1c1405">${title}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:2px">${subtitle}</div>
        <div style="font-size:11px;color:#cbd5e1;margin-top:4px">Printed: ${new Date().toLocaleString()}</div>
      </div>
    </div>`;
}

// ── 1. PAYSLIP ─────────────────────────────────────────────────────────────
export function printPayslip(staff, month, year) {
  const { name, role, gross, napsa, paye, loan, net } = staff;
  const napsaAmt = napsa || Math.round(Number(gross)*0.05);
  const payeAmt  = paye  || (Number(gross)>5000 ? Math.round((Number(gross)-5000)*0.25) : 0);
  const loanAmt  = Number(loan||0);
  const netAmt   = net || (Number(gross) - napsaAmt - payeAmt - loanAmt);

  const html = `
    ${schoolHeader("Official Payslip", `${month} ${year}`)}
    <div class="section" style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:24px">
      <div style="font-size:18px;font-weight:800;margin-bottom:4px">${name}</div>
      <div style="font-size:13px;color:#64748b">${role} · ${month} ${year}</div>
    </div>

    <table>
      <tr><th colspan="2">Earnings</th></tr>
      <tr><td>Basic Monthly Salary</td><td style="text-align:right;font-weight:700;color:#10b981">${fmt(gross)}</td></tr>
    </table>

    <table>
      <tr><th colspan="2">Deductions</th></tr>
      ${napsaAmt>0?`<tr><td>NAPSA Contribution (5%)</td><td style="text-align:right;color:#f43f5e">-${fmt(napsaAmt)}</td></tr>`:""}
      ${payeAmt>0?`<tr><td>PAYE Income Tax</td><td style="text-align:right;color:#f43f5e">-${fmt(payeAmt)}</td></tr>`:""}
      ${loanAmt>0?`<tr><td>Loan Repayment</td><td style="text-align:right;color:#f43f5e">-${fmt(loanAmt)}</td></tr>`:""}
      <tr class="total-row"><td>Total Deductions</td><td style="text-align:right;color:#f43f5e">-${fmt(napsaAmt+payeAmt+loanAmt)}</td></tr>
    </table>

    <div class="net-box">
      <div>
        <div style="font-size:12px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.08em">Net Pay (Take Home)</div>
        <div style="font-size:12px;color:rgba(255,255,255,.4);margin-top:2px">${month} ${year}</div>
      </div>
      <div class="net-val" style="color:#fbbf24">${fmt(netAmt)}</div>
    </div>

    <div class="footer">
      <div>${SCHOOL} · ${ADDRESS}</div>
      <div>This is an official payslip generated by EduPay</div>
    </div>`;
  openPrint(html);
}

// ── 2. ALL PAYSLIPS (bulk) ─────────────────────────────────────────────────
export function printAllPayslips(allStaff, month, year) {
  const slips = allStaff.map(s => {
    const napsaAmt = s.napsa ? Math.round(Number(s.gross)*0.05) : 0;
    const payeAmt  = s.paye  ? (Number(s.gross)>5000?Math.round((Number(s.gross)-5000)*0.25):0) : 0;
    const loanAmt  = Number(s.loan||0);
    const netAmt   = Number(s.gross) - napsaAmt - payeAmt - loanAmt;
    return `
      <div style="page-break-after:always;padding-bottom:32px;border-bottom:2px dashed #e2e8f0;margin-bottom:32px">
        <div style="font-size:16px;font-weight:800;margin-bottom:2px">${s.name}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:14px">${s.role} · ${month} ${year}</div>
        <table>
          <tr><td>Gross Salary</td><td style="text-align:right;color:#10b981;font-weight:700">${fmt(s.gross)}</td></tr>
          ${napsaAmt>0?`<tr><td>NAPSA (5%)</td><td style="text-align:right;color:#f43f5e">-${fmt(napsaAmt)}</td></tr>`:""}
          ${payeAmt>0?`<tr><td>PAYE Tax</td><td style="text-align:right;color:#f43f5e">-${fmt(payeAmt)}</td></tr>`:""}
          ${loanAmt>0?`<tr><td>Loan</td><td style="text-align:right;color:#f43f5e">-${fmt(loanAmt)}</td></tr>`:""}
          <tr class="total-row"><td><strong>NET PAY</strong></td><td style="text-align:right;font-size:16px;color:#1c1405"><strong>${fmt(netAmt)}</strong></td></tr>
        </table>
      </div>`;
  }).join("");

  const html = `${schoolHeader("All Staff Payslips", `${month} ${year} · ${allStaff.length} employees`)}${slips}
    <div class="footer"><div>${SCHOOL}</div><div>Printed by EduPay · ${new Date().toLocaleString()}</div></div>`;
  openPrint(html);
}

// ── 3. EXPENSE REPORT ─────────────────────────────────────────────────────
export function printExpenseReport(expenses, term, filters = {}) {
  const rows = expenses.filter(e => e.term === term);
  const total = rows.reduce((a, e) => a + Number(e.amount || 0), 0);
  const cats = {};
  rows.forEach(e => { cats[e.category] = (cats[e.category]||0) + Number(e.amount||0); });

  const tableRows = rows.map(e => `
    <tr>
      <td>${e.date}</td>
      <td>${e.category}</td>
      <td>${e.description}</td>
      <td style="text-align:right;font-weight:700;color:#f43f5e">${fmt(e.amount)}</td>
      <td>${e.method||"—"}</td>
      <td>${e.receipt||"—"}</td>
      <td>${e.approvedBy||"—"}</td>
    </tr>`).join("");

  const catRows = Object.entries(cats).map(([cat,total])=>`
    <tr><td>${cat}</td><td style="text-align:right;font-weight:700">${fmt(total)}</td></tr>`).join("");

  const html = `
    ${schoolHeader("Expenditure Report", `${term} · ${rows.length} transactions`)}
    <div class="section">
      <h2>Category Summary</h2>
      <table style="width:50%">
        <tr><th>Category</th><th style="text-align:right">Total</th></tr>
        ${catRows}
        <tr class="total-row"><td>Grand Total</td><td style="text-align:right">${fmt(total)}</td></tr>
      </table>
    </div>
    <div class="section">
      <h2>All Transactions</h2>
      <table>
        <tr><th>Date</th><th>Category</th><th>Description</th><th style="text-align:right">Amount</th><th>Method</th><th>Receipt</th><th>Approved By</th></tr>
        ${tableRows}
        <tr class="total-row">
          <td colspan="3">TOTAL</td>
          <td style="text-align:right">${fmt(total)}</td>
          <td colspan="3"></td>
        </tr>
      </table>
    </div>
    <div class="footer"><div>${SCHOOL} · ${term}</div><div>EduPay Finance System · ${new Date().toLocaleString()}</div></div>`;
  openPrint(html);
}

// ── 4. FINANCIAL STATEMENT ─────────────────────────────────────────────────
export function printFinancialStatement(data, term) {
  const { feeIncome, salariesPaid, napsaPaid, payePaid, opsTotal, totalOut, netPos, catBreakdown } = data;
  const surplus = netPos >= 0;

  const catRows = (catBreakdown||[]).map(c=>`
    <tr><td>${c.icon||""} ${c.label}</td><td style="text-align:right">${fmt(c.total)}</td></tr>`).join("");

  const html = `
    ${schoolHeader("Financial Statement", term)}
    <div style="display:flex;gap:24px;margin-bottom:24px">
      <div style="flex:1">
        <h2 style="color:#10b981">📥 Income</h2>
        <table>
          <tr><th>Item</th><th style="text-align:right">Amount</th></tr>
          <tr><td>School Fees Collected</td><td style="text-align:right;color:#10b981;font-weight:700">${fmt(feeIncome)}</td></tr>
          <tr class="total-row"><td>Total Income</td><td style="text-align:right">${fmt(feeIncome)}</td></tr>
        </table>
      </div>
      <div style="flex:1">
        <h2 style="color:#f43f5e">📤 Expenditure</h2>
        <table>
          <tr><th>Item</th><th style="text-align:right">Amount</th></tr>
          <tr><td>Net Salaries Paid</td><td style="text-align:right">${fmt(salariesPaid)}</td></tr>
          <tr><td>NAPSA Contributions</td><td style="text-align:right">${fmt(napsaPaid)}</td></tr>
          <tr><td>PAYE Tax</td><td style="text-align:right">${fmt(payePaid)}</td></tr>
          ${catRows}
          <tr class="total-row"><td>Total Expenditure</td><td style="text-align:right;color:#f43f5e">${fmt(totalOut)}</td></tr>
        </table>
      </div>
    </div>
    <div class="net-box" style="background:${surplus?"#064e3b":"#7f1d1d"}">
      <div>
        <div style="font-size:13px;color:rgba(255,255,255,.7)">${surplus?"✅ SURPLUS":"⚠️ DEFICIT"} — Net Financial Position</div>
        <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:2px">${term} · ${SCHOOL}</div>
      </div>
      <div class="net-val" style="color:${surplus?"#6ee7b7":"#fca5a5"}">${surplus?"+":""}{fmt(netPos)}</div>
    </div>
    <div class="footer"><div>${SCHOOL} · ${ADDRESS}</div><div>Official Financial Statement · EduPay · ${new Date().toLocaleString()}</div></div>`;

  // Fix the fmt call in template literal
  const fixedHtml = html.replace("{fmt(netPos)}", fmt(netPos));
  openPrint(fixedHtml);
}

// ── 5. PETTY CASH LEDGER ──────────────────────────────────────────────────
export function printPettyCashLedger(entries, month) {
  let running = 0;
  const rows = [...entries].reverse().map(e => {
    if (e.type==="topup") running += Number(e.amount||0);
    else running -= Number(e.amount||0);
    const bal = running;
    return `<tr>
      <td>${e.date}</td>
      <td>${e.type==="topup"?"↑ Top Up":"↓ Expense"}</td>
      <td>${e.description}${e.paidTo?` (${e.paidTo})`:""}</td>
      <td style="text-align:right;color:#10b981">${e.type==="topup"?fmt(e.amount):"—"}</td>
      <td style="text-align:right;color:#f43f5e">${e.type==="expense"?fmt(e.amount):"—"}</td>
      <td style="text-align:right;font-weight:700;color:${bal>=0?"#1e293b":"#f43f5e"}">${fmt(bal)}</td>
      <td>${e.receipt||"—"}</td>
    </tr>`;
  }).reverse().join("");

  const total = entries.filter(e=>e.type==="topup").reduce((a,e)=>a+Number(e.amount||0),0)
              - entries.filter(e=>e.type==="expense").reduce((a,e)=>a+Number(e.amount||0),0);

  const html = `
    ${schoolHeader("Petty Cash Ledger", month ? month : "All Records")}
    <table>
      <tr><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Cash In</th><th style="text-align:right">Cash Out</th><th style="text-align:right">Balance</th><th>Receipt</th></tr>
      ${rows}
      <tr class="total-row">
        <td colspan="3">CLOSING BALANCE</td>
        <td></td><td></td>
        <td style="text-align:right;color:${total>=0?"#10b981":"#f43f5e"}">${fmt(total)}</td>
        <td></td>
      </tr>
    </table>
    <div class="footer"><div>${SCHOOL} · Petty Cash Ledger</div><div>EduPay Finance · ${new Date().toLocaleString()}</div></div>`;
  openPrint(html);
}

// ── 6. ANNUAL REPORT ──────────────────────────────────────────────────────
export function printAnnualReport(termData, annual) {
  const TERMS = ["Term 1 2026","Term 2 2026","Term 3 2026"];
  const rows = [
    {label:"Fee Income",    key:"feeIncome",    color:"#10b981"},
    {label:"Salaries Paid", key:"salariesPaid", color:"#6366f1"},
    {label:"NAPSA+PAYE",    key:"napsaPaid",    color:"#f59e0b"},
    {label:"Operations",    key:"opsTotal",     color:"#f43f5e"},
    {label:"Total Out",     key:"totalOut",     color:"#f43f5e"},
    {label:"Net Position",  key:"netPos",       color:"#1e293b"},
  ];
  const tableRows = rows.map(r=>`
    <tr ${r.key==="netPos"||r.key==="totalOut"?'class="total-row"':""}>
      <td><strong>${r.label}</strong></td>
      ${termData.map(t=>`<td style="text-align:right;font-weight:600;color:${r.color}">${r.key==="netPos"&&t[r.key]>0?"+":""}${fmt(t[r.key])}</td>`).join("")}
      <td style="text-align:right;font-weight:800;color:${r.color}">${r.key==="netPos"&&annual[r.key]>0?"+":""}${fmt(annual[r.key]||0)}</td>
    </tr>`).join("");

  const html = `
    ${schoolHeader("Annual Financial Report", "Academic Year 2026 — All Terms")}
    <table>
      <tr>
        <th>Line Item</th>
        ${TERMS.map(t=>`<th style="text-align:right">${t}</th>`).join("")}
        <th style="text-align:right;background:#1c1405">Annual Total</th>
      </tr>
      ${tableRows}
    </table>
    <div class="net-box">
      <div><div style="font-size:13px;color:rgba(255,255,255,.6)">Annual Net Position — Academic Year 2026</div></div>
      <div class="net-val" style="color:${annual.netPos>=0?"#6ee7b7":"#fca5a5"}">${annual.netPos>=0?"+":""}${fmt(annual.netPos)}</div>
    </div>
    <div class="footer"><div>${SCHOOL} · Annual Report 2026</div><div>EduPay Finance System · ${new Date().toLocaleString()}</div></div>`;
  openPrint(html);
}
