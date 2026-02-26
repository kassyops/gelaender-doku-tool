import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "gelaender-tool-v3";

const defaultProject = {
  standort: "Rosenweg, 8307 Illnau-Effretikon",
  parzelle: "IE7652",
  datumAusbau: "",
  datumWiederaufbau: "",
  verantwortlich: "",
  baufirma: "",
  auftraggeber: "",
};

const defaultAbnahme = {
  reihenfolge: false, schrauben: false, hoehe: false, stabil: false,
  optisch: false, fotos: false, absturz: false,
  datumAbnahme: "", monteur: "", auftraggeber: "",
};

const CHECKLIST = [
  "Gesamtfotos von allen vier Seiten aufgenommen",
  "Detailfotos jeder Befestigungsstelle",
  "Detailfotos jeder Segment-Verbindung",
  "Fotos der Anfangs- und Endpunkte",
  "Massstab auf allen Detailfotos sichtbar",
  "Alle Segmente nummeriert (1, 2, 3 ...)",
  "Orientierungspfeile markiert",
  "Verbindungen markiert",
  "Skizze mit Draufsicht angefertigt",
  "Vermessung abgeschlossen",
];

const AUFBAU_STEPS = [
  { title: "Vorbereitung", desc: "Alle Segmente, Schrauben-Tüten und Dokumentation bereitlegen." },
  { title: "Referenzpunkte", desc: "Positionen der Fussplatten auf dem Boden anzeichnen." },
  { title: "Bohrlöcher", desc: "Bestehende Bohrlöcher prüfen. Falls beschädigt: neue Dübel setzen." },
  { title: "Erstes Segment", desc: "Segment 1 positionieren. Orientierungspfeil beachten." },
  { title: "Ausrichten", desc: "Mit Wasserwaage ausrichten. Höhenmasse kontrollieren." },
  { title: "Befestigen", desc: "Fussplatten mit dokumentierten Schrauben und Dübeln befestigen." },
  { title: "Weitere Segmente", desc: "Nachfolgende Segmente in Reihenfolge montieren." },
  { title: "Endkontrolle", desc: "Alle Verbindungen prüfen. Masse kontrollieren. Stabilität testen." },
];

const TABS = [
  { key: "skizze", label: "Skizze", icon: "✏️" },
  { key: "projekt", label: "Projekt", icon: "📋" },
  { key: "checkliste", label: "Check", icon: "✓" },
  { key: "pfosten", label: "Pfosten", icon: "🔩" },
  { key: "ausbau", label: "Ausbau", icon: "🔧" },
  { key: "aufbau", label: "Aufbau", icon: "📖" },
  { key: "abnahme", label: "Abnahme", icon: "✅" },
];

const DIR = { RIGHT: 0, DOWN: 1, LEFT: 2, UP: 3 };
const DIR_ARROWS = ["→", "↓", "←", "↑"];

function App() {
  const [activeTab, setActiveTab] = useState("skizze");
  const [project, setProject] = useState(defaultProject);
  const [checklist, setChecklist] = useState(Array(CHECKLIST.length).fill(false));
  const [abnahme, setAbnahme] = useState(defaultAbnahme);
  const [aufbauChecked, setAufbauChecked] = useState(Array(AUFBAU_STEPS.length).fill(false));
  const [segments, setSegments] = useState([
    { id: 1, nr: 1, lengthOben: 3200, typeOben: "ganz", hasUnten: true, lengthUnten: 3200, direction: DIR.DOWN, bemerkungen: "Entlang Gebäude" },
    { id: 2, nr: 2, lengthOben: 2400, typeOben: "halb", hasUnten: true, lengthUnten: 2400, direction: DIR.RIGHT, bemerkungen: "Ecke Parkplatz" },
    { id: 3, nr: 3, lengthOben: 4800, typeOben: "ganz", hasUnten: true, lengthUnten: 4800, direction: DIR.DOWN, bemerkungen: "Entlang Rosenweg" },
  ]);
  const [pfostenList, setPfostenList] = useState([]);
  const [protokoll, setProtokoll] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [toast, setToast] = useState("");
  const [editingSegment, setEditingSegment] = useState(null);
  const [startPoint, setStartPoint] = useState({ x: 40, y: 210 });
  const [pickingStart, setPickingStart] = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.project) setProject(d.project);
        if (d.checklist) setChecklist(d.checklist);
        if (d.segments?.length) setSegments(d.segments);
        if (d.pfostenList) setPfostenList(d.pfostenList);
        if (d.protokoll) setProtokoll(d.protokoll);
        if (d.abnahme) setAbnahme(d.abnahme);
        if (d.aufbauChecked) setAufbauChecked(d.aufbauChecked);
        if (d.startPoint) setStartPoint(d.startPoint);
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          project, checklist, segments, pfostenList, protokoll, abnahme, aufbauChecked, startPoint,
        }));
      } catch (e) {}
    }, 600);
    return () => clearTimeout(t);
  }, [project, checklist, segments, pfostenList, protokoll, abnahme, aufbauChecked, startPoint, loaded]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2200); };
  const totalLength = segments.reduce((s, seg) => s + (parseInt(seg.lengthOben) || 0), 0);

  const updateSegment = (id, u) => setSegments(p => p.map(s => s.id === id ? { ...s, ...u } : s));

  const addSegment = () => {
    const last = segments[segments.length - 1];
    setSegments([...segments, {
      id: Date.now(), nr: (last?.nr || 0) + 1, lengthOben: 2000, typeOben: "halb",
      hasUnten: true, lengthUnten: 2000, direction: last?.direction ?? DIR.RIGHT, bemerkungen: "",
    }]);
  };

  const removeSegment = (id) => {
    if (segments.length <= 1) return;
    setSegments(p => p.filter(s => s.id !== id));
    if (editingSegment === id) setEditingSegment(null);
  };

  const handleExportJSON = () => {
    const data = JSON.stringify({ project, checklist, segments, pfostenList, protokoll, abnahme, aufbauChecked }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `gelaender_${project.parzelle || "export"}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast("Exportiert!"); setShowExport(false);
  };

  const handleReset = async () => {
    if (!confirm("Alle Daten zurücksetzen?")) return;
    setProject(defaultProject);
    setChecklist(Array(CHECKLIST.length).fill(false));
    setSegments([{ id: 1, nr: 1, lengthOben: 2000, typeOben: "ganz", hasUnten: true, lengthUnten: 2000, direction: DIR.RIGHT, bemerkungen: "" }]);
    setPfostenList([]); setProtokoll([]); setAbnahme(defaultAbnahme);
    setAufbauChecked(Array(AUFBAU_STEPS.length).fill(false)); setEditingSegment(null);
    setStartPoint({ x: 40, y: 210 }); setPickingStart(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
    showToast("Zurückgesetzt"); setShowExport(false);
  };

  const SEG_COLORS = ["#dc2626","#2563eb","#7c3aed","#059669","#ea580c","#0891b2","#d946ef","#ca8a04","#475569","#be123c"];
  const segColor = (i) => SEG_COLORS[i % SEG_COLORS.length];

  // ─── SVG SITE PLAN (based on GeoWeb Rosenweg / Hinterbüelstrasse) ───
  const renderSitePlan = () => {
    const W = 440, H = 480;
    const SCALE = 0.038;
    const MIN_PX = 25;

    // Railing start point: configurable via click
    const startX = startPoint.x, startY = startPoint.y;
    let pts = [{ x: startX, y: startY }];
    let segData = [];

    segments.forEach((seg, i) => {
      const len = Math.max((parseInt(seg.lengthOben) || 0) * SCALE, MIN_PX);
      const p = pts[pts.length - 1];
      let end;
      switch (seg.direction) {
        case DIR.RIGHT: end = { x: p.x + len, y: p.y }; break;
        case DIR.DOWN:  end = { x: p.x, y: p.y + len }; break;
        case DIR.LEFT:  end = { x: p.x - len, y: p.y }; break;
        case DIR.UP:    end = { x: p.x, y: p.y - len }; break;
        default:        end = { x: p.x + len, y: p.y };
      }
      segData.push({ s: { ...p }, e: { ...end }, seg, i });
      pts.push(end);
    });

    // Auto-fit viewport
    const fixedPts = [
      { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }
    ];
    const allX = [...pts.map(p => p.x), ...fixedPts.map(p => p.x)];
    const allY = [...pts.map(p => p.y), ...fixedPts.map(p => p.y)];
    const padL = 15, padR = 15, padT = 50, padB = 55;
    const mnX = Math.min(...allX), mxX = Math.max(...allX);
    const mnY = Math.min(...allY), mxY = Math.max(...allY);
    const contentW = mxX - mnX || 1, contentH = mxY - mnY || 1;
    const sc = Math.min((W - padL - padR) / contentW, (H - padT - padB) / contentH, 1.2);
    const offX = padL + (W - padL - padR - contentW * sc) / 2 - mnX * sc;
    const offY = padT + (H - padT - padB - contentH * sc) / 2 - mnY * sc;
    const tx = (x) => x * sc + offX;
    const ty = (y) => y * sc + offY;
    const tl = (l) => l * sc;
    // Inverse transform for click → logical coords
    const fromSvg = (px, py) => ({ x: (px - offX) / sc, y: (py - offY) / sc });

    const handleSvgClick = (e) => {
      if (!pickingStart) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const svgX = (e.clientX - rect.left) / rect.width * W;
      const svgY = (e.clientY - rect.top) / rect.height * H;
      const pt = fromSvg(svgX, svgY);
      setStartPoint({ x: Math.round(pt.x), y: Math.round(pt.y) });
      setPickingStart(false);
      showToast("Startpunkt gesetzt");
    };

    return (
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2 flex items-center justify-between" style={{
          background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)"
        }}>
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-bold">Lageplan</span>
            <span className="text-slate-400 text-[10px] bg-slate-700 px-2 py-0.5 rounded-full">Rosenweg / Hinterbüelstr.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-mono">{(totalLength/1000).toFixed(2)}m</span>
            <button onClick={() => setPickingStart(!pickingStart)}
              className={`text-[10px] px-2 py-1 rounded-full font-bold transition-all ${
                pickingStart ? "bg-green-500 text-white animate-pulse" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}>{pickingStart ? "Klicke auf Plan..." : "Startpunkt"}</button>
          </div>
        </div>

        <div className="overflow-auto bg-white" style={{ WebkitOverflowScrolling: "touch" }}
          onClick={handleSvgClick}>
          <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`}
            style={{ display: "block", width: "100%", height: "auto", cursor: pickingStart ? "crosshair" : "default" }}>
            <defs>
              <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="1" dy="2" stdDeviation="3" floodColor="#00000020"/>
              </filter>
              <linearGradient id="roadH" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8"/><stop offset="50%" stopColor="#78716c"/><stop offset="100%" stopColor="#94a3b8"/>
              </linearGradient>
              <linearGradient id="roadV" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#94a3b8"/><stop offset="50%" stopColor="#78716c"/><stop offset="100%" stopColor="#94a3b8"/>
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="white"/>

            {/* ── Rosenweg (horizontal road, bottom area) ── */}
            <rect x={tx(-10)} y={ty(230)} width={tl(420)} height={tl(40)} rx="2"
              fill="url(#roadH)" opacity="0.35"/>
            <line x1={tx(10)} y1={ty(250)} x2={tx(380)} y2={ty(250)}
              stroke="#f8fafc" strokeWidth="1.5" strokeDasharray="10,8" opacity="0.4"/>
            <text x={tx(160)} y={ty(253)} fill="#475569" fontSize="10" fontWeight="700"
              fontFamily="system-ui" letterSpacing="4">ROSENWEG</text>

            {/* ── Hinterbüelstrasse (vertical road, right side) ── */}
            <rect x={tx(330)} y={ty(-10)} width={tl(40)} height={tl(420)} rx="2"
              fill="url(#roadV)" opacity="0.35"/>
            <line x1={tx(350)} y1={ty(10)} x2={tx(350)} y2={ty(380)}
              stroke="#f8fafc" strokeWidth="1.5" strokeDasharray="10,8" opacity="0.4"/>
            <text x={tx(350)} y={ty(180)} textAnchor="middle"
              fill="#475569" fontSize="9" fontWeight="700" fontFamily="system-ui" letterSpacing="3"
              transform={`rotate(-90,${tx(350)},${ty(180)})`}>HINTERBÜELSTR.</text>

            {/* ── Sidewalk along Rosenweg (north side) ── */}
            <rect x={tx(-10)} y={ty(218)} width={tl(350)} height={tl(14)} rx="1"
              fill="#d6d3d1" opacity="0.25"/>

            {/* ── Parking (far left) ── */}
            <rect x={tx(-5)} y={ty(100)} width={tl(40)} height={tl(110)} rx="3"
              fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.5" opacity="0.4"/>
            <text x={tx(15)} y={ty(160)} textAnchor="middle" fill="#94a3b8" fontSize="7"
              fontFamily="system-ui" transform={`rotate(-90,${tx(15)},${ty(160)})`}>Parkplatz</text>

            {/* ── Building 2434 / IE7652 (main building, north of railing) ── */}
            <rect x={tx(50)} y={ty(60)} width={tl(250)} height={tl(145)} rx="3"
              fill="#78716c" opacity="0.3" stroke="#57534e" strokeWidth="0.8" filter="url(#shadow)"/>
            {[0.2, 0.4, 0.6, 0.8].map((f, i) => (
              <rect key={`w${i}`} x={tx(60)} y={ty(60 + 145 * f)} width={tl(230)} height={tl(10)}
                fill="#57534e" opacity="0.12" rx="1"/>
            ))}
            <text x={tx(175)} y={ty(125)} textAnchor="middle"
              fill="#44403c" fontSize="10" fontWeight="800" fontFamily="system-ui" opacity="0.45">2434</text>
            <text x={tx(175)} y={ty(140)} textAnchor="middle"
              fill="#44403c" fontSize="7.5" fontFamily="system-ui" opacity="0.35">IE7652</text>

            {/* ── Building 2432 / IE186 (top right) ── */}
            <rect x={tx(310)} y={ty(20)} width={tl(55)} height={tl(80)} rx="2"
              fill="#78716c" opacity="0.2" stroke="#57534e" strokeWidth="0.5"/>
            <text x={tx(337)} y={ty(55)} textAnchor="middle"
              fill="#44403c" fontSize="7" fontWeight="700" fontFamily="system-ui" opacity="0.35">2432</text>
            <text x={tx(337)} y={ty(66)} textAnchor="middle"
              fill="#44403c" fontSize="5.5" fontFamily="system-ui" opacity="0.25">IE186</text>

            {/* ── Building 2505 (bottom right, across Hinterbüelstr.) ── */}
            <rect x={tx(375)} y={ty(230)} width={tl(40)} height={tl(80)} rx="2"
              fill="#78716c" opacity="0.2" stroke="#57534e" strokeWidth="0.5"/>
            <text x={tx(395)} y={ty(270)} textAnchor="middle"
              fill="#44403c" fontSize="7" fontWeight="700" fontFamily="system-ui" opacity="0.35">2505</text>

            {/* ── Stadtpolizei (left area) ── */}
            <rect x={tx(-5)} y={ty(280)} width={tl(70)} height={tl(80)} rx="2"
              fill="#78716c" opacity="0.15" stroke="#57534e" strokeWidth="0.5"/>
            <text x={tx(30)} y={ty(320)} textAnchor="middle"
              fill="#44403c" fontSize="6" fontWeight="600" fontFamily="system-ui" opacity="0.3">Stadtpolizei</text>

            {/* ── Intersection circle ── */}
            <circle cx={tx(350)} cy={ty(250)} r={tl(8)} fill="none" stroke="#94a3b8" strokeWidth="0.5" opacity="0.3"/>

            {/* ── Zone 30 sign ── */}
            <g transform={`translate(${tx(80)},${ty(255)})`}>
              <circle r="9" fill="white" stroke="#dc2626" strokeWidth="1.5" opacity="0.5"/>
              <text textAnchor="middle" y="3" fill="#dc2626" fontSize="7" fontWeight="700" opacity="0.5">30</text>
            </g>

            {/* ── Railing segments ── */}
            {segData.map(({ s, e, seg, i: idx }) => {
              const x1 = tx(s.x), y1 = ty(s.y), x2 = tx(e.x), y2 = ty(e.y);
              const isH = seg.direction === DIR.RIGHT || seg.direction === DIR.LEFT;
              const color = segColor(idx);
              const active = editingSegment === seg.id;
              const OFF = 10;
              let lx1, ly1, lx2, ly2;
              if (isH) { lx1=x1; ly1=y1+OFF; lx2=x2; ly2=y2+OFF; }
              else     { lx1=x1+OFF; ly1=y1; lx2=x2+OFF; ly2=y2; }
              const mx = (x1+x2)/2, my = (y1+y2)/2;

              const barCount = Math.max(3, Math.floor(Math.hypot(x2-x1, y2-y1) / 8));
              const bars = [];
              if (seg.hasUnten) {
                for (let b = 0; b <= barCount; b++) {
                  const t = b / barCount;
                  bars.push(
                    <line key={b}
                      x1={x1+(x2-x1)*t} y1={y1+(y2-y1)*t}
                      x2={lx1+(lx2-lx1)*t} y2={ly1+(ly2-ly1)*t}
                      stroke={color} strokeWidth="0.5" opacity="0.25"/>
                  );
                }
              }
              const lengthM = ((parseInt(seg.lengthOben)||0)/1000).toFixed(2);

              return (
                <g key={seg.id} onClick={() => setEditingSegment(active ? null : seg.id)} style={{ cursor: "pointer" }}>
                  <rect x={Math.min(x1,x2,lx1,lx2)-10} y={Math.min(y1,y2,ly1,ly2)-10}
                    width={Math.abs(Math.max(x2,lx2)-Math.min(x1,lx1))+20}
                    height={Math.abs(Math.max(y2,ly2)-Math.min(y1,ly1))+20}
                    fill="transparent"/>
                  {active && <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={color} strokeWidth="14" opacity="0.12" strokeLinecap="round"/>}
                  <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={color} strokeWidth={active ? 5 : 3.5} strokeLinecap="round"/>
                  {seg.hasUnten && <>{bars}
                    <line x1={lx1} y1={ly1} x2={lx2} y2={ly2}
                      stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray="5,3" opacity="0.5"/></>}
                  <circle cx={x1} cy={y1} r="3" fill={color} stroke="white" strokeWidth="1"/>
                  <circle cx={x2} cy={y2} r="3" fill={color} stroke="white" strokeWidth="1"/>
                  <rect x={mx-9} y={my-(isH?20:5)-8} width="18" height="16" rx="4" fill={color}/>
                  <text x={mx} y={my-(isH?20:5)+4} textAnchor="middle" fill="white"
                    fontSize="10" fontWeight="800" fontFamily="system-ui">{seg.nr}</text>
                  <rect x={mx+(isH?-18:16)} y={my+(isH?6:-6)} width="36" height="13" rx="2"
                    fill="white" stroke={color} strokeWidth="0.5" opacity="0.9"/>
                  <text x={mx+(isH?0:34)} y={my+(isH?15:4)} textAnchor="middle"
                    fill={color} fontSize="8" fontWeight="700" fontFamily="system-ui">{lengthM}m</text>
                  <text x={mx+(isH?0:28)} y={my+(isH?25:16)} textAnchor="middle"
                    fill={color} fontSize="6" fontWeight="600" fontFamily="system-ui" opacity="0.6">
                    {seg.typeOben === "ganz" ? "GANZ" : "HALB"}</text>
                </g>
              );
            })}

            {/* Start / End markers */}
            {segData.length > 0 && <>
              <circle cx={tx(segData[0].s.x)} cy={ty(segData[0].s.y)} r="7"
                fill="#16a34a" stroke="white" strokeWidth="2" filter="url(#shadow)"/>
              <text x={tx(segData[0].s.x)} y={ty(segData[0].s.y)-12} textAnchor="middle"
                fill="#16a34a" fontSize="7" fontWeight="800" fontFamily="system-ui">START</text>
              <circle cx={tx(segData[segData.length-1].e.x)} cy={ty(segData[segData.length-1].e.y)} r="7"
                fill="#dc2626" stroke="white" strokeWidth="2" filter="url(#shadow)"/>
              <text x={tx(segData[segData.length-1].e.x)} y={ty(segData[segData.length-1].e.y)+18}
                textAnchor="middle" fill="#dc2626" fontSize="7" fontWeight="800" fontFamily="system-ui">ENDE</text>
            </>}

            {/* North arrow */}
            <g transform={`translate(${W-28},28)`}>
              <circle r="14" fill="white" stroke="#94a3b8" strokeWidth="0.5" opacity="0.9"/>
              <line x1="0" y1="8" x2="0" y2="-8" stroke="#475569" strokeWidth="1.5"/>
              <polygon points="0,-10 -3,-5 3,-5" fill="#475569"/>
              <text y="-14" textAnchor="middle" fill="#475569" fontSize="7" fontWeight="800">N</text>
            </g>

            {/* Scale bar */}
            <g transform={`translate(15,${H-18})`}>
              <line x1="0" y1="0" x2={tl(100)} y2="0" stroke="#475569" strokeWidth="1"/>
              <line x1="0" y1="-3" x2="0" y2="3" stroke="#475569" strokeWidth="1"/>
              <line x1={tl(100)} y1="-3" x2={tl(100)} y2="3" stroke="#475569" strokeWidth="1"/>
              <text x="0" y="10" fill="#64748b" fontSize="6" fontFamily="system-ui">0</text>
              <text x={tl(100)} y="10" textAnchor="middle" fill="#64748b" fontSize="6" fontFamily="system-ui">10m</text>
            </g>

            {/* Legend */}
            <g transform={`translate(15,${H-38})`}>
              <line x1="0" y1="0" x2="14" y2="0" stroke="#475569" strokeWidth="3"/>
              <text x="18" y="3" fill="#64748b" fontSize="6.5" fontFamily="system-ui">Oben</text>
              <line x1="55" y1="0" x2="69" y2="0" stroke="#475569" strokeWidth="2" strokeDasharray="4,2" opacity="0.5"/>
              <text x="73" y="3" fill="#64748b" fontSize="6.5" fontFamily="system-ui">Unten</text>
              <circle cx="110" cy="0" r="3" fill="#16a34a"/>
              <circle cx="122" cy="0" r="3" fill="#dc2626"/>
              <text x="129" y="3" fill="#64748b" fontSize="6.5" fontFamily="system-ui">Start / Ende</text>
            </g>

            {/* Title */}
            <g transform="translate(15,15)">
              <rect width="175" height="30" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="0.5" opacity="0.95"/>
              <text x="8" y="12" fill="#1e293b" fontSize="7.5" fontWeight="700" fontFamily="system-ui">
                Geländer Rosenweg · IE7652</text>
              <text x="8" y="23" fill="#64748b" fontSize="6.5" fontFamily="system-ui">
                {segments.length} Segmente · {(totalLength/1000).toFixed(2)}m · 8307 Illnau-Effretikon</text>
            </g>
          </svg>
        </div>
      </div>
    );
  };

  // ─── SEGMENT EDITOR ───
  const renderSegmentEditor = () => {
    const editSeg = editingSegment ? segments.find(s => s.id === editingSegment) : null;
    return (
      <div>
        <div className="space-y-2 mb-3">
          {segments.map((seg, i) => {
            const active = editingSegment === seg.id;
            const color = segColor(i);
            return (
              <button key={seg.id} onClick={() => setEditingSegment(active ? null : seg.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  active ? "border-2 shadow-md" : "bg-white border-stone-200"
                }`} style={active ? { borderColor: color, backgroundColor: color + "08" } : {}}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: color }}>{seg.nr}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-stone-800">
                        {((parseInt(seg.lengthOben)||0)/1000).toFixed(2)}m</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        seg.typeOben === "ganz" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
                      }`}>{seg.typeOben === "ganz" ? "Ganz" : "Halb"}</span>
                      <span className="text-stone-400 text-xs">{DIR_ARROWS[seg.direction]}</span>
                      {seg.hasUnten && <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">+Unten</span>}
                    </div>
                    {seg.bemerkungen && <p className="text-xs text-stone-400 truncate mt-0.5">{seg.bemerkungen}</p>}
                  </div>
                  <span className="text-stone-300 text-lg">{active ? "▾" : "▸"}</span>
                </div>
              </button>
            );
          })}
        </div>

        {editSeg && (() => {
          const idx = segments.findIndex(s => s.id === editSeg.id);
          const color = segColor(idx);
          return (
            <div className="rounded-xl p-4 mb-3 border-2" style={{
              borderColor: color, backgroundColor: color + "06"
            }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-stone-800">Segment {editSeg.nr} bearbeiten</h3>
                <div className="flex gap-2">
                  {segments.length > 1 && (
                    <button onClick={() => removeSegment(editSeg.id)}
                      className="text-xs text-red-600 font-medium bg-red-50 px-2.5 py-1 rounded-lg">Löschen</button>
                  )}
                  <button onClick={() => setEditingSegment(null)}
                    className="text-xs text-stone-600 font-medium bg-white px-2.5 py-1 rounded-lg border border-stone-300">OK</button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Nr.</label>
                    <input type="number" className={inputStyle} value={editSeg.nr}
                      onChange={e => updateSegment(editSeg.id, { nr: parseInt(e.target.value)||0 })}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Richtung</label>
                    <div className="grid grid-cols-4 gap-1">
                      {[DIR.LEFT, DIR.UP, DIR.DOWN, DIR.RIGHT].map(d => (
                        <button key={d} onClick={() => updateSegment(editSeg.id, { direction: d })}
                          className={`py-2.5 rounded-lg text-base font-bold transition-all ${
                            editSeg.direction === d ? "text-white shadow-sm" : "bg-white border border-stone-300 text-stone-500"
                          }`} style={editSeg.direction === d ? { backgroundColor: color } : {}}>
                          {DIR_ARROWS[d]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                    Oberer Handlauf – Länge (mm)</label>
                  <div className="flex gap-2">
                    <input type="number" inputMode="numeric" className={inputStyle + " flex-1"} placeholder="mm"
                      value={editSeg.lengthOben}
                      onChange={e => updateSegment(editSeg.id, { lengthOben: e.target.value })}/>
                    <button onClick={() => updateSegment(editSeg.id, { typeOben: editSeg.typeOben === "ganz" ? "halb" : "ganz" })}
                      className={`px-4 rounded-lg text-xs font-bold transition-all ${
                        editSeg.typeOben === "ganz" ? "bg-blue-600 text-white" : "bg-violet-600 text-white"
                      }`}>{editSeg.typeOben === "ganz" ? "Ganz" : "Halb"}</button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Untere Stange</label>
                    <button onClick={() => updateSegment(editSeg.id, { hasUnten: !editSeg.hasUnten })}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        editSeg.hasUnten ? "bg-green-600 text-white" : "bg-stone-300 text-stone-600"
                      }`}>{editSeg.hasUnten ? "Ja" : "Nein"}</button>
                  </div>
                  {editSeg.hasUnten && (
                    <input type="number" inputMode="numeric" className={inputStyle} placeholder="Länge mm"
                      value={editSeg.lengthUnten}
                      onChange={e => updateSegment(editSeg.id, { lengthUnten: e.target.value })}/>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Bemerkungen</label>
                  <input type="text" className={inputStyle} placeholder="Ecke, Schaden, Schweissnaht..."
                    value={editSeg.bemerkungen}
                    onChange={e => updateSegment(editSeg.id, { bemerkungen: e.target.value })}/>
                </div>
              </div>
            </div>
          );
        })()}

        <button onClick={addSegment}
          className="w-full py-3 border-2 border-dashed border-amber-400 rounded-xl text-amber-700 font-semibold text-sm hover:bg-amber-50 transition-all">
          + Segment hinzufügen</button>

        <div className="mt-3 rounded-xl p-4" style={{ background: "linear-gradient(135deg, #1e293b, #334155)" }}>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Gesamtlänge</span>
            <span className="text-white text-xl font-bold font-mono">{(totalLength/1000).toFixed(2)} m</span>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-semibold">
              {segments.length} Segmente</span>
            <span className="text-[10px] bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full font-semibold">
              Ganz: {segments.filter(s => s.typeOben==="ganz").length}</span>
            <span className="text-[10px] bg-violet-900 text-violet-300 px-2 py-0.5 rounded-full font-semibold">
              Halb: {segments.filter(s => s.typeOben==="halb").length}</span>
          </div>
        </div>
      </div>
    );
  };

  const inputStyle = "w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all placeholder-stone-400";
  const labelStyle = "block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1";
  const cardStyle = "bg-white rounded-xl border border-stone-200 shadow-sm p-4 mb-3";

  const renderProjekt = () => (
    <div className={cardStyle}>
      <h3 className="text-sm font-bold text-stone-700 mb-3">Projektdaten</h3>
      <div className="space-y-3">
        {[["Standort","standort","Strasse, PLZ Ort"],["Parzelle","parzelle",""],["Datum Ausbau","datumAusbau","","date"],
          ["Datum Wiederaufbau","datumWiederaufbau","","date"],["Verantwortlich","verantwortlich","Name"],
          ["Baufirma / Monteur","baufirma",""],["Auftraggeber","auftraggeber",""]
        ].map(([l,k,p,t]) => (
          <div key={k}><label className={labelStyle}>{l}</label>
            <input type={t||"text"} className={inputStyle} placeholder={p} value={project[k]}
              onChange={e => setProject({...project,[k]:e.target.value})}/></div>
        ))}
      </div>
    </div>
  );

  const renderCheckliste = () => {
    const pct = Math.round((checklist.filter(Boolean).length/CHECKLIST.length)*100);
    return (
      <div className={cardStyle}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-stone-700">Vor dem Ausbau</h3>
          <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
            {checklist.filter(Boolean).length}/{CHECKLIST.length}</span>
        </div>
        <div className="w-full bg-stone-200 rounded-full h-2 mb-4">
          <div className="h-2 rounded-full transition-all duration-500"
            style={{ width:`${pct}%`, background: pct===100?"#16a34a":"#d97706" }}/></div>
        <div className="space-y-1">
          {CHECKLIST.map((item,i) => (
            <button key={i} onClick={() => { const c=[...checklist]; c[i]=!c[i]; setChecklist(c); }}
              className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all ${
                checklist[i]?"bg-green-50 border border-green-200":"bg-stone-50 border border-stone-200"}`}>
              <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 ${
                checklist[i]?"bg-green-600 border-green-600":"border-stone-400"}`}>
                {checklist[i] && <span className="text-white text-xs font-bold">✓</span>}</div>
              <span className={`text-sm ${checklist[i]?"text-green-800 line-through opacity-70":"text-stone-700"}`}>{item}</span>
            </button>))}
        </div>
        {pct===100 && <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg text-center">
          <span className="text-green-800 text-sm font-semibold">Bereit für den Ausbau!</span></div>}
      </div>
    );
  };

  const renderPfosten = () => (
    <div>
      <div className="bg-stone-50 rounded-xl border border-stone-200 p-3 mb-3">
        <p className="text-xs text-stone-600">Befestigungsdetails pro Pfosten erfassen.</p></div>
      {pfostenList.map((p,i) => (
        <div key={p.id||i} className={cardStyle}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-stone-700">Pfosten P{i+1}</h3>
            {pfostenList.length>1 && <button onClick={() => setPfostenList(pfostenList.filter((_,j)=>j!==i))}
              className="text-xs text-red-500 font-medium">Entfernen</button>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[["Segment","segment","z.B. 1-2"],["Fussplatte","fussplatte","B×L mm"],
              ["Schrauben","schrauben","Anz/Typ"],["Dübel","duebelTyp",""],["Bohrtiefe","bohrtiefe","mm"]
            ].map(([l,k,ph]) => (
              <div key={k}><label className={labelStyle}>{l}</label>
                <input type="text" className={inputStyle} placeholder={ph} value={p[k]||""}
                  onChange={e => { const a=[...pfostenList]; a[i]={...a[i],[k]:e.target.value}; setPfostenList(a); }}/></div>
            ))}
          </div>
        </div>))}
      <button onClick={() => setPfostenList([...pfostenList,{id:Date.now()}])}
        className="w-full py-3 border-2 border-dashed border-amber-400 rounded-xl text-amber-700 font-semibold text-sm hover:bg-amber-50">
        + Pfosten hinzufügen</button>
    </div>
  );

  const renderAusbau = () => (
    <div>
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-3 mb-3">
        <p className="text-xs text-amber-800">Ausbau-Reihenfolge und Besonderheiten dokumentieren.</p></div>
      {protokoll.map((p,i) => (
        <div key={p.id||i} className={cardStyle}>
          <div className="flex items-center gap-3 mb-2">
            <span className="w-7 h-7 rounded-full bg-stone-800 text-white flex items-center justify-center text-xs font-bold">{i+1}</span>
            {protokoll.length>1 && <button onClick={() => setProtokoll(protokoll.filter((_,j)=>j!==i))}
              className="text-xs text-red-500 ml-auto font-medium">×</button>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelStyle}>Seg.</label>
              <input type="text" className={inputStyle} placeholder="#" value={p.segment||""}
                onChange={e => { const a=[...protokoll]; a[i]={...a[i],segment:e.target.value}; setProtokoll(a); }}/></div>
            <div className="col-span-2"><label className={labelStyle}>Aktion</label>
              <input type="text" className={inputStyle} placeholder="Besonderheiten..." value={p.aktion||""}
                onChange={e => { const a=[...protokoll]; a[i]={...a[i],aktion:e.target.value}; setProtokoll(a); }}/></div>
          </div>
          <button onClick={() => { const a=[...protokoll]; a[i]={...a[i],kleinteile:!a[i].kleinteile}; setProtokoll(a); }}
            className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
              p.kleinteile?"bg-green-50 border-green-300 text-green-800":"bg-stone-50 border-stone-300 text-stone-600"}`}>
            <div className={`w-4 h-4 rounded flex items-center justify-center border-2 ${
              p.kleinteile?"bg-green-600 border-green-600":"border-stone-400"}`}>
              {p.kleinteile && <span className="text-white text-[10px]">✓</span>}</div>
            Kleinteile eingetütet</button>
        </div>))}
      <button onClick={() => setProtokoll([...protokoll,{id:Date.now(),segment:"",aktion:"",kleinteile:false}])}
        className="w-full py-3 border-2 border-dashed border-amber-400 rounded-xl text-amber-700 font-semibold text-sm hover:bg-amber-50">
        + Schritt hinzufügen</button>
    </div>
  );

  const renderAufbau = () => (
    <div>
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 mb-3">
        <p className="text-xs text-blue-800 font-medium">Wiederaufbau Schritt für Schritt abhaken.</p></div>
      {AUFBAU_STEPS.map((step,i) => (
        <button key={i} onClick={() => { const c=[...aufbauChecked]; c[i]=!c[i]; setAufbauChecked(c); }}
          className={`w-full text-left mb-2 rounded-xl border p-4 transition-all ${
            aufbauChecked[i]?"bg-green-50 border-green-200":"bg-white border-stone-200"}`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              aufbauChecked[i]?"bg-green-600 text-white":"bg-stone-200 text-stone-600"}`}>{i+1}</div>
            <div>
              <div className={`text-sm font-semibold ${aufbauChecked[i]?"text-green-800":"text-stone-800"}`}>{step.title}</div>
              <div className={`text-xs mt-0.5 ${aufbauChecked[i]?"text-green-700 opacity-70":"text-stone-500"}`}>{step.desc}</div>
            </div>
          </div>
        </button>))}
    </div>
  );

  const ABNAHME_CHECKS = [
    ["reihenfolge","Alle Segmente korrekt montiert"],["schrauben","Schrauben festgezogen"],
    ["hoehe","Höhenmasse stimmen"],["stabil","Geländer stabil"],["optisch","Optische Kontrolle ok"],
    ["fotos","Fotos Endzustand"],["absturz","Absturzsicherung ok"]
  ];

  const handleExportPDF = () => {
    const checkRows = ABNAHME_CHECKS.map(([k, l]) =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${abnahme[k] ? "&#10003;" : "&#10007;"}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${l}</td></tr>`
    ).join("");
    const segRows = segments.map((seg, i) =>
      `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:bold;">${seg.nr}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${((parseInt(seg.lengthOben)||0)/1000).toFixed(2)} m</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${seg.typeOben === "ganz" ? "Ganz" : "Halb"}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${seg.hasUnten ? "Ja" : "Nein"}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${seg.bemerkungen || "-"}</td></tr>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Abnahmeprotokoll - ${project.parzelle || "Geländer"}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Helvetica,Arial,sans-serif;color:#1e293b;padding:40px;font-size:13px}
h1{font-size:22px;margin-bottom:4px}h2{font-size:15px;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #0f172a}
table{width:100%;border-collapse:collapse;margin-bottom:16px}th{text-align:left;padding:8px 12px;background:#f1f5f9;border-bottom:2px solid #cbd5e1;font-size:11px;text-transform:uppercase;letter-spacing:0.5px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #0f172a}
.logo{font-size:28px;font-weight:800;letter-spacing:-0.5px}.meta{text-align:right;color:#64748b;font-size:11px;line-height:1.6}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:16px}.grid-item{display:flex;gap:8px}.grid-label{font-weight:700;min-width:120px;color:#475569}.grid-value{color:#1e293b}
.sig-area{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}.sig-box{border-top:1px solid #1e293b;padding-top:8px;text-align:center;font-size:11px;color:#64748b}
.status{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:11px}.pass{background:#dcfce7;color:#166534}.fail{background:#fee2e2;color:#991b1b}
.footer{margin-top:40px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px}
@media print{body{padding:20px}@page{margin:15mm}}
</style></head><body>
<div class="header"><div><div class="logo">Abnahmeprotokoll</div><div style="color:#64748b;font-size:13px">Geländer-Dokumentation</div></div>
<div class="meta">Parzelle: <strong>${project.parzelle || "-"}</strong><br>Datum: <strong>${abnahme.datumAbnahme || new Date().toLocaleDateString("de-CH")}</strong><br>
<span class="status ${ABNAHME_CHECKS.every(([k]) => abnahme[k]) ? "pass" : "fail"}">${ABNAHME_CHECKS.every(([k]) => abnahme[k]) ? "BESTANDEN" : "OFFEN"}</span></div></div>

<h2>Projektdaten</h2>
<div class="grid">
<div class="grid-item"><span class="grid-label">Standort:</span><span class="grid-value">${project.standort || "-"}</span></div>
<div class="grid-item"><span class="grid-label">Parzelle:</span><span class="grid-value">${project.parzelle || "-"}</span></div>
<div class="grid-item"><span class="grid-label">Datum Ausbau:</span><span class="grid-value">${project.datumAusbau || "-"}</span></div>
<div class="grid-item"><span class="grid-label">Wiederaufbau:</span><span class="grid-value">${project.datumWiederaufbau || "-"}</span></div>
<div class="grid-item"><span class="grid-label">Verantwortlich:</span><span class="grid-value">${project.verantwortlich || "-"}</span></div>
<div class="grid-item"><span class="grid-label">Baufirma:</span><span class="grid-value">${project.baufirma || "-"}</span></div>
<div class="grid-item"><span class="grid-label">Auftraggeber:</span><span class="grid-value">${project.auftraggeber || "-"}</span></div>
<div class="grid-item"><span class="grid-label">Gesamtlänge:</span><span class="grid-value">${(totalLength/1000).toFixed(2)} m (${segments.length} Segmente)</span></div>
</div>

<h2>Segmente</h2>
<table><thead><tr><th>Nr.</th><th>Länge</th><th>Typ</th><th>Unten</th><th>Bemerkungen</th></tr></thead><tbody>${segRows}</tbody></table>

<h2>Abnahme-Checkliste</h2>
<table><thead><tr><th style="width:40px">OK</th><th>Prüfpunkt</th></tr></thead><tbody>${checkRows}</tbody></table>

<h2>Abnahme</h2>
<div class="grid" style="margin-bottom:8px">
<div class="grid-item"><span class="grid-label">Datum Abnahme:</span><span class="grid-value">${abnahme.datumAbnahme || "-"}</span></div>
<div class="grid-item"><span class="grid-label">Monteur:</span><span class="grid-value">${abnahme.monteur || "-"}</span></div>
<div class="grid-item"><span class="grid-label">Auftraggeber:</span><span class="grid-value">${abnahme.auftraggeber || "-"}</span></div>
</div>

<div class="sig-area"><div><div class="sig-box">Monteur: ${abnahme.monteur || "________________"}</div></div>
<div><div class="sig-box">Auftraggeber: ${abnahme.auftraggeber || "________________"}</div></div></div>

<div class="footer">Erstellt mit Geländer-Doku Tool &middot; ${new Date().toLocaleDateString("de-CH")} ${new Date().toLocaleTimeString("de-CH", {hour:"2-digit",minute:"2-digit"})}</div>
</body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  const renderAbnahme = () => (
    <div>
      <div className={cardStyle}>
        <h3 className="text-sm font-bold text-stone-700 mb-3">Abnahme-Checkliste</h3>
        <div className="space-y-1">
          {ABNAHME_CHECKS.map(([k,l]) => (
            <button key={k} onClick={() => setAbnahme({...abnahme,[k]:!abnahme[k]})}
              className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all ${
                abnahme[k]?"bg-green-50 border border-green-200":"bg-stone-50 border border-stone-200"}`}>
              <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 ${
                abnahme[k]?"bg-green-600 border-green-600":"border-stone-400"}`}>
                {abnahme[k] && <span className="text-white text-xs font-bold">✓</span>}</div>
              <span className={`text-sm ${abnahme[k]?"text-green-800":"text-stone-700"}`}>{l}</span>
            </button>))}
        </div>
      </div>
      <div className={cardStyle}>
        <h3 className="text-sm font-bold text-stone-700 mb-3">Unterschriften</h3>
        <div className="space-y-3">
          {[["Datum","datumAbnahme","","date"],["Monteur","monteur","Name"],["Auftraggeber","auftraggeber","Name"]].map(([l,k,p,t]) => (
            <div key={k}><label className={labelStyle}>{l}</label>
              <input type={t||"text"} className={inputStyle} placeholder={p}
                value={abnahme[k]} onChange={e => setAbnahme({...abnahme,[k]:e.target.value})}/></div>))}
        </div>
      </div>
      <button onClick={handleExportPDF}
        className="w-full py-3.5 mt-3 rounded-xl text-white font-semibold text-sm shadow-md"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #334155 100%)" }}>
        PDF Abnahmeprotokoll herunterladen
      </button>
    </div>
  );

  const content = {
    skizze: () => <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{renderSitePlan()}<div>{renderSegmentEditor()}</div></div>,
    projekt: renderProjekt, checkliste: renderCheckliste, pfosten: renderPfosten,
    ausbau: renderAusbau, aufbau: renderAufbau, abnahme: renderAbnahme,
  };

  return (
    <div className="h-screen flex flex-col bg-stone-100 overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div className="text-white px-4 py-3 flex-shrink-0" style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold tracking-tight">Geländer-Doku</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {project.standort} · <span className="font-mono">{(totalLength/1000).toFixed(1)}m</span> · {segments.length} Seg.</p>
            </div>
            <button onClick={() => setShowExport(!showExport)}
              className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700">
              <span className="text-sm">⚙</span></button>
          </div>
          {showExport && (
            <div className="mt-2 p-2 bg-slate-800 rounded-xl flex gap-2">
              <button onClick={handleExportJSON}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold">
                JSON exportieren</button>
              <button onClick={handleReset}
                className="flex-1 py-2 bg-red-900/50 hover:bg-red-900 text-red-300 rounded-lg text-xs font-medium">
                Zurücksetzen</button>
            </div>)}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-stone-200 flex-shrink-0 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 py-2 px-3 text-center transition-all border-b-2 ${
                  activeTab===tab.key?"border-amber-600 text-amber-700":"border-transparent text-stone-400 hover:text-stone-600"}`}>
                <span className="text-sm">{tab.icon}</span>
                <span className="text-[11px] font-semibold">{tab.label}</span>
              </button>))}
          </div>
        </div>
      </div>

      {/* Content - fills remaining space */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 pb-8">{content[activeTab]?.()}</div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-full text-sm font-medium shadow-lg"
          style={{ animation: "fadeUp .3s ease" }}>{toast}</div>)}

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translate(-50%,10px)} to{opacity:1;transform:translate(-50%,0)} }
        ::-webkit-scrollbar{display:none}
      `}</style>
    </div>
  );
}

export default App;
