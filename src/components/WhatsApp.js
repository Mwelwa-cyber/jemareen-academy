import { useState, useMemo } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const WA_TEMPLATES = [
  { id:"fee_reminder",    icon:"💳", label:"Fee Reminder",       tone:"Polite",    color:"#7B2D8B", body:`Dear {parent_name}, this is a friendly reminder that {learner_name}'s school fee balance of *K{balance}* for {term} ({grade}) is outstanding. Kindly arrange payment at your earliest convenience.\n\nThank you 🙏\n_Jemareen Academy_` },
  { id:"payment_confirmed",icon:"✅", label:"Payment Confirmed",  tone:"Positive",  color:"#10b981", body:`Dear {parent_name}, we confirm receipt of *K{amount_paid}* toward {learner_name}'s school fees for {term}. Your balance is now *K{balance}*.\n\nThank you for your prompt payment! 🎉\n_Jemareen Academy_` },
  { id:"overdue_notice",  icon:"⚠️", label:"Overdue Notice",     tone:"Firm",      color:"#f43f5e", body:`Dear {parent_name}, URGENT: {learner_name}'s fee payment of *K{balance}* for {term} is overdue. Please settle this immediately to avoid disruption to your child's education.\n\nContact the bursar urgently.\n_Jemareen Academy_` },
  { id:"term_opening",    icon:"📚", label:"Term Opening",        tone:"Welcoming", color:"#f59e0b", body:`Dear {parent_name}, we warmly welcome {learner_name} back for *{term}*! 🏫\n\nSchool opens Monday. Fees of *K{fee}* are due by end of Week 1.\n\nCall {school_phone} for payment arrangements.\n_Jemareen Academy_` },
  { id:"partial_payment", icon:"🙏", label:"Partial Thanks",      tone:"Grateful",  color:"#06b6d4", body:`Dear {parent_name}, thank you for your payment toward {learner_name}'s fees for {term}. The remaining balance is *K{balance}*.\n\nKindly clear this at your earliest. We appreciate you! 💙\n_Jemareen Academy_` },
];

const SCHOOL_PHONE = "+260 97 000 0000";
const TERMS = ["Term 1 2026","Term 2 2026","Term 3 2026"];

function formatPhone(raw) {
  let p = (raw||"").replace(/\s/g,"").replace(/^\+/,"");
  if (p.startsWith("0")) p = "260"+p.slice(1);
  if (!p.startsWith("260")) p = "260"+p;
  return p;
}

function mergeTemplate(body, learner, term, feeStructure) {
  const fee = feeStructure[learner.grade]||0;
  return body
    .replace(/{parent_name}/g, learner.parent||"Parent")
    .replace(/{learner_name}/g, learner.name||"")
    .replace(/{grade}/g, learner.grade||"")
    .replace(/{term}/g, term)
    .replace(/{fee}/g, `${Number(fee).toLocaleString()}`)
    .replace(/{balance}/g, `${Number(learner.balance||0).toLocaleString()}`)
    .replace(/{amount_paid}/g, `${Number(learner.totalPaid||0).toLocaleString()}`)
    .replace(/{school_phone}/g, SCHOOL_PHONE);
}

const initials = name => (name||"").split(" ").filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase();
const AVATAR_COLORS = ["#7B2D8B","#10b981","#f59e0b","#ef4444","#3b82f6","#8b5cf6","#06b6d4","#ec4899"];
const avatarColor = id => AVATAR_COLORS[Math.abs((id||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0))%AVATAR_COLORS.length];

export default function WhatsApp({ learners, feeStructure, activeTerm, user }) {
  const [selectedTemplate, setSelectedTemplate] = useState(WA_TEMPLATES[0]);
  const [customBody,   setCustomBody]   = useState(WA_TEMPLATES[0].body);
  const [queue,        setQueue]        = useState([]);
  const [sentLog,      setSentLog]      = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [gradeFilter,  setGradeFilter]  = useState("All Grades");
  const [previewLearner, setPreviewLearner] = useState(null);
  const [toast,        setToast]        = useState(null);
  const [tab,          setTab]          = useState("compose");
  const [term,         setTerm]         = useState(activeTerm||TERMS[0]);

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(null),3000); };
  const allGrades = [...new Set(learners.map(l=>l.grade))];

  const filteredLearners = useMemo(()=>{
    let ls = learners;
    if (gradeFilter!=="All Grades") ls = ls.filter(l=>l.grade===gradeFilter);
    if (filterStatus==="unpaid") ls = ls.filter(l=>(l.balance||0)>0);
    if (filterStatus==="paid")   ls = ls.filter(l=>(l.balance||0)===0);
    return ls;
  },[learners,gradeFilter,filterStatus]);

  const previewText = useMemo(()=>{
    const l = previewLearner||filteredLearners[0];
    if (!l) return customBody;
    return mergeTemplate(customBody,l,term,feeStructure);
  },[customBody,previewLearner,filteredLearners,term,feeStructure]);

  const toggleQueue = l => setQueue(prev=>prev.find(q=>q.id===l.id)?prev.filter(q=>q.id!==l.id):[...prev,l]);

  const handleSend = async () => {
    if (queue.length===0){showToast("Select at least one recipient.");return;}
    const sent=[];
    for (const learner of queue){
      const msg=mergeTemplate(customBody,learner,term,feeStructure);
      const url=`https://wa.me/${formatPhone(learner.phone||"")}?text=${encodeURIComponent(msg)}`;
      window.open(url,"_blank");
      await new Promise(r=>setTimeout(r,600));
      const entry={learnerId:learner.id,learnerName:learner.name,parent:learner.parent,phone:learner.phone,template:selectedTemplate.label,message:msg,sentAt:new Date().toISOString(),sentBy:user?.email};
      sent.push(entry);
      try{await addDoc(collection(db,"whatsappLog"),{...entry,createdAt:serverTimestamp()});}catch{}
    }
    setSentLog(prev=>[...sent,...prev]);
    setQueue([]);
    showToast(`✅ WhatsApp opened for ${sent.length} parent${sent.length>1?"s":""}!`);
    setTab("log");
  };

  const handleSendOne = async learner => {
    const msg=mergeTemplate(customBody,learner,term,feeStructure);
    window.open(`https://wa.me/${formatPhone(learner.phone||"")}?text=${encodeURIComponent(msg)}`,"_blank");
    try{await addDoc(collection(db,"whatsappLog"),{learnerId:learner.id,learnerName:learner.name,parent:learner.parent,phone:learner.phone,template:selectedTemplate.label,message:msg,sentAt:new Date().toISOString(),sentBy:user?.email,createdAt:serverTimestamp()});}catch{}
    setSentLog(prev=>[{learnerId:learner.id,learnerName:learner.name,parent:learner.parent,phone:learner.phone,template:selectedTemplate.label,message:msg,sentAt:new Date().toISOString()},...prev]);
    showToast(`WhatsApp opened for ${learner.parent}`);
  };

  const selectTemplate = tpl=>{setSelectedTemplate(tpl);setCustomBody(tpl.body);setPreviewLearner(null);};

  return (
    <div style={{fontFamily:"'Outfit',sans-serif"}}>
      <style>{`
        .wa-card{background:#fff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);}
        .wa-btn{border:none;border-radius:12px;padding:13px 18px;font-family:inherit;font-weight:700;font-size:14px;cursor:pointer;transition:all .18s;}
        .wa-btn:active{transform:scale(.97);}
        .wa-inp{width:100%;background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:14px;font-family:inherit;font-size:16px;color:#1e293b;outline:none;transition:border-color .2s;-webkit-appearance:none;}
        .wa-inp:focus{border-color:#25D366;background:#fff;}
        textarea.wa-inp{resize:vertical;line-height:1.7;}
        select.wa-inp option{background:#fff;}
        .wa-pill{border:none;border-radius:99px;padding:8px 16px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap;}
        .wa-pill:active{transform:scale(.96);}
        .wa-row{transition:background .15s;cursor:pointer;}
        .wa-row:hover{background:#f0fdf4;}
        .wa-tab{border:none;background:none;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;padding:10px 16px;border-radius:10px;transition:all .18s;white-space:nowrap;}
        .merge-tag{display:inline-block;background:#dcfce7;color:#166534;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer;margin:3px;}
        .merge-tag:active{transform:scale(.95);}
      `}</style>

      {/* Sub-nav — scrollable on mobile */}
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginBottom:16,paddingBottom:4}}>
        <div style={{display:"flex",gap:4,background:"#fff",borderRadius:14,padding:5,boxShadow:"0 2px 8px rgba(0,0,0,.06)",width:"max-content",minWidth:"100%",alignItems:"center"}}>
          {[{id:"compose",label:"✍️ Compose"},{id:"send",label:"📤 Send"},{id:"log",label:"📋 Log"}].map(t=>(
            <button key={t.id} className="wa-tab" onClick={()=>setTab(t.id)}
              style={{color:tab===t.id?"#25D366":"#64748b",background:tab===t.id?"#f0fdf4":"none"}}>
              {t.label}
            </button>
          ))}
          <div style={{width:1,background:"#e2e8f0",margin:"0 4px",height:24,flexShrink:0}}/>
          <select className="wa-inp" style={{border:"none",background:"none",padding:"9px 10px",width:"auto",fontSize:14,flexShrink:0}} value={term} onChange={e=>setTerm(e.target.value)}>
            {TERMS.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* ── COMPOSE TAB ── */}
      {tab==="compose" && (
        <div>
          {/* Template picker — horizontal scroll */}
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginBottom:16,paddingBottom:4}}>
            <div style={{display:"flex",gap:10,width:"max-content"}}>
              {WA_TEMPLATES.map(tpl=>(
                <div key={tpl.id} onClick={()=>selectTemplate(tpl)}
                  style={{border:`2px solid ${selectedTemplate.id===tpl.id?tpl.color:"#e2e8f0"}`,borderRadius:14,padding:"12px 16px",cursor:"pointer",background:selectedTemplate.id===tpl.id?tpl.color+"0d":"#fff",transition:"all .18s",minWidth:140,flexShrink:0}}>
                  <div style={{fontSize:22,marginBottom:6}}>{tpl.icon}</div>
                  <div style={{fontSize:13,fontWeight:700,color:selectedTemplate.id===tpl.id?tpl.color:"#1e293b"}}>{tpl.label}</div>
                  <div style={{fontSize:11,color:tpl.color,fontWeight:600,marginTop:2}}>{tpl.tone}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Editor card */}
          <div className="wa-card" style={{padding:20,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,padding:"12px 14px",background:"#f0fdf4",borderRadius:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:"#25D366",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💬</div>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:"#1e293b"}}>{selectedTemplate.label}</div>
                <div style={{fontSize:12,color:"#64748b"}}>Tap tags below to insert into message</div>
              </div>
            </div>

            <label style={{fontSize:12,fontWeight:700,color:"#475569",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:".05em"}}>Message Body</label>
            <textarea className="wa-inp" rows={6} value={customBody} onChange={e=>setCustomBody(e.target.value)} style={{marginBottom:12}}/>

            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:14}}>
              <div style={{fontSize:12,fontWeight:700,color:"#166534",marginBottom:10,textTransform:"uppercase",letterSpacing:".05em"}}>📎 Merge Tags — tap to insert</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:0}}>
                {["{parent_name}","{learner_name}","{grade}","{term}","{fee}","{balance}","{amount_paid}","{school_phone}"].map(tag=>(
                  <span key={tag} className="merge-tag" onClick={()=>setCustomBody(p=>p+tag)}>{tag}</span>
                ))}
              </div>
              <div style={{fontSize:12,color:"#166534",marginTop:8,opacity:.75}}>Use *text* for bold in WhatsApp</div>
            </div>
          </div>

          {/* Live preview */}
          <div className="wa-card" style={{padding:20}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>👁 Live Preview</div>
            <select className="wa-inp" style={{marginBottom:12}} value={previewLearner?.id||""} onChange={e=>setPreviewLearner(learners.find(l=>l.id===e.target.value)||null)}>
              <option value="">Select a learner to preview…</option>
              {learners.map(l=><option key={l.id} value={l.id}>{l.name} ({l.grade}) — Bal: K{Number(l.balance||0).toLocaleString()}</option>)}
            </select>
            <div style={{background:"#f0fdf4",border:"1px solid #dcfce7",borderRadius:12,padding:16,fontSize:14,lineHeight:1.8,color:"#1e293b",whiteSpace:"pre-wrap",fontFamily:"system-ui,sans-serif"}}>
              {previewText}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
              <span style={{fontSize:12,color:"#94a3b8"}}>{previewText.length} characters</span>
              <button className="wa-btn" onClick={()=>setTab("send")} style={{background:"#25D366",color:"#fff",fontSize:13,padding:"9px 18px"}}>
                Send to Parents →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SEND TAB ── */}
      {tab==="send" && (
        <div>
          {/* Filters */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            <select className="wa-inp" style={{flex:1,minWidth:130}} value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)}>
              <option>All Grades</option>{allGrades.map(g=><option key={g}>{g}</option>)}
            </select>
            <div style={{display:"flex",gap:8,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              {[{id:"all",label:"All"},{id:"unpaid",label:"Has Balance"},{id:"paid",label:"Paid Up"}].map(f=>(
                <button key={f.id} className="wa-pill" onClick={()=>setFilterStatus(f.id)} style={{background:filterStatus===f.id?"#25D366":"#F0E8F5",color:filterStatus===f.id?"#fff":"#64748b",border:"1px solid "+(filterStatus===f.id?"#25D366":"#e2e8f0")}}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Select all / queue info */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,background:"#fff",borderRadius:14,padding:"12px 16px",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
            <span style={{fontSize:14,color:"#64748b"}}>{queue.length} selected</span>
            <div style={{display:"flex",gap:8}}>
              <button className="wa-btn" onClick={()=>setQueue(filteredLearners)} style={{background:"#f0fdf4",color:"#166534",fontSize:12,padding:"8px 14px"}}>Select All ({filteredLearners.length})</button>
              <button className="wa-btn" onClick={()=>setQueue([])} style={{background:"#F0E8F5",color:"#94a3b8",fontSize:12,padding:"8px 14px"}}>Clear</button>
            </div>
          </div>

          {/* Learner list */}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
            {filteredLearners.map(learner=>{
              const checked=!!queue.find(q=>q.id===learner.id);
              return (
                <div key={learner.id} className="wa-row" onClick={()=>toggleQueue(learner)}
                  style={{background:checked?"#f0fdf4":"#fff",borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,.04)",border:`2px solid ${checked?"#25D366":"transparent"}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:22,height:22,borderRadius:7,border:`2px solid ${checked?"#25D366":"#d1d5db"}`,background:checked?"#25D366":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                      {checked&&<span style={{color:"#fff",fontSize:12,fontWeight:800,lineHeight:1}}>✓</span>}
                    </div>
                    <div style={{width:38,height:38,borderRadius:"50%",background:avatarColor(learner.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>{initials(learner.name)}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:15,fontWeight:700,color:"#1e293b"}}>{learner.name}</div>
                      <div style={{fontSize:12,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{learner.grade} · {learner.parent} · {learner.phone}</div>
                    </div>
                    <div style={{flexShrink:0,textAlign:"right"}}>
                      {(learner.balance||0)>0&&<div style={{fontSize:14,fontWeight:800,color:"#f43f5e"}}>K{Number(learner.balance).toLocaleString()}</div>}
                      <button className="wa-btn" onClick={e=>{e.stopPropagation();handleSendOne(learner);}}
                        style={{background:"#25D366",color:"#fff",fontSize:12,padding:"7px 14px",marginTop:4}}>
                        Send
                      </button>
                    </div>
                  </div>
                  <div style={{marginTop:10,fontSize:12,color:"#64748b",background:"#FEFCFF",borderRadius:8,padding:"8px 10px",lineHeight:1.5}}>
                    {mergeTemplate(customBody,learner,term,feeStructure).slice(0,90)}…
                  </div>
                </div>
              );
            })}
          </div>

          {/* Send queue sticky button */}
          {queue.length>0&&(
            <div style={{position:"sticky",bottom:80,padding:"0 0 10px"}}>
              <button className="wa-btn" onClick={handleSend} style={{background:"#25D366",color:"#fff",width:"100%",fontSize:16,padding:"16px",boxShadow:"0 8px 32px rgba(37,211,102,.35)"}}>
                💬 Send to {queue.length} Parent{queue.length>1?"s":""}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── LOG TAB ── */}
      {tab==="log" && (
        <div>
          <div style={{fontSize:14,color:"#64748b",marginBottom:14,fontWeight:600}}>{sentLog.length} message{sentLog.length!==1?"s":""} sent this session</div>
          {sentLog.length===0?(
            <div className="wa-card" style={{padding:48,textAlign:"center",color:"#94a3b8"}}>
              <div style={{fontSize:40,marginBottom:12}}>💬</div>
              <div>No messages sent yet.</div>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {sentLog.map((log,i)=>(
                <div key={i} className="wa-card" style={{padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:"#1e293b"}}>{log.learnerName}</div>
                      <div style={{fontSize:12,color:"#94a3b8"}}>{log.parent} · {log.phone} · {log.template}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                      <span style={{background:"#d1fae5",color:"#065f46",borderRadius:99,padding:"3px 10px",fontSize:12,fontWeight:700}}>✓ Sent</span>
                      <span style={{fontSize:11,color:"#94a3b8"}}>{new Date(log.sentAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                    </div>
                  </div>
                  <div style={{fontSize:12,color:"#64748b",background:"#f0fdf4",borderRadius:8,padding:"8px 10px",lineHeight:1.5,fontFamily:"system-ui"}}>
                    {log.message.slice(0,100)}…
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {toast&&(
        <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",zIndex:300,background:"#1e293b",color:"#e2e8f0",borderRadius:12,padding:"13px 20px",fontSize:14,fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,.2)",whiteSpace:"nowrap"}}>
          {toast}
        </div>
      )}
    </div>
  );
}
