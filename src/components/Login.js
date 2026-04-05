import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { LOGO } from "../App";
import { IconMail, IconLock, IconEye, IconEyeOff, IconWarning, IconInfo, IconArrowRight } from "./Icons";

export default function Login() {
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [shake,     setShake]     = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setLoading(false);
      setShake(true); setTimeout(() => setShake(false), 600);
      if (["auth/user-not-found","auth/wrong-password","auth/invalid-credential"].includes(err.code)) {
        setError("Incorrect email or password.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait and try again.");
      } else {
        setError("Login failed. Check your internet connection.");
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError("Enter your email address first."); return; }
    try { await sendPasswordResetEmail(auth, email.trim()); setResetSent(true); }
    catch { setError("Could not send reset email. Check the address."); }
  };

  return (
    <div style={{minHeight:"100vh",fontFamily:"'Outfit',sans-serif",background:"#3D1445",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,500&display=swap');
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .l-inp{width:100%;background:#F7F3FA;border:2px solid #E2D4EC;border-radius:14px;padding:16px 16px 16px 50px;font-family:'Outfit',sans-serif;font-size:16px;color:#1e293b;outline:none;transition:all .2s;-webkit-appearance:none;}
        .l-inp:focus{border-color:#7B2D8B;background:#fff;box-shadow:0 0 0 4px rgba(123,45,139,.08);}
        .l-btn{width:100%;border:none;border-radius:14px;padding:17px;font-family:'Outfit',sans-serif;font-size:16px;font-weight:800;cursor:pointer;transition:all .2s;}
        .l-btn:active{transform:scale(.97);}
      `}</style>

      {/* Purple brand header */}
      <div style={{padding:"44px 24px 36px",textAlign:"center",position:"relative",overflow:"hidden",flexShrink:0}}>
        {/* Decorative orbs */}
        {[{s:200,t:"-20%",l:"-5%",c:"rgba(212,168,32,.12)"},{s:160,t:"30%",l:"70%",c:"rgba(255,255,255,.05)"}].map((o,i)=>(
          <div key={i} style={{position:"absolute",top:o.t,left:o.l,width:o.s,height:o.s,borderRadius:"50%",background:o.c,filter:"blur(40px)",pointerEvents:"none"}}/>
        ))}
        <div style={{position:"relative",zIndex:2}}>
          <img src={LOGO} alt="Jemareen Academy" style={{width:90,height:90,marginBottom:14,animation:"float 3s ease-in-out infinite",filter:"drop-shadow(0 8px 24px rgba(0,0,0,.3))"}}/>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"#fff",letterSpacing:"-0.3px",marginBottom:4}}>
            Jemareen Academy
          </div>
          <div style={{fontSize:12,color:"#D4A820",letterSpacing:".12em",textTransform:"uppercase",fontWeight:600}}>
            EduPay · School Finance System
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.55)",marginTop:10,fontStyle:"italic",letterSpacing:".01em"}}>
            "Bringing out the best in children"
          </div>
        </div>
      </div>

      {/* White form card slides up */}
      <div style={{flex:1,background:"#fff",borderRadius:"28px 28px 0 0",padding:"32px 20px 52px",animation:"slideUp .45s cubic-bezier(.34,1.2,.64,1)"}}>
        <div style={{maxWidth:400,margin:"0 auto"}}>
          {resetSent ? (
            <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{width:64,height:64,background:"rgba(123,45,139,.1)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",color:"#7B2D8B"}}><IconMail size={30}/></div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#1e293b",marginBottom:8}}>Reset link sent!</div>
              <div style={{fontSize:14,color:"#64748b",lineHeight:1.7,marginBottom:24}}>Check your inbox at <strong>{email}</strong> and follow the link to reset your password.</div>
              <button onClick={()=>setResetSent(false)} style={{background:"#7B2D8B",border:"none",borderRadius:14,padding:"14px 32px",color:"#fff",fontWeight:800,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontSize:15}}>Back to Login</button>
            </div>
          ) : (
            <>
              <div style={{textAlign:"center",marginBottom:28}}>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#1e293b",marginBottom:6}}>Welcome back</h2>
                <p style={{fontSize:14,color:"#94a3b8"}}>Sign in to your admin dashboard</p>
              </div>

              <form onSubmit={handleLogin} style={{animation:shake?"shake .5s ease":"none"}}>
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:12,fontWeight:700,color:"#5A1F68",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:".05em"}}>Email Address</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",opacity:.45,pointerEvents:"none",display:"flex",alignItems:"center",color:"#5A1F68"}}><IconMail size={18}/></span>
                    <input className="l-inp" type="email" inputMode="email" autoCapitalize="none" autoComplete="email"
                      placeholder="admin@jemareen.zm" value={email}
                      onChange={e=>{setEmail(e.target.value);setError("");}} required />
                  </div>
                </div>

                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <label style={{fontSize:12,fontWeight:700,color:"#5A1F68",textTransform:"uppercase",letterSpacing:".05em"}}>Password</label>
                    <button type="button" onClick={handleForgotPassword}
                      style={{background:"none",border:"none",fontSize:13,color:"#7B2D8B",fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif",padding:0}}>
                      Forgot password?
                    </button>
                  </div>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",opacity:.45,pointerEvents:"none",display:"flex",alignItems:"center",color:"#5A1F68"}}><IconLock size={18}/></span>
                    <input className="l-inp" type={showPass?"text":"password"} autoComplete="current-password"
                      placeholder="••••••••••" value={password}
                      onChange={e=>{setPassword(e.target.value);setError("");}} required style={{paddingRight:52}}/>
                    <button type="button" onClick={()=>setShowPass(p=>!p)}
                      style={{position:"absolute",right:16,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",opacity:.45,padding:0,display:"flex",alignItems:"center",color:"#5A1F68"}}>
                      {showPass?<IconEyeOff size={20}/>:<IconEye size={20}/>}
                    </button>
                  </div>
                </div>

                <div style={{minHeight:36,marginBottom:12}}>
                  {error && (
                    <div style={{fontSize:13,color:"#dc2626",fontWeight:600,background:"#fff5f5",border:"1px solid #fecaca",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{display:"flex",alignItems:"center",flexShrink:0}}><IconWarning size={15}/></span>{error}
                    </div>
                  )}
                </div>

                <button className="l-btn" type="submit" disabled={loading||!email||!password}
                  style={{background:(loading||!email||!password)?"#e2e8f0":"linear-gradient(135deg,#7B2D8B,#5A1F68)",color:(loading||!email||!password)?"#94a3b8":"#fff",marginBottom:20}}>
                  {loading ? (
                    <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
                      <span style={{width:18,height:18,border:"2.5px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin .7s linear infinite"}}/>
                      Signing in…
                    </span>
                  ) : <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>Sign In<IconArrowRight size={18}/></span>}
                </button>
              </form>

              <div style={{background:"#F7F3FA",border:"1px solid #E2D4EC",borderRadius:14,padding:"14px 16px",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{color:"#7B2D8B",flexShrink:0,marginTop:1,display:"flex"}}><IconInfo size={16}/></span>
                <div style={{fontSize:13,color:"#64748b",lineHeight:1.6}}>
                  Your login is set up by your school administrator. Contact them if you need credentials.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
