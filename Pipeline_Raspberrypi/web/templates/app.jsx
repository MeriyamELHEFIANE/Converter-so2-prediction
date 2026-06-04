// ─────────────────────────────────────────────────────────────
// APP — Shell principal, header, tabs, sidebar, state management
// ─────────────────────────────────────────────────────────────
const { useState, useEffect, useMemo, useRef } = React;

function App(){
  const [tab, setTab] = useState("converter");
  const [running, setRunning] = useState(true);
  const modelStatus = {loaded:true, r2:0.847, mae:62, rec:91,
    status:"Modèle XGBoost intégré · R²=0.847 · MAE=62 mg/Nm³ · Rappel=91%"};
  const [vals, setVals] = useState(()=>{
    const s = SCENARIOS["Alarme (1960-2200)"];
    return {...s.temps, SO2:s.SO2, SO2_pred:s.SO2_pred, Vapeur:s.Vapeur, debit_soufre:s.debit_soufre};
  });
  const [historyCurves, setHistoryCurves] = useState(()=>genHistoryPoints());
  const [historyRows, setHistoryRows] = useState([]);
  const [alarmes, setAlarmes] = useState([]);
  const alarmIdRef = useRef(0);
  const [now, setNow] = useState(new Date());
  const stateRef = useRef({phase:0, t:0}); // pilote la dérive temps réel

  // Horloge
  useEffect(()=>{
    const id = setInterval(()=>setNow(new Date()), 1000);
    return ()=>clearInterval(id);
  },[]);

  // ── Acquisition données réelles depuis Flask /api/etat (toutes les 10 s) ──
  useEffect(()=>{
    if (!running) return;
    const fetchData = () => {
      fetch('/api/etat')
        .then(r => r.json())
        .then(d => {
          // Attendre que le pipeline ait au moins une mesure
          if (!d || d.so2_actuel === null || d.so2_actuel === undefined) return;

          // Mapper les données Flask vers le format attendu par pushSample
          const newTemps = d.temperatures || {};   // { "13TE021B": 431.2, ... }
          const newSO2   = d.so2_actuel   || 0;   // SO2 mesuré en temps réel
          const newPred  = d.so2_pred     || 0;   // SO2 prédit +1h par XGBoost
          const newVap   = d.Vapeur       || 0;   // débit vapeur
          const newDeb   = d.debit_soufre || 0;   // débit soufre

          pushSample(newTemps, newSO2, newPred, newVap, newDeb);
        })
        .catch(err => console.warn('[API] Erreur /api/etat :', err));
    };
    fetchData();                               // premier appel immédiat
    const id = setInterval(fetchData, 10000); // puis toutes les 10 s
    return () => clearInterval(id);
  }, [running]);

  function pushSample(temps, so2, so2p, vap, deb){
    setVals({...temps, SO2:so2, SO2_pred:so2p, Vapeur:vap, debit_soufre:deb});
    const d2 = Object.entries(MASSES).map(([nm,info])=>diagnostiquer(nm,info,temps)).filter(Boolean);
    const ts = fmtTime(new Date());

    // Alarmes
    const newAlarms = [];
    if (so2p >= ALARM) {
      newAlarms.push({msg:`SO₂ prédit ${so2p.toFixed(0)} ≥ ${ALARM} mg/Nm³`, masse:"SO₂", type:"ALARME", severite:3});
    } else if (so2p >= PREALARM) {
      newAlarms.push({msg:`SO₂ prédit ${so2p.toFixed(0)} ≥ ${PREALARM} mg/Nm³`, masse:"SO₂", type:"PRE-ALARME", severite:1});
    }
    d2.forEach(d => {
      d.probs.forEach(pr => {
        if (pr.grav >= 2) newAlarms.push({msg:`${d.nom} : ${pr.msg}`, masse:d.nom, type:pr.type, severite:pr.grav});
      });
    });
    setAlarmes(prev => {
      const out = [...prev];
      newAlarms.forEach(na => {
        if (out.length && out[out.length-1].msg === na.msg) return;
        alarmIdRef.current += 1;
        out.push({id:alarmIdRef.current, ts, acq:false, ...na});
      });
      return out.slice(-500);
    });

    // Tableau historique
    const masses = Object.entries(MASSES).map(([nm,info])=>{
      const d = d2.find(x=>x.nom===nm);
      if (!d) return {Te:null, Ts:null, dT:null};
      const dT_bad = d.dT != null && (d.dT < info.dT_nom-info.dtb || d.dT > info.dT_nom+info.dth);
      return {Te:d.Te, Ts:d.Ts, dT:d.dT, dT_bad};
    });
    setHistoryRows(prev => [{ts, so2, so2p, masses, temps:{...temps}}, ...prev].slice(0,1000));

    // Courbes
    setHistoryCurves(prev => {
      const sensorSnap = {};
      ALL_TE_SENSORS.forEach(k => { sensorSnap[k] = temps[k]; });
      const last = {t:new Date(), so2, so2p, vap, deb,
        tcsg_m1:425, tcsg_m2:445, tcsg_m3:445, tcsg_m4:445,
        treal_m1: d2[0]?.Te || 425,
        dt_m1: d2[0]?.dT || 175, dt_m2: d2[1]?.dT || 75,
        dt_m3: d2[2]?.dT || 25, dt_m4: d2[3]?.dT || 7,
        temps: sensorSnap,
      };
      return [...prev.slice(1), last];
    });
  }

  // ── Diagnostic des 4 masses — uniquement si SO2_pred >= PREALARM ──
  const diags = useMemo(()=>{
    // Si SO2 normal : aucune action requise, ne pas alarmer l'opérateur
    if (!vals.SO2_pred || vals.SO2_pred < PREALARM) return [];
    return Object.entries(MASSES).map(([nm,info])=>diagnostiquer(nm,info,vals)).filter(Boolean);
  }, [vals]);

  const zone = useMemo(()=>{
    const sop = vals.SO2_pred;
    if (sop >= URGENCE) return "URGENCE";
    if (sop >= ALARM) return "ALARME";
    if (sop >= PREALARM) return "PRÉ-ALARME";
    return "NORMAL";
  }, [vals.SO2_pred]);

  // ── Diagnostic textuel ──
  const diagText = useMemo(()=>{
    if (zone === "NORMAL") return {text:"OK — Toutes les masses dans les plages nominales.", level:"ok"};
    const causes = diags.filter(d=>d.grav>=2);
    const sympts = diags.filter(d=>d.grav===1);
    if (!causes.length) {
      return {text:"SO₂ élevé · T nominales OK\n→ Réduire débit soufre", level:"warn"};
    }
    const cn = causes.map(d=>d.nom).join(", ");
    const sn = sympts.length ? sympts.map(d=>d.nom).join(", ") : "—";
    return {text:`CAUSE RACINE :\n${cn}\n\nSymptômes (cascade) :\n${sn}`, level:"err"};
  }, [diags, zone]);

  // ── Alarmes : acquittement ──
  function acqOne(id){ setAlarmes(prev => prev.map(a => a.id===id?{...a,acq:true}:a)); }
  function acqAll(){ setAlarmes(prev => prev.map(a => ({...a,acq:true}))); }
  function clearAll(){
    if (confirm("Effacer l'historique des alarmes ?")) setAlarmes([]);
  }

  // ── Export CSV ──
  function exportCsv(){
    if (!historyRows.length) { alert("Aucune donnée à exporter."); return; }
    const sensorCols = ALL_TE_SENSORS;
    const header = ["Horodatage","SO2_actuel","SO2_predit", ...sensorCols].join(",");
    const lines = historyRows.map(r => {
      const sv = sensorCols.map(s => r.temps?.[s]!=null ? r.temps[s].toFixed(1) : "").join(",");
      return `${r.ts},${r.so2.toFixed(0)},${r.so2p.toFixed(0)},${sv}`;
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "historique_tconsigne.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const activeAlarmsCount = alarmes.filter(a=>!a.acq).length;

  return (
    <React.Fragment>
      {/* HEADER */}
      <div style={{background:"var(--header)",color:"#fff",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <img src="logo_ocp.png" alt="OCP" style={{height:36}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          {activeAlarmsCount>0 && (
            <div onClick={()=>setTab("alarms")} style={{cursor:"pointer",background:"#C0392B",padding:"6px 12px",borderRadius:16,
              display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,animation:"pulse 1.6s infinite"}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>
              {activeAlarmsCount} alarme{activeAlarmsCount>1?"s":""} active{activeAlarmsCount>1?"s":""}
            </div>
          )}
          <div className="mono" style={{fontSize:12,color:"#B0E8D4"}}>{fmtTime(now)}</div>
        </div>
      </div>

      {/* BANDEAU STATUT SO₂ */}
      {(() => {
        const so2 = vals.SO2, sop = vals.SO2_pred;
        const zoneColor = zone==="URGENCE"||zone==="ALARME"?"#C0392B"
                         :zone==="PRÉ-ALARME"?"#D68910":"#1D9E75";
        const zoneBg   = zone==="URGENCE"||zone==="ALARME"?"#FDECEA"
                         :zone==="PRÉ-ALARME"?"#FEF9E7":"#E8F7F2";
        const so2Color = so2>=ALARM?"#C0392B":so2>=PREALARM?"#D68910":"#1D9E75";
        const sopColor = sop>=ALARM?"#C0392B":sop>=PREALARM?"#D68910":"#1D9E75";
        const so2pct = Math.min(1, sop/(URGENCE*1.2));
        return (
          <div style={{background:"#FFFFFF",borderBottom:"2px solid #CDD1D6",
                        padding:"6px 16px",display:"flex",alignItems:"center",gap:16}}>

            {/* Label STATUT */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,
                          borderRight:"1px solid #CDD1D6",paddingRight:16,minWidth:80}}>
              <span style={{width:9,height:9,borderRadius:"50%",background:"#1D9E75",
                boxShadow:"0 0 8px #1D9E75",animation:"pulse 1.4s infinite"}}/>
              <span style={{fontWeight:800,letterSpacing:0.5,fontSize:10,color:"#0A5C42",
                            textTransform:"uppercase"}}>Statut SO₂</span>
            </div>

            {/* SO2 actuel */}
            <div style={{background:"#F5F7F9",border:`2px solid ${so2Color}`,borderRadius:6,
                          padding:"4px 14px",textAlign:"center",minWidth:110}}>
              <div style={{fontSize:9,color:"#4A5568",fontWeight:600,letterSpacing:0.3,marginBottom:1}}>SO₂ actuel</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,justifyContent:"center"}}>
                <span className="mono" style={{fontSize:26,fontWeight:800,color:so2Color,lineHeight:1}}>
                  {so2?so2.toFixed(0):"---"}
                </span>
                <span style={{fontSize:10,color:"#8A95A3",fontFamily:"JetBrains Mono"}}>mg/Nm³</span>
              </div>
            </div>

            {/* SO2 prédit */}
            <div style={{background:"#F5F7F9",border:`2px solid ${sopColor}`,borderRadius:6,
                          padding:"4px 14px",textAlign:"center",minWidth:120}}>
              <div style={{fontSize:9,color:"#4A5568",fontWeight:600,letterSpacing:0.3,marginBottom:1}}>SO₂ prédit +1 h</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,justifyContent:"center"}}>
                <span className="mono" style={{fontSize:26,fontWeight:800,color:sopColor,lineHeight:1}}>
                  {sop?sop.toFixed(0):"---"}
                </span>
                <span style={{fontSize:10,color:"#8A95A3",fontFamily:"JetBrains Mono"}}>mg/Nm³</span>
              </div>
            </div>

            {/* Barre de progression */}
            <div style={{flex:1,maxWidth:320,minWidth:140}}>
              <div style={{height:10,background:"#E2E6EA",borderRadius:5,overflow:"hidden",
                            border:"1px solid #CDD1D6"}}>
                <div style={{height:"100%",width:`${so2pct*100}%`,background:sopColor,
                              transition:"width 0.4s",borderRadius:5}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:8,
                            color:"#8A95A3",marginTop:2,fontFamily:"JetBrains Mono"}}>
                <span>0</span><span>{PREALARM}</span><span>{ALARM}</span><span>{URGENCE}+</span>
              </div>
            </div>

            {/* Badge ZONE */}
            <div style={{background:zoneBg,border:`2px solid ${zoneColor}`,borderRadius:5,
                          padding:"5px 18px",textAlign:"center",minWidth:90}}>
              <div style={{fontSize:9,color:"#8A95A3",letterSpacing:0.4,fontWeight:600}}>ZONE</div>
              <div style={{fontSize:15,fontWeight:800,color:zoneColor,letterSpacing:0.8,lineHeight:1.2}}>{zone}</div>
            </div>

          </div>
        );
      })()}

      {/* TABS */}
      <div style={{display:"flex",background:"var(--win)",borderBottom:"1px solid var(--border)"}}>
        {[
          ["converter","Convertisseur"],
          ["curves","Courbes"],
          ["history","Historique"],
          ["alarms","Alarmes"],
          ["weather","Station Météo"],
        ].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{
              padding:"10px 22px",border:"none",cursor:"pointer",
              fontSize:12,fontWeight:700,letterSpacing:0.3,
              background: tab===id?"var(--green)":"transparent",
              color: tab===id?"#fff":"var(--txt2)",
              position:"relative", display:"flex",alignItems:"center",gap:8,
            }}>
            {label}
            {id==="alarms" && activeAlarmsCount>0 && (
              <span style={{background:tab===id?"#fff":"var(--red)",color:tab===id?"var(--red)":"#fff",
                fontSize:10,padding:"1px 6px",borderRadius:8,fontWeight:800}}>{activeAlarmsCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* CONTENU */}
      <div style={{flex:1,minHeight:0,overflow:"hidden",background:"var(--win)"}}>
        {tab==="converter" && (
          <ConverterTab vals={vals} diags={diags} zone={zone} diagText={diagText}
                         alarmes={alarmes} acqOne={acqOne} acqAll={acqAll}
                         modelStatus={modelStatus}/>
        )}
        {tab==="curves" && <CurvesView history={historyCurves} currentTemps={vals}/>}
        {tab==="history" && <HistoryView rows={historyRows} onExport={exportCsv}/>}
        {tab==="alarms" && <AlarmsView alarmes={alarmes} onClear={clearAll} onAcq={acqOne} onAcqAll={acqAll}/>}
        {tab==="weather" && <WeatherView/>}
      </div>


      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.55}}
      `}</style>
    </React.Fragment>
  );
}

// ── Onglet Convertisseur (sidebars + SCADA) ──────────────────
function ConverterTab({vals, diags, zone, diagText, alarmes, acqOne, acqAll, modelStatus}){
  const so2 = vals.SO2, sop = vals.SO2_pred;
  const zoneColor = zone==="URGENCE"||zone==="ALARME"?"var(--red)"
                   :zone==="PRÉ-ALARME"?"var(--orange)":"var(--green-d)";
  const zoneBg = zone==="URGENCE"||zone==="ALARME"?"var(--red-l)"
                 :zone==="PRÉ-ALARME"?"var(--orange-l)":"var(--green-l)";
  const so2pct = Math.min(1, sop/(URGENCE*1.2));
  const so2BarColor = sop>=ALARM?"var(--red)":sop>=PREALARM?"var(--orange)":"var(--green)";

  return (
    <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:8,padding:8,height:"100%"}}>
      {/* SIDEBAR GAUCHE — Diagnostic par masse */}
      <div style={{display:"flex",flexDirection:"column",gap:6,overflow:"auto"}}>
        <div style={{background:"var(--header)",color:"#fff",padding:"8px 12px",fontSize:11,fontWeight:800,
                      letterSpacing:0.5,textAlign:"center",borderRadius:"4px 4px 0 0"}}>
          DIAGNOSTIC PAR MASSE
        </div>
        {Object.entries(MASSES).map(([name,info],idx) => {
          const d = diags.find(x => x.nom === name);
          return <MassDiagCard key={name} idx={idx+1} name={name} info={info} diag={d}/>;
        })}
      </div>

      {/* CENTRE — SCADA */}
      <div style={{minWidth:0,display:"flex",flexDirection:"column",overflow:"auto"}}>
        <Scada vals={vals} diags={diags} zone={zone}/>
      </div>
    </div>
  );
}

function MassDiagCard({idx, name, info, diag}){
  const ok = !diag || diag.grav === 0;
  const isWarn = diag && diag.grav === 1;
  const isErr = diag && diag.grav >= 2;
  const color = ok ? "var(--green)" : isWarn ? "var(--orange)" : "var(--red)";
  const bg = ok ? "var(--green-l)" : isWarn ? "var(--orange-l)" : "var(--red-l)";
  const statusLabel = ok ? "ÉTAT NORMAL" : isWarn ? "ANOMALIE LÉGÈRE" : "ANOMALIE CRITIQUE";

  return (
    <div style={{background:"var(--panel)",border:`1px solid var(--border)`,borderLeft:`4px solid ${color}`,
                  borderRadius:4,overflow:"hidden",flexShrink:0}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:bg,borderBottom:`1px solid var(--border)`}}>
        <div style={{width:26,height:26,borderRadius:3,background:color,color:"#fff",
                      display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12}}>
          M{idx}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--txt)"}}>{name}</div>
          <div style={{fontSize:9,color:"var(--txt3)",fontWeight:600,letterSpacing:0.3}}>
            consigne {info.Te_nom}°C · ΔT nom {info.dT_nom}°C
          </div>
        </div>
        <div style={{width:18,height:18,borderRadius:"50%",background:color,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
          {ok ? (
            <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6 L5 9 L10 3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 12 12"><path d="M6 2 L6 7 M6 10 L6 10" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
          )}
        </div>
      </div>

      {/* Status + mesures */}
      <div style={{padding:"6px 10px",fontSize:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <span style={{color,fontWeight:800,letterSpacing:0.4,fontSize:10}}>{statusLabel}</span>
          {diag && (
            <span className="mono" style={{fontSize:9,color:"var(--txt2)"}}>
              Te <b style={{color:"var(--txt)"}}>{diag.Te?diag.Te.toFixed(1):"--"}</b> · ΔT <b style={{color:"var(--txt)"}}>{diag.dT??"--"}</b>
            </span>
          )}
        </div>

        {ok ? (
          <div style={{color:"var(--green-d)",fontSize:10,lineHeight:1.35}}>
            Te dans la tolérance ±{info.tol}°C · ΔT dans [{info.dT_nom-info.dtb} ; {info.dT_nom+info.dth}]°C
            <div style={{marginTop:3,color:"var(--txt3)",fontStyle:"italic"}}>
              Aucune action requise.
            </div>
          </div>
        ) : (
          (diag?.probs || []).map((pr,i) => (
            <div key={i} style={{marginTop:i?6:0,borderTop:i?"1px dashed var(--border)":"none",paddingTop:i?5:0}}>
              <div style={{fontSize:10,fontWeight:600,color,marginBottom:2,lineHeight:1.3}}>
                ⚠ {pr.msg}
              </div>
              <div style={{fontSize:9,color:"var(--txt3)",letterSpacing:0.3,fontWeight:700,marginTop:3}}>ACTION CORRECTIVE</div>
              <div style={{fontSize:10,color:"var(--txt)",lineHeight:1.35,background:"var(--panel2)",
                            padding:"4px 6px",borderRadius:2,borderLeft:`2px solid ${color}`,marginTop:2}}>
                {pr.action}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SO2Card({label,value,color}){
  return (
    <div style={{background:"var(--panel2)",padding:"6px 10px",borderRadius:4,border:"1px solid var(--border)"}}>
      <div style={{fontSize:10,color:"var(--txt2)",fontWeight:500}}>{label}</div>
      <div className="mono" style={{fontSize:22,fontWeight:800,color,textAlign:"right",lineHeight:1.2}}>{value}</div>
    </div>
  );
}
function MetricBox({label,value}){
  return (
    <div style={{flex:1,background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:3,padding:"4px 2px",textAlign:"center"}}>
      <div style={{fontSize:9,color:"var(--txt3)",fontWeight:600}}>{label}</div>
      <div className="mono" style={{fontSize:13,fontWeight:700,color:"var(--green-d)"}}>{value}</div>
    </div>
  );
}
function KV2({k,v}){
  return (
    <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0",fontSize:11}}>
      <span style={{color:"var(--txt2)"}}>{k}</span>
      <span className="mono" style={{fontWeight:700,color:"var(--txt)"}}>{v}</span>
    </div>
  );
}
function SO2Top({label, value, unit, color}){
  return (
    <div style={{display:"flex",flexDirection:"column",lineHeight:1.05}}>
      <div style={{fontSize:9,color:"rgba(205,230,255,0.6)",fontWeight:600,letterSpacing:0.3}}>{label}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:4}}>
        <span className="mono" style={{fontSize:20,fontWeight:800,color}}>{value}</span>
        <span style={{fontSize:9,color:"rgba(205,230,255,0.55)",fontFamily:"JetBrains Mono"}}>{unit}</span>
      </div>
    </div>
  );
}

function Pill({label,value,color}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.06)",
      border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"2px 9px",fontSize:10}}>
      <span style={{opacity:0.7,letterSpacing:0.3}}>{label}</span>
      <span className="mono" style={{fontWeight:700,color}}>{value}</span>
    </div>
  );
}

const btnPrimary = {background:"var(--green)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:3,
  fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:0.3,display:"inline-flex",alignItems:"center",gap:4};
const btnNeutral = {background:"var(--txt2)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:3,
  fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:0.3};
const btnSecondary = {background:"#fff",color:"var(--txt)",border:"1px solid var(--border2)",padding:"6px 14px",borderRadius:3,
  fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:0.3};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
