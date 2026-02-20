import { useState, useMemo, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, ComposedChart, Bar, Cell
} from "recharts";

/* ─── UTILS ─────────────────────────────────────────────────── */
const czk = (v) => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(Math.round(v));
const num = (v) => new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Math.round(v));

/* ─── THEME ──────────────────────────────────────────────────── */
const T = {
  bg: "#0a0b0f", surface: "#11141c", card: "#181c28", border: "#1e2438", borderLight: "#252d44",
  gold: "#d4a847", goldDim: "#a8832e", teal: "#2dd4bf", rose: "#f87171", violet: "#818cf8",
  amber: "#fb923c", text: "#e2e8f0", muted: "#64748b", faint: "#374151",
};

/* ─── RESPONSIVE HOOK ────────────────────────────────────────── */
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 850 : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 850);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return isMobile;
};

/* ─── BUDGET CONFIGURATION ───────────────────────────────────── */
const BUDGET_CATEGORIES = [
  { id: "bydleni", title: "1. Bydlení a energie", items: [
    { id: "b_najem", label: "Nájem/splátka hypotéky", p: "m" },
    { id: "b_ele", label: "Záloha na elektřinu", p: "m" },
    { id: "b_plyn", label: "Záloha na plyn", p: "m" },
    { id: "b_voda", label: "Záloha na vodu", p: "m" },
    { id: "b_teplo", label: "Záloha na teplo", p: "m" },
    { id: "b_svj", label: "Poplatky družstvu/SVJ", p: "m" },
    { id: "b_odpad", label: "Odvoz odpadu", p: "r" },
    { id: "b_dan", label: "Daň z nemovitosti", p: "r" },
    { id: "b_net", label: "Internet", p: "m" },
    { id: "b_poj", label: "Pojištění nemovitosti", p: "r" },
    { id: "b_udrzba", label: "Údržba domu/bytu", p: "r" },
  ]},
  { id: "jidlo", title: "2. Jídlo a drogerie", items: [
    { id: "j_potraviny", label: "Nákup potravin", p: "m" },
    { id: "j_obedy", label: "Obědy (práce/škola)", p: "m" },
    { id: "j_rest", label: "Restaurace a dovoz", p: "m" },
    { id: "j_drog", label: "Drogerie", p: "m" },
    { id: "j_kava", label: "Kafíčka a ostatní", p: "m" },
  ]},
  { id: "doprava", title: "3. Doprava", items: [
    { id: "d_auto", label: "Splátka auta", p: "m" },
    { id: "d_phm", label: "Pohonné hmoty", p: "m" },
    { id: "d_pov", label: "Povinné ručení", p: "r" },
    { id: "d_hav", label: "Havarijní pojištění", p: "r" },
    { id: "d_dalnice", label: "Dálniční známka", p: "fix", val: 2440, per: "r" },
    { id: "d_servis", label: "Servis a údržba", p: "m" },
    { id: "d_mhd", label: "MHD a vlak", p: "m" },
  ]},
  { id: "deti", title: "4. Děti", items: [
    { id: "k_skola", label: "Školné a školkovné", p: "m" },
    { id: "k_krouzky", label: "Kroužky a sport", p: "m" },
    { id: "k_pomucky", label: "Školní pomůcky", p: "m" },
    { id: "k_saty", label: "Oblečení a obuv", p: "m" },
    { id: "k_pleny", label: "Plenky a umělá výživa", p: "m" },
    { id: "k_vylety", label: "Výlety", p: "m" },
    { id: "k_kapesne", label: "Kapesné", p: "m" },
  ]},
  { id: "sluzby", title: "5. Služby", items: [
    { id: "s_mobil", label: "Mobilní tarify", p: "m" },
    { id: "s_tv", label: "TV a rozhlasové poplatky", p: "fix", val: 205, per: "m" },
    { id: "s_subs", label: "Předplatné (Netflix, Spotify...)", p: "m" },
  ]},
  { id: "zdravi", title: "6. Zdraví", items: [
    { id: "z_leky", label: "Léky a antikoncepce", p: "m" },
    { id: "z_doplnky", label: "Doplňky stravy", p: "m" },
    { id: "z_vlasy", label: "Kadeřník/holič", p: "m" },
    { id: "z_bryle", label: "Brýle/čočky", p: "m" },
  ]},
  { id: "volny", title: "7. Volný čas", items: [
    { id: "v_kultura", label: "Kino, divadlo, koncerty", p: "m" },
    { id: "v_vylety", label: "Výlety", p: "m" },
    { id: "v_knihy", label: "Knihy a hry", p: "m" },
    { id: "v_hobbies", label: "Koníčky", p: "m" },
    { id: "v_dovolena", label: "Letní a zimní dovolená", p: "r" },
  ]},
  { id: "ostatni", title: "8. Ostatní", items: [
    { id: "o_vanoce", label: "Dárky na Vánoce", p: "r" },
    { id: "o_darky", label: "Ostatní dárky", p: "r" },
    { id: "o_zver", label: "Domácí mazlíček", p: "m" },
    { id: "o_ziv", label: "Životní pojištění", p: "m" },
    { id: "o_penz", label: "Penzijní připojištění", p: "m" },
    { id: "o_uraz", label: "Úrazové pojištění", p: "m" },
    { id: "o_dluhy", label: "Ostatní splátky dluhů", p: "m" },
    { id: "o_necekane", label: "Ostatní nezařazené výdaje", p: "m" },
  ]},
];

/* ─── CUSTOM TOOLTIP ─────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.borderLight}`, borderRadius: 10, padding: "14px 18px", minWidth: 200, boxShadow: "0 20px 40px rgba(0,0,0,0.6)" }}>
      <p style={{ color: T.gold, fontSize: 12, fontWeight: 700, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>Rok {label}</p>
      {payload.map((p, i) => {
        if (p.value === 0) return null;
        let color = p.color; let name = p.name; let displayValue = p.value;
        if (p.dataKey === "annualFlow") {
          color = p.value < 0 ? T.rose : T.teal;
          name = p.value < 0 ? "Měsíční výběr" : "Měsíční vklad";
          displayValue = Math.abs(p.value);
        }
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 6 }}>
            <span style={{ color: color, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />{name}
            </span>
            <span style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{czk(displayValue)}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ─── SUB-COMPONENTS ─────────────────────────────────────────── */
const SectionHead = ({ label, icon }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
    <span style={{ fontSize: 14 }}>{icon}</span>
    <span style={{ fontSize: 10, fontWeight: 800, color: T.gold, letterSpacing: 2, textTransform: "uppercase" }}>{label}</span>
  </div>
);

const Slider = ({ label, hint, value, onChange, min, max, step, fmt, color }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <label style={{ fontSize: 11, color: T.muted }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 700, color: color || T.text }}>{fmt ? fmt(value) : value}</span>
      </div>
      <div style={{ position: "relative" }}>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
          style={{ width: "100%", appearance: "none", height: 4, borderRadius: 2, background: `linear-gradient(to right, ${color || T.gold} ${pct}%, ${T.border} ${pct}%)`, outline: "none", cursor: "pointer" }} />
      </div>
      {hint && <p style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>{hint}</p>}
    </div>
  );
};

const Toggle = ({ label, checked, onChange }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 10 }}>
    <div onClick={() => onChange(!checked)} style={{ width: 36, height: 20, borderRadius: 10, background: checked ? T.gold : T.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: checked ? 19 : 3, transition: "left 0.2s" }} />
    </div>
    <span style={{ fontSize: 11, color: T.muted, flex: 1 }}>{label}</span>
  </label>
);

const StatCard = ({ label, value, sub, color, icon }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px", flex: 1, minWidth: 0, borderTop: `2px solid ${color || T.border}` }}>
    <div style={{ fontSize: 10, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{icon} {label}</div>
    <div style={{ fontSize: 17, fontWeight: 800, color: color || T.text, letterSpacing: -0.5 }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>{sub}</div>}
  </div>
);

/* ─── LOCAL STORAGE INITIALIZATION ───────────────────────────── */
const loadSavedState = () => {
  try {
    const saved = localStorage.getItem("finPlannerData");
    if (saved) return JSON.parse(saved);
  } catch (e) { console.error("Nelze načíst data z paměti", e); }
  return null;
};

/* ─── MAIN APP ───────────────────────────────────────────────── */
export default function App() {
  const isMobile = useIsMobile();
  const savedState = useMemo(() => loadSavedState(), []);
  const [activeTab, setActiveTab] = useState("budget");

  /* ── BUDGET STATE ── */
  const [income, setIncome] = useState(savedState?.income ?? 60000);
  const [exp, setExp] = useState(savedState?.exp ?? { d_dalnice: true, s_tv: true });

  const handleExpChange = (id, val) => setExp(prev => ({ ...prev, [id]: val }));

  const { rawMonthlyExp, totalExpWithBuffer, leftover } = useMemo(() => {
    let rawM = 0;
    BUDGET_CATEGORIES.forEach(cat => {
      cat.items.forEach(item => {
        if (item.p === "m") rawM += Number(exp[item.id]) || 0;
        if (item.p === "r") rawM += (Number(exp[item.id]) || 0) / 12;
        if (item.p === "fix" && exp[item.id]) { rawM += item.per === "m" ? item.val : item.val / 12; }
      });
    });
    const totalWithBuffer = rawM * 1.05;
    return { rawMonthlyExp: rawM, totalExpWithBuffer: totalWithBuffer, leftover: income - totalWithBuffer };
  }, [income, exp]);

  const applyLeftoverToInvest = () => {
    if (leftover > 0) {
      setPhases(p => {
        const newP = [...p];
        newP[0].amount = Math.floor(leftover);
        return newP;
      });
    }
    setActiveTab("invest");
  };

  /* ── INVEST STATE ── */
  const defaultPhases = [
    { id: 1, startYear: 1, endYear: 5,  amount: 5000, type: "contribute" },
    { id: 2, startYear: 6, endYear: 15, amount: 8000, type: "contribute" },
    { id: 3, startYear: 16,endYear: 25, amount: 4000, type: "withdraw"  },
  ];

  const [initial, setInitial] = useState(savedState?.initial ?? 100000);
  const [annualReturn, setAnnualReturn] = useState(savedState?.annualReturn ?? 8);
  const [mgmtFee, setMgmtFee] = useState(savedState?.mgmtFee ?? 0.5);
  const [perfFee, setPerfFee] = useState(savedState?.perfFee ?? 0); // Změněn výchozí na 0% (ETF standard)
  const [useHwm, setUseHwm] = useState(savedState?.useHwm ?? true);
  const [applyTax, setApplyTax] = useState(savedState?.applyTax ?? true);
  const [taxRate, setTaxRate] = useState(savedState?.taxRate ?? 15);
  const [timeTest, setTimeTest] = useState(savedState?.timeTest ?? true); // Změněno na výchozí ZAPNUTO
  const [phases, setPhases] = useState(savedState?.phases ?? defaultPhases);
  const [chartMode, setChartMode] = useState("value");

  const totalYears = useMemo(() => Math.max(...phases.map(p => p.endYear), 5), [phases]);
  const addPhase = () => {
    const last = phases[phases.length - 1];
    const start = last ? last.endYear + 1 : 1;
    setPhases(p => [...p, { id: Date.now(), startYear: start, endYear: start + 9, amount: 5000, type: "contribute" }]);
  };
  const removePhase = (id) => setPhases(p => p.filter(x => x.id !== id));
  const editPhase = (id, field, val) => setPhases(p => p.map(x => x.id === id ? { ...x, [field]: val } : x));

  /* ── AUTO-SAVE ── */
  useEffect(() => {
    const stateToSave = { income, exp, initial, annualReturn, mgmtFee, perfFee, useHwm, applyTax, taxRate, timeTest, phases };
    localStorage.setItem("finPlannerData", JSON.stringify(stateToSave));
  }, [income, exp, initial, annualReturn, mgmtFee, perfFee, useHwm, applyTax, taxRate, timeTest, phases]);

  const clearMemory = () => {
    if (window.confirm("Opravdu chceš vymazat všechna zadaná data a uvést aplikaci do výchozího stavu?")) {
      localStorage.removeItem("finPlannerData");
      window.location.reload();
    }
  };

  /* ── INVEST SIMULATION ── */
  const { chartData, summary } = useMemo(() => {
    const mr = annualReturn / 100 / 12, mf = mgmtFee / 100 / 12, netMr = mr - mf;
    let port = initial, portGross = initial, portNoPerf = initial, totalIn = initial, totalOut = 0, hwm = initial;
    let annualStart = initial, annualStartGross = initial, annualStartNoPerf = initial;
    const rows = [{ year: 0, value: port, gross: portGross, noPerf: portNoPerf, invested: totalIn, netInvested: totalIn, gains: 0, afterTax: port, out: 0, annualGain: 0, annualFlow: 0 }];

    for (let m = 1; m <= totalYears * 12; m++) {
      const yr = m / 12, yc = Math.ceil(yr);
      const ph = phases.find(p => yc >= p.startYear && yc <= p.endYear);
      const mo = ph ? ph.amount : 0;
      const withdraw = ph?.type === "withdraw";

      port *= (1 + netMr); portGross *= (1 + mr); portNoPerf *= (1 + netMr);
      if (!withdraw) { port += mo; portGross += mo; portNoPerf += mo; totalIn += mo; } 
      else { const w = Math.min(mo, port); port -= w; portGross -= w; portNoPerf -= w; totalOut += w; }

      if (m % 12 === 0 && perfFee > 0) {
        const gain = port - annualStart;
        if (gain > 0) {
          const base = useHwm ? Math.max(0, port - hwm) : gain;
          port -= (base * perfFee / 100);
        }
        if (port > hwm) hwm = port;
        annualStart = port; annualStartGross = portGross; annualStartNoPerf = portNoPerf;
      }
      port = Math.max(0, port);

      if (m % 12 === 0) {
        const netInv = totalIn - totalOut;
        const gains = Math.max(0, port - netInv);
        const taxable = Math.max(0, port - totalIn);
        const afterTax = applyTax && !timeTest ? port - taxable * taxRate / 100 : port;
        rows.push({ year: m / 12, value: Math.max(0, Math.round(port)), gross: Math.max(0, Math.round(portGross)), noPerf: Math.max(0, Math.round(portNoPerf)), invested: Math.round(totalIn), netInvested: Math.round(netInv), gains: Math.round(gains), afterTax: Math.round(afterTax), out: Math.round(totalOut), annualFlow: withdraw ? -mo : mo });
      }
    }
    const fin = rows[rows.length - 1];
    const taxable = Math.max(0, fin.value - fin.invested);
    const taxPaid = applyTax && !timeTest ? taxable * taxRate / 100 : 0;
    return { chartData: rows, summary: { finalValue: fin.value, afterTax: fin.afterTax, totalIn: fin.invested, totalOut: fin.out, gains: fin.gains, feesCost: Math.round(fin.gross - fin.value), taxPaid: Math.round(taxPaid), years: totalYears } };
  }, [initial, annualReturn, mgmtFee, perfFee, useHwm, applyTax, taxRate, timeTest, phases, totalYears]);

  /* ─── RENDER ─────────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Mono', 'Courier New', monospace", fontSize: 13, overflow: "hidden" }}>
      
      {/* ══ HEADER / TABS ══ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 60, borderBottom: `1px solid ${T.borderLight}`, background: T.surface, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", overflowX: "auto" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: T.gold, letterSpacing: -1, marginRight: 40 }}>◈ FIN PLANNER</div>
          <div style={{ display: "flex", gap: 10 }}>
            {[ { id: "budget", label: "1. ANALÝZA ROZPOČTU" }, { id: "invest", label: "2. INVESTIČNÍ KALKULAČKA" } ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 800, letterSpacing: 1, whiteSpace: "nowrap",
                  background: activeTab === t.id ? T.gold : "transparent", color: activeTab === t.id ? T.bg : T.muted, transition: "all 0.2s" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={clearMemory} title="Smazat veškerá data a začít znovu"
          style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, cursor: "pointer", fontSize: 10, fontWeight: 700, transition: "all 0.2s", whiteSpace: "nowrap" }}
          onMouseOver={e => { e.currentTarget.style.color = T.rose; e.currentTarget.style.borderColor = T.rose; }}
          onMouseOut={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}>
          🗑 Vymazat data
        </button>
      </div>

      {/* ══ CONTENT AREA (Fix pro scrollování na mobilu) ══ */}
      <div style={{ flex: 1, overflowY: isMobile ? "auto" : "hidden", display: "flex", flexDirection: isMobile ? "column" : "row" }}>
        
        {/* ─── ZÁLOŽKA 1: ROZPOČET ─── */}
        {activeTab === "budget" && (
          <div style={{ flex: 1, overflowY: isMobile ? "visible" : "auto", padding: isMobile ? "16px" : "32px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ maxWidth: 1000, width: "100%" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
                <div style={{ background: `${T.teal}15`, border: `1px solid ${T.teal}50`, padding: 20, borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: T.teal, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Čistý příjem</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: T.teal }}>{czk(income)}</div>
                </div>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 20, borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Výdaje (Základ)</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>{czk(rawMonthlyExp)}</div>
                </div>
                <div style={{ background: `${T.rose}15`, border: `1px solid ${T.rose}50`, padding: 20, borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: T.rose, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Výdaje vč. 5% rezervy</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: T.rose }}>{czk(totalExpWithBuffer)}</div>
                </div>
                <div style={{ background: `${T.gold}15`, border: `1px solid ${T.gold}50`, padding: 20, borderRadius: 12, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: 11, color: T.gold, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Zbývá na investice</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: leftover > 0 ? T.gold : T.rose }}>{czk(leftover)}</div>
                  {leftover > 0 && (
                    <button onClick={applyLeftoverToInvest} style={{ marginTop: 12, padding: "8px", background: T.gold, color: T.bg, border: "none", borderRadius: 6, fontWeight: 800, fontSize: 10, cursor: "pointer", textTransform: "uppercase" }}>
                      Převést do investic →
                    </button>
                  )}
                </div>
              </div>

              <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 24, borderRadius: 12, marginBottom: 24 }}>
                <SectionHead label="Celkové čisté příjmy domácnosti" icon="💰" />
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <label style={{ fontSize: 12, color: T.muted, flex: 1 }}>Zahrnuje zaměstnání, podnikání, pronájmy atd. (měsíčně)</label>
                  <input type="number" value={income} onChange={e => setIncome(Number(e.target.value))}
                    style={{ width: 150, background: T.bg, border: `1px solid ${T.borderLight}`, borderRadius: 8, color: T.teal, padding: "10px 14px", fontSize: 16, fontWeight: 800, fontFamily: "inherit" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 24 }}>
                {BUDGET_CATEGORIES.map(cat => (
                  <div key={cat.id} style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 24, borderRadius: 12 }}>
                    <SectionHead label={cat.title} icon="▪" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {cat.items.map(item => (
                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: `1px solid ${T.borderLight}50` }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: 12, color: T.text }}>{item.label}</span>
                            <span style={{ fontSize: 9, color: T.muted }}>
                              {item.p === "m" ? "Měsíčně" : item.p === "r" ? "Ročně (přepočítá se na /12)" : `Fixní částka ${item.val} Kč / ${item.per === "m" ? "měsíc" : "rok"}`}
                            </span>
                          </div>
                          {item.p === "fix" ? (
                            <Toggle label="" checked={!!exp[item.id]} onChange={val => handleExpChange(item.id, val)} />
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input type="number" value={exp[item.id] || ""} placeholder="0" onChange={e => handleExpChange(item.id, e.target.value)}
                                style={{ width: 80, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "6px 10px", fontSize: 13, fontFamily: "inherit", textAlign: "right" }} />
                              <span style={{ fontSize: 11, color: T.muted }}>Kč</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── ZÁLOŽKA 2: INVESTICE ─── */}
        {activeTab === "invest" && (
          <>
            <div style={{ width: isMobile ? "100%" : 340, minWidth: isMobile ? "100%" : 340, overflowY: isMobile ? "visible" : "auto", padding: "22px 18px", background: T.surface, borderRight: isMobile ? "none" : `1px solid ${T.border}`, borderBottom: isMobile ? `1px solid ${T.border}` : "none", scrollbarWidth: "thin", scrollbarColor: `${T.border} transparent`, boxSizing: "border-box" }}>
              <div style={{ marginBottom: 22 }}>
                <SectionHead label="Základní nastavení" icon="◆" />
                <Slider label="Počáteční vklad" value={initial} onChange={setInitial} min={0} max={2000000} step={5000} fmt={v => czk(v)} color={T.teal} />
                <Slider label="Roční výnos (brutto)" value={annualReturn} onChange={setAnnualReturn} min={0} max={30} step={0.5} fmt={v => `${v} %`} color={T.gold} />
              </div>

              <div style={{ marginBottom: 22 }}>
                <SectionHead label="Fáze spoření & výběrů" icon="◆" />
                {phases.map((ph, i) => (
                  <div key={ph.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${ph.type === "contribute" ? T.teal : T.rose}`, borderRadius: 8, padding: "12px", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>FÁZE {i + 1} · {ph.type === "contribute" ? "📥 VKLADÁM" : "📤 VYBÍRÁM"}</span>
                      <button onClick={() => removePhase(ph.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      {[["Od roku", "startYear"], ["Do roku", "endYear"]].map(([lbl, fld]) => (
                        <div key={fld} style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: T.muted, marginBottom: 3 }}>{lbl}</div>
                          <input type="number" value={ph[fld]} onChange={e => editPhase(ph.id, fld, Number(e.target.value))} style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, padding: "5px 8px", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: T.muted, marginBottom: 3 }}>Měsíční částka (Kč)</div>
                      <input type="number" value={ph.amount} onChange={e => editPhase(ph.id, "amount", Number(e.target.value))} style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, padding: "5px 8px", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {["contribute", "withdraw"].map(t => (
                        <button key={t} onClick={() => editPhase(ph.id, "type", t)} style={{ flex: 1, padding: "5px 0", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "inherit", background: ph.type === t ? (t === "contribute" ? T.teal : T.rose) : T.surface, color: ph.type === t ? T.bg : T.muted, transition: "all 0.15s" }}>
                          {t === "contribute" ? "📥 Vkládám" : "📤 Vybírám"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={addPhase} style={{ width: "100%", padding: "9px", background: "none", border: `1px dashed ${T.border}`, borderRadius: 8, color: T.gold, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>+ Přidat fázi</button>
              </div>

              <div style={{ marginBottom: 22 }}>
                <SectionHead label="Poplatky fondu" icon="◆" />
                <Slider label="Správcovský poplatek (p.a.)" value={mgmtFee} onChange={setMgmtFee} min={0} max={3} step={0.05} fmt={v => `${v.toFixed(2)} %`} color={T.rose} />
                <Slider label="Výkonnostní odměna" value={perfFee} onChange={setPerfFee} min={0} max={50} step={1} fmt={v => `${v} %`} color={T.rose} />
                <Toggle label="High-water mark" checked={useHwm} onChange={setUseHwm} />
              </div>

              <div style={{ marginBottom: 22 }}>
                <SectionHead label="Daně při výběru" icon="◆" />
                <Toggle label="Zahrnout daň z výnosů" checked={applyTax} onChange={setApplyTax} />
                {applyTax && (
                  <>
                    <Slider label="Sazba daně" value={taxRate} onChange={setTaxRate} min={0} max={40} step={1} fmt={v => `${v} %`} color={T.amber} />
                    <Toggle label="Splněn časový test (osvobozeno)" checked={timeTest} onChange={setTimeTest} />
                  </>
                )}
              </div>

              {/* NAVRÁCENÝ DOPAD POPLATKŮ */}
              <div style={{ background: `${T.rose}12`, border: `1px solid ${T.rose}30`, borderRadius: 8, padding: "12px 14px", marginTop: 10 }}>
                <div style={{ fontSize: 11, color: T.rose, fontWeight: 800, marginBottom: 4 }}>⚠ DOPAD POPLATKŮ</div>
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                  Poplatky a daně vás za {summary.years} let vyjdou na <br/>
                  <span style={{ color: T.rose, fontSize: 16, fontWeight: 900 }}>{czk(summary.feesCost + summary.taxPaid)}</span>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: isMobile ? "16px 12px" : "22px 24px", overflow: isMobile ? "visible" : "auto", gap: 16, boxSizing: "border-box" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
                <StatCard icon="◈" label="Portfolio" value={czk(summary.finalValue)} color={T.gold} sub={`Výnos ${annualReturn}% p.a.`} />
                <StatCard icon="✦" label="Po zdanění" value={czk(summary.afterTax)} color={T.teal} sub={applyTax && !timeTest ? `Daň: ${czk(summary.taxPaid)}` : "Osvobozeno"} />
                <StatCard icon="▲" label="Vloženo" value={czk(summary.totalIn)} color={T.violet} sub={summary.totalOut > 0 ? `Vybráno: ${czk(summary.totalOut)}` : "Bez výběrů"} />
                <StatCard icon="◉" label="Čistý zisk" value={czk(summary.gains)} color={T.amber} sub={`Poplatky: ${czk(summary.feesCost)}`} />
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {[ { id: "value", label: "Hodnota portfolia" }, { id: "compare", label: "Porovnání poplatků" }, { id: "flow", label: "Toky (vklady/výběry)" } ].map(m => (
                  <button key={m.id} onClick={() => setChartMode(m.id)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${chartMode === m.id ? T.gold : T.border}`, background: chartMode === m.id ? `${T.gold}18` : "transparent", color: chartMode === m.id ? T.gold : T.muted, cursor: "pointer", fontSize: 10, fontFamily: "inherit", fontWeight: 700, flex: isMobile ? "1 1 45%" : "none" }}>{m.label}</button>
                ))}
              </div>

              <div style={{ flex: isMobile ? "none" : 1, height: isMobile ? 350 : 500, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: "20px 10px 8px 0px", minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === "value" ? (
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                      <defs>{[["vg", T.gold], ["tg", T.teal], ["ig", T.violet]].map(([id, c]) => <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={c} stopOpacity={0.25} /><stop offset="95%" stopColor={c} stopOpacity={0} /></linearGradient>)}</defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }} tickFormatter={v => `${v}r`} />
                      <YAxis stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: T.muted, paddingTop: 8 }} />
                      <Area dataKey="invested" name="Vloženo" stroke={T.violet} fill="url(#ig)" strokeWidth={2} dot={false} />
                      <Area dataKey="value" name="Hodnota" stroke={T.gold} fill="url(#vg)" strokeWidth={2.5} dot={false} />
                      {applyTax && !timeTest && <Area dataKey="afterTax" name="Po zdanění" stroke={T.teal} fill="url(#tg)" strokeWidth={2} strokeDasharray="6 3" dot={false} />}
                    </AreaChart>
                  ) : chartMode === "compare" ? (
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                      <defs>{[["g1", T.amber], ["g2", T.gold], ["g3", T.teal]].map(([id, c]) => <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={c} stopOpacity={0.2} /><stop offset="95%" stopColor={c} stopOpacity={0} /></linearGradient>)}</defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }} tickFormatter={v => `${v}r`} />
                      <YAxis stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: T.muted, paddingTop: 8 }} />
                      <Area dataKey="gross" name="Bez poplatků" stroke={T.amber} fill="url(#g1)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                      <Area dataKey="noPerf" name="Pouze správcovský" stroke={T.gold} fill="url(#g2)" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                      <Area dataKey="value" name="S poplatky" stroke={T.teal} fill="url(#g3)" strokeWidth={2.5} dot={false} />
                    </AreaChart>
                  ) : (
                    <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                      <defs><linearGradient id="vgf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.gold} stopOpacity={0.25} /><stop offset="95%" stopColor={T.gold} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }} tickFormatter={v => `${v}r`} />
                      <YAxis yAxisId="left" stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} />
                      <YAxis yAxisId="right" orientation="right" stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }} tickFormatter={v => v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: T.muted, paddingTop: 8 }} />
                      <ReferenceLine yAxisId="right" y={0} stroke={T.border} strokeWidth={2} />
                      <Bar yAxisId="right" dataKey="annualFlow" name="Měsíční tok" opacity={0.8} radius={[2, 2, 0, 0]}>
                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.annualFlow < 0 ? T.rose : T.teal} />)}
                      </Bar>
                      <Area yAxisId="left" dataKey="value" name="Hodnota" stroke={T.gold} fill="url(#vgf)" strokeWidth={2.5} dot={false} />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>

              {!isMobile && (
                <div style={{ display: "flex", gap: 4, alignItems: "center", height: 28 }}>
                  <span style={{ fontSize: 9, color: T.muted, whiteSpace: "nowrap", marginRight: 4 }}>TIMELINE</span>
                  {phases.map((ph) => {
                    const w = ((ph.endYear - ph.startYear + 1) / totalYears) * 100;
                    return (
                      <div key={ph.id} style={{ height: 20, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", background: ph.type === "contribute" ? `${T.teal}30` : `${T.rose}30`, border: `1px solid ${ph.type === "contribute" ? T.teal : T.rose}50`, minWidth: 40, flex: w }}>
                        <span style={{ fontSize: 9, color: ph.type === "contribute" ? T.teal : T.rose, fontWeight: 700, whiteSpace: "nowrap" }}>{ph.startYear}–{ph.endYear}r</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}