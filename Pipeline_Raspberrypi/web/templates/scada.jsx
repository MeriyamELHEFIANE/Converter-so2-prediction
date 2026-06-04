// ─────────────────────────────────────────────────────────────
// SCADA — Design original + labels ENTRÉES/SORTIES par masse
// ─────────────────────────────────────────────────────────────
const { useMemo } = React;

function colorForTe(Te, Te_nom){
  if (Te == null) return {bg:"#EEEEEE", tx:"#888888"};
  const ec = Te - Te_nom;
  if (ec >  25) return {bg:"#C0392B", tx:"#FFFFFF"};
  if (ec >  10) return {bg:"#E67E22", tx:"#FFFFFF"};
  if (ec < -25) return {bg:"#1F4E96", tx:"#FFFFFF"};
  if (ec < -10) return {bg:"#2A6DBE", tx:"#FFFFFF"};
  return {bg:"#FFFFFF", tx:"#1C2B3A"};
}

// Cellule originale identique
function ScadaCell({x, y, w, name, value, unit, bg, tx}){
  return (
    <g>
      <rect x={x} y={y} width={w} height={18} fill="#D8DCE0" stroke="#909AA3" strokeWidth="0.5"/>
      <text x={x+w/2} y={y+12} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="#1C2B3A">{name}</text>
      <rect x={x} y={y+18} width={w} height={26} fill={bg} stroke="#909AA3" strokeWidth="0.5"/>
      <text x={x+w/2} y={y+18+17} textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="JetBrains Mono" fill={tx}>
        {value} <tspan fontSize="9" opacity="0.7">{unit}</tspan>
      </text>
    </g>
  );
}

function circuitLabel(ctrl){
  if (!ctrl) return "";
  return ctrl.toLowerCase().includes("échangeur") ? "ÉCH." : "BYPASS";
}

function Scada({vals, diags, zone}){
  const diagsByName = useMemo(()=>{
    const m = {};
    (diags||[]).forEach(d => { if (d) m[d.nom]=d; });
    return m;
  }, [diags]);

  const CX=200, CY=100, CW=480, CH=388;
  const MH = CH / 4;   // ~97 px par masse
  const massNames = Object.keys(MASSES);

  // Positions cellules (identiques à l'original)
  const xL   = CX + 56;
  const colW = 140;
  const xOpt = CX + CW/2 - 30;
  const xR   = CX + CW - 56 - colW;

  // Label centré horizontalement sur les 3 colonnes (entrée + consigne + sortie)
  const labelCX = (xL + xR + colW) / 2;
  // Largeur totale des 3 colonnes pour le fond du label
  const labelW  = (xR + colW) - xL;

  return (
    <div style={{width:"100%",height:"100%",background:"#C8CDD2",borderRadius:8,
                  padding:6,boxShadow:"inset 0 0 0 1px #B0B8C1",overflow:"auto"}}>
    <svg viewBox="0 0 880 560" width="100%" height="100%"
         preserveAspectRatio="xMidYMid meet" style={{display:"block"}}>

      {/* ── Bandeau titre ── */}
      <rect x="0" y="0" width="880" height="28" fill="#0A1F4A"/>
      <text x="440" y="18" textAnchor="middle" fontSize="11" fontWeight="700"
            fontFamily="Inter" fill="#7CC0FF" letterSpacing="0.6">
        CIRCUIT GAZ–VAPEUR  ·  CONVERTISSEUR 13BC01
      </text>
      <text x="872" y="18" textAnchor="end" fontSize="9" fill="#7CC0FF" opacity="0.75" fontFamily="JetBrains Mono">SAFI / MP-II</text>

      {/* ── DEPUIS FILTRE ── */}
      <rect x={CX+CW/2-52} y={34} width={104} height={18} rx="4"
            fill="#D8DCE0" stroke="#707880" strokeWidth="1.2"/>
      <text x={CX+CW/2} y={47} textAnchor="middle" fontSize="9.5" fontWeight="700"
            fill="#1C2B3A" fontFamily="Inter" letterSpacing="0.4">DEPUIS FILTRE</text>
      <line x1={CX+CW/2} y1={52} x2={CX+CW/2} y2={CY-8}
            stroke="#2471A3" strokeWidth="3" strokeLinecap="round"/>
      <polygon points={`${CX+CW/2-6},${CY-8} ${CX+CW/2+6},${CY-8} ${CX+CW/2},${CY-1}`}
               fill="#2471A3"/>

      {/* ── CONVERTISSEUR : cadre métallique ── */}
      <rect x={CX-6} y={CY-6} width={CW+12} height={CH+12} rx="14"
            fill="#B8BEC4" stroke="#707880" strokeWidth="2"/>
      <rect x={CX-6} y={CY-6} width={CW+12} height={10} rx="14" fill="#D8DCE0"/>

      {/* ── Masses : couleur vanadium FIXE ── */}
      {[0,1,2,3].map(mi => {
        const my1 = CY + mi*MH;
        const my2 = my1 + MH;
        const info = MASSES[massNames[mi]];
        return (
          <g key={mi}>
            <rect x={CX} y={my1} width={CW} height={MH} fill="#9e911d"/>
            {/* texture catalyseur */}
            {[...Array(Math.floor(MH/5))].map((_,i)=>(
              <line key={i} x1={CX} y1={my1+3+i*5} x2={CX+CW} y2={my1+3+i*5}
                stroke={i%2?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.12)"} strokeWidth="1.2"/>
            ))}
            <line x1={CX} y1={my2} x2={CX+CW} y2={my2} stroke="#000" strokeWidth="1.5" opacity="0.4"/>

            {/* ── Label M à GAUCHE hors cadre ── */}
            <rect x={102} y={my1+MH/2-26} width={82} height={52} rx="7"
                  fill="#FFFFFF" stroke="#1D9E75" strokeWidth="2"/>
            <text x={143} y={my1+MH/2-5} textAnchor="middle"
                  fontSize="15" fontWeight="800" fill="#0A5C42" fontFamily="Inter">M{mi+1}</text>
            <text x={143} y={my1+MH/2+11} textAnchor="middle"
                  fontSize="8.5" fill="#4A5568" fontFamily="Inter">{info.conv}% conv.</text>
            {/* ligne de connexion */}
            <line x1={184} y1={my1+MH/2} x2={CX-6} y2={my1+MH/2}
                  stroke="#1D9E75" strokeWidth="1.2" strokeDasharray="4,3" opacity="0.65"/>

            {/* ── Label "ENTRÉES MASSE N" — 1ère demi-ligne ── */}
            <rect x={xL} y={my1+1} width={labelW} height={11}
                  fill="rgba(0,0,0,0.30)" rx="2"/>
            <text x={labelCX} y={my1+9.5} textAnchor="middle"
                  fontSize="7.5" fontWeight="700" fill="#FFE87C"
                  fontFamily="Inter" letterSpacing="0.8">
              ENTRÉES MASSE {mi+1}
            </text>

            {/* ── Séparateur entre demi-lignes ── */}
            <line x1={xL} y1={my1+MH/2} x2={xR+colW} y2={my1+MH/2}
                  stroke="rgba(255,255,255,0.40)" strokeWidth="1" strokeDasharray="5,3"/>

            {/* ── Label "SORTIES MASSE N" — 2ème demi-ligne ── */}
            <rect x={xL} y={my1+MH/2+1} width={labelW} height={11}
                  fill="rgba(0,0,0,0.30)" rx="2"/>
            <text x={labelCX} y={my1+MH/2+9.5} textAnchor="middle"
                  fontSize="7.5" fontWeight="700" fill="#87CEEB"
                  fontFamily="Inter" letterSpacing="0.8">
              SORTIES MASSE {mi+1}
            </text>
          </g>
        );
      })}

      {/* ── Headers colonnes (identiques original) ── */}
      <text x={xL+colW/2}  y={CY-8} textAnchor="middle" fontSize="9" fontWeight="700" fill="#1C2B3A">T Entrée (mesure)</text>
      <text x={xOpt+30}    y={CY-8} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0A5C42">T Optimale</text>
      <text x={xR+colW/2}  y={CY-8} textAnchor="middle" fontSize="9" fontWeight="700" fill="#1C2B3A">T Sortie (mesure)</text>

      {/* ── Cellules + ΔT ── */}
      {ROWS.map(([cap_e, cap_s, mi], i) => {
        const my1 = CY + mi*MH;
        const li  = i - mi*2;
        const rh  = MH/2;
        const ry  = my1 + li*rh;
        const cellH = 44;
        // Décaler vers le bas pour laisser place au label (11px + 1px padding)
        const cellY = ry + 13 + (rh - cellH - 13)/2;

        const info    = MASSES[massNames[mi]];
        const isSortie = li === 1;
        const Te_nom  = isSortie ? info.Ts_nom : info.Te_nom;
        const Te      = vals[cap_e];
        const Ts      = vals[cap_s];
        const colE    = colorForTe(Te, Te_nom);
        let colS = {bg:"#FFFFFF", tx:"#1C2B3A"};
        if (Ts != null && Te != null){
          const dT = Ts - Te;
          if (dT < info.dT_nom-info.dtb || dT > info.dT_nom+info.dth)
            colS = {bg:"#E67E22", tx:"#FFFFFF"};
        }

        return (
          <g key={i}>
            {/* Cellule Entrée */}
            <ScadaCell x={xL} y={cellY} w={colW}
              name={cap_e} value={Te?Te.toFixed(1):"---"} unit="°C"
              bg={colE.bg} tx={colE.tx}/>

            {/* CONSIGNE centrale */}
            <rect x={xOpt} y={cellY+2} width={60} height={40} rx={3}
                  fill="#0A2810" stroke="#1D9E75" strokeWidth="1"/>
            <text x={xOpt+30} y={cellY+12} textAnchor="middle" fontSize="7"
                  fill="#1D9E75" fontFamily="Inter">CONSIGNE</text>
            <text x={xOpt+30} y={cellY+28} textAnchor="middle" fontSize="13"
                  fontWeight="800" fontFamily="JetBrains Mono" fill="#7CFFA7">{Te_nom}</text>
            <text x={xOpt+30} y={cellY+39} textAnchor="middle" fontSize="8"
                  fill="#7CFFA7" opacity="0.7">°C</text>

            {/* Cellule Sortie */}
            <ScadaCell x={xR} y={cellY} w={colW}
              name={cap_s} value={Ts?Ts.toFixed(1):"---"} unit="°C"
              bg={colS.bg} tx={colS.tx}/>

            {/* ── ΔT + circuit hors cadre à DROITE (2ème ligne de chaque masse) ── */}
            {li === 1 && Te != null && Ts != null && (() => {
              const dTv  = Ts - Te;
              const ok   = dTv >= info.dT_nom-info.dtb && dTv <= info.dT_nom+info.dth;
              const dcol = ok ? "#1D9E75" : "#C0392B";
              const circ = circuitLabel(info.ctrl);
              const cy   = my1 + MH/2;
              return (
                <g>
                  <line x1={CX+CW+6} y1={cy} x2={694} y2={cy}
                        stroke="#909AA3" strokeWidth="1" strokeDasharray="4,3"/>
                  <rect x={694} y={cy-24} width={84} height={48} rx="6"
                        fill="#FFFFFF" stroke={dcol} strokeWidth="1.8"/>
                  <text x={736} y={cy-9} textAnchor="middle"
                        fontSize="8.5" fill="#4A5568" fontFamily="Inter" fontWeight="700">{circ}</text>
                  <text x={736} y={cy+9} textAnchor="middle"
                        fontSize="12" fontWeight="800" fill={dcol} fontFamily="JetBrains Mono">
                    ΔT{dTv>=0?"+":""}{dTv.toFixed(0)}°
                  </text>
                </g>
              );
            })()}
          </g>
        );
      })}

      {/* ── Cadre par-dessus ── */}
      <rect x={CX-6} y={CY-6} width={CW+12} height={CH+12} rx="14"
            fill="none" stroke="#707880" strokeWidth="3"/>

      {/* ── VERS ABSORPTION ── */}
      <line x1={CX+CW/2} y1={CY+CH+6} x2={CX+CW/2} y2={CY+CH+30}
            stroke="#2471A3" strokeWidth="3" strokeLinecap="round"/>
      <polygon points={`${CX+CW/2-6},${CY+CH+30} ${CX+CW/2+6},${CY+CH+30} ${CX+CW/2},${CY+CH+37}`}
               fill="#2471A3"/>
      <rect x={CX+CW/2-56} y={CY+CH+39} width={112} height={18} rx="4"
            fill="#D8DCE0" stroke="#707880" strokeWidth="1.2"/>
      <text x={CX+CW/2} y={CY+CH+52} textAnchor="middle" fontSize="9.5" fontWeight="700"
            fill="#1C2B3A" fontFamily="Inter" letterSpacing="0.4">VERS ABSORPTION</text>

    </svg>
    </div>
  );
}

window.Scada = Scada;
