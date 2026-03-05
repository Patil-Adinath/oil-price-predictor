import { useState, useEffect, useCallback } from "react";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// --- Geopolitical & Market Signal Data ---
const GEOPOLITICAL_FACTORS = [
  { id: "middleEast", label: "Middle East Tension", region: "MENA", icon: "🌍", weight: 0.18 },
  { id: "russiaUkraine", label: "Russia-Ukraine Conflict", region: "Europe", icon: "⚔️", weight: 0.15 },
  { id: "iranSanctions", label: "Iran Sanctions", region: "MENA", icon: "🚫", weight: 0.12 },
  { id: "opecPolicy", label: "OPEC+ Policy", region: "Global", icon: "🛢️", weight: 0.20 },
  { id: "chinaGrowth", label: "China Economic Growth", region: "Asia", icon: "🇨🇳", weight: 0.14 },
  { id: "usDollar", label: "USD Strength", region: "Americas", icon: "💵", weight: 0.10 },
  { id: "seaRoutes", label: "Shipping Route Security", region: "Global", icon: "🚢", weight: 0.11 },
];

const MARKET_INDICATORS = [
  { id: "inventories", label: "US Crude Inventories", unit: "MMbbl", baseValue: 430, range: [380, 480] },
  { id: "rigCount", label: "Baker Hughes Rig Count", unit: "rigs", baseValue: 485, range: [400, 560] },
  { id: "gdpGrowth", label: "Global GDP Growth", unit: "%", baseValue: 3.1, range: [1.5, 4.5] },
  { id: "inflation", label: "US Inflation (CPI)", unit: "%", baseValue: 3.2, range: [2.0, 6.0] },
  { id: "naturalGas", label: "Natural Gas Price", unit: "$/MMBtu", baseValue: 2.8, range: [1.5, 5.0] },
];

const OIL_BENCHMARKS = ["WTI Crude", "Brent Crude", "Dubai Crude"];

// Simulate realistic price history
function generatePriceHistory(benchmark) {
  const seed = benchmark === "WTI Crude" ? 78 : benchmark === "Brent Crude" ? 82 : 80;
  const history = [];
  let price = seed;
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    price += (Math.random() - 0.48) * 1.8;
    price = Math.max(60, Math.min(120, price));
    history.push({ date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), price: +price.toFixed(2) });
  }
  return history;
}

function generateIndicatorValue(indicator) {
  const { baseValue, range } = indicator;
  const v = baseValue + (Math.random() - 0.5) * (range[1] - range[0]) * 0.25;
  return +Math.max(range[0], Math.min(range[1], v)).toFixed(2);
}

// Sparkline SVG
function Sparkline({ data, color = "#f59e0b", width = 120, height = 40 }) {
  if (!data || data.length < 2) return null;
  const prices = data.map(d => d.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - ((p - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  const areaPath = `M0,${height} L${pts.split(" ").map((pt, i) => i === 0 ? `0,${pt.split(",")[1]}` : pt).join(" L")} L${width},${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={`M0,${height} ${pts.split(" ").map((pt, i) => (i === 0 ? `L${pt}` : `L${pt}`)).join(" ")} L${width},${height} Z`}
        fill={`url(#sg-${color.replace("#","")})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Gauge component
function Gauge({ value, label, color }) {
  const pct = Math.min(1, Math.max(0, value / 10));
  const angle = -135 + pct * 270;
  const r = 40, cx = 50, cy = 55;
  const toRad = deg => (deg * Math.PI) / 180;
  const arcX = cx + r * Math.cos(toRad(angle - 90));
  const arcY = cy + r * Math.sin(toRad(angle - 90));
  const startX = cx + r * Math.cos(toRad(-135 - 90));
  const startY = cy + r * Math.sin(toRad(-135 - 90));
  const largeArc = pct > 0.5 ? 1 : 0;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="100" height="70" viewBox="0 0 100 70">
        <path d={`M ${cx + r * Math.cos(toRad(-135-90))} ${cy + r * Math.sin(toRad(-135-90))} A ${r} ${r} 0 1 1 ${cx + r * Math.cos(toRad(135-90))} ${cy + r * Math.sin(toRad(135-90))}`}
          fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round"/>
        <path d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${arcX} ${arcY}`}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r="4" fill={color}/>
        <text x={cx} y={cy - 12} textAnchor="middle" fill="#f1f5f9" fontSize="13" fontWeight="700">{value.toFixed(1)}</text>
      </svg>
      <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "-8px" }}>{label}</div>
    </div>
  );
}

// BarChart for price history
function MiniBarChart({ data }) {
  if (!data || data.length === 0) return null;
  const prices = data.map(d => d.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const recent = data.slice(-14);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "60px", padding: "0 4px" }}>
      {recent.map((d, i) => {
        const h = ((d.price - min) / range) * 50 + 8;
        const isLast = i === recent.length - 1;
        return (
          <div key={i} title={`${d.date}: $${d.price}`}
            style={{ flex: 1, height: `${h}px`, background: isLast ? "#f59e0b" : `rgba(245,158,11,${0.3 + 0.4 * ((d.price - min) / range)})`,
              borderRadius: "2px 2px 0 0", transition: "height 0.3s", cursor: "pointer" }}/>
        );
      })}
    </div>
  );
}

export default function OilPredictor() {
  const [benchmark, setBenchmark] = useState("Brent Crude");
  const [geoFactors, setGeoFactors] = useState(() =>
    Object.fromEntries(GEOPOLITICAL_FACTORS.map(f => [f.id, 5]))
  );
  const [indicators, setIndicators] = useState(() =>
    Object.fromEntries(MARKET_INDICATORS.map(i => [i.id, generateIndicatorValue(i)]))
  );
  const [priceHistory, setPriceHistory] = useState(() => generatePriceHistory("Brent Crude"));
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [horizon, setHorizon] = useState("7d");
  const [activeTab, setActiveTab] = useState("geo");
  const [pulseActive, setPulseActive] = useState(false);

  const currentPrice = priceHistory[priceHistory.length - 1]?.price || 82;
  const prevPrice = priceHistory[priceHistory.length - 2]?.price || 81;
  const priceChange = +(currentPrice - prevPrice).toFixed(2);
  const priceChangePct = +((priceChange / prevPrice) * 100).toFixed(2);

  useEffect(() => {
    setPriceHistory(generatePriceHistory(benchmark));
    setPrediction(null);
  }, [benchmark]);

  const geoRiskScore = Object.entries(geoFactors).reduce((acc, [id, val]) => {
    const f = GEOPOLITICAL_FACTORS.find(f => f.id === id);
    return acc + val * (f?.weight || 0.1);
  }, 0);

  const buildPrompt = useCallback(() => {
    const geoLines = GEOPOLITICAL_FACTORS.map(f =>
      `  - ${f.label} (${f.region}): ${geoFactors[f.id]}/10 tension`
    ).join("\n");
    const indLines = MARKET_INDICATORS.map(i =>
      `  - ${i.label}: ${indicators[i.id]} ${i.unit}`
    ).join("\n");
    const horizonLabel = { "1d": "1 day", "7d": "7 days", "30d": "30 days", "90d": "90 days" }[horizon];

    return `You are an expert oil market analyst. Predict the ${benchmark} oil price over the next ${horizonLabel}.

CURRENT MARKET DATA:
- Benchmark: ${benchmark}
- Current Price: $${currentPrice}/barrel
- 30-day trend: From $${priceHistory[0]?.price} to $${currentPrice}
- Geopolitical Risk Score: ${geoRiskScore.toFixed(2)}/10

GEOPOLITICAL FACTORS (1=calm, 10=extreme tension):
${geoLines}

MARKET INDICATORS:
${indLines}

Provide your analysis in this EXACT JSON format (no markdown, no extra text):
{
  "predictedPrice": <number>,
  "lowEstimate": <number>,
  "highEstimate": <number>,
  "confidence": <number 0-100>,
  "direction": "bullish" | "bearish" | "neutral",
  "primaryDriver": "<main factor driving price>",
  "riskFactors": ["<risk1>", "<risk2>", "<risk3>"],
  "geoImpact": "<1 sentence on geopolitical impact>",
  "marketSentiment": "<1 sentence on market sentiment>",
  "summary": "<2-3 sentence expert analysis>"
}`;
  }, [benchmark, currentPrice, geoFactors, indicators, geoRiskScore, horizon, priceHistory]);

  const runPrediction = async () => {
    setLoading(true);
    setPulseActive(true);
    try {
      const res = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: buildPrompt() }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        }),
      });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const start = clean.indexOf("{"), end = clean.lastIndexOf("}");
      const parsed = JSON.parse(clean.slice(start, end + 1));
      setPrediction({ ...parsed, timestamp: new Date().toLocaleTimeString() });
    } catch (e) {
      setPrediction({ error: "Analysis failed. Please try again.", timestamp: new Date().toLocaleTimeString() });
    }
    setLoading(false);
    setTimeout(() => setPulseActive(false), 1000);
  };

  const directionColor = prediction?.direction === "bullish" ? "#22c55e" : prediction?.direction === "bearish" ? "#ef4444" : "#f59e0b";
  const directionIcon = prediction?.direction === "bullish" ? "▲" : prediction?.direction === "bearish" ? "▼" : "→";

  return (
    <div style={{
      minHeight: "100vh", background: "#030712",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      color: "#e2e8f0", padding: "0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0f172a; } ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .tab-btn { background: none; border: 1px solid #1e293b; color: #64748b; padding: 6px 16px; cursor: pointer; font-family: inherit; font-size: 11px; letter-spacing: 0.1em; transition: all 0.2s; border-radius: 2px; }
        .tab-btn.active { background: #f59e0b; border-color: #f59e0b; color: #000; font-weight: 600; }
        .tab-btn:hover:not(.active) { border-color: #f59e0b44; color: #cbd5e1; }
        .bench-btn { background: none; border: 1px solid #1e293b; color: #64748b; padding: 7px 14px; cursor: pointer; font-family: inherit; font-size: 11px; letter-spacing: 0.08em; transition: all 0.2s; border-radius: 2px; }
        .bench-btn.active { background: #0f172a; border-color: #f59e0b; color: #f59e0b; }
        .bench-btn:hover:not(.active) { border-color: #334155; color: #cbd5e1; }
        .slider-geo { width: 100%; -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; outline: none; cursor: pointer; transition: all 0.2s; }
        .slider-geo::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #f59e0b; cursor: pointer; box-shadow: 0 0 8px #f59e0b66; }
        .predict-btn { background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: #000; padding: 14px 36px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.15em; cursor: pointer; border-radius: 4px; transition: all 0.3s; width: 100%; }
        .predict-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px #f59e0b44; }
        .predict-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .card { background: #0a0f1e; border: 1px solid #1e293b; border-radius: 6px; padding: 16px; }
        .pulse { animation: pulse 2s ease-in-out; }
        @keyframes pulse { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 30px #f59e0b44} }
        .glow-text { text-shadow: 0 0 20px currentColor; }
        .horizon-btn { background: none; border: 1px solid #1e293b; color: #64748b; padding: 5px 12px; cursor: pointer; font-family: inherit; font-size: 10px; letter-spacing: 0.1em; transition: all 0.2s; border-radius: 2px; }
        .horizon-btn.active { background: #1e293b; border-color: #475569; color: #e2e8f0; }
        .ticker-row { display:flex; gap:4px; overflow:hidden; white-space:nowrap; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e293b", background: "#030712", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "32px", height: "32px", background: "linear-gradient(135deg,#f59e0b,#92400e)", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🛢️</div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "20px", letterSpacing: "0.15em", color: "#f59e0b" }}>PETROCAST</div>
            <div style={{ fontSize: "9px", color: "#475569", letterSpacing: "0.2em" }}>AI-POWERED OIL PRICE INTELLIGENCE</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {OIL_BENCHMARKS.map(b => (
            <button key={b} className={`bench-btn ${benchmark === b ? "active" : ""}`} onClick={() => setBenchmark(b)}>{b}</button>
          ))}
        </div>
      </div>

      {/* Ticker */}
      <div style={{ background: "#050b14", borderBottom: "1px solid #1e293b", padding: "6px 24px", fontSize: "10px", color: "#475569", letterSpacing: "0.1em", display: "flex", gap: "32px", overflowX: "auto" }}>
        {[["WTI", "78.42", "+0.38%", true], ["BRENT", "82.10", "-0.21%", false], ["DUBAI", "80.55", "+0.15%", true], ["NAT GAS", "2.84", "+1.2%", true], ["USD/EUR", "1.085", "-0.08%", false], ["OPEC BASKET", "83.20", "+0.42%", true]].map(([n, p, c, up]) => (
          <span key={n} style={{ display: "flex", gap: "6px", whiteSpace: "nowrap" }}>
            <span style={{ color: "#64748b" }}>{n}</span>
            <span style={{ color: "#e2e8f0" }}>${p}</span>
            <span style={{ color: up ? "#22c55e" : "#ef4444" }}>{c}</span>
          </span>
        ))}
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
        {/* Top Row - Price Hero + Chart */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "16px", marginBottom: "16px" }}>
          {/* Price Card */}
          <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.2em", marginBottom: "8px" }}>{benchmark.toUpperCase()} · SPOT PRICE</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "52px", color: "#f8fafc", lineHeight: 1 }}>${currentPrice}</div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
                <span style={{ color: priceChange >= 0 ? "#22c55e" : "#ef4444", fontSize: "14px", fontWeight: 600 }}>
                  {priceChange >= 0 ? "▲" : "▼"} {Math.abs(priceChange)} ({priceChangePct}%)
                </span>
                <span style={{ fontSize: "10px", color: "#475569" }}>24h</span>
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <Sparkline data={priceHistory} width={260} height={50} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#334155", marginTop: "4px" }}>
                <span>{priceHistory[0]?.date}</span>
                <span>30-DAY TREND</span>
                <span>TODAY</span>
              </div>
            </div>
            <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[["30D HIGH", Math.max(...priceHistory.map(d => d.price)).toFixed(2)], ["30D LOW", Math.min(...priceHistory.map(d => d.price)).toFixed(2)]].map(([l, v]) => (
                <div key={l} style={{ background: "#0f172a", borderRadius: "4px", padding: "8px" }}>
                  <div style={{ fontSize: "9px", color: "#475569", letterSpacing: "0.1em" }}>{l}</div>
                  <div style={{ fontSize: "15px", color: "#f1f5f9", fontWeight: 600 }}>${v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bar Chart */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.2em" }}>30-DAY PRICE HISTORY · $/BBL</div>
              <div style={{ fontSize: "10px", color: "#334155" }}>Last updated: {new Date().toLocaleTimeString()}</div>
            </div>
            {/* Custom chart */}
            <div style={{ position: "relative", height: "140px" }}>
              <svg width="100%" height="100%" viewBox="0 0 800 140" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4"/>
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                {(() => {
                  const prices = priceHistory.map(d => d.price);
                  const min = Math.min(...prices) - 2, max = Math.max(...prices) + 2;
                  const range = max - min;
                  const W = 800, H = 130;
                  const pts = prices.map((p, i) => ({ x: (i / (prices.length - 1)) * W, y: H - ((p - min) / range) * H }));
                  const linePts = pts.map(p => `${p.x},${p.y}`).join(" ");
                  const areaD = `M0,${H} ${pts.map(p => `L${p.x},${p.y}`).join(" ")} L${W},${H} Z`;
                  return <>
                    <path d={areaD} fill="url(#lineGrad)"/>
                    <polyline points={linePts} fill="none" stroke="#f59e0b" strokeWidth="2.5"/>
                    {pts.filter((_, i) => i % 5 === 0).map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="3" fill="#f59e0b" opacity="0.7"/>
                    ))}
                  </>;
                })()}
              </svg>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#334155", marginTop: "4px" }}>
              {priceHistory.filter((_, i) => i % 7 === 0 || i === priceHistory.length - 1).map((d, i) => (
                <span key={i}>{d.date}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Row - Inputs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          {/* Geopolitical Panel */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.2em" }}>GEOPOLITICAL TENSION MATRIX</div>
              <div style={{ background: "#0f172a", padding: "3px 10px", borderRadius: "2px", fontSize: "10px", color: geoRiskScore > 6 ? "#ef4444" : geoRiskScore > 4 ? "#f59e0b" : "#22c55e" }}>
                RISK: {geoRiskScore.toFixed(1)}/10
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {GEOPOLITICAL_FACTORS.map(f => {
                const val = geoFactors[f.id];
                const color = val > 7 ? "#ef4444" : val > 5 ? "#f59e0b" : val > 3 ? "#22d3ee" : "#22c55e";
                return (
                  <div key={f.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: "11px", color: "#94a3b8", display: "flex", gap: "6px", alignItems: "center" }}>
                        <span>{f.icon}</span><span>{f.label}</span>
                        <span style={{ fontSize: "9px", color: "#334155", padding: "1px 5px", background: "#0f172a", borderRadius: "2px" }}>{f.region}</span>
                      </span>
                      <span style={{ fontSize: "12px", color, fontWeight: 600, width: "24px", textAlign: "right" }}>{val}</span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input type="range" min="1" max="10" step="1" value={val} className="slider-geo"
                        style={{ background: `linear-gradient(to right, ${color} ${(val-1)/9*100}%, #1e293b ${(val-1)/9*100}%)` }}
                        onChange={e => setGeoFactors(prev => ({ ...prev, [f.id]: +e.target.value }))}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Market Indicators + Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Market Indicators */}
            <div className="card">
              <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.2em", marginBottom: "14px" }}>MARKET INDICATORS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {MARKET_INDICATORS.map(ind => {
                  const val = indicators[ind.id];
                  const pct = (val - ind.range[0]) / (ind.range[1] - ind.range[0]);
                  const color = ind.id === "inventories" ? (pct > 0.6 ? "#ef4444" : "#22c55e") : pct > 0.6 ? "#22c55e" : "#ef4444";
                  return (
                    <div key={ind.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                          <span style={{ fontSize: "10px", color: "#64748b" }}>{ind.label}</span>
                          <span style={{ fontSize: "11px", color: "#e2e8f0", fontWeight: 600 }}>{val} <span style={{ fontSize: "9px", color: "#475569" }}>{ind.unit}</span></span>
                        </div>
                        <div style={{ height: "3px", background: "#0f172a", borderRadius: "2px" }}>
                          <div style={{ height: "100%", width: `${pct * 100}%`, background: color, borderRadius: "2px", transition: "width 0.3s" }}/>
                        </div>
                      </div>
                      <button style={{ background: "none", border: "1px solid #1e293b", color: "#64748b", width: "22px", height: "22px", cursor: "pointer", borderRadius: "2px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onClick={() => setIndicators(prev => ({ ...prev, [ind.id]: +Math.min(ind.range[1], (prev[ind.id] + (ind.range[1]-ind.range[0])*0.05)).toFixed(2) }))}>+</button>
                      <button style={{ background: "none", border: "1px solid #1e293b", color: "#64748b", width: "22px", height: "22px", cursor: "pointer", borderRadius: "2px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onClick={() => setIndicators(prev => ({ ...prev, [ind.id]: +Math.max(ind.range[0], (prev[ind.id] - (ind.range[1]-ind.range[0])*0.05)).toFixed(2) }))}>−</button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gauges */}
            <div className="card" style={{ padding: "12px" }}>
              <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.2em", marginBottom: "10px" }}>RISK GAUGES</div>
              <div style={{ display: "flex", justifyContent: "space-around" }}>
                <Gauge value={geoRiskScore} label="GEO RISK" color={geoRiskScore > 6 ? "#ef4444" : geoRiskScore > 4 ? "#f59e0b" : "#22c55e"}/>
                <Gauge value={indicators.gdpGrowth * 2.5} label="DEMAND" color="#22d3ee"/>
                <Gauge value={(indicators.inflation / 6) * 10} label="INFLATION" color="#a78bfa"/>
              </div>
            </div>
          </div>
        </div>

        {/* Prediction Controls + Output */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "16px" }}>
          {/* Controls */}
          <div className="card">
            <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.2em", marginBottom: "16px" }}>PREDICTION HORIZON</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "20px" }}>
              {[["1d", "24 HOURS"], ["7d", "7 DAYS"], ["30d", "30 DAYS"], ["90d", "90 DAYS"]].map(([v, l]) => (
                <button key={v} className={`horizon-btn ${horizon === v ? "active" : ""}`} onClick={() => setHorizon(v)} style={{ padding: "10px", textAlign: "center" }}>{l}</button>
              ))}
            </div>
            <div style={{ background: "#050b14", borderRadius: "4px", padding: "12px", marginBottom: "16px", fontSize: "10px", color: "#475569", lineHeight: 1.6 }}>
              <div style={{ color: "#f59e0b", marginBottom: "4px", letterSpacing: "0.1em" }}>SIGNAL SUMMARY</div>
              <div>Geo Risk: <span style={{ color: "#e2e8f0" }}>{geoRiskScore.toFixed(2)}/10</span></div>
              <div>Demand: <span style={{ color: "#e2e8f0" }}>{indicators.gdpGrowth}%</span> GDP</div>
              <div>Inventories: <span style={{ color: "#e2e8f0" }}>{indicators.inventories}M bbl</span></div>
              <div>Web Search: <span style={{ color: "#22c55e" }}>ENABLED ✓</span></div>
            </div>
            <button className="predict-btn" onClick={runPrediction} disabled={loading}>
              {loading ? "ANALYZING MARKETS..." : "RUN PREDICTION"}
            </button>
            {loading && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {["Fetching live market data...", "Analyzing geopolitical signals...", "Running AI model..."].map((s, i) => (
                  <div key={s} style={{ fontSize: "9px", color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", animation: `pulse ${0.8 + i * 0.3}s infinite`, opacity: loading ? 1 : 0 }}/>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prediction Output */}
          <div className={`card ${pulseActive ? "pulse" : ""}`} style={{ minHeight: "200px", position: "relative" }}>
            {!prediction && !loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "200px", gap: "12px", opacity: 0.4 }}>
                <div style={{ fontSize: "40px" }}>📡</div>
                <div style={{ fontSize: "12px", color: "#475569", letterSpacing: "0.2em" }}>AWAITING ANALYSIS</div>
                <div style={{ fontSize: "10px", color: "#334155" }}>Configure signals and run prediction</div>
              </div>
            )}
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "200px", gap: "16px" }}>
                <div style={{ width: "48px", height: "48px", border: "3px solid #1e293b", borderTop: "3px solid #f59e0b", borderRadius: "50%", animation: "spin 1s linear infinite" }}/>
                <div style={{ fontSize: "11px", color: "#f59e0b", letterSpacing: "0.2em" }}>PROCESSING GLOBAL SIGNALS</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
              </div>
            )}
            {prediction && !loading && !prediction.error && (
              <div className="fade-in">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.2em", marginBottom: "6px" }}>
                      {benchmark.toUpperCase()} PRICE FORECAST · {horizon.toUpperCase()}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "56px", color: directionColor, lineHeight: 1 }}>
                        ${prediction.predictedPrice?.toFixed(2)}
                      </div>
                      <div>
                        <div style={{ fontSize: "18px", color: directionColor }}>{directionIcon} {((prediction.predictedPrice - currentPrice) / currentPrice * 100).toFixed(1)}%</div>
                        <div style={{ fontSize: "10px", color: "#475569" }}>from ${currentPrice}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                      Range: <span style={{ color: "#22c55e" }}>${prediction.lowEstimate}</span> — <span style={{ color: "#ef4444" }}>${prediction.highEstimate}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ background: directionColor + "22", border: `1px solid ${directionColor}44`, borderRadius: "4px", padding: "8px 16px", marginBottom: "8px" }}>
                      <div style={{ fontSize: "10px", color: "#64748b", letterSpacing: "0.1em" }}>SENTIMENT</div>
                      <div style={{ fontSize: "16px", color: directionColor, fontWeight: 700, textTransform: "uppercase" }}>{prediction.direction}</div>
                    </div>
                    <div style={{ fontSize: "10px", color: "#475569" }}>
                      Confidence: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{prediction.confidence}%</span>
                    </div>
                    <div style={{ height: "4px", background: "#1e293b", borderRadius: "2px", marginTop: "4px", width: "120px" }}>
                      <div style={{ height: "100%", width: `${prediction.confidence}%`, background: directionColor, borderRadius: "2px" }}/>
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ background: "#0a0f1e", borderRadius: "4px", padding: "12px", border: "1px solid #1e293b" }}>
                    <div style={{ fontSize: "9px", color: "#475569", letterSpacing: "0.1em", marginBottom: "6px" }}>PRIMARY DRIVER</div>
                    <div style={{ fontSize: "11px", color: "#f59e0b" }}>⚡ {prediction.primaryDriver}</div>
                  </div>
                  <div style={{ background: "#0a0f1e", borderRadius: "4px", padding: "12px", border: "1px solid #1e293b" }}>
                    <div style={{ fontSize: "9px", color: "#475569", letterSpacing: "0.1em", marginBottom: "6px" }}>GEO IMPACT</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.4 }}>{prediction.geoImpact}</div>
                  </div>
                </div>
                <div style={{ background: "#0a0f1e", borderRadius: "4px", padding: "12px", border: "1px solid #1e293b", marginBottom: "12px" }}>
                  <div style={{ fontSize: "9px", color: "#475569", letterSpacing: "0.1em", marginBottom: "6px" }}>RISK FACTORS</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {prediction.riskFactors?.map((r, i) => (
                      <span key={i} style={{ background: "#1e293b", padding: "3px 10px", borderRadius: "2px", fontSize: "10px", color: "#94a3b8" }}>⚠ {r}</span>
                    ))}
                  </div>
                </div>
                <div style={{ background: "#050e1a", borderRadius: "4px", padding: "12px", borderLeft: "2px solid #f59e0b" }}>
                  <div style={{ fontSize: "9px", color: "#f59e0b", letterSpacing: "0.1em", marginBottom: "6px" }}>AI ANALYST SUMMARY</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.6 }}>{prediction.summary}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: "9px", color: "#334155", marginTop: "8px" }}>Analysis at {prediction.timestamp}</div>
              </div>
            )}
            {prediction?.error && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ef4444", fontSize: "12px" }}>{prediction.error}</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "9px", color: "#1e293b", letterSpacing: "0.1em" }}>
          PETROCAST · AI-POWERED OIL MARKET INTELLIGENCE · NOT FINANCIAL ADVICE · DATA FOR EDUCATIONAL PURPOSES ONLY
        </div>
      </div>
    </div>
  );
}
