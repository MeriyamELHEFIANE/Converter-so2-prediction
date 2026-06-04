// ─────────────────────────────────────────────────────────────
// Courbes — Charts SVG temps réel + sélection capteurs
// ─────────────────────────────────────────────────────────────
const { useState: useStateC } = React;

function LineChart({title, unit, series, refs, height=160, width=1200, legendCols=6}){
  // series : [{label,color,values,dashed,fill}]
  // refs   : [{value,color,label,dashed}]
  const all = series.flatMap(s => s.values).concat((refs||[]).map(r=>r.value)).filter(v => v != null && !isNaN(v));
  if (!all.length) return (
    <div style={{padding:20,textAlign:"center",color:"var(--txt3)",fontSize:12,fontStyle:"italic"}}>
      Aucune donnée à afficher — sélectionnez au moins un capteur.
    </div>
  );
  let ymin = Math.min(...all), ymax = Math.max(...all);
  const pad = (ymax-ymin)*0.1 || 1;
  ymin -= pad; ymax += pad;
  const n = Math.max(...series.map(s=>s.values.length));
  const W = width, H = height;
  const legendRows = Math.ceil(series.length / legendCols);
  const padL=46, padR=14, padT=22, padB=18 + legendRows*14;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xAt = i => padL + (n<=1?0:i*innerW/(n-1));
  const yAt = v => padT + innerH - (v-ymin)/(ymax-ymin)*innerH;
  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{display:"block",background:"#F5F7F9",borderRadius:4}}>
      <text x={padL} y={14} fontSize="11" fontWeight="700" fill="#1C2B3A" fontFamily="Inter">{title}</text>
      {unit && <text x={padL} y={14} fontSize="10" fill="#4A5568" fontFamily="JetBrains Mono" dx={title.length*6.4+4}>· {unit}</text>}
      {/* grid + Y labels */}
      {[...Array(ticks+1)].map((_,i)=>{
        const v = ymin + (ymax-ymin)*i/ticks;
        const y = yAt(v);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W-padR} y2={y} stroke="#CDD1D6" strokeWidth="0.5" opacity="0.7"/>
            <text x={padL-4} y={y+3} textAnchor="end" fontSize="9" fill="#4A5568" fontFamily="JetBrains Mono">{v.toFixed(v>100?0:1)}</text>
          </g>
        );
      })}
      {/* refs */}
      {(refs||[]).map((r,i)=>(
        <g key={i}>
          <line x1={padL} y1={yAt(r.value)} x2={W-padR} y2={yAt(r.value)}
            stroke={r.color} strokeWidth="1" strokeDasharray={r.dashed?"4,3":"none"} opacity="0.85"/>
          {r.label && <text x={W-padR-4} y={yAt(r.value)-2} textAnchor="end" fontSize="9" fill={r.color} fontFamily="JetBrains Mono">{r.label}</text>}
        </g>
      ))}
      {/* series */}
      {series.map((s,si)=>{
        const vals = s.values;
        const pts = vals.map((v,i)=> v==null||isNaN(v) ? null : `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).filter(Boolean).join(" ");
        const fillD = s.fill ? `M ${xAt(0)},${yAt(ymin)} L ${vals.map((v,i)=>`${xAt(i)},${yAt(v)}`).join(" L ")} L ${xAt(vals.length-1)},${yAt(ymin)} Z` : null;
        return (
          <g key={si}>
            {fillD && <path d={fillD} fill={s.color} opacity="0.12"/>}
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth="1.5"
              strokeDasharray={s.dashed?"5,3":"none"} strokeLinejoin="round" strokeLinecap="round"/>
          </g>
        );
      })}
      {/* legend (grille) */}
      {series.map((s,i)=>{
        const col = i % legendCols;
        const row = Math.floor(i / legendCols);
        const colW = (W - padL - padR) / legendCols;
        return (
          <g key={"l"+i} transform={`translate(${padL + col*colW}, ${H - padB + 18 + row*14})`}>
            <line x1="0" y1="0" x2="14" y2="0" stroke={s.color} strokeWidth="2.2" strokeDasharray={s.dashed?"3,2":"none"}/>
            <text x="18" y="3" fontSize="9" fill="#4A5568" fontFamily="JetBrains Mono">{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Palette stable : couleur fixe par capteur ─────────────────
const SENSOR_COLORS = {
  // Masse 1 (rouges/oranges)
  "13TE021B":"#C0392B", "13TE031B":"#E67E22", "13TE022B":"#922B21", "13TE032B":"#B9770E",
  // Masse 2 (bleus)
  "13TE023B":"#2471A3", "13TE033B":"#5499C7", "13TE024B":"#1F4E96", "13TE034B":"#5DADE2",
  // Masse 3 (verts)
  "13TE025B":"#1D9E75", "13TE035B":"#48C9B0", "13TE026B":"#0A5C42", "13TE036B":"#52BE80",
  // Masse 4 (violets/bruns)
  "13TE037B":"#7D3C98", "13TE027B":"#A569BD", "13TE038B":"#6E2C00", "13TE028B":"#CA6F1E",
};

// Regroupement pour les contrôles
const SENSOR_GROUPS = [
  {mass:"Masse 1", entree:["13TE021B","13TE031B"], sortie:["13TE022B","13TE032B"]},
  {mass:"Masse 2", entree:["13TE023B","13TE033B"], sortie:["13TE024B","13TE034B"]},
  {mass:"Masse 3", entree:["13TE025B","13TE035B"], sortie:["13TE026B","13TE036B"]},
  {mass:"Masse 4", entree:["13TE037B","13TE027B"], sortie:["13TE038B","13TE028B"]},
];

// ── Panneau de sélection des capteurs ────────────────────────
function SensorPicker({selected, onToggle, onPreset}){
  return (
    <div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:5,
                  padding:"8px 10px",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--txt)",letterSpacing:0.3}}>
          SÉLECTION DES CAPTEURS  <span className="mono" style={{color:"var(--txt3)",fontWeight:500}}>({selected.size}/16)</span>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          <PresetBtn label="Tous"      onClick={()=>onPreset("all")}/>
          <PresetBtn label="Aucun"     onClick={()=>onPreset("none")}/>
          <PresetBtn label="Entrées"   onClick={()=>onPreset("entrees")}/>
          <PresetBtn label="Sorties"   onClick={()=>onPreset("sorties")}/>
          <PresetBtn label="Masse 1"   onClick={()=>onPreset("m1")}/>
          <PresetBtn label="Masse 2"   onClick={()=>onPreset("m2")}/>
          <PresetBtn label="Masse 3"   onClick={()=>onPreset("m3")}/>
          <PresetBtn label="Masse 4"   onClick={()=>onPreset("m4")}/>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
        {SENSOR_GROUPS.map(g => (
          <div key={g.mass} style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:3,padding:"6px 8px"}}>
            <div style={{fontSize:10,fontWeight:700,color:"var(--txt2)",letterSpacing:0.4,marginBottom:4}}>{g.mass}</div>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              <div style={{fontSize:9,color:"var(--txt3)",fontWeight:600,letterSpacing:0.3,marginTop:2}}>ENTRÉE</div>
              {g.entree.map(id => <Chip key={id} id={id} on={selected.has(id)} onToggle={onToggle}/>)}
              <div style={{fontSize:9,color:"var(--txt3)",fontWeight:600,letterSpacing:0.3,marginTop:2}}>SORTIE</div>
              {g.sortie.map(id => <Chip key={id} id={id} on={selected.has(id)} onToggle={onToggle}/>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PresetBtn({label,onClick}){
  return (
    <button onClick={onClick} style={{
      background:"var(--panel)",border:"1px solid var(--border2)",color:"var(--txt2)",
      padding:"3px 9px",borderRadius:3,fontSize:10,fontWeight:600,cursor:"pointer",
      fontFamily:"Inter"
    }}>{label}</button>
  );
}

function Chip({id, on, onToggle}){
  const color = SENSOR_COLORS[id];
  return (
    <label style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:10,
                    padding:"2px 5px",borderRadius:3,
                    background: on ? color+"15" : "transparent",
                    border: on ? `1px solid ${color}55` : "1px solid transparent"}}>
      <input type="checkbox" checked={on} onChange={()=>onToggle(id)}
        style={{margin:0,accentColor:color,cursor:"pointer"}}/>
      <span style={{width:10,height:3,background:color,borderRadius:1,display:"inline-block",
                    opacity: on?1:0.3}}/>
      <span className="mono" style={{color: on?"var(--txt)":"var(--txt3)",fontWeight: on?700:500}}>{id}</span>
    </label>
  );
}

// ── Vue principale ────────────────────────────────────────────
function CurvesView({history, currentTemps}){
  const so2  = history.map(p=>p.so2);
  const so2p = history.map(p=>p.so2p);
  const vap  = history.map(p=>p.vap);
  const deb  = history.map(p=>p.deb);

  // Par défaut on affiche les 2 entrées de la Masse 1 (les plus parlantes)
  const [selected, setSelected] = useStateC(new Set(["13TE021B","13TE031B","13TE022B","13TE032B"]));

  function toggle(id){
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function preset(name){
    if (name === "all")     setSelected(new Set(ALL_TE_SENSORS));
    else if (name === "none") setSelected(new Set());
    else if (name === "entrees") setSelected(new Set(SENSOR_GROUPS.flatMap(g=>g.entree)));
    else if (name === "sorties") setSelected(new Set(SENSOR_GROUPS.flatMap(g=>g.sortie)));
    else if (name === "m1") setSelected(new Set([...SENSOR_GROUPS[0].entree,...SENSOR_GROUPS[0].sortie]));
    else if (name === "m2") setSelected(new Set([...SENSOR_GROUPS[1].entree,...SENSOR_GROUPS[1].sortie]));
    else if (name === "m3") setSelected(new Set([...SENSOR_GROUPS[2].entree,...SENSOR_GROUPS[2].sortie]));
    else if (name === "m4") setSelected(new Set([...SENSOR_GROUPS[3].entree,...SENSOR_GROUPS[3].sortie]));
  }

  // Séries températures pour les capteurs sélectionnés
  const tempSeries = ALL_TE_SENSORS
    .filter(id => selected.has(id))
    .map(id => ({
      label: id,
      color: SENSOR_COLORS[id],
      values: history.map(p => p.temps ? p.temps[id] : null),
    }));

  return (
    <div style={{padding:12,display:"flex",flexDirection:"column",gap:8,height:"100%",overflow:"auto",background:"var(--win)"}}>
      {/* 1. SO2 */}
      <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:6,padding:10}}>
        <LineChart title="SO₂ — Actuel & Prédit +1 h" unit="mg/Nm³" height={180}
          series={[
            {label:"SO₂ actuel",color:"#1C2B3A",values:so2},
            {label:"SO₂ prédit +1 h",color:"#1D9E75",values:so2p,dashed:true,fill:true},
          ]}
          refs={[
            {value:ALARM,color:"#C0392B",label:`Alarme ${ALARM}`,dashed:true},
            {value:PREALARM,color:"#D68910",label:`Pré-alarme ${PREALARM}`,dashed:true},
          ]}
          legendCols={2}
        />
      </div>

      {/* 2. Débits */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:6,padding:10}}>
          <LineChart title="Débit vapeur" unit="t/h" height={150}
            series={[{label:"Vapeur",color:"#2471A3",values:vap,fill:true}]} legendCols={1}/>
        </div>
        <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:6,padding:10}}>
          <LineChart title="Débit soufre" unit="t/h" height={150}
            series={[{label:"Soufre",color:"#B7770D",values:deb,fill:true}]} legendCols={1}/>
        </div>
      </div>

      {/* 3. Températures — UN seul graphe + sélecteur */}
      <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:6,padding:10,marginBottom:12}}>
        <SensorPicker selected={selected} onToggle={toggle} onPreset={preset}/>
        <LineChart title="Températures capteurs" unit="°C" height={Math.max(280, 250 + Math.ceil(tempSeries.length/6)*14)}
          series={tempSeries} legendCols={6}/>
      </div>
    </div>
  );
}

window.CurvesView = CurvesView;
