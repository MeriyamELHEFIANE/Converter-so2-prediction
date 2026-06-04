// ─────────────────────────────────────────────────────────────
// STATION MÉTÉO — OCP Safi (données réelles ESP8266 → SQL Server)
// ─────────────────────────────────────────────────────────────
const { useState: useStateW, useEffect: useEffectW } = React;

const COMPASS = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                  "S","SSO","SO","OSO","O","ONO","NO","NNO"];
function dirFromDeg(deg){ return COMPASS[Math.round(((deg%360)/22.5))%16]; }

// ── Composants visuels ──────────────────────────────────────

function WeatherIcon({type, size=36, color="#D68910"}){
  if (type==="sun") return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="8" fill={color}/>
      {[...Array(8)].map((_,i)=>{
        const a = i*Math.PI/4;
        return <line key={i}
          x1={20+Math.cos(a)*12} y1={20+Math.sin(a)*12}
          x2={20+Math.cos(a)*16} y2={20+Math.sin(a)*16}
          stroke={color} strokeWidth="2" strokeLinecap="round"/>;
      })}
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="14" cy="15" r="6" fill={color}/>
      {[...Array(8)].map((_,i)=>{
        const a = i*Math.PI/4;
        return <line key={i}
          x1={14+Math.cos(a)*8.5} y1={15+Math.sin(a)*8.5}
          x2={14+Math.cos(a)*11}  y2={15+Math.sin(a)*11}
          stroke={color} strokeWidth="1.5" strokeLinecap="round"/>;
      })}
      <ellipse cx="24" cy="28" rx="11" ry="6" fill="#B0B8C1"/>
      <circle cx="20" cy="24" r="5" fill="#B0B8C1"/>
      <circle cx="29" cy="23" r="5.5" fill="#B0B8C1"/>
    </svg>
  );
}

function Gauge({value, min=0, max=100, label, unit, color="#1D9E75"}){
  const pct = value != null
    ? Math.max(0, Math.min(1, (value-min)/(max-min))) : 0;
  const angle = -135 + pct*270;
  const r=60, cx=80, cy=80;
  const arc = (a1,a2,col,w=10) => {
    const x1=cx+r*Math.cos(a1*Math.PI/180), y1=cy+r*Math.sin(a1*Math.PI/180);
    const x2=cx+r*Math.cos(a2*Math.PI/180), y2=cy+r*Math.sin(a2*Math.PI/180);
    const large = Math.abs(a2-a1) > 180 ? 1 : 0;
    return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
      stroke={col} strokeWidth={w} fill="none" strokeLinecap="round"/>;
  };
  const displayVal = value != null
    ? (typeof value==="number"
        ? value.toFixed(unit==="%"?0:1)
        : value)
    : "—";
  return (
    <svg viewBox="0 0 160 140" width="100%" height="140">
      {arc(45+90, 315+90, "#E2E6EA")}
      {value != null && arc(45+90, 45+90+pct*270, color)}
      <line
        x1={cx} y1={cy}
        x2={cx+r*0.85*Math.cos(angle*Math.PI/180)}
        y2={cy+r*0.85*Math.sin(angle*Math.PI/180)}
        stroke="#1C2B3A" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r="5" fill="#1C2B3A"/>
      <text x={cx} y={cy+28} textAnchor="middle" fontSize="24"
            fontWeight="800" fontFamily="JetBrains Mono" fill="#1C2B3A">
        {displayVal}
      </text>
      <text x={cx} y={cy+44} textAnchor="middle" fontSize="11"
            fill="#4A5568">{unit}</text>
      <text x={cx} y={130} textAnchor="middle" fontSize="11"
            fontWeight="600" fill="#1C2B3A" letterSpacing="0.4">{label}</text>
    </svg>
  );
}

function Compass({dir, dirLabel}){
  const cx=110, cy=110, r=80;
  return (
    <svg viewBox="0 0 220 220" width="100%" height="220">
      <circle cx={cx} cy={cy} r={r+12} fill="#F5F7F9"
              stroke="#CDD1D6" strokeWidth="1"/>
      <circle cx={cx} cy={cy} r={r} fill="#FFFFFF"
              stroke="#B0B8C1" strokeWidth="1"/>
      {[...Array(36)].map((_,i)=>{
        const a = i*10*Math.PI/180 - Math.PI/2;
        const major = i%9===0;
        return <line key={i}
          x1={cx+Math.cos(a)*r} y1={cy+Math.sin(a)*r}
          x2={cx+Math.cos(a)*(r-(major?10:5))}
          y2={cy+Math.sin(a)*(r-(major?10:5))}
          stroke={major?"#1C2B3A":"#CDD1D6"}
          strokeWidth={major?2:1}/>;
      })}
      {[["N",0],["E",90],["S",180],["O",270]].map(([l,a])=>{
        const rad=(a-90)*Math.PI/180;
        return <text key={l}
          x={cx+Math.cos(rad)*(r-22)} y={cy+Math.sin(rad)*(r-22)+5}
          textAnchor="middle" fontSize="14" fontWeight="800"
          fill={l==="N"?"#C0392B":"#1C2B3A"}>{l}</text>;
      })}
      <g transform={`rotate(${dir||0} ${cx} ${cy})`}>
        <polygon
          points={`${cx},${cy-r+18} ${cx-10},${cy+5} ${cx},${cy-8} ${cx+10},${cy+5}`}
          fill="#C0392B" stroke="#7A1414" strokeWidth="1"/>
        <polygon
          points={`${cx},${cy+r-18} ${cx-8},${cy-5} ${cx},${cy+8} ${cx+8},${cy-5}`}
          fill="#1C2B3A" stroke="#0A0F1A" strokeWidth="1"/>
      </g>
      <circle cx={cx} cy={cy} r="9" fill="#1C2B3A" stroke="#fff" strokeWidth="2"/>
      <circle cx={cx} cy={cy} r="3" fill="#fff"/>
      <text x={cx} y={195} textAnchor="middle" fontSize="22"
            fontWeight="800" fontFamily="JetBrains Mono" fill="#1C2B3A">
        {dirLabel || dirFromDeg(dir||0)}
      </text>
      <text x={cx} y={213} textAnchor="middle" fontSize="11" fill="#4A5568">
        {Math.round(dir||0)}°
      </text>
    </svg>
  );
}

function MiniTrend({values, color, height=42}){
  const valid = (values||[]).filter(v => v!=null && !isNaN(v));
  if (valid.length < 2) return (
    <div style={{height,display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:10,
                  color:"var(--txt3)",fontStyle:"italic"}}>
      Données insuffisantes
    </div>
  );
  const min=Math.min(...valid), max=Math.max(...valid);
  const W=200, H=height;
  const xAt = i => (i/(valid.length-1))*W;
  const yAt = v => max===min ? H/2 : H-2-((v-min)/(max-min))*(H-6);
  const pts = valid.map((v,i)=>
    `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
  const area = `M 0,${H} L ${valid.map((v,i)=>
    `${xAt(i)},${yAt(v)}`).join(" L ")} L ${W},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
         preserveAspectRatio="none">
      <path d={area} fill={color} opacity="0.18"/>
      <polyline points={pts} fill="none" stroke={color}
                strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Vue principale ──────────────────────────────────────────
function WeatherView(){
  const [now, setNow]           = useStateW(new Date());
  const [meteo, setMeteo]       = useStateW(null);
  const [history, setHistory]   = useStateW([]);
  const [statut, setStatut]     = useStateW("chargement");
  const [lastUpdate, setLastUpdate] = useStateW(null);

  useEffectW(()=>{
    const fetchMeteo = async () => {
      try {
        const r = await fetch('/api/meteo');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (data && (data.temperature !== null || data.humidity !== null)){
          setMeteo(data);
          if (data.historique && data.historique.length > 0)
            setHistory(data.historique);
          setStatut('ok');
          setLastUpdate(new Date());
        } else {
          setStatut('attente');
        }
      } catch(e){
        console.error('[METEO]', e);
        setStatut('erreur');
      }
    };
    fetchMeteo();
    const id    = setInterval(fetchMeteo, 10000);
    const clock = setInterval(()=>setNow(new Date()), 1000);
    return ()=>{ clearInterval(id); clearInterval(clock); };
  }, []);

  const temperature = meteo?.temperature ?? null;
  const humidity    = meteo?.humidity    ?? null;
  const angle       = meteo?.angle       ?? 0;
  const direction   = meteo?.direction   ?? 'N';
  const ts          = meteo?.timestamp   ?? null;

  const dewPoint = (temperature != null && humidity != null)
    ? (temperature - (100-humidity)/5).toFixed(1) : null;

  const temps_hist = history.map(h=>h.temperature).filter(v=>v!=null);
  const tempMin = temps_hist.length ? Math.min(...temps_hist).toFixed(1) : "—";
  const tempMax = temps_hist.length ? Math.max(...temps_hist).toFixed(1) : "—";

  return (
    <div style={{padding:12,display:"flex",flexDirection:"column",gap:10,
                  height:"100%",overflow:"auto",
                  background:"linear-gradient(180deg,#E8F1F8 0%,#EEF1F4 200px)"}}>

      {/* En-tête */}
      <div style={{background:"linear-gradient(135deg,#0A5C42,#1D9E75)",
                    borderRadius:8,padding:"14px 18px",color:"#fff",
                    display:"flex",alignItems:"center",
                    justifyContent:"space-between",
                    boxShadow:"0 2px 8px rgba(0,92,66,0.25)"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
              <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0
                       9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
            </svg>
            <div style={{fontSize:20,fontWeight:800,letterSpacing:0.3}}>
              Station Safi
            </div>
            <div style={{fontSize:12,opacity:0.85}}>
              · OCP Maroc Phosphore II
            </div>
          </div>
          <div style={{fontSize:11,opacity:0.8,marginTop:4,display:"flex",
                        gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <span>Màj : {lastUpdate
              ? lastUpdate.toLocaleTimeString('fr-FR') : "—"}</span>
            {ts && <span style={{opacity:0.7}}>SQL : {ts}</span>}
            <span style={{
              display:"inline-flex",alignItems:"center",gap:5,
              background: statut==='ok'
                ? "rgba(255,255,255,0.15)" : "rgba(220,38,38,0.3)",
              padding:"2px 8px",borderRadius:10,fontSize:10,
            }}>
              <span style={{width:6,height:6,borderRadius:"50%",
                display:"inline-block",
                background: statut==='ok' ? "#4ade80"
                  : statut==='attente'    ? "#fbbf24" : "#f87171"}}/>
              {statut==='ok'     ? "ESP8266 CONNECTÉ"
               : statut==='attente' ? "EN ATTENTE" : "ERREUR SQL"}
            </span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <WeatherIcon type="sun" size={48} color="#FFD54F"/>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:42,fontWeight:800,
                          fontFamily:"JetBrains Mono",lineHeight:1}}>
              {temperature != null ? `${temperature.toFixed(1)}°` : "—°"}
            </div>
            <div style={{fontSize:12,opacity:0.85}}>
              Humidité {humidity != null
                ? `${humidity.toFixed(0)}%` : "—"} · {direction} {angle}°
            </div>
          </div>
        </div>
      </div>

      {/* Alerte si pas de données */}
      {statut !== 'ok' && (
        <div style={{background:"#FEF9E7",border:"1px solid #D68910",
                      borderLeft:"4px solid #D68910",borderRadius:6,
                      padding:"10px 14px",fontSize:12,color:"#7D5A00",
                      display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:16}}>⚠</span>
          <span>
            {statut==='erreur'
              ? "Impossible de joindre /api/meteo. Vérifiez que main.py est en cours d'exécution."
              : "En attente de données ESP8266. Vérifiez la connexion au réseau."}
          </span>
        </div>
      )}

      {/* Grille principale : 3 colonnes */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1.2fr 1fr",gap:10}}>

        {/* Température */}
        <Card title="Température" sub="DHT11 · ±2°C · ESP8266">
          <Gauge value={temperature} min={-5} max={45}
                 label="Air ambiant" unit="°C" color="#C0392B"/>
          <Divider/>
          <KV k="Point de rosée"  v={dewPoint!=null?`${dewPoint} °C`:"—"} mono/>
          <KV k="Min. historique" v={`${tempMin} °C`} mono/>
          <KV k="Max. historique" v={`${tempMax} °C`} mono/>
          <div style={{marginTop:8}}>
            <MiniTrend values={history.map(h=>h.temperature)} color="#C0392B"/>
          </div>
          <div style={{fontSize:10,color:"var(--txt3)",
                        textAlign:"right",marginTop:-4}}>
            {history.length} mesures
          </div>
        </Card>

        {/* Direction du vent */}
        <Card title="Direction du vent" sub="Encodeur KY-040 · 16 secteurs">
          <Compass dir={angle} dirLabel={direction}/>
          <Divider/>
          <KV k="Direction" v={`${direction} · ${angle}°`} mono/>
          <KV k="Résolution" v="22.5° / secteur" mono/>
        </Card>

        {/* Humidité */}
        <Card title="Humidité relative" sub="DHT11 · ±5% RH · ESP8266">
          <Gauge value={humidity} min={0} max={100}
                 label="Air ambiant" unit="%" color="#2471A3"/>
          <Divider/>
          <KV k="Point de rosée" v={dewPoint!=null?`${dewPoint} °C`:"—"} mono/>
          <KV k="Résolution"     v="±5 % RH" mono/>
          <div style={{marginTop:8}}>
            <MiniTrend values={history.map(h=>h.humidity)} color="#2471A3"/>
          </div>
          <div style={{fontSize:10,color:"var(--txt3)",
                        textAlign:"right",marginTop:-4}}>
            {history.length} mesures
          </div>
        </Card>
      </div>

      {/* Tableau historique complet */}
      <Card title="Historique SQL" sub="Dernières mesures reçues depuis SQL Server (meteo_station)">
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:8}}>
          <div style={{background:"var(--panel2)",border:"1px solid var(--border)",
                        borderRadius:6,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"var(--txt3)",marginBottom:4,
                          fontWeight:600,letterSpacing:0.3}}>HORODATAGE SQL</div>
            <div className="mono" style={{fontSize:12,fontWeight:700,
                                           color:"var(--txt)"}}>{ts||"—"}</div>
          </div>
          <div style={{background:"var(--panel2)",border:"1px solid var(--border)",
                        borderRadius:6,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"var(--txt3)",marginBottom:4,
                          fontWeight:600,letterSpacing:0.3}}>DIRECTION VENT</div>
            <div className="mono" style={{fontSize:12,fontWeight:700,
                                           color:"var(--txt)"}}>
              {direction} · {angle}°
            </div>
          </div>
        </div>
        <Divider/>
        {history.length > 0 ? (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",
                            fontSize:11,fontFamily:"JetBrains Mono"}}>
              <thead>
                <tr style={{borderBottom:"1px solid var(--border)"}}>
                  {["Horodatage","Temp °C","Humid %","Direction","Angle"].map(h=>(
                    <th key={h} style={{padding:"4px 8px",textAlign:"left",
                                         color:"var(--txt3)",fontSize:10,
                                         fontWeight:600}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().slice(0,10).map((row,i)=>(
                  <tr key={i} style={{
                    background: i===0 ? "#E8F7F2" : "transparent",
                    borderBottom:"1px solid var(--border)"}}>
                    <td style={{padding:"4px 8px",color:"var(--txt3)",fontSize:10}}>
                      {row.ts}
                    </td>
                    <td style={{padding:"4px 8px",color:"#C0392B",fontWeight:700}}>
                      {row.temperature??'—'}
                    </td>
                    <td style={{padding:"4px 8px",color:"#2471A3",fontWeight:700}}>
                      {row.humidity??'—'}
                    </td>
                    <td style={{padding:"4px 8px",color:"var(--txt2)"}}>
                      {row.direction??'—'}
                    </td>
                    <td style={{padding:"4px 8px",color:"var(--txt2)"}}>
                      {row.angle??'—'}°
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{fontSize:11,color:"var(--txt3)",
                        fontStyle:"italic",textAlign:"center",padding:12}}>
            Aucun historique disponible
          </div>
        )}
      </Card>

    </div>
  );
}

// ── Composants utilitaires ───────────────────────────────────
function Card({title, sub, children}){
  return (
    <div style={{background:"var(--panel)",border:"1px solid var(--border)",
                  borderRadius:8,padding:12,display:"flex",
                  flexDirection:"column",gap:6,
                  boxShadow:"0 1px 2px rgba(0,0,0,0.03)"}}>
      <div>
        <div style={{fontSize:11,fontWeight:700,color:"var(--txt)",
                      textTransform:"uppercase",letterSpacing:0.6}}>{title}</div>
        {sub && <div style={{fontSize:10,color:"var(--txt3)",marginTop:1}}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}
function Divider(){
  return <div style={{height:1,background:"var(--border)",margin:"4px 0"}}/>;
}
function KV({k, v, mono}){
  return (
    <div style={{display:"flex",justifyContent:"space-between",
                  alignItems:"center",fontSize:11,padding:"2px 0"}}>
      <span style={{color:"var(--txt2)"}}>{k}</span>
      <span className={mono?"mono":""} style={{fontWeight:700,color:"var(--txt)"}}>
        {v}
      </span>
    </div>
  );
}

window.WeatherView = WeatherView;
