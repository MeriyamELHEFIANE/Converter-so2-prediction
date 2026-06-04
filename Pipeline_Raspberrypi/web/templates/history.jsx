// ─────────────────────────────────────────────────────────────
// HISTORIQUE — Tableau capteurs individuels par masse
// ─────────────────────────────────────────────────────────────

// Disposition des capteurs par masse (entrée puis sortie)
const SENSOR_LAYOUT = [
  {mass:"Masse 1", Te_nom:425, entree:["13TE021B","13TE031B"], sortie:["13TE022B","13TE032B"]},
  {mass:"Masse 2", Te_nom:445, entree:["13TE023B","13TE033B"], sortie:["13TE024B","13TE034B"]},
  {mass:"Masse 3", Te_nom:445, entree:["13TE025B","13TE035B"], sortie:["13TE026B","13TE036B"]},
  {mass:"Masse 4", Te_nom:445, entree:["13TE027B","13TE037B"], sortie:["13TE028B","13TE038B"]},
];

const MASS_COLORS = ["#C0392B","#2471A3","#1D9E75","#7D3C98"];

function HistoryView({rows, onExport}){
  return (
    <div style={{padding:12,display:"flex",flexDirection:"column",height:"100%",background:"var(--win)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                    background:"var(--gray-h)",padding:"8px 12px",borderRadius:"6px 6px 0 0",
                    border:"1px solid var(--border)",borderBottom:"none"}}>
        <div style={{fontSize:13,color:"var(--txt2)",fontWeight:600}}>
          Historique des températures (16 capteurs) et SO₂ · <span className="mono">{rows.length}</span> enregistrement(s)
        </div>
        <button onClick={onExport}
          style={{background:"var(--green)",color:"#fff",border:"none",padding:"6px 14px",
                  borderRadius:4,fontSize:12,fontWeight:600,cursor:"pointer"}}>
          Exporter CSV
        </button>
      </div>

      <div style={{flex:1,overflow:"auto",border:"1px solid var(--border)",background:"var(--panel)"}}>
        <table style={{borderCollapse:"collapse",fontSize:10,fontFamily:"JetBrains Mono",minWidth:"100%"}}>
          <thead style={{position:"sticky",top:0,zIndex:2}}>
            {/* Ligne 1 : groupes (SO2, Masse 1..4) */}
            <tr style={{background:"var(--gray-h)",color:"var(--txt)",textAlign:"center"}}>
              <th rowSpan="3" style={{...th, position:"sticky", left:0, zIndex:3, background:"var(--gray-h)", minWidth:140}}>
                Horodatage
              </th>
              <th colSpan="2" style={{...thGroup, background:"#0F6E5615", color:"var(--green-d)"}}>SO₂ (mg/Nm³)</th>
              {SENSOR_LAYOUT.map((m,i)=>(
                <th key={m.mass} colSpan="4"
                    style={{...thGroup, background:MASS_COLORS[i]+"22", color:MASS_COLORS[i],
                            borderLeft:`2px solid ${MASS_COLORS[i]}66`}}>
                  {m.mass}  <span style={{fontWeight:500,opacity:0.75}}>· consigne {m.Te_nom}°C</span>
                </th>
              ))}
            </tr>
            {/* Ligne 2 : sous-groupes Entrée/Sortie */}
            <tr style={{background:"var(--gray-h)",color:"var(--txt2)",textAlign:"center"}}>
              <th colSpan="2" style={thSubgroup}>{/* SO2 */}</th>
              {SENSOR_LAYOUT.map((m,i)=>(
                <React.Fragment key={m.mass}>
                  <th colSpan="2" style={{...thSubgroup, borderLeft:`2px solid ${MASS_COLORS[i]}66`,
                       background:"#FFF0E0", color:"#8B4513"}}>ENTRÉE</th>
                  <th colSpan="2" style={{...thSubgroup, background:"#E8F1F8", color:"var(--blue)"}}>SORTIE</th>
                </React.Fragment>
              ))}
            </tr>
            {/* Ligne 3 : noms capteurs */}
            <tr style={{background:"var(--gray-h)",color:"var(--txt2)",textAlign:"center",fontWeight:600}}>
              <th style={thSmall}>Actuel</th>
              <th style={thSmall}>Prédit</th>
              {SENSOR_LAYOUT.map((m,i)=>(
                <React.Fragment key={m.mass}>
                  {m.entree.map((s,j)=>(
                    <th key={s} style={{...thSmall, fontSize:9,
                      borderLeft: j===0 ? `2px solid ${MASS_COLORS[i]}66` : "1px solid var(--border)"}}>{s}</th>
                  ))}
                  {m.sortie.map(s => <th key={s} style={{...thSmall, fontSize:9}}>{s}</th>)}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={2+SENSOR_LAYOUT.length*4+1} style={{padding:30,textAlign:"center",color:"var(--txt3)"}}>
                Aucun enregistrement — l'acquisition temps réel va peupler le tableau.
              </td></tr>
            ) : rows.map((r,i)=>(
              <tr key={i} style={{background: i%2?"var(--panel2)":"var(--panel)"}}>
                <td style={{...tdTime, position:"sticky", left:0, zIndex:1,
                             background: i%2?"var(--panel2)":"var(--panel)"}}>
                  {r.ts}
                </td>
                <td style={{...td, color: r.so2 >= ALARM ? "var(--red)" : r.so2 >= PREALARM ? "var(--orange)" : "var(--green-d)", fontWeight:700}}>
                  {Math.round(r.so2)}
                </td>
                <td style={{...td, color: r.so2p >= ALARM ? "var(--red)" : r.so2p >= PREALARM ? "var(--orange)" : "var(--green-d)", fontWeight:700}}>
                  {Math.round(r.so2p)}
                </td>
                {SENSOR_LAYOUT.map((m,mi)=>{
                  const Te_nom = m.Te_nom;
                  return (
                    <React.Fragment key={mi}>
                      {m.entree.map((s,j)=>{
                        const v = r.temps?.[s];
                        const ec = v != null ? v - Te_nom : null;
                        const color = ec == null ? "var(--txt3)"
                          : Math.abs(ec) > 25 ? "var(--red)"
                          : Math.abs(ec) > 10 ? "var(--orange)" : "var(--txt)";
                        return (
                          <td key={s} style={{...td, color, fontWeight: Math.abs(ec||0)>10?700:400,
                            borderLeft: j===0 ? `2px solid ${MASS_COLORS[mi]}66` : "1px solid #ECEFF1"}}>
                            {v != null ? v.toFixed(1) : "—"}
                          </td>
                        );
                      })}
                      {m.sortie.map(s => {
                        const v = r.temps?.[s];
                        return (
                          <td key={s} style={{...td, color:"var(--txt2)"}}>
                            {v != null ? v.toFixed(1) : "—"}
                          </td>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Légende */}
      <div style={{padding:"6px 12px",background:"var(--gray-h)",border:"1px solid var(--border)",borderTop:"none",
                    borderRadius:"0 0 6px 6px",display:"flex",gap:14,fontSize:10,color:"var(--txt2)"}}>
        <span><b style={{color:"var(--txt)"}}>Code couleur Entrée :</b> écart vs consigne</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:10,height:10,background:"var(--orange)",borderRadius:2}}/>±10 à ±25 °C
        </span>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:10,height:10,background:"var(--red)",borderRadius:2}}/>{">"} ±25 °C
        </span>
      </div>
    </div>
  );
}

const th = {padding:"8px 6px",fontSize:11,fontWeight:700,borderBottom:"1px solid var(--border)",borderRight:"1px solid var(--border)"};
const thGroup = {...th, background:"#D6DBE0", borderBottom:"1px solid var(--border)"};
const thSubgroup = {padding:"4px 4px",fontSize:9,fontWeight:700,letterSpacing:0.3,
  borderBottom:"1px solid var(--border)",borderRight:"1px solid var(--border)"};
const thSmall = {padding:"5px 4px",fontSize:10,fontWeight:600,
  borderBottom:"1px solid var(--border)",borderRight:"1px solid var(--border)"};
const td = {padding:"5px 6px",textAlign:"center",borderBottom:"1px solid var(--border)",
  borderRight:"1px solid #ECEFF1",color:"var(--txt2)"};
const tdTime = {...td, textAlign:"left", paddingLeft:10, color:"var(--txt)", fontWeight:500,
  borderRight:"1px solid var(--border)"};

window.HistoryView = HistoryView;
