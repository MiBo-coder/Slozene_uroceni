import { useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, ComposedChart, Bar
} from "recharts";

/* ─── UTILS ─────────────────────────────────────────────────── */
const czk = (v) =>
  new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(Math.round(v));
const num = (v) => new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Math.round(v));

/* ─── THEME ──────────────────────────────────────────────────── */
const T = {
  bg: "#0a0b0f",
  surface: "#11141c",
  card: "#181c28",
  border: "#1e2438",
  borderLight: "#252d44",
  gold: "#d4a847",
  goldDim: "#a8832e",
  teal: "#2dd4bf",
  rose: "#f87171",
  violet: "#818cf8",
  amber: "#fb923c",
  text: "#e2e8f0",
  muted: "#64748b",
  faint: "#374151",
};

/* ─── CUSTOM TOOLTIP ─────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.borderLight}`,
      borderRadius: 10, padding: "14px 18px", minWidth: 200,
      boxShadow: "0 20px 40px rgba(0,0,0,0.6)"
    }}>
      <p style={{ color: T.gold, fontSize: 12, fontWeight: 700, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>
        Rok {label}
      </p>
      {payload.map((p, i) => p.value > 0 && (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 6 }}>
          <span style={{ color: p.color, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }} />
            {p.name}
          </span>
          <span style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{czk(p.value)}</span>
        </div>
      ))}
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
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: "100%", appearance: "none", height: 4, borderRadius: 2,
            background: `linear-gradient(to right, ${color || T.gold} ${pct}%, ${T.border} ${pct}%)`,
            outline: "none", cursor: "pointer"
          }}
        />
      </div>
      {hint && <p style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>{hint}</p>}
    </div>
  );
};

const Toggle = ({ label, checked, onChange }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 10 }}>
    <div onClick={() => onChange(!checked)} style={{
      width: 36, height: 20, borderRadius: 10, background: checked ? T.gold : T.border,
      position: "relative", transition: "background 0.2s", flexShrink: 0, cursor: "pointer"
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3, left: checked ? 19 : 3, transition: "left 0.2s"
      }} />
    </div>
    <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
  </label>
);

const StatCard = ({ label, value, sub, color, icon }) => (
  <div style={{
    background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
    padding: "16px 18px", flex: 1, minWidth: 0,
    borderTop: `2px solid ${color || T.border}`
  }}>
    <div style={{ fontSize: 10, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: 17, fontWeight: 800, color: color || T.text, letterSpacing: -0.5 }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>{sub}</div>}
  </div>
);

/* ─── MAIN ───────────────────────────────────────────────────── */
export default function App() {
  /* ── Basic ── */
  const [initial, setInitial] = useState(100000);
  const [annualReturn, setAnnualReturn] = useState(8);

  /* ── Fees ── */
  const [mgmtFee, setMgmtFee] = useState(0.5);
  const [perfFee, setPerfFee] = useState(10);
  const [useHwm, setUseHwm] = useState(true);

  /* ── Tax ── */
  const [applyTax, setApplyTax] = useState(true);
  const [taxRate, setTaxRate] = useState(15);
  const [timeTest, setTimeTest] = useState(false);

  /* ── Chart mode ── */
  const [chartMode, setChartMode] = useState("value"); // value | annual

  /* ── Phases ── */
  const [phases, setPhases] = useState([
    { id: 1, startYear: 1, endYear: 5,  amount: 1000, type: "contribute" },
    { id: 2, startYear: 6, endYear: 15, amount: 3000, type: "contribute" },
    { id: 3, startYear: 16,endYear: 25, amount: 8000, type: "contribute" },
    { id: 4, startYear: 26,endYear: 35, amount: 4000, type: "withdraw"  },
  ]);

  const totalYears = useMemo(() => Math.max(...phases.map(p => p.endYear), 5), [phases]);

  const addPhase = () => {
    const last = phases[phases.length - 1];
    const start = last ? last.endYear + 1 : 1;
    setPhases(p => [...p, { id: Date.now(), startYear: start, endYear: start + 9, amount: 5000, type: "contribute" }]);
  };
  const removePhase = (id) => setPhases(p => p.filter(x => x.id !== id));
  const editPhase = (id, field, val) => setPhases(p => p.map(x => x.id === id ? { ...x, [field]: val } : x));

  /* ── SIMULATION ── */
  const { chartData, summary } = useMemo(() => {
    const mr = annualReturn / 100 / 12;           // monthly gross return
    const mf = mgmtFee   / 100 / 12;              // monthly mgmt fee
    const netMr = mr - mf;                         // net monthly return

    let port = initial;
    let portGross = initial;                       // without any fees
    let portNoPerf = initial;                      // with mgmt fee, no perf fee
    let totalIn = initial;
    let totalOut = 0;
    let hwm = initial;
    let annualStart = initial;
    let annualStartGross = initial;
    let annualStartNoPerf = initial;

    const rows = [{
      year: 0, value: port, gross: portGross, noPerf: portNoPerf,
      invested: totalIn, netInvested: totalIn, gains: 0, afterTax: port, out: 0,
      annualGain: 0,
    }];

    for (let m = 1; m <= totalYears * 12; m++) {
      const yr = m / 12;
      const yc = Math.ceil(yr);
      const ph = phases.find(p => yc >= p.startYear && yc <= p.endYear);
      const mo = ph ? ph.amount : 0;
      const withdraw = ph?.type === "withdraw";

      // Grow
      port      = port      * (1 + netMr);
      portGross = portGross * (1 + mr);
      portNoPerf= portNoPerf* (1 + netMr);

      // Flow
      if (!withdraw) {
        port      += mo; portGross += mo; portNoPerf += mo;
        totalIn   += mo;
      } else {
        const w = Math.min(mo, port);
        port      -= w; portGross -= w; portNoPerf -= w;
        totalOut  += w;
      }

      // Performance fee (annual)
      if (m % 12 === 0 && perfFee > 0) {
        const gain = port - annualStart;
        if (gain > 0) {
          const base = useHwm ? Math.max(0, port - hwm) : gain;
          const fee  = base * perfFee / 100;
          port -= fee;
        }
        if (port > hwm) hwm = port;
        annualStart      = port;
        annualStartGross = portGross;
        annualStartNoPerf= portNoPerf;
      }

      port = Math.max(0, port);

      if (m % 12 === 0) {
        const netInv  = totalIn - totalOut;
        const gains   = Math.max(0, port - netInv);
        const taxable = Math.max(0, port - totalIn);
        const afterTax = applyTax && !timeTest
          ? port - taxable * taxRate / 100
          : port;
        const annualGain = port - annualStart + (m > 12 ? (rows[m/12 - 1]?.value || port) : initial) - annualStart;

        rows.push({
          year:      m / 12,
          value:     Math.max(0, Math.round(port)),
          gross:     Math.max(0, Math.round(portGross)),
          noPerf:    Math.max(0, Math.round(portNoPerf)),
          invested:  Math.round(totalIn),
          netInvested: Math.round(netInv),
          gains:     Math.round(gains),
          afterTax:  Math.round(afterTax),
          out:       Math.round(totalOut),
          annualFlow: withdraw ? -mo : mo,
        });
      }
    }

    const fin = rows[rows.length - 1];
    const taxable = Math.max(0, fin.value - fin.invested);
    const taxPaid = applyTax && !timeTest ? taxable * taxRate / 100 : 0;
    const feesCost = fin.gross - fin.value;

    return {
      chartData: rows,
      summary: {
        finalValue:    fin.value,
        afterTax:      fin.afterTax,
        totalIn:       fin.invested,
        totalOut:      fin.out,
        gains:         fin.gains,
        feesCost:      Math.round(feesCost),
        taxPaid:       Math.round(taxPaid),
        years:         totalYears,
      }
    };
  }, [initial, annualReturn, mgmtFee, perfFee, useHwm, applyTax, taxRate, timeTest, phases, totalYears]);

  /* ─── RENDER ─────────────────────────────────────────────────── */
  return (
    <div style={{
      display: "flex", height: "100vh", background: T.bg,
      color: T.text, fontFamily: "'DM Mono', 'Courier New', monospace",
      fontSize: 13, overflow: "hidden"
    }}>
      {/* ══ LEFT PANEL ══ */}
      <div style={{
        width: 340, minWidth: 340, overflowY: "auto", padding: "22px 18px",
        background: T.surface, borderRight: `1px solid ${T.border}`,
        scrollbarWidth: "thin", scrollbarColor: `${T.border} transparent`
      }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: T.gold, letterSpacing: -1 }}>
            ◈ INVEST CALC
          </div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 4, letterSpacing: 1 }}>
            SIMULÁTOR SLOŽENÉHO ÚROČENÍ
          </div>
        </div>

        {/* ── Základní ── */}
        <div style={{ marginBottom: 22 }}>
          <SectionHead label="Základní nastavení" icon="◆" />
          <Slider label="Počáteční vklad" value={initial} onChange={setInitial}
            min={0} max={2000000} step={5000} fmt={v => czk(v)} color={T.teal} />
          <Slider label="Roční výnos (brutto)" value={annualReturn} onChange={setAnnualReturn}
            min={0} max={30} step={0.5} fmt={v => `${v} %`} color={T.gold} />
        </div>

        {/* ── Poplatky ── */}
        <div style={{ marginBottom: 22 }}>
          <SectionHead label="Poplatky fondu" icon="◆" />
          <Slider label="Správcovský poplatek (p.a.)" value={mgmtFee} onChange={setMgmtFee}
            min={0} max={3} step={0.05} fmt={v => `${v.toFixed(2)} %`} color={T.rose}
            hint="Strhává se průběžně z hodnoty portfolia každý měsíc" />
          <Slider label="Výkonnostní odměna" value={perfFee} onChange={setPerfFee}
            min={0} max={50} step={1} fmt={v => `${v} %`} color={T.rose}
            hint="Procento z ročního zisku fondu" />
          <Toggle label="High-water mark (fee jen z nových maxim)" checked={useHwm} onChange={setUseHwm} />
        </div>

        {/* ── Daně ── */}
        <div style={{ marginBottom: 22 }}>
          <SectionHead label="Daně při výběru" icon="◆" />
          <Toggle label="Zahrnout daň z kapitálových výnosů" checked={applyTax} onChange={setApplyTax} />
          {applyTax && (
            <>
              <Slider label="Sazba daně z výnosu" value={taxRate} onChange={setTaxRate}
                min={0} max={40} step={1} fmt={v => `${v} %`} color={T.amber} />
              <Toggle
                label="Splněn časový test (3 roky) — výnosy osvobozeny"
                checked={timeTest} onChange={setTimeTest}
              />
            </>
          )}
        </div>

        {/* ── Fáze ── */}
        <div style={{ marginBottom: 22 }}>
          <SectionHead label="Fáze spoření & výběrů" icon="◆" />
          <p style={{ fontSize: 10, color: T.muted, marginBottom: 12, lineHeight: 1.6 }}>
            Nastav různé měsíční vklady nebo výběry v různých obdobích. Portfolio roste i při výběrech — záleží na výši částky.
          </p>

          {phases.map((ph, i) => (
            <div key={ph.id} style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderLeft: `3px solid ${ph.type === "contribute" ? T.teal : T.rose}`,
              borderRadius: 8, padding: "12px", marginBottom: 10
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>
                  FÁZE {i + 1} · {ph.type === "contribute" ? "📥 VKLADÁM" : "📤 VYBÍRÁM"}
                </span>
                <button onClick={() => removePhase(ph.id)}
                  style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {[["Od roku", "startYear"], ["Do roku", "endYear"]].map(([lbl, fld]) => (
                  <div key={fld} style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: T.muted, marginBottom: 3 }}>{lbl}</div>
                    <input type="number" value={ph[fld]}
                      onChange={e => editPhase(ph.id, fld, Number(e.target.value))}
                      style={{
                        width: "100%", background: T.surface, border: `1px solid ${T.border}`,
                        borderRadius: 5, color: T.text, padding: "5px 8px", fontSize: 12,
                        fontFamily: "inherit", boxSizing: "border-box"
                      }} />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: T.muted, marginBottom: 3 }}>
                  Měsíční částka (Kč)
                </div>
                <input type="number" value={ph.amount}
                  onChange={e => editPhase(ph.id, "amount", Number(e.target.value))}
                  style={{
                    width: "100%", background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 5, color: T.text, padding: "5px 8px", fontSize: 12,
                    fontFamily: "inherit", boxSizing: "border-box"
                  }} />
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {["contribute", "withdraw"].map(t => (
                  <button key={t} onClick={() => editPhase(ph.id, "type", t)}
                    style={{
                      flex: 1, padding: "5px 0", borderRadius: 5, border: "none", cursor: "pointer",
                      fontSize: 10, fontWeight: 700, fontFamily: "inherit",
                      background: ph.type === t
                        ? (t === "contribute" ? T.teal : T.rose)
                        : T.surface,
                      color: ph.type === t ? T.bg : T.muted,
                      transition: "all 0.15s"
                    }}>
                    {t === "contribute" ? "📥 Vkládám" : "📤 Vybírám"}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button onClick={addPhase} style={{
            width: "100%", padding: "9px", background: "none",
            border: `1px dashed ${T.border}`, borderRadius: 8,
            color: T.gold, cursor: "pointer", fontSize: 11, fontFamily: "inherit",
            transition: "border-color 0.2s"
          }}>
            + Přidat fázi
          </button>
        </div>

        {/* Fee impact note */}
        <div style={{
          background: `${T.rose}12`, border: `1px solid ${T.rose}30`,
          borderRadius: 8, padding: "10px 12px", marginBottom: 16
        }}>
          <div style={{ fontSize: 10, color: T.rose, fontWeight: 700, marginBottom: 4 }}>⚠ DOPAD POPLATKŮ</div>
          <div style={{ fontSize: 11, color: T.muted }}>
            Poplatky a daně vás za {summary.years} let přijdou na <span style={{ color: T.rose, fontWeight: 700 }}>
              {czk(summary.feesCost + summary.taxPaid)}
            </span>
          </div>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "22px 24px", overflow: "hidden", gap: 16 }}>

        {/* ── Summary cards ── */}
        <div style={{ display: "flex", gap: 12 }}>
          <StatCard icon="◈" label="Hodnota portfolia"
            value={czk(summary.finalValue)} color={T.gold}
            sub={`Za ${summary.years} let | Výnos ${annualReturn}% p.a.`} />
          <StatCard icon="✦" label="Po zdanění"
            value={czk(summary.afterTax)} color={T.teal}
            sub={applyTax && !timeTest ? `Daň: ${czk(summary.taxPaid)}` : "Daň: 0 Kč (osvobozen)"} />
          <StatCard icon="▲" label="Celkem vloženo"
            value={czk(summary.totalIn)} color={T.violet}
            sub={summary.totalOut > 0 ? `Vybráno: ${czk(summary.totalOut)}` : "Bez výběrů"} />
          <StatCard icon="◉" label="Čistý zisk"
            value={czk(summary.gains)} color={T.amber}
            sub={`Poplatky: ${czk(summary.feesCost)}`} />
        </div>

        {/* ── Chart controls ── */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[
            { id: "value",   label: "Hodnota portfolia" },
            { id: "compare", label: "Porovnání (s/bez poplatků)" },
            { id: "flow",    label: "Toky (vklady vs výběry)" },
          ].map(m => (
            <button key={m.id} onClick={() => setChartMode(m.id)}
              style={{
                padding: "5px 14px", borderRadius: 6, border: `1px solid ${chartMode === m.id ? T.gold : T.border}`,
                background: chartMode === m.id ? `${T.gold}18` : "transparent",
                color: chartMode === m.id ? T.gold : T.muted,
                cursor: "pointer", fontSize: 10, fontFamily: "inherit", fontWeight: 700,
                letterSpacing: 0.5, transition: "all 0.15s"
              }}>
              {m.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: T.muted }}>Přejdi myší na graf pro detailní hodnoty</span>
        </div>

        {/* ── Chart ── */}
        <div style={{
          flex: 1, background: T.surface, borderRadius: 12,
          border: `1px solid ${T.border}`, padding: "20px 20px 8px", minHeight: 0
        }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === "value" ? (
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                <defs>
                  {[["vg", T.gold], ["tg", T.teal], ["ig", T.violet], ["ag", T.amber]].map(([id, c]) => (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }}
                  tickFormatter={v => `${v}r`} />
                <YAxis stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }}
                  tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: T.muted, paddingTop: 8 }} />
                <Area dataKey="invested" name="Celkem vloženo" stroke={T.violet} fill="url(#ig)" strokeWidth={2} dot={false} />
                <Area dataKey="value"    name="Hodnota portfolia" stroke={T.gold}   fill="url(#vg)" strokeWidth={2.5} dot={false} />
                {applyTax && !timeTest && (
                  <Area dataKey="afterTax" name="Po zdanění" stroke={T.teal} fill="url(#tg)" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                )}
              </AreaChart>
            ) : chartMode === "compare" ? (
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                <defs>
                  {[["g1", T.amber], ["g2", T.gold], ["g3", T.teal]].map(([id, c]) => (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }} tickFormatter={v => `${v}r`} />
                <YAxis stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }}
                  tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: T.muted, paddingTop: 8 }} />
                <Area dataKey="gross"  name="Bez jakýchkoliv poplatků" stroke={T.amber} fill="url(#g1)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                <Area dataKey="noPerf" name="Pouze správcovský poplatek" stroke={T.gold}  fill="url(#g2)" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                <Area dataKey="value"  name="S poplatky (správa + výkonnostní)" stroke={T.teal} fill="url(#g3)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            ) : (
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                <defs>
                  <linearGradient id="vgf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T.gold} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={T.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }} tickFormatter={v => `${v}r`} />
                <YAxis yAxisId="left" stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }}
                  tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} />
                <YAxis yAxisId="right" orientation="right" stroke={T.muted} tick={{ fontSize: 10, fill: T.muted }}
                  tickFormatter={v => v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: T.muted, paddingTop: 8 }} />
                <ReferenceLine yAxisId="right" y={0} stroke={T.border} strokeWidth={2} />
                <Bar yAxisId="right" dataKey="annualFlow" name="Měsíční tok (Kč)"
                  fill={T.teal} opacity={0.6} radius={[2, 2, 0, 0]} />
                <Area yAxisId="left" dataKey="value" name="Hodnota portfolia"
                  stroke={T.gold} fill="url(#vgf)" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* ── Phase timeline ── */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", height: 28 }}>
          <span style={{ fontSize: 9, color: T.muted, whiteSpace: "nowrap", marginRight: 4 }}>TIMELINE</span>
          {phases.map((ph, i) => {
            const w = ((ph.endYear - ph.startYear + 1) / totalYears) * 100;
            return (
              <div key={ph.id} style={{
                height: 20, borderRadius: 4, display: "flex", alignItems: "center",
                justifyContent: "center", overflow: "hidden", position: "relative",
                background: ph.type === "contribute" ? `${T.teal}30` : `${T.rose}30`,
                border: `1px solid ${ph.type === "contribute" ? T.teal : T.rose}50`,
                minWidth: 40, flex: w,
              }}>
                <span style={{ fontSize: 9, color: ph.type === "contribute" ? T.teal : T.rose, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {ph.startYear}–{ph.endYear}r | {ph.type === "contribute" ? "+" : "−"}{num(ph.amount)} Kč
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}