import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, ComposedChart, Bar, Line
} from "recharts";

/* ─── THEME ──────────────────────────────────────────────────── */
const T = {
  bg: "#0a0b0f", surface: "#11141c", card: "#181c28",
  border: "#1e2438", borderLight: "#252d44",
  gold: "#d4a847", teal: "#2dd4bf", rose: "#f87171",
  violet: "#818cf8", amber: "#fb923c", green: "#4ade80", lime: "#a3e635",
  text: "#e2e8f0", muted: "#64748b", faint: "#374151",
};
const CAT_COLORS = {
  bydleni:"#818cf8", jidlo:"#2dd4bf", doprava:"#fb923c",
  deti:"#f472b6", sluzby:"#a78bfa", zdravi:"#34d399",
  volnyCas:"#60a5fa", ostatni:"#94a3b8",
};

/* ─── UTILS ──────────────────────────────────────────────────── */
const czk = v => new Intl.NumberFormat("cs-CZ",{style:"currency",currency:"CZK",maximumFractionDigits:0}).format(Math.round(v));
const num  = v => new Intl.NumberFormat("cs-CZ",{maximumFractionDigits:0}).format(Math.round(v));

/* ─── GLOBAL CSS ─────────────────────────────────────────────── */
if (!document.getElementById("fp-css")) {
  const _s = document.createElement("style");
  _s.id = "fp-css";
  _s.textContent = `
    *,*::before,*::after{box-sizing:border-box}
    input[type=range]{-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;background:transparent}
    input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px}
    input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:#1e2438}
    input[type=range]::-webkit-slider-thumb{
      -webkit-appearance:none;width:16px;height:16px;border-radius:50%;
      background:var(--c,#d4a847);border:2.5px solid #0a0b0f;cursor:pointer;
      margin-top:-6px;box-shadow:0 0 8px var(--c,#d4a847);transition:transform .12s}
    input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.25)}
    input[type=range]::-moz-range-thumb{
      width:14px;height:14px;border-radius:50%;
      background:var(--c,#d4a847);border:2.5px solid #0a0b0f;cursor:pointer;
      box-shadow:0 0 8px var(--c,#d4a847)}
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
    input[type=number]{-moz-appearance:textfield}
    ::-webkit-scrollbar{width:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:#1e2438;border-radius:2px}
  `;
  document.head.appendChild(_s);
}

/* ─── PERSISTENT STORAGE HOOK ───────────────────────────────── */
function useLS(key, defaultVal) {
  const [val, setVal] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultVal;
    } catch { return defaultVal; }
  });
  const setter = useCallback((v) => {
    setVal(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [val, setter];
}


/* ─── BREAKPOINT ─────────────────────────────────────────────── */
function useBreakpoint() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return { isMobile: w < 700, isTablet: w < 1060 };
}

/* ─── SIMULATION ─────────────────────────────────────────────── */
function simulate({ initial, annualReturn, inflation, mgmtFee, perfFee, useHwm, phases, totalYears }) {
  const mr = annualReturn / 100 / 12, mf = mgmtFee / 100 / 12, netMr = mr - mf;
  const inflMr = (inflation || 0) / 100 / 12;
  let port = initial, portGross = initial, portNoPerf = initial;
  let totalIn = initial, totalOut = 0, hwm = initial, annualStart = initial;
  const rows = [{ year:0, value:Math.round(port), gross:Math.round(portGross), noPerf:Math.round(portNoPerf),
    real:Math.round(port), invested:Math.round(totalIn), out:0, annualFlow:0 }];
  for (let m = 1; m <= totalYears * 12; m++) {
    const yc = Math.ceil(m / 12);
    const ph = phases.find(p => yc >= p.startYear && yc <= p.endYear);
    const mo = ph ? ph.amount : 0, withdraw = ph?.type === "withdraw";
    port = port*(1+netMr); portGross = portGross*(1+mr); portNoPerf = portNoPerf*(1+netMr);
    if (!withdraw) { port+=mo; portGross+=mo; portNoPerf+=mo; totalIn+=mo; }
    else { const w=Math.min(mo,port); port-=w; portGross-=w; portNoPerf-=w; totalOut+=w; }
    if (m%12===0 && perfFee>0) {
      const gain=port-annualStart;
      if (gain>0){const base=useHwm?Math.max(0,port-hwm):gain; port-=base*perfFee/100;}
      if (port>hwm) hwm=port;
      annualStart=port;
    }
    port = Math.max(0, port);
    if (m%12===0) {
      const yr = m/12;
      const inflFactor = Math.pow(1 + (inflation||0)/100, yr);
      rows.push({ year:yr, value:Math.round(port), gross:Math.round(portGross), noPerf:Math.round(portNoPerf),
        real:Math.round(port/inflFactor), invested:Math.round(totalIn),
        gains:Math.round(Math.max(0,port-(totalIn-totalOut))),
        out:Math.round(totalOut), annualFlow: withdraw?-mo:mo });
    }
  }
  return rows;
}

/* ─── FIRE YEAR ──────────────────────────────────────────────── */
function findFireYear(data, monthlyTarget) {
  // 4% rule: portfolio >= monthlyTarget * 12 / 0.04
  const needed = monthlyTarget * 12 / 0.04;
  const row = data.find(r => r.value >= needed);
  return row ? row.year : null;
}

/* ─── TOOLTIP ────────────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const a = payload.find(p=>p.name?.includes("(A)"));
  const b = payload.find(p=>p.name?.includes("(B)"));
  return (
    <div style={{background:T.card,border:`1px solid ${T.borderLight}`,borderRadius:10,padding:"12px 16px",minWidth:210,boxShadow:"0 20px 40px rgba(0,0,0,.7)"}}>
      <p style={{color:T.gold,fontSize:11,fontWeight:700,marginBottom:9,letterSpacing:1}}>ROK {label}</p>
      {payload.map((p,i)=>p.value!=null&&p.value!==0&&(
        <div key={i} style={{display:"flex",justifyContent:"space-between",gap:18,marginBottom:4}}>
          <span style={{color:p.color,fontSize:10,display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:p.color,display:"inline-block",flexShrink:0}}/>{p.name}
          </span>
          <span style={{color:T.text,fontSize:11,fontWeight:700}}>{czk(p.value)}</span>
        </div>
      ))}
      {a?.value&&b?.value&&(
        <div style={{marginTop:7,paddingTop:7,borderTop:`1px solid ${T.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:10,color:T.muted}}>Rozdíl B − A</span>
            <span style={{fontSize:11,fontWeight:700,color:b.value>=a.value?T.lime:T.rose}}>
              {b.value>=a.value?"+":""}{czk(b.value-a.value)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── SLIDER ROW (Step 1) — thumb color = track color ───────── */
const SliderRow = ({ label, value, onChange, softMax, step, color=T.gold, annual, sub }) => {
  const [raw, setRaw] = useState("");
  const [editing, setEditing] = useState(false);
  const sliderMax = Math.max(softMax, value);
  const pct = sliderMax>0 ? Math.min(100,(value/sliderMax)*100) : 0;
  const commit = useCallback(()=>{
    setEditing(false);
    const p = parseInt(raw.replace(/\s/g,""),10);
    if(!isNaN(p)&&p>=0) onChange(p); else setRaw("");
  },[raw,onChange]);
  useEffect(()=>{ if(!editing) setRaw(""); },[editing]);
  return (
    <div style={{padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7,gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,color:T.text}}>{label}</div>
          <div style={{fontSize:10,color:T.muted,marginTop:2}}>{annual?`Ročně → ${czk(value/12)}/měs.`:(sub||"Měsíčně")}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
          <input type="number" value={editing?raw:value}
            onFocus={()=>{setEditing(true);setRaw(String(value));}}
            onChange={e=>setRaw(e.target.value)} onBlur={commit}
            onKeyDown={e=>e.key==="Enter"&&commit()}
            style={{width:86,background:editing?T.card:"transparent",border:`1px solid ${editing?color:(value>0?T.borderLight:T.border)}`,
              borderRadius:6,color:value>0?color:T.faint,padding:"4px 7px",fontSize:12,fontWeight:700,
              fontFamily:"inherit",outline:"none",textAlign:"right",transition:"border-color .15s,background .15s"}}/>
          <span style={{fontSize:11,color:T.muted}}>Kč</span>
        </div>
      </div>
      <input type="range" min={0} max={sliderMax} step={step} value={Math.min(value,sliderMax)}
        onChange={e=>onChange(Number(e.target.value))}
        style={{"--c":color,width:"100%",height:4,borderRadius:2,background:`linear-gradient(to right,${color} ${pct}%,${T.border} ${pct}%)`}}/>
      {value>softMax&&<div style={{fontSize:9,color:T.amber,marginTop:2}}>⚠ Nad typickým rozsahem ({czk(softMax)})</div>}
    </div>
  );
};

/* ─── SMALL SLIDER (Step 2 + sub-sections) ──────────────────── */
const SSlider = ({ label, value, onChange, min, max, step, fmt, color=T.gold }) => {
  const [raw, setRaw] = useState("");
  const [editing, setEditing] = useState(false);
  const pct = Math.min(100,Math.max(0,((value-min)/(max-min))*100));
  const commit = useCallback(()=>{
    setEditing(false);
    const p = parseFloat(raw.replace(/\s/g,"").replace(",","."));
    if(!isNaN(p)) onChange(Math.min(max,Math.max(min,p))); else setRaw("");
  },[raw,min,max,onChange]);
  return (
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:8}}>
        <label style={{fontSize:11,color:T.muted,flex:1}}>{label}</label>
        <input type={editing?"number":"text"} value={editing?raw:(fmt?fmt(value):value)}
          onFocus={()=>{setEditing(true);setRaw(String(value));}}
          onChange={e=>setRaw(e.target.value)} onBlur={commit}
          onKeyDown={e=>e.key==="Enter"&&commit()}
          style={{width:108,background:editing?T.card:"transparent",border:`1px solid ${editing?color:T.border}`,
            borderRadius:6,color,padding:"4px 8px",fontSize:13,fontWeight:700,
            fontFamily:"inherit",outline:"none",textAlign:"right",transition:"border-color .15s"}}/>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(Number(e.target.value))}
        style={{"--c":color,width:"100%",height:4,borderRadius:2,background:`linear-gradient(to right,${color} ${pct}%,${T.border} ${pct}%)`}}/>
    </div>
  );
};

/* ─── TOGGLES ────────────────────────────────────────────────── */
const Toggle = ({label,sub,checked,onChange}) => (
  <div style={{padding:"11px 0",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
    <div style={{flex:1}}><div style={{fontSize:12,color:T.text}}>{label}</div><div style={{fontSize:10,color:T.muted,marginTop:2}}>{sub}</div></div>
    <div onClick={()=>onChange(!checked)} style={{width:42,height:24,borderRadius:12,flexShrink:0,background:checked?T.gold:T.border,position:"relative",transition:"background .2s",cursor:"pointer"}}>
      <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:checked?21:3,transition:"left .2s"}}/>
    </div>
  </div>
);
const SToggle = ({label,checked,onChange}) => (
  <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:10}}>
    <div onClick={()=>onChange(!checked)} style={{width:36,height:20,borderRadius:10,background:checked?T.gold:T.border,position:"relative",transition:"background .2s",flexShrink:0,cursor:"pointer"}}>
      <div style={{width:14,height:14,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:checked?19:3,transition:"left .2s"}}/>
    </div>
    {label&&<span style={{fontSize:11,color:T.muted}}>{label}</span>}
  </label>
);

/* ─── STAT CARD ──────────────────────────────────────────────── */
// minWidth:140 → cards wrap to next row on narrow containers instead of squeezing
const StatCard = ({label,value,sub,color,icon}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",
    flex:"1 1 140px",minWidth:140,maxWidth:"100%",borderTop:`2px solid ${color||T.border}`}}>
    <div style={{fontSize:9,color:T.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>{icon} {label}</div>
    <div style={{fontSize:17,fontWeight:800,color:color||T.text,letterSpacing:-0.5,wordBreak:"break-all"}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:T.muted,marginTop:4}}>{sub}</div>}
  </div>
);

/* ─── CAT HEAD ───────────────────────────────────────────────── */
const CatHead = ({num:n,label,color,total,collapsed,onToggle}) => (
  <div onClick={onToggle} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 0 10px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,userSelect:"none"}}>
    <span style={{width:8,height:8,borderRadius:2,background:color,flexShrink:0}}/>
    <span style={{fontSize:10,fontWeight:800,color,letterSpacing:2,textTransform:"uppercase",flex:1}}>{n}. {label}</span>
    {total>0&&<span style={{fontSize:11,color:T.muted,fontWeight:600}}>{czk(total)}/měs.</span>}
    <span style={{fontSize:11,color:T.muted,display:"inline-block",transform:collapsed?"rotate(-90deg)":"rotate(0deg)",transition:"transform .2s",flexShrink:0}}>▾</span>
  </div>
);

/* ─── SECTION HEAD (Step 2) ──────────────────────────────────── */
const SecHead = ({label,icon,color=T.gold}) => (
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
    <span style={{fontSize:12}}>{icon}</span>
    <span style={{fontSize:10,fontWeight:800,color,letterSpacing:2,textTransform:"uppercase"}}>{label}</span>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   KROK 1
═══════════════════════════════════════════════════════════════ */
function Step1({onNext,suggestedMonthly,setSuggestedMonthly}) {
  const {isMobile} = useBreakpoint();
  const [showSummary,setShowSummary] = useState(false);
  const formRef = useRef(null);

  const [income,setIncome] = useLS("fp_income", 50000);
  const [col,setCol] = useLS("fp_col", {bydleni:true,jidlo:true,doprava:true,deti:true,sluzby:true,zdravi:true,volnyCas:true,ostatni:true});
  const toggleCat = useCallback(k=>setCol(c=>({...c,[k]:!c[k]})),[]);

  const [v,sv] = useLS("fp_v", {
    najem:0,elektrina:0,plyn:0,voda:0,teplo:0,svj:0,odpad:0,danNem:0,internet:0,pojNem:0,udrzba:0,
    potraviny:0,obedy:0,restaurace:0,drogerie:0,kaficka:0,
    splatkaAuta:0,povinne:0,havarijni:0,servisAuta:0,mhd:0,
    skolne:0,krouzky:0,pomucky:0,obleceniDeti:0,plenky:0,vyletyDeti:0,kapesne:0,
    mobil:0,predplatne:0,leky:0,doplnky:0,kadernik:0,bryle:0,
    kino:0,vylety:0,knihy:0,konicky:0,dovolena:0,
    darkyVanoce:0,darkyOstatni:0,mazlicek:0,zivotni:0,penzijni:0,urazove:0,splatkyDluhu:0,nezarazene:0,
  });
  const setV = useCallback(k=>val=>sv(p=>({...p,[k]:val})),[]);

  const [annualKm,setAnnualKm]       = useLS("fp_annualKm", 15000);
  const [consumption,setConsumption] = useLS("fp_consumption", 7.0);
  const [fuelPrice,setFuelPrice]     = useLS("fp_fuelPrice", 38.0);
  const [hasCar,setHasCar]           = useLS("fp_hasCar", true);
  const [dalnicni,setDalnicni]       = useLS("fp_dalnicni", false);
  const [tv,setTv]                   = useLS("fp_tv", false);

  const monthlyFuel = useMemo(()=>Math.round((annualKm/100*consumption*fuelPrice)/12),[annualKm,consumption,fuelPrice]);

  const M = useMemo(()=>{
    const a=k=>(v[k]||0)/12, m=k=>v[k]||0;
    return {
      bydleni: m("najem")+m("elektrina")+m("plyn")+m("voda")+m("teplo")+m("svj")+a("odpad")+a("danNem")+m("internet")+a("pojNem")+a("udrzba"),
      jidlo:   m("potraviny")+m("obedy")+m("restaurace")+m("drogerie")+m("kaficka"),
      doprava: (hasCar?(m("splatkaAuta")+monthlyFuel+a("povinne")+a("havarijni")+(dalnicni?2440/12:0)+m("servisAuta")):0)+m("mhd"),
      deti:    m("skolne")+m("krouzky")+m("pomucky")+m("obleceniDeti")+m("plenky")+m("vyletyDeti")+m("kapesne"),
      sluzby:  m("mobil")+(tv?205:0)+m("predplatne"),
      zdravi:  m("leky")+m("doplnky")+m("kadernik")+m("bryle"),
      volnyCas:m("kino")+m("vylety")+m("knihy")+m("konicky")+a("dovolena"),
      ostatni: a("darkyVanoce")+a("darkyOstatni")+m("mazlicek")+m("zivotni")+m("penzijni")+m("urazove")+m("splatkyDluhu")+m("nezarazene"),
    };
  },[v,monthlyFuel,dalnicni,tv]);

  const totalExpenses = useMemo(()=>Object.values(M).reduce((s,x)=>s+x,0),[M]);
  const available = income - totalExpenses;
  const savingsRate = income>0?((Math.max(0,available)/income)*100).toFixed(1):0;

  const catRows = [
    {key:"bydleni",label:"Bydlení a energie"},{key:"jidlo",label:"Jídlo a drogerie"},
    {key:"doprava",label:"Doprava"},{key:"deti",label:"Děti"},
    {key:"sluzby",label:"Služby"},{key:"zdravi",label:"Zdraví"},
    {key:"volnyCas",label:"Volný čas"},{key:"ostatni",label:"Ostatní"},
  ];
  const maxCatVal = Math.max(...Object.values(M),1);

  const formContent = (
    <>
      <div style={{marginBottom:16,padding:"12px 14px",background:`${T.green}10`,border:`1px solid ${T.green}28`,borderRadius:10}}>
        <div style={{fontSize:9,color:T.green,fontWeight:800,marginBottom:10,letterSpacing:1,textTransform:"uppercase"}}>Čistý měsíční příjem domácnosti</div>
        <div style={{fontSize:9,color:T.green+"99",marginBottom:6}}>Zahrnuje zaměstnání, podnikání, pronájmy atd. (měsíčně)</div>
        <SSlider label="" value={income} onChange={setIncome} min={5000} max={250000} step={500} fmt={czk} color={T.green}/>
        <div style={{fontSize:18,fontWeight:900,color:T.green,marginTop:-6}}>{czk(income)}</div>
      </div>

      <CatHead num={1} label="Bydlení a energie" color={CAT_COLORS.bydleni} total={M.bydleni} collapsed={col.bydleni} onToggle={()=>toggleCat("bydleni")}/>
      {!col.bydleni&&<>
        <SliderRow label="Nájem/splátka hypotéky"   value={v.najem}     onChange={setV("najem")}     softMax={60000}  step={500}/>
        <SliderRow label="Záloha na elektřinu"       value={v.elektrina} onChange={setV("elektrina")} softMax={6000}   step={50}/>
        <SliderRow label="Záloha na plyn"            value={v.plyn}      onChange={setV("plyn")}      softMax={5000}   step={50}/>
        <SliderRow label="Záloha na vodu"            value={v.voda}      onChange={setV("voda")}      softMax={5000}   step={50}/>
        <SliderRow label="Záloha na teplo"           value={v.teplo}     onChange={setV("teplo")}     softMax={6000}   step={50}/>
        <SliderRow label="Poplatky družstvu/SVJ"     value={v.svj}       onChange={setV("svj")}       softMax={5000}   step={50}/>
        <SliderRow label="Odvoz odpadu"              value={v.odpad}     onChange={setV("odpad")}     softMax={5000}   step={100} annual/>
        <SliderRow label="Daň z nemovitosti"         value={v.danNem}    onChange={setV("danNem")}    softMax={50000}  step={200} annual/>
        <SliderRow label="Internet"                  value={v.internet}  onChange={setV("internet")}  softMax={3000}   step={50}/>
        <SliderRow label="Pojištění nemovitosti"     value={v.pojNem}    onChange={setV("pojNem")}    softMax={20000}  step={200} annual/>
        <SliderRow label="Údržba domu/bytu"          value={v.udrzba}    onChange={setV("udrzba")}    softMax={100000} step={500} annual/>
      </>}

      <CatHead num={2} label="Jídlo a drogerie" color={CAT_COLORS.jidlo} total={M.jidlo} collapsed={col.jidlo} onToggle={()=>toggleCat("jidlo")}/>
      {!col.jidlo&&<>
        <SliderRow label="Nákup potravin"     value={v.potraviny}  onChange={setV("potraviny")}  softMax={25000} step={200}/>
        <SliderRow label="Obědy (práce/škola)"value={v.obedy}      onChange={setV("obedy")}      softMax={8000}  step={100}/>
        <SliderRow label="Restaurace a dovoz" value={v.restaurace} onChange={setV("restaurace")} softMax={15000} step={200}/>
        <SliderRow label="Drogerie"           value={v.drogerie}   onChange={setV("drogerie")}   softMax={5000}  step={50}/>
        <SliderRow label="Kafíčka a ostatní"  value={v.kaficka}    onChange={setV("kaficka")}    softMax={5000}  step={50}/>
      </>}

      <CatHead num={3} label="Doprava" color={CAT_COLORS.doprava} total={M.doprava} collapsed={col.doprava} onToggle={()=>toggleCat("doprava")}/>
      {!col.doprava&&<>
        <div style={{padding:"10px 0",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div>
            <div style={{fontSize:12,color:T.text}}>Máte auto?</div>
            <div style={{fontSize:10,color:T.muted,marginTop:2}}>Zobrazí detailní výdaje na vozidlo</div>
          </div>
          <div style={{display:"flex",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
            <button onClick={()=>setHasCar(true)}
              style={{padding:"6px 20px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:800,
                background:hasCar?T.teal:"transparent",color:hasCar?T.bg:T.muted,transition:"all .15s"}}>ANO</button>
            <button onClick={()=>setHasCar(false)}
              style={{padding:"6px 20px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:800,
                background:!hasCar?T.rose:"transparent",color:!hasCar?T.bg:T.muted,transition:"all .15s"}}>NE</button>
          </div>
        </div>
        {hasCar&&<>
        <SliderRow label="Splátka auta" value={v.splatkaAuta} onChange={setV("splatkaAuta")} softMax={25000} step={200}/>
        <div style={{padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div><div style={{fontSize:12,color:T.text}}>Pohonné hmoty</div><div style={{fontSize:10,color:T.muted,marginTop:2}}>Počítáno z nájezdu</div></div>
            <span style={{fontSize:13,fontWeight:700,color:T.amber}}>{czk(monthlyFuel)}/měs.</span>
          </div>
          <div style={{background:T.card,borderRadius:8,padding:"10px 12px",border:`1px solid ${T.border}`}}>
            <SSlider label="Roční nájezd"  value={annualKm}    onChange={setAnnualKm}    min={500}  max={100000} step={500}  fmt={v=>`${num(v)} km`}          color={T.amber}/>
            <SSlider label="Spotřeba"      value={consumption} onChange={setConsumption} min={3}    max={30}     step={0.1}  fmt={v=>`${v.toFixed(1)} l/100`}  color={T.amber}/>
            <SSlider label="Cena PHM"      value={fuelPrice}   onChange={setFuelPrice}   min={20}   max={100}    step={0.5}  fmt={v=>`${v.toFixed(1)} Kč/l`}   color={T.amber}/>
            <div style={{fontSize:9,color:T.muted,marginTop:-8}}>{num(annualKm)}km × {consumption.toFixed(1)}l × {fuelPrice.toFixed(1)}Kč ÷ 12 = <strong style={{color:T.amber}}>{czk(monthlyFuel)}/měs.</strong></div>
          </div>
        </div>
        <SliderRow label="Povinné ručení"    value={v.povinne}    onChange={setV("povinne")}    softMax={20000} step={200} annual/>
        <SliderRow label="Havarijní pojištění" value={v.havarijni} onChange={setV("havarijni")} softMax={40000} step={500} annual/>
        <Toggle label="Dálniční známka" sub="Fixní částka 2 440 Kč / rok" checked={dalnicni} onChange={setDalnicni}/>
        <SliderRow label="Servis a údržba" value={v.servisAuta} onChange={setV("servisAuta")} softMax={8000} step={100}/>
        </>}
        <SliderRow label="MHD a vlak"      value={v.mhd}       onChange={setV("mhd")}       softMax={5000} step={100}/>
      </>}

      <CatHead num={4} label="Děti" color={CAT_COLORS.deti} total={M.deti} collapsed={col.deti} onToggle={()=>toggleCat("deti")}/>
      {!col.deti&&<>
        <SliderRow label="Školné a školkovné"    value={v.skolne}       onChange={setV("skolne")}       softMax={30000} step={200}/>
        <SliderRow label="Kroužky a sport"       value={v.krouzky}      onChange={setV("krouzky")}      softMax={10000} step={200}/>
        <SliderRow label="Školní pomůcky"        value={v.pomucky}      onChange={setV("pomucky")}      softMax={5000}  step={100}/>
        <SliderRow label="Oblečení a obuv"       value={v.obleceniDeti} onChange={setV("obleceniDeti")} softMax={8000}  step={100}/>
        <SliderRow label="Plenky a umělá výživa" value={v.plenky}       onChange={setV("plenky")}       softMax={8000}  step={100}/>
        <SliderRow label="Výlety"                value={v.vyletyDeti}   onChange={setV("vyletyDeti")}   softMax={8000}  step={100}/>
        <SliderRow label="Kapesné"               value={v.kapesne}      onChange={setV("kapesne")}      softMax={5000}  step={50}/>
      </>}

      <CatHead num={5} label="Služby" color={CAT_COLORS.sluzby} total={M.sluzby} collapsed={col.sluzby} onToggle={()=>toggleCat("sluzby")}/>
      {!col.sluzby&&<>
        <SliderRow label="Mobilní tarify"                   value={v.mobil}      onChange={setV("mobil")}      softMax={5000} step={50}/>
        <Toggle label="TV a rozhlasové poplatky" sub="Fixní částka 205 Kč / měsíc" checked={tv} onChange={setTv}/>
        <SliderRow label="Předplatné (Netflix, Spotify, podcasty...)" value={v.predplatne} onChange={setV("predplatne")} softMax={3000} step={50}/>
      </>}

      <CatHead num={6} label="Zdraví" color={CAT_COLORS.zdravi} total={M.zdravi} collapsed={col.zdravi} onToggle={()=>toggleCat("zdravi")}/>
      {!col.zdravi&&<>
        <SliderRow label="Léky a antikoncepce" value={v.leky}     onChange={setV("leky")}     softMax={5000} step={50}/>
        <SliderRow label="Doplňky stravy"      value={v.doplnky}  onChange={setV("doplnky")}  softMax={5000} step={50}/>
        <SliderRow label="Kadeřník/holič"      value={v.kadernik} onChange={setV("kadernik")} softMax={3000} step={50}/>
        <SliderRow label="Brýle/čočky"         value={v.bryle}    onChange={setV("bryle")}    softMax={5000} step={50}/>
      </>}

      <CatHead num={7} label="Volný čas" color={CAT_COLORS.volnyCas} total={M.volnyCas} collapsed={col.volnyCas} onToggle={()=>toggleCat("volnyCas")}/>
      {!col.volnyCas&&<>
        <SliderRow label="Kino, divadlo, koncerty" value={v.kino}     onChange={setV("kino")}     softMax={8000}   step={100}/>
        <SliderRow label="Výlety"                  value={v.vylety}   onChange={setV("vylety")}   softMax={8000}   step={100}/>
        <SliderRow label="Knihy a hry"             value={v.knihy}    onChange={setV("knihy")}    softMax={5000}   step={50}/>
        <SliderRow label="Koníčky"                 value={v.konicky}  onChange={setV("konicky")}  softMax={10000}  step={100}/>
        <SliderRow label="Letní a zimní dovolená"  value={v.dovolena} onChange={setV("dovolena")} softMax={200000} step={1000} annual/>
      </>}

      <CatHead num={8} label="Ostatní" color={CAT_COLORS.ostatni} total={M.ostatni} collapsed={col.ostatni} onToggle={()=>toggleCat("ostatni")}/>
      {!col.ostatni&&<>
        <SliderRow label="Dárky na Vánoce"           value={v.darkyVanoce}  onChange={setV("darkyVanoce")}  softMax={30000} step={500}  annual/>
        <SliderRow label="Ostatní dárky"             value={v.darkyOstatni} onChange={setV("darkyOstatni")} softMax={20000} step={500}  annual/>
        <SliderRow label="Domácí mazlíček"           value={v.mazlicek}     onChange={setV("mazlicek")}     softMax={8000}  step={100}/>
        <SliderRow label="Životní pojištění"         value={v.zivotni}      onChange={setV("zivotni")}      softMax={5000}  step={100}/>
        <SliderRow label="Penzijní připojištění"     value={v.penzijni}     onChange={setV("penzijni")}     softMax={5000}  step={100}/>
        <SliderRow label="Úrazové pojištění"         value={v.urazove}      onChange={setV("urazove")}      softMax={3000}  step={50}/>
        <SliderRow label="Ostatní splátky dluhů"     value={v.splatkyDluhu} onChange={setV("splatkyDluhu")} softMax={30000} step={200}/>
        <SliderRow label="Ostatní nezařazené výdaje" value={v.nezarazene}   onChange={setV("nezarazene")}   softMax={15000} step={200}/>
      </>}
      <div style={{height:20}}/>
    </>
  );

  const summaryContent = (
    <div style={{display:"flex",flexDirection:"column",gap:14,flex:1}}>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <StatCard icon="💰" label="Čistý příjem"       value={czk(income)}               color={T.green}/>
        <StatCard icon="💸" label="Výdaje celkem"      value={czk(totalExpenses)}         color={T.rose}  sub={`${((totalExpenses/Math.max(income,1))*100).toFixed(1)} % příjmu`}/>
        <StatCard icon="◈"  label="Volné na investice" value={czk(Math.max(0,available))}
          color={available>=0?T.gold:T.rose} sub={`Míra úspor: ${savingsRate} %`}/>
      </div>

      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px",flex:1}}>
        <div style={{fontSize:10,color:T.muted,marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Rozložení výdajů</div>
        {catRows.map(({key,label})=>{
          const val=M[key], pct=income>0?(val/income)*100:0;
          const barW=maxCatVal>0?(val/maxCatVal)*100:0;
          const color=CAT_COLORS[key];
          return (
            <div key={key} style={{marginBottom:11}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <span style={{width:7,height:7,borderRadius:2,background:color,display:"inline-block",flexShrink:0}}/>
                  <span style={{fontSize:11,color:val>0?T.text:T.muted}}>{label}</span>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
                  <span style={{fontSize:10,color:T.muted}}>{pct.toFixed(1)} %</span>
                  <span style={{fontSize:12,fontWeight:700,color:val>0?color:T.faint,minWidth:80,textAlign:"right"}}>{czk(val)}</span>
                </div>
              </div>
              <div style={{background:T.border,borderRadius:4,height:7,overflow:"hidden"}}>
                <div style={{width:`${barW}%`,background:`linear-gradient(to right,${color}99,${color})`,height:"100%",borderRadius:4,transition:"width .35s",minWidth:val>0?4:0}}/>
              </div>
            </div>
          );
        })}
        <div style={{marginTop:16,paddingTop:14,borderTop:`2px solid ${T.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:700,color:available>=0?T.gold:T.rose}}>{available>=0?"✅ Volné na investice":"❌ Deficit"}</span>
            <span style={{fontSize:18,fontWeight:900,color:available>=0?T.gold:T.rose}}>{czk(Math.abs(available))}</span>
          </div>
          <div style={{background:T.border,borderRadius:4,height:10,overflow:"hidden"}}>
            <div style={{width:`${Math.min(Math.max(0,(available/income)*100),100)}%`,background:available>=0?`linear-gradient(to right,#a8832e,${T.gold})`:T.rose,height:"100%",borderRadius:4,transition:"width .35s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
            <span style={{fontSize:9,color:T.muted}}>Výdaje: {czk(totalExpenses)}/měs.</span>
            <span style={{fontSize:9,color:T.muted}}>Příjem: {czk(income)}/měs.</span>
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:T.muted}}>Měsíční vklad pro Krok 2:</span>
        <input type="number" value={suggestedMonthly} onChange={e=>setSuggestedMonthly(Number(e.target.value))}
          style={{width:110,background:T.card,border:`1px solid ${T.gold}50`,borderRadius:6,color:T.gold,padding:"7px 10px",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
        {available>0&&(
          <button onClick={()=>setSuggestedMonthly(Math.max(0,Math.round(available)))}
            style={{padding:"7px 13px",background:"transparent",border:`1px solid ${T.gold}40`,borderRadius:7,color:T.gold,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
            Použít volné ({czk(available)})
          </button>
        )}
        <button onClick={onNext}
          style={{padding:"9px 22px",background:T.gold,border:"none",borderRadius:8,color:T.bg,fontWeight:900,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginLeft:"auto"}}>
          Krok 2 →
        </button>
      </div>
    </div>
  );

  const panelSt = {width:isMobile?"100%":420,minWidth:isMobile?0:380,overflowY:"auto",padding:isMobile?"14px":"18px 20px",background:T.surface,borderRight:isMobile?"none":`1px solid ${T.border}`,scrollbarWidth:"thin",scrollbarColor:`${T.border} transparent`};

  if (isMobile) return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{display:"flex",background:T.card,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        {[{id:false,label:"📝 Výdaje"},{id:true,label:"📊 Přehled"}].map(t=>(
          <button key={String(t.id)} onClick={()=>setShowSummary(t.id)}
            style={{flex:1,padding:"10px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:700,
              background:showSummary===t.id?`${T.gold}18`:"transparent",color:showSummary===t.id?T.gold:T.muted,
              borderBottom:showSummary===t.id?`2px solid ${T.gold}`:"2px solid transparent"}}>
            {t.label}
          </button>
        ))}
      </div>
      <div ref={formRef} style={{...panelSt,display:showSummary?"none":"block"}}>{formContent}</div>
      <div style={{display:showSummary?"flex":"none",flexDirection:"column",padding:"16px 14px",gap:14,overflow:"auto",flex:1}}>{summaryContent}</div>
    </div>
  );

  return (
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      <div ref={formRef} style={panelSt}>{formContent}</div>
      <div style={{flex:1,display:"flex",flexDirection:"column",padding:"22px 26px",gap:14,overflow:"auto"}}>{summaryContent}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KROK 2
═══════════════════════════════════════════════════════════════ */
function Step2({defaultMonthly}) {
  const {isMobile,isTablet} = useBreakpoint();
  const [showPanel,setShowPanel] = useState("settings");

  /* ── Params A ── */
  const [initial,setInitial]           = useState(100000);
  const [annualReturn,setAnnualReturn] = useState(8);
  const [inflation,setInflation]       = useState(2.1);
  const [mgmtFee,setMgmtFee]           = useState(0.5);
  const [perfFee,setPerfFee]           = useState(0);
  const [useHwm,setUseHwm]             = useState(true);
  const [applyTax,setApplyTax]         = useState(true);
  const [taxRate,setTaxRate]           = useState(15);
  const [timeTest,setTimeTest]         = useState(false);
  const [showReal,setShowReal]         = useState(true);
  /* ── Params B ── */
  const [showB,setShowB]               = useState(false);
  const [initialB,setInitialB]         = useState(100000);
  const [annualReturnB,setAnnualReturnB]=useState(9);
  const [mgmtFeeB,setMgmtFeeB]         = useState(1.0);
  const [perfFeeB,setPerfFeeB]         = useState(10);
  const [useHwmB,setUseHwmB]           = useState(true);
  /* ── FIRE target ── */
  const [fireTarget,setFireTarget]     = useState(30000);
  /* ── Chart ── */
  const [chartMode,setChartMode]       = useState("value");

  const [phases,setPhases] = useState([
    {id:1,startYear:1, endYear:5,  amount:defaultMonthly||2000,type:"contribute"},
    {id:2,startYear:6, endYear:15, amount:(defaultMonthly||2000)*2,type:"contribute"},
    {id:3,startYear:16,endYear:25, amount:(defaultMonthly||2000)*4,type:"contribute"},
    {id:4,startYear:26,endYear:35, amount:5000,type:"withdraw"},
  ]);
  const totalYears  = useMemo(()=>Math.max(...phases.map(p=>p.endYear),5),[phases]);
  const addPhase    = ()=>{const l=phases[phases.length-1];const st=l?l.endYear+1:1;setPhases(p=>[...p,{id:Date.now(),startYear:st,endYear:st+9,amount:5000,type:"contribute"}]);};
  const removePhase = useCallback(id=>setPhases(p=>p.filter(x=>x.id!==id)),[]);
  const editPhase   = useCallback((id,f,val)=>setPhases(p=>p.map(x=>x.id===id?{...x,[f]:val}:x)),[]);

  const dataA = useMemo(()=>simulate({initial,annualReturn,inflation,mgmtFee,perfFee,useHwm,phases,totalYears}),
    [initial,annualReturn,inflation,mgmtFee,perfFee,useHwm,phases,totalYears]);
  const dataB = useMemo(()=>showB
    ?simulate({initial:initialB,annualReturn:annualReturnB,inflation,mgmtFee:mgmtFeeB,perfFee:perfFeeB,useHwm:useHwmB,phases,totalYears})
    :null,[showB,initialB,annualReturnB,inflation,mgmtFeeB,perfFeeB,useHwmB,phases,totalYears]);

  const chartData = useMemo(()=>dataA.map((row,i)=>({
    ...row, valueB:dataB?.[i]?.value, grossB:dataB?.[i]?.gross, realB:dataB?.[i]?.real,
  })),[dataA,dataB]);

  const finA = dataA[dataA.length-1];
  const finB = dataB?.[dataB.length-1];
  const taxPaidA  = applyTax&&!timeTest?Math.max(0,finA.value-finA.invested)*taxRate/100:0;
  const feesCostA = finA.gross-finA.value;
  const fireYear  = useMemo(()=>findFireYear(dataA,fireTarget),[dataA,fireTarget]);
  const yFmt = v=>v>=1e6?`${(v/1e6).toFixed(1)}M`:v>=1e3?`${(v/1e3).toFixed(0)}k`:v;
  const gd=(id,color,o1=0.2)=>(
    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%"  stopColor={color} stopOpacity={o1}/>
      <stop offset="95%" stopColor={color} stopOpacity={0}/>
    </linearGradient>
  );

  const settingsRef = useRef(null);

  const settingsContent = (
    <div style={{padding:isMobile?"14px":"20px 18px"}}>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:9,color:T.muted,letterSpacing:1}}>FIN PLANNER</div>
        <div style={{fontSize:15,fontWeight:900,color:T.gold,marginTop:2}}>◈ KROK 2 — SIMULACE</div>
      </div>

      {/* Základní nastavení */}
      <div style={{marginBottom:22}}>
        <SecHead label="Základní nastavení" icon="◆"/>
        <SSlider label="Počáteční vklad"          value={initial}      onChange={setInitial}      min={0}   max={2000000} step={5000} fmt={czk}                       color={T.teal}/>
        <SSlider label="Roční výnos (brutto)"     value={annualReturn} onChange={setAnnualReturn} min={0}   max={30}      step={0.5}  fmt={v=>`${v} %`}               color={T.gold}/>
        <SSlider label="Očekávaná inflace (p.a.)" value={inflation}    onChange={setInflation}    min={0}   max={15}      step={0.1}  fmt={v=>`${v.toFixed(1)} %`}    color={T.rose}
        />
        <div style={{fontSize:10,color:T.muted,marginTop:-10,marginBottom:14,lineHeight:1.5}}>
          Určuje, jak rychle ztrácejí peníze hodnotu.
        </div>
      </div>

      {/* Fáze */}
      <div style={{marginBottom:22}}>
        <SecHead label="Fáze spoření & výběrů" icon="◆" color={T.teal}/>
        {phases.map((ph,i)=>(
          <div key={ph.id} style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`3px solid ${ph.type==="contribute"?T.teal:T.rose}`,borderRadius:8,padding:"10px 11px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:9,color:T.muted,fontWeight:700}}>FÁZE {i+1}</span>
                <span style={{fontSize:9,fontWeight:800,color:ph.type==="contribute"?T.teal:T.rose,background:ph.type==="contribute"?`${T.teal}18`:`${T.rose}18`,padding:"1px 6px",borderRadius:4}}>
                  {ph.type==="contribute"?"VKLÁDÁM":"VYBÍRÁM"}
                </span>
              </div>
              <button onClick={()=>removePhase(ph.id)} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:15,padding:0}}>×</button>
            </div>
            <div style={{display:"flex",gap:7,marginBottom:7}}>
              {[["Od roku","startYear"],["Do roku","endYear"]].map(([lbl,fld])=>(
                <div key={fld} style={{flex:1}}>
                  <div style={{fontSize:9,color:T.muted,marginBottom:2}}>{lbl}</div>
                  <input type="number" value={ph[fld]} onChange={e=>editPhase(ph.id,fld,Number(e.target.value))}
                    style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,color:T.text,padding:"5px 7px",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                </div>
              ))}
            </div>
            <div style={{marginBottom:7}}>
              <div style={{fontSize:9,color:T.muted,marginBottom:2}}>Měsíční částka (Kč)</div>
              <input type="number" value={ph.amount} onChange={e=>editPhase(ph.id,"amount",Number(e.target.value))}
                style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,color:T.text,padding:"5px 7px",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
            </div>
            <div style={{display:"flex",gap:5}}>
              {["contribute","withdraw"].map(t=>(
                <button key={t} onClick={()=>editPhase(ph.id,"type",t)}
                  style={{flex:1,padding:"5px 0",borderRadius:5,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"inherit",transition:"all .15s",
                    background:ph.type===t?(t==="contribute"?T.teal:T.rose):T.surface,
                    color:ph.type===t?T.bg:T.muted}}>
                  {t==="contribute"?"📥 Vkládám":"📤 Vybírám"}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={addPhase} style={{width:"100%",padding:"8px",background:"none",border:`1px dashed ${T.border}`,borderRadius:8,color:T.gold,cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>
          + Přidat fázi
        </button>
      </div>

      {/* Poplatky fondu */}
      <div style={{marginBottom:22}}>
        <SecHead label="Poplatky fondu" icon="◆" color={T.rose}/>
        <SSlider label="Správcovský poplatek (p.a.)" value={mgmtFee} onChange={setMgmtFee} min={0} max={3}  step={0.05} fmt={v=>`${v.toFixed(2)} %`} color={T.rose}/>
        <SSlider label="Výkonnostní odměna"          value={perfFee} onChange={setPerfFee} min={0} max={50} step={1}    fmt={v=>`${v} %`}             color={T.rose}/>
        <SToggle label="High-water mark" checked={useHwm} onChange={setUseHwm}/>
      </div>

      {/* Daně */}
      <div style={{marginBottom:22}}>
        <SecHead label="Daně při výběru" icon="◆" color={T.amber}/>
        <SToggle label="Zahrnout daň z výnosů" checked={applyTax} onChange={setApplyTax}/>
        {applyTax&&<>
          <SSlider label="Sazba daně" value={taxRate} onChange={setTaxRate} min={0} max={40} step={1} fmt={v=>`${v} %`} color={T.amber}/>
          <SToggle label="Splněn časový test (osvobozeno)" checked={timeTest} onChange={setTimeTest}/>
        </>}
      </div>

      {/* FIRE */}
      <div style={{marginBottom:22}}>
        <SecHead label="FIRE kalkulačka" icon="🔥" color={T.lime}/>
        <SSlider label="Cílový měsíční příjem (z portfolia)" value={fireTarget} onChange={setFireTarget} min={5000} max={200000} step={1000} fmt={czk} color={T.lime}/>
        <div style={{fontSize:10,color:T.muted,marginTop:-10,marginBottom:8,lineHeight:1.5}}>
          Pravidlo 4 % — kdy bude portfolio dostatečně velké?
        </div>
        {fireYear!=null?(
          <div style={{background:`${T.lime}12`,border:`1px solid ${T.lime}30`,borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:T.lime,fontWeight:700,marginBottom:2}}>🔥 FIRE dosaženo v roce {fireYear}</div>
            <div style={{fontSize:11,color:T.muted}}>Portfolio {czk(dataA[fireYear]?.value||0)} ≥ {czk(fireTarget*12/0.04)}</div>
          </div>
        ):(
          <div style={{background:`${T.rose}10`,border:`1px solid ${T.rose}28`,borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:T.rose}}>FIRE s těmito parametry nedosaženo během {totalYears} let</div>
          </div>
        )}
      </div>

      {/* Scénář B */}
      <div style={{marginBottom:22}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
          <div style={{width:9,height:9,borderRadius:"50%",background:showB?T.lime:T.border,transition:"background .2s"}}/>
          <span style={{fontSize:10,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:showB?T.lime:T.muted,flex:1}}>Scénář B — porovnání</span>
          <SToggle label="" checked={showB} onChange={setShowB}/>
        </div>
        {showB&&(
          <div style={{background:`${T.lime}0c`,border:`1px solid ${T.lime}28`,borderRadius:10,padding:"12px",marginBottom:8}}>
            <div style={{fontSize:10,color:T.lime,marginBottom:10,lineHeight:1.5}}>Alternativní parametry — fáze spoření sdílené.</div>
            <SSlider label="Počáteční vklad B"      value={initialB}      onChange={setInitialB}      min={0} max={2000000} step={5000} fmt={czk}                       color={T.lime}/>
            <SSlider label="Roční výnos B"          value={annualReturnB} onChange={setAnnualReturnB} min={0} max={30}      step={0.5}  fmt={v=>`${v} %`}               color={T.lime}/>
            <SSlider label="Správcovský poplatek B" value={mgmtFeeB}      onChange={setMgmtFeeB}      min={0} max={3}       step={0.05} fmt={v=>`${v.toFixed(2)} %`}    color="#6ab81e}"/>
            <SSlider label="Výkonnostní odměna B"   value={perfFeeB}      onChange={setPerfFeeB}      min={0} max={50}      step={1}    fmt={v=>`${v} %`}               color="#6ab81e"/>
            <SToggle label="High-water mark B" checked={useHwmB} onChange={setUseHwmB}/>
            {finB&&(
              <div style={{marginTop:4,padding:"10px 12px",background:T.card,borderRadius:8,border:`1px solid ${T.border}`}}>
                <div style={{fontSize:9,color:T.muted,marginBottom:7}}>ROZDÍL B − A (rok {totalYears})</div>
                {[
                  {label:"Hodnota portfolia",a:finA.value,             b:finB.value,              inv:false},
                  {label:"Dopad poplatků",   a:finA.gross-finA.value,  b:finB.gross-finB.value,   inv:true},
                  {label:"Čistý zisk",       a:finA.gains,             b:finB.gains,              inv:false},
                ].map(({label,a,b,inv})=>{
                  const diff=b-a, pos=inv?diff<=0:diff>=0;
                  return (
                    <div key={label} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:10,color:T.muted}}>{label}</span>
                      <span style={{fontSize:10,fontWeight:700,color:pos?T.lime:T.rose}}>{diff>=0?"+":""}{czk(diff)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dopad poplatků */}
      <div style={{background:`${T.rose}10`,border:`1px solid ${T.rose}28`,borderRadius:8,padding:"10px 12px",marginBottom:16}}>
        <div style={{fontSize:9,color:T.rose,fontWeight:700,letterSpacing:1,marginBottom:4}}>⚠ DOPAD POPLATKŮ</div>
        <div style={{fontSize:11,color:T.muted,lineHeight:1.6}}>
          Poplatky a daně vás za {totalYears} let vyjdou na<br/>
          <span style={{fontSize:16,fontWeight:900,color:T.rose}}>{czk(Math.round(feesCostA)+Math.round(taxPaidA))}</span>
        </div>
      </div>
      <div style={{height:10}}/>
    </div>
  );

  const chartContent = (
    <div style={{flex:1,display:"flex",flexDirection:"column",padding:isMobile?"12px":"20px 22px",overflow:"hidden",gap:12}}>
      {/* Big stat cards */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <StatCard icon="◆" label={showB?"Portfolio (nominál)":"Portfolio (nominál)"}
          value={czk(finA.value)} color={T.gold}
          sub={`Kupní síla: ${czk(finA.real)}`}/>
        <StatCard icon="◆" label="Po zdanění"
          value={czk(finA.value-taxPaidA)} color={T.teal}
          sub={applyTax&&!timeTest?`Daň: ${czk(taxPaidA)}`:"Osvobozeno"}/>
        <StatCard icon="▲" label="Vloženo"
          value={czk(finA.invested)} color={T.violet}
          sub={finA.out>0?`Vybráno: ${czk(finA.out)}`:"Bez výběrů"}/>
        <StatCard icon="◉" label="Čistý zisk"
          value={czk(finA.gains)} color={T.amber}
          sub={`Poplatky: ${czk(Math.round(feesCostA))}`}/>
      </div>

      {showB&&finB&&(
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <StatCard icon="◆" label="Portfolio B" value={czk(finB.value)} color={T.lime} sub={`${annualReturnB}% p.a. · ${mgmtFeeB}% správa`}/>
          <StatCard icon="⟺" label="Rozdíl B − A" value={czk(finB.value-finA.value)}
            color={finB.value>=finA.value?T.lime:T.rose}
            sub={`${((finB.value/finA.value-1)*100).toFixed(1)} % relativně`}/>
        </div>
      )}

      {/* Chart mode + options */}
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        {[{id:"value",label:"Hodnota portfolia"},{id:"compare",label:"Porovnání poplatků"},{id:"flow",label:"Toky (vklady/výběry)"},{id:"sensitivity",label:"Citlivostní matice"}].map(m=>(
          <button key={m.id} onClick={()=>setChartMode(m.id)} style={{
            padding:"6px 14px",borderRadius:6,cursor:"pointer",fontFamily:"inherit",
            border:`1px solid ${chartMode===m.id?T.gold:T.border}`,
            background:chartMode===m.id?`${T.gold}18`:"transparent",
            color:chartMode===m.id?T.gold:T.muted,fontSize:10,fontWeight:700,transition:"all .15s"}}>
            {m.label}
          </button>
        ))}
        {chartMode==="value"&&(
          <button onClick={()=>setShowReal(r=>!r)} style={{
            padding:"6px 12px",borderRadius:6,cursor:"pointer",fontFamily:"inherit",
            border:`1px solid ${showReal?T.rose:T.border}`,
            background:showReal?`${T.rose}15`:"transparent",
            color:showReal?T.rose:T.muted,fontSize:10,fontWeight:700,transition:"all .15s"}}>
            {showReal?"● Kupní síla":"○ Kupní síla"}
          </button>
        )}
        {showB&&(
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"4px 10px",background:`${T.lime}0e`,border:`1px solid ${T.lime}28`,borderRadius:6}}>
            <span style={{fontSize:10,color:T.gold,display:"flex",alignItems:"center",gap:4}}>
              <span style={{width:14,height:3,background:T.gold,display:"inline-block",borderRadius:2}}/> A
            </span>
            <span style={{fontSize:10,color:T.lime,display:"flex",alignItems:"center",gap:4}}>
              <span style={{width:14,height:3,background:T.lime,display:"inline-block",borderRadius:2}}/> B
            </span>
          </div>
        )}
        <div style={{flex:1}}/>
        {!isMobile&&<span style={{fontSize:9,color:T.muted}}>Přejeď myší pro detaily</span>}
      </div>

      {/* Chart */}
      <div style={{flex:1,background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:"14px 14px 4px",minHeight:isMobile?240:0}}>
        {chartMode==="sensitivity" ? (() => {
          const returns = [annualReturn-4,annualReturn-2,annualReturn,annualReturn+2,annualReturn+4].map(r=>Math.max(0,Math.round(r*10)/10));
          const horizons = [5,10,15,20,25,30].filter(h=>h<=Math.max(totalYears+5,30)).slice(0,6);
          const sentData = returns.map(r=>horizons.map(h=>{const d=simulate({initial,annualReturn:r,inflation,mgmtFee,perfFee,useHwm,phases,totalYears:h});return d[d.length-1].value;}));
          const allVals = sentData.flat(), minV=Math.min(...allVals), maxV=Math.max(...allVals);
          const heat = v=>{const t=maxV>minV?(v-minV)/(maxV-minV):0.5;return t<0.5?`rgba(248,113,113,${0.12+t*0.55})`:`rgba(212,168,71,${0.08+(t-0.5)*0.75})`;};
          const fmtM = v=>v>=1e6?`${(v/1e6).toFixed(2)}M`:v>=1e3?`${Math.round(v/1e3)}k`:`${v}`;
          return (
            <div style={{height:"100%",overflow:"auto",padding:"8px 2px"}}>
              <div style={{fontSize:10,color:T.muted,marginBottom:10}}>
                Hodnota portfolia pro různé výnosy × horizonty. <span style={{color:T.gold}}>■ zlatá = vyšší</span>, <span style={{color:T.rose}}>■ červená = nižší</span>. Aktuální parametry zvýrazněny.
              </div>
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"2px",fontSize:11}}>
                <thead>
                  <tr>
                    <th style={{padding:"5px 8px",textAlign:"left",color:T.muted,fontSize:10,fontWeight:700}}>Výnos \ Roky</th>
                    {horizons.map(h=><th key={h} style={{padding:"5px 8px",textAlign:"center",color:Math.abs(h-totalYears)<1?T.gold:T.muted,fontSize:10,fontWeight:Math.abs(h-totalYears)<1?800:500,background:Math.abs(h-totalYears)<1?T.gold+"18":"transparent",borderRadius:4}}>{h}r</th>)}
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r,ri)=>(
                    <tr key={r}>
                      <td style={{padding:"6px 8px",color:Math.abs(r-annualReturn)<0.05?T.gold:T.muted,fontWeight:Math.abs(r-annualReturn)<0.05?800:400,fontSize:11,background:Math.abs(r-annualReturn)<0.05?T.gold+"10":"transparent",borderRadius:4}}>
                        {r.toFixed(1)} %
                      </td>
                      {horizons.map((h,hi)=>{
                        const val=sentData[ri][hi];
                        const isHL=Math.abs(r-annualReturn)<0.05&&Math.abs(h-totalYears)<1;
                        return <td key={h} style={{padding:"7px 6px",textAlign:"center",background:isHL?T.gold+"35":heat(val),borderRadius:6,border:isHL?`1px solid ${T.gold}80`:`1px solid transparent`}}>
                          <span style={{fontSize:isHL?12:11,fontWeight:isHL?900:500,color:isHL?T.gold:T.text}}>{fmtM(val)}</span>
                        </td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{marginTop:12,fontSize:10,color:T.muted}}>
                📌 Tvoje nastavení: <span style={{color:T.gold,fontWeight:700}}>{annualReturn} % · {totalYears} let → {fmtM(finA.value)}</span>
                &nbsp;&nbsp;·&nbsp;&nbsp; Správa {mgmtFee} % · Inflace {inflation} % zahrnuta
              </div>
            </div>
          );
        })() : (
        <ResponsiveContainer width="100%" height="100%">
          {chartMode==="value"?(
            <AreaChart data={chartData} margin={{top:4,right:4,bottom:0,left:0}}>
              <defs>{gd("gG",T.gold)}{gd("gR",T.rose,0.15)}{gd("gV",T.violet)}{gd("gL",T.lime)}</defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="year" stroke={T.muted} tick={{fontSize:9,fill:T.muted}} tickFormatter={v=>`${v}r`}/>
              <YAxis stroke={T.muted} tick={{fontSize:9,fill:T.muted}} tickFormatter={yFmt} width={44}/>
              <Tooltip content={<ChartTooltip/>}/>
              <Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
              {fireYear&&<ReferenceLine x={fireYear} stroke={T.lime} strokeDasharray="4 3" label={{value:`🔥 FIRE`,position:"top",fill:T.lime,fontSize:9}}/>}
              <Area dataKey="invested" name="Vloženo"                                       stroke={T.violet} fill="url(#gV)" strokeWidth={1.5} dot={false}/>
              <Area dataKey="value"    name={showB?"Hodnota (A)":"Hodnota portfolia"}       stroke={T.gold}   fill="url(#gG)" strokeWidth={2.5} dot={false}/>
              {showReal&&!showB&&<Area dataKey="real" name="Kupní síla (dnešní hodnota)" stroke={T.rose} fill="url(#gR)" strokeWidth={1.5} strokeDasharray="6 3" dot={false}/>}
              {showB&&<Area dataKey="valueB" name="Hodnota (B)" stroke={T.lime} fill="url(#gL)" strokeWidth={2} strokeDasharray="7 3" dot={false} fillOpacity={0.3}/>}
            </AreaChart>
          ):chartMode==="compare"?(
            <AreaChart data={chartData} margin={{top:4,right:4,bottom:0,left:0}}>
              <defs>{gd("c1",T.amber)}{gd("c2",T.gold)}{gd("c3",T.teal)}{gd("c4",T.lime)}</defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="year" stroke={T.muted} tick={{fontSize:9,fill:T.muted}} tickFormatter={v=>`${v}r`}/>
              <YAxis stroke={T.muted} tick={{fontSize:9,fill:T.muted}} tickFormatter={yFmt} width={44}/>
              <Tooltip content={<ChartTooltip/>}/>
              <Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
              <Area dataKey="gross"  name="A: Bez poplatků"    stroke={T.amber} fill="url(#c1)" strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
              <Area dataKey="noPerf" name="A: Jen správa"      stroke={T.gold}  fill="url(#c2)" strokeWidth={1.5} strokeDasharray="3 3" dot={false}/>
              <Area dataKey="value"  name="A: Plné poplatky"   stroke={T.teal}  fill="url(#c3)" strokeWidth={2.5} dot={false}/>
              {showB&&<>
                <Area dataKey="grossB" name="B: Bez poplatků"  stroke="#86efac" fill="none"      strokeWidth={1}   strokeDasharray="4 4" dot={false}/>
                <Area dataKey="valueB" name="B: Plné poplatky" stroke={T.lime}  fill="url(#c4)" strokeWidth={2}   strokeDasharray="7 3" dot={false}/>
              </>}
            </AreaChart>
          ):(
            <ComposedChart data={chartData} margin={{top:4,right:4,bottom:0,left:0}}>
              <defs>{gd("gfG",T.gold,0.25)}</defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="year" stroke={T.muted} tick={{fontSize:9,fill:T.muted}} tickFormatter={v=>`${v}r`}/>
              <YAxis yAxisId="l" stroke={T.muted} tick={{fontSize:9,fill:T.muted}} tickFormatter={yFmt} width={44}/>
              <YAxis yAxisId="r" orientation="right" stroke={T.muted} tick={{fontSize:9,fill:T.muted}} tickFormatter={v=>v>=1e3?`${(v/1e3).toFixed(0)}k`:v} width={38}/>
              <Tooltip content={<ChartTooltip/>}/>
              <Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
              <ReferenceLine yAxisId="r" y={0} stroke={T.border} strokeWidth={2}/>
              <Bar yAxisId="r" dataKey="annualFlow" name="Měsíční tok" fill={T.teal} opacity={0.6} radius={[2,2,0,0]}/>
              <Area yAxisId="l" dataKey="value" name="Portfolio A" stroke={T.gold} fill="url(#gfG)" strokeWidth={2.5} dot={false}/>
              {showB&&<Line yAxisId="l" dataKey="valueB" name="Portfolio B" stroke={T.lime} strokeWidth={2} strokeDasharray="7 3" dot={false}/>}
            </ComposedChart>
          )}
        </ResponsiveContainer>
        )}
      </div>

      {/* Timeline */}
      {!isMobile&&(
        <div style={{display:"flex",gap:4,alignItems:"center",height:26,flexShrink:0}}>
          <span style={{fontSize:9,color:T.muted,whiteSpace:"nowrap",marginRight:6}}>TIMELINE</span>
          {phases.map(ph=>{
            const w=((ph.endYear-ph.startYear+1)/totalYears)*100;
            return (
              <div key={ph.id} style={{height:22,borderRadius:5,flex:w,minWidth:30,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",
                background:ph.type==="contribute"?`${T.teal}28`:`${T.rose}28`,
                border:`1px solid ${ph.type==="contribute"?T.teal:T.rose}45`}}>
                <span style={{fontSize:9,color:ph.type==="contribute"?T.teal:T.rose,fontWeight:700,whiteSpace:"nowrap"}}>
                  {ph.startYear}–{ph.endYear}r | {ph.type==="contribute"?"+":"−"}{num(ph.amount)} Kč
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const settingsSt={width:isMobile?"100%":isTablet?300:340,minWidth:isMobile?0:280,overflowY:"auto",background:T.surface,borderRight:isMobile?"none":`1px solid ${T.border}`,scrollbarWidth:"thin",scrollbarColor:`${T.border} transparent`};

  if (isMobile) return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{display:"flex",background:T.card,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        {[{id:"settings",label:"⚙ Nastavení"},{id:"chart",label:"📈 Graf"}].map(t=>(
          <button key={t.id} onClick={()=>setShowPanel(t.id)}
            style={{flex:1,padding:"10px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:700,
              background:showPanel===t.id?`${T.gold}18`:"transparent",color:showPanel===t.id?T.gold:T.muted,
              borderBottom:showPanel===t.id?`2px solid ${T.gold}`:"2px solid transparent"}}>
            {t.label}
          </button>
        ))}
      </div>
      <div ref={settingsRef} style={{...settingsSt,display:showPanel==="settings"?"block":"none",flex:1}}>{settingsContent}</div>
      <div style={{display:showPanel==="chart"?"flex":"none",flex:1,overflow:"hidden"}}>{chartContent}</div>
    </div>
  );

  return (
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      <div ref={settingsRef} style={settingsSt}>{settingsContent}</div>
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>{chartContent}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [step,setStep]                       = useState(1);
  const [suggestedMonthly,setSuggestedMonthly] = useState(3000);
  const {isMobile} = useBreakpoint();
  const hasSaved = useMemo(()=>{try{return !!localStorage.getItem("fp_income");}catch{return false;}},[]);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100dvh",background:T.bg,color:T.text,fontFamily:"'DM Mono','Courier New',monospace",fontSize:13,overflow:"hidden"}}>
      {/* Nav */}
      <div style={{display:"flex",alignItems:"center",padding:isMobile?"0 12px":"0 24px",background:T.surface,borderBottom:`1px solid ${T.border}`,height:46,flexShrink:0,gap:6}}>
        <span style={{fontSize:13,fontWeight:900,color:T.gold,marginRight:12,letterSpacing:-0.5}}>◆ FIN PLANNER</span>
        {[
          {id:1,label:isMobile?"1. ROZPOČET":"1. ANALÝZA ROZPOČTU"},
          {id:2,label:isMobile?"2. KALKULAČKA":"2. INVESTIČNÍ KALKULAČKA"},
        ].map(t=>(
          <button key={t.id} onClick={()=>setStep(t.id)} style={{
            padding:isMobile?"7px 12px":"7px 18px",borderRadius:6,border:"none",cursor:"pointer",fontFamily:"inherit",
            fontWeight:800,fontSize:isMobile?10:11,letterSpacing:1,textTransform:"uppercase",transition:"all .15s",
            background:step===t.id?T.gold:"transparent",
            color:step===t.id?T.bg:T.muted,
          }}>
            {t.label}
          </button>
        ))}
        <div style={{flex:1}}/>
        {hasSaved&&!isMobile&&(
          <span style={{fontSize:9,color:T.teal,display:"flex",alignItems:"center",gap:5,marginRight:8,letterSpacing:1}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:T.teal,flexShrink:0}}/>DATA ULOŽENA
          </span>
        )}
        <button onClick={()=>{if(confirm("Opravdu vymazat data?\nOdstraní všechna uložená nastavení.")){try{Object.keys(localStorage).filter(k=>k.startsWith("fp_")).forEach(k=>localStorage.removeItem(k));}catch{}window.location.reload();}}}
          style={{fontSize:10,color:T.muted,background:"none",border:`1px solid ${T.border}`,borderRadius:5,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}}>
          ⊘ Vymazat data
        </button>
      </div>

      <div style={{flex:1,overflow:"hidden"}}>
        {step===1
          ?<Step1 onNext={()=>setStep(2)} suggestedMonthly={suggestedMonthly} setSuggestedMonthly={setSuggestedMonthly}/>
          :<Step2 defaultMonthly={suggestedMonthly}/>}
      </div>
    </div>
  );
}