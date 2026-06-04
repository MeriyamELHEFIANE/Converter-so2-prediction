// ─────────────────────────────────────────────────────────────
// ALARMES — Historique avec acquittement
// ─────────────────────────────────────────────────────────────

function AlarmsView({alarmes, onClear, onAcq, onAcqAll}){
  const actives = alarmes.filter(a => !a.acq);
  return (
    <div style={{padding:12,display:"flex",flexDirection:"column",height:"100%",background:"var(--win)",gap:8}}>
      {/* Bandeau récap */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
        <Stat label="Alarmes actives" value={actives.length} color="var(--red)" bg="var(--red-l)"/>
        <Stat label="Acquittées" value={alarmes.filter(a=>a.acq).length} color="var(--green-d)" bg="var(--green-l)"/>
        <Stat label="Pré-alarmes" value={alarmes.filter(a=>a.type.includes("PRE")).length} color="var(--orange)" bg="var(--orange-l)"/>
        <Stat label="Total enregistrées" value={alarmes.length} color="var(--blue)" bg="var(--blue-l)"/>
      </div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                    background:"var(--gray-h)",padding:"8px 12px",border:"1px solid var(--border)",borderRadius:6}}>
        <div style={{fontSize:13,color:"var(--txt2)",fontWeight:600}}>
          Historique des alarmes  ·  <span className="mono">{alarmes.length}</span> enregistrée(s)
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={onAcqAll}
            style={{background:"var(--orange)",color:"#fff",border:"none",padding:"6px 14px",
                    borderRadius:4,fontSize:12,fontWeight:600,cursor:"pointer"}}>
            Acquitter tout
          </button>
          <button onClick={onClear}
            style={{background:"var(--red)",color:"#fff",border:"none",padding:"6px 14px",
                    borderRadius:4,fontSize:12,fontWeight:600,cursor:"pointer"}}>
            Effacer historique
          </button>
        </div>
      </div>

      <div style={{flex:1,overflow:"auto",border:"1px solid var(--border)",background:"var(--panel)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead style={{position:"sticky",top:0}}>
            <tr style={{background:"var(--gray-h)",color:"var(--txt)",textAlign:"left"}}>
              <th style={tha}>#</th>
              <th style={tha}>Horodatage</th>
              <th style={{...tha, width:"40%"}}>Message</th>
              <th style={tha}>Source</th>
              <th style={tha}>Type</th>
              <th style={tha}>Sévérité</th>
              <th style={{...tha,textAlign:"center"}}>État</th>
              <th style={{...tha,textAlign:"center"}}>Action</th>
            </tr>
          </thead>
          <tbody>
            {alarmes.length === 0 ? (
              <tr><td colSpan="8" style={{padding:40,textAlign:"center",color:"var(--txt3)"}}>
                Aucune alarme enregistrée.
              </td></tr>
            ) : [...alarmes].reverse().map((a,i)=>{
              const isPre = a.type.includes("PRE") || a.type==="DT_ELEVE";
              const isUrg = a.severite === 3;
              const bg = a.acq ? "var(--green-l)" : isPre ? "var(--orange-l)" : "var(--red-l)";
              const fg = a.acq ? "var(--green-d)" : isPre ? "var(--amber)" : "var(--red)";
              return (
                <tr key={a.id} style={{background:bg,borderBottom:"1px solid var(--border)"}}>
                  <td style={{...tda,color:fg,fontFamily:"JetBrains Mono",fontWeight:700}}>#{a.id}</td>
                  <td style={{...tda,fontFamily:"JetBrains Mono"}}>{a.ts}</td>
                  <td style={{...tda,color:fg,fontWeight:500}}>{a.msg}</td>
                  <td style={{...tda,fontWeight:600}}>{a.masse}</td>
                  <td style={{...tda,fontFamily:"JetBrains Mono",fontSize:11,color:"var(--txt2)"}}>{a.type}</td>
                  <td style={{...tda}}>
                    <SeverityBadge sev={a.severite || (isPre?1:2)}/>
                  </td>
                  <td style={{...tda,textAlign:"center"}}>
                    <span style={{
                      display:"inline-block",padding:"2px 10px",borderRadius:10,fontSize:11,fontWeight:700,
                      background:a.acq?"var(--green)":"var(--red)",color:"#fff"
                    }}>{a.acq?"ACQ":"ACTIVE"}</span>
                  </td>
                  <td style={{...tda,textAlign:"center"}}>
                    {!a.acq && (
                      <button onClick={()=>onAcq(a.id)} style={{
                        background:"var(--green)",color:"#fff",border:"none",padding:"4px 10px",
                        borderRadius:3,fontSize:11,fontWeight:600,cursor:"pointer"
                      }}>Acquitter</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({label,value,color,bg}){
  return (
    <div style={{background:bg,border:`1px solid ${color}33`,borderLeft:`3px solid ${color}`,borderRadius:6,padding:"10px 14px"}}>
      <div style={{fontSize:11,color:"var(--txt2)",textTransform:"uppercase",letterSpacing:0.5,fontWeight:600}}>{label}</div>
      <div style={{fontSize:26,fontWeight:800,color,fontFamily:"JetBrains Mono",lineHeight:1.1}}>{value}</div>
    </div>
  );
}

function SeverityBadge({sev}){
  const opts = {
    3:{label:"Critique",bg:"#7A1414",fg:"#fff"},
    2:{label:"Élevée",  bg:"#C0392B",fg:"#fff"},
    1:{label:"Moyenne", bg:"#D68910",fg:"#fff"},
  }[sev] || {label:"—",bg:"#CDD1D6",fg:"var(--txt2)"};
  return (
    <span style={{display:"inline-block",padding:"2px 8px",borderRadius:3,fontSize:10,fontWeight:700,
                  background:opts.bg,color:opts.fg,letterSpacing:0.4}}>{opts.label.toUpperCase()}</span>
  );
}

const tha = {padding:"10px 12px",fontWeight:700,fontSize:11,borderBottom:"1px solid var(--border)",letterSpacing:0.3,textTransform:"uppercase",color:"var(--txt)"};
const tda = {padding:"8px 12px",borderBottom:"1px solid #ECEFF1",color:"var(--txt2)"};

window.AlarmsView = AlarmsView;
