import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./styles.css";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL
});
const setToken = t => { if (t) { localStorage.setItem("ss3-token", t); API.defaults.headers.common.Authorization = `Bearer ${t}`; } else { localStorage.removeItem("ss3-token"); delete API.defaults.headers.common.Authorization; } };
const saved = localStorage.getItem("ss3-token"); if (saved) setToken(saved);

function Auth({ done }) {
  const [mode, setMode] = useState("login"), [f, setF] = useState({ name: "", email: "", password: "" }), [err, setErr] = useState("");
  async function submit(e) { e.preventDefault(); setErr(""); try { const { data } = await API.post(mode === "login" ? "/auth/login" : "/auth/register", f); setToken(data.token); done(data.user); } catch (e) { setErr(e.response?.data?.message || "Request failed."); } }
  return <main className="auth"><div className="card authcard"><div className="brand">Stream<span>Sphere</span></div><p className="eyebrow">TASK 3 · SUBSCRIPTION MANAGEMENT</p><h1>{mode === "login" ? "Welcome back" : "Create account"}</h1><p className="muted">Manage plans, access limits, validity, and subscription history.</p><form onSubmit={submit}>{mode === "register" && <input placeholder="Full name" required onChange={e => setF({ ...f, name: e.target.value })} />}<input type="email" placeholder="Email" required onChange={e => setF({ ...f, email: e.target.value })} /><input type="password" placeholder="Password (6+)" required onChange={e => setF({ ...f, password: e.target.value })} />{err && <div className="error">{err}</div>}<button className="primary">{mode === "login" ? "Sign in" : "Register"}</button></form><button className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create a new account" : "Back to sign in"}</button></div></main>;
}

function Subscription({ current, reload, setMsg }) {
  const [plans, setPlans] = useState({});
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState("");
  useEffect(() => { (async () => { try { const [p,h] = await Promise.all([API.get("/subscriptions/plans"), API.get("/subscriptions/history")]); setPlans(p.data.plans); setHistory(h.data.subscriptions); } catch {} })(); }, [current]);

  async function demo(plan) { setBusy(plan); try { const r = await API.post("/subscriptions/demo-activate", { plan }); setMsg(r.data.message); await reload(); const h = await API.get("/subscriptions/history"); setHistory(h.data.subscriptions); } catch(e) { setMsg(e.response?.data?.message || "Unable to change plan."); } finally { setBusy(""); } }

  async function razorpayCheckout(plan) {
    setBusy(plan); setMsg("");
    try {
      const { data } = await API.post("/subscriptions/create-order", { plan });
      const script = await new Promise(resolve => { if (window.Razorpay) return resolve(true); const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = () => resolve(true); s.onerror = () => resolve(false); document.body.appendChild(s); });
      if (!script) throw new Error("Razorpay checkout could not load.");
      const rzp = new window.Razorpay({ key: data.keyId, amount: data.order.amount, currency: data.order.currency, name: "StreamSphere", description: `${plan} subscription`, order_id: data.order.id, handler: async response => { try { const v = await API.post("/subscriptions/verify", response); setMsg(v.data.message); await reload(); } catch(e) { setMsg(e.response?.data?.message || "Payment verification failed."); } }, prefill: { name: "StreamSphere User" }, theme: { color: "#2563eb" }, modal: { ondismiss: () => setMsg("Payment window closed.") } });
      rzp.open();
    } catch(e) { setMsg(e.response?.data?.message || e.message || "Razorpay test checkout unavailable."); } finally { setBusy(""); }
  }

  async function cancel() { setBusy("cancel"); try { const r = await API.post("/subscriptions/cancel"); setMsg(r.data.message); await reload(); } catch(e) { setMsg(e.response?.data?.message || "Cancellation failed."); } finally { setBusy(""); } }

  return <section><div className="sectionhead"><div><h2>Subscription plans</h2><p className="muted">Choose a plan and control the download entitlement linked to your account.</p></div><span className="pill">Current: {current.plan}</span></div><div className="plansGrid">{Object.entries(plans).map(([name,p]) => <article className={`planCard ${name === current.plan ? "current" : ""}`} key={name}><div className="planTop"><h3>{name}</h3>{name === current.plan && <span className="currentTag">ACTIVE</span>}</div><div className="price">₹{p.price}<small>{name === "Free" ? "" : " / 30 days"}</small></div><p><b>{p.dailyLimit}</b> downloads/day · {p.validity}</p><ul>{p.features?.map(x => <li key={x}>{x}</li>)}</ul>{name !== current.plan && <><button className="primary small" disabled={busy === name} onClick={() => razorpayCheckout(name)}>{busy === name ? "Opening…" : `Pay ₹${p.price} with Razorpay Test`}</button><button className="secondary small" disabled={busy === name} onClick={() => demo(name)}>Demo activate</button></>}{name === "Free" && current.plan !== "Free" && <button className="secondary small" disabled={busy === "cancel"} onClick={cancel}>Cancel subscription</button>}</article>)}</div><div className="card info"><b>Local testing:</b> “Demo activate” changes the account immediately without charging money. Razorpay buttons use Test Mode only when test keys are configured in the backend.</div><h2>Subscription history</h2><div className="card history">{history.length ? history.map(x => <div className="row" key={x._id}><div><b>{x.plan} plan</b><small>{new Date(x.createdAt).toLocaleString()} · {x.provider}</small></div><span className={`status ${x.status}`}>{x.status}</span></div>) : <p className="muted empty">No subscription transactions yet.</p>}</div></section>;
}

function Downloads({ data, history, msg, load, download, plan }) {
  const q = data.quota;
  return <section><div className="hero"><div><p className="eyebrow">CONTROLLED DOWNLOADS</p><h1>Your downloads</h1><p className="muted">Your active subscription determines the server-side daily quota.</p></div><b className="pill">{plan} plan</b></div>{msg && <div className="notice">{msg}</div>}<div className="stats"><div className="card"><small>Daily limit</small><strong>{q?.limit}</strong></div><div className="card"><small>Used today</small><strong>{q?.used}</strong></div><div className="card"><small>Remaining</small><strong>{q?.remaining}</strong></div></div><h2>Available files</h2><div className="grid">{data.files.map(f => <div className="card file" key={f.id}><div className="icon">↓</div><div><h3>{f.name}</h3><p>{f.description}</p><button className="primary small" disabled={!q?.remaining} onClick={() => download(f)}>{q?.remaining ? "Download" : "Quota reached"}</button></div></div>)}</div><h2>Download activity</h2><div className="card history">{history.length ? history.map(x => <div className="row" key={x._id}><div><b>{x.fileName}</b><small>{new Date(x.createdAt).toLocaleString()}</small></div><span className={`status ${x.status}`}>{x.status}</span></div>) : <p className="muted empty">No activity yet.</p>}</div></section>;
}

function App() {
  const [user,setUser]=useState(null), [data,setData]=useState({files:[],quota:null}), [history,setHistory]=useState([]), [current,setCurrent]=useState({plan:"Free",expiresAt:null}), [msg,setMsg]=useState(""), [tab,setTab]=useState("downloads"), [checking,setChecking]=useState(true);
  const load = async () => { const [a,b,c] = await Promise.all([API.get("/downloads/files"), API.get("/downloads/history"), API.get("/subscriptions/current")]); setData(a.data); setHistory(b.data.history); setCurrent({plan:c.data.plan,expiresAt:c.data.expiresAt}); };
  useEffect(() => { API.get("/auth/me").then(r => setUser(r.data.user)).catch(() => setToken(null)).finally(() => setChecking(false)); }, []);
  useEffect(() => { if (user) load().catch(e => { if(e.response?.status===401){setToken(null);setUser(null);} }); }, [user]);
  async function download(f){ setMsg(""); try { const device=localStorage.getItem("ss3-device")||crypto.randomUUID(); localStorage.setItem("ss3-device",device); const r=await API.get(`/downloads/${f.id}`,{responseType:"blob",headers:{"x-device-id":device}}); const u=URL.createObjectURL(r.data),a=document.createElement("a"); a.href=u;a.download=f.name;a.click();URL.revokeObjectURL(u);setMsg("Download completed successfully.");await load(); } catch(e){ let m=e.response?.data?.message||"Download failed.";if(e.response?.data instanceof Blob)try{m=JSON.parse(await e.response.data.text()).message||m}catch{}setMsg(m);await load(); } }
  if(checking)return <div className="loading">Loading…</div>; if(!user)return <Auth done={setUser}/>;
  return <div><header><div className="brand">Stream<span>Sphere</span></div><nav><button className={tab==="downloads"?"active":""} onClick={()=>setTab("downloads")}>Downloads</button><button className={tab==="subscriptions"?"active":""} onClick={()=>setTab("subscriptions")}>Subscriptions</button></nav><div className="user"><b>{user.name}</b><button onClick={()=>{setToken(null);setUser(null)}}>Log out</button></div></header><main className="wrap">{tab==="downloads"?<Downloads data={data} history={history} msg={msg} load={load} download={download} plan={current.plan}/>:<Subscription current={current} reload={load} setMsg={setMsg}/>}</main></div>;
}

createRoot(document.getElementById("root")).render(<App/>);
