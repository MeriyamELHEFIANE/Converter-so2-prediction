// ─────────────────────────────────────────────────────────────
// Constantes, configuration, et simulateur de données
// ─────────────────────────────────────────────────────────────

const ALARM = 1960;
const PREALARM = 1700;
const URGENCE = 2200;
const HORIZON = 12;

const MASSES = {
  "Masse 1": {
    cap_e:["13TE031B","13TE021B"], cap_s:["13TE032B","13TE022B"],
    Te_nom:425, Ts_nom:600, dT_nom:175, tol:10, dtb:30, dth:25, conv:60,
    ctrl:"Échangeur inter-lits",
    act_c:"Augmenter vapeur échangeur → refroidir vers 425°C",
    act_f:"Réduire vapeur échangeur → réchauffer vers 425°C",
  },
  "Masse 2": {
    cap_e:["13TE033B","13TE023B"], cap_s:["13TE034B","13TE024B"],
    Te_nom:445, Ts_nom:520, dT_nom:75,  tol:10, dtb:20, dth:20, conv:20,
    ctrl:"Échangeur inter-lits",
    act_c:"Augmenter vapeur échangeur → refroidir vers 445°C",
    act_f:"Réduire vapeur échangeur → réchauffer vers 445°C",
  },
  "Masse 3": {
    cap_e:["13TE035B","13TE025B"], cap_s:["13TE036B","13TE026B"],
    Te_nom:445, Ts_nom:470, dT_nom:25,  tol:10, dtb:12, dth:12, conv:12,
    ctrl:"Vanne bypass",
    act_c:"Fermer vanne bypass → refroidir vers 445°C",
    act_f:"Ouvrir vanne bypass → réchauffer vers 445°C",
  },
  "Masse 4": {
    cap_e:["13TE037B","13TE027B"], cap_s:["13TE038B","13TE028B"],
    Te_nom:445, Ts_nom:437, dT_nom:7,   tol:10, dtb:7,  dth:8,  conv:5,
    ctrl:"Vanne bypass",
    act_c:"Fermer vanne bypass → refroidir vers 445°C",
    act_f:"Ouvrir vanne bypass → réchauffer vers 445°C",
  },
};

const ROWS = [
  // [gauche,       droite,      masse]
  ["13TE031B","13TE021B",0],   // entrées masse 1  (031 gauche, 021 droite)
  ["13TE032B","13TE022B",0],   // sorties masse 1  (032 gauche, 022 droite)
  ["13TE033B","13TE023B",1],   // entrées masse 2
  ["13TE034B","13TE024B",1],   // sorties masse 2
  ["13TE035B","13TE025B",2],   // entrées masse 3
  ["13TE036B","13TE026B",2],   // sorties masse 3
  ["13TE037B","13TE027B",3],   // entrées masse 4
  ["13TE038B","13TE028B",3],   // sorties masse 4
];

const DEFAULT_VALS = {
  "13TE021B":441.8, "13TE031B":441.2,
  "13TE022B":619.7, "13TE032B":618.2,
  "13TE023B":449.1, "13TE033B":448.8,
  "13TE024B":541.4, "13TE034B":538.0,
  "13TE025B":446.3, "13TE035B":445.9,
  "13TE026B":440.9, "13TE036B":442.3,
  "13TE037B":441.0, "13TE027B":421.0,
  "13TE038B":430.2, "13TE028B":431.9,
  "SO2":2084, "SO2_pred":1920,
  "Vapeur":76.5, "debit_soufre":20.9,
};

// Scénarios pré-définis (comme le combobox Python)
const SCENARIOS = {
  "Normal (<1700)": {
    SO2: 1540, SO2_pred: 1605, Vapeur: 78.2, debit_soufre: 19.8,
    temps: {
      "13TE021B":425.2, "13TE031B":424.8, "13TE022B":598.5, "13TE032B":599.1,
      "13TE023B":444.7, "13TE033B":445.3, "13TE024B":519.2, "13TE034B":518.8,
      "13TE025B":444.9, "13TE035B":445.1, "13TE026B":468.8, "13TE036B":469.2,
      "13TE037B":446.3, "13TE027B":445.8, "13TE038B":452.9, "13TE028B":453.1,
    }
  },
  "Pré-alarme (1700-1960)": {
    SO2: 1820, SO2_pred: 1845, Vapeur: 75.1, debit_soufre: 20.6,
    temps: {
      "13TE021B":438.5, "13TE031B":437.9, "13TE022B":612.4, "13TE032B":611.8,
      "13TE023B":447.2, "13TE033B":446.8, "13TE024B":528.6, "13TE034B":527.9,
      "13TE025B":445.8, "13TE035B":446.1, "13TE026B":472.5, "13TE036B":473.1,
      "13TE037B":445.9, "13TE027B":444.3, "13TE038B":454.2, "13TE028B":455.0,
    }
  },
  "Alarme (1960-2200)": {
    SO2: 2084, SO2_pred: 2078, Vapeur: 71.5, debit_soufre: 21.4,
    temps: {
      "13TE021B":451.8, "13TE031B":452.2, "13TE022B":619.7, "13TE032B":618.2,
      "13TE023B":449.1, "13TE033B":448.8, "13TE024B":541.4, "13TE034B":538.0,
      "13TE025B":446.3, "13TE035B":445.9, "13TE026B":478.9, "13TE036B":479.3,
      "13TE037B":441.0, "13TE027B":421.0, "13TE038B":460.2, "13TE028B":461.9,
    }
  },
  "Urgence (>2200)": {
    SO2: 2310, SO2_pred: 2285, Vapeur: 68.2, debit_soufre: 22.6,
    temps: {
      "13TE021B":458.4, "13TE031B":459.1, "13TE022B":625.3, "13TE032B":624.7,
      "13TE023B":462.8, "13TE033B":463.2, "13TE024B":548.6, "13TE034B":547.1,
      "13TE025B":452.7, "13TE035B":453.0, "13TE026B":485.3, "13TE036B":486.0,
      "13TE037B":438.2, "13TE027B":415.5, "13TE038B":463.7, "13TE028B":464.5,
    }
  },
};

// ── Diagnostic (port du diagnostiquer() Python) ──────────────
function diagnostiquer(nom, info, temperatures) {
  const Te = info.cap_e.map(c => temperatures[c]).filter(v => v != null);
  const Ts = info.cap_s.map(c => temperatures[c]).filter(v => v != null);
  if (!Te.length) return null;
  const T_e = Te.reduce((a,b)=>a+b,0)/Te.length;
  const T_s = Ts.length ? Ts.reduce((a,b)=>a+b,0)/Ts.length : null;
  const dT = T_s !== null ? Math.round(T_s - T_e) : null;
  const ec = T_e - info.Te_nom;
  const probs = [];
  if (ec > info.tol) {
    probs.push({type:"T_ENTREE_HAUTE", grav: ec>25?3:2,
      msg:`Te=${T_e.toFixed(1)}°C > nominale ${info.Te_nom}°C (+${ec.toFixed(0)}°C)`,
      action:info.act_c});
  } else if (ec < -info.tol) {
    probs.push({type:"T_ENTREE_BASSE", grav:2,
      msg:`Te=${T_e.toFixed(1)}°C < nominale ${info.Te_nom}°C (${ec.toFixed(0)}°C)`,
      action:info.act_f});
  }
  if (dT !== null) {
    const ed = dT - info.dT_nom;
    if (dT < info.dT_nom - info.dtb) {
      probs.push({type:"DT_FAIBLE", grav:2,
        msg:`ΔT=${dT}°C < nominal ${info.dT_nom}°C (${ed.toFixed(0)}°C)`,
        action:"Vérifier catalyseur — encrassement"});
    } else if (dT > info.dT_nom + info.dth) {
      probs.push({type:"DT_ELEVE", grav:1,
        msg:`ΔT=${dT}°C > nominal ${info.dT_nom}°C (+${ed.toFixed(0)}°C)`,
        action:"Symptôme cascade — corriger masse amont"});
    }
  }
  return {nom, Te:T_e, Ts:T_s, dT, probs,
    grav: probs.length ? Math.max(...probs.map(p=>p.grav)) : 0,
    Te_nom:info.Te_nom, dT_nom:info.dT_nom};
}

function fmtTime(d){
  const p = n => String(n).padStart(2,'0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function fmtTimeShort(d){
  const p = n => String(n).padStart(2,'0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Liste de tous les capteurs T (ordre logique : par masse, Te puis Ts)
const ALL_TE_SENSORS = [
  "13TE021B","13TE031B","13TE022B","13TE032B",
  "13TE023B","13TE033B","13TE024B","13TE034B",
  "13TE025B","13TE035B","13TE026B","13TE036B",
  "13TE037B","13TE027B","13TE038B","13TE028B",
];

// ── Génération de l'historique courbes (200 points) ──────────
function genHistoryPoints(){
  const out = [];
  const now = Date.now();
  let so2 = 1800;
  for (let i = 199; i >= 0; i--) {
    so2 += (Math.random() - 0.48) * 35;
    so2 = Math.max(1200, Math.min(2350, so2));
    const t = new Date(now - i*5*60*1000);
    const pred = so2 + (Math.random()-0.5)*60;
    const vap = 76 + Math.sin(i/15)*4 + (Math.random()-0.5)*1.5;
    const deb = 20.5 + Math.cos(i/12)*1.2 + (Math.random()-0.5)*0.6;
    // Températures : on bruite autour des valeurs par défaut (drift en fct du SO2)
    const drift = (so2 - 1800) * 0.04;
    const temps = {};
    ALL_TE_SENSORS.forEach(k => {
      temps[k] = DEFAULT_VALS[k] + (Math.random()-0.5)*6 + drift*0.6;
    });
    out.push({
      t, so2, so2p:pred, vap, deb,
      tcsg_m1:425, tcsg_m2:445, tcsg_m3:445, tcsg_m4:445,
      treal_m1:425 + (Math.random()-0.5)*15 + (so2>2000?10:0),
      dt_m1:175 + (Math.random()-0.5)*20,
      dt_m2:75 + (Math.random()-0.5)*10,
      dt_m3:25 + (Math.random()-0.5)*6,
      dt_m4:7 + (Math.random()-0.5)*3,
      temps,
    });
  }
  return out;
}

Object.assign(window, {
  ALARM, PREALARM, URGENCE, HORIZON,
  MASSES, ROWS, DEFAULT_VALS, SCENARIOS, ALL_TE_SENSORS,
  diagnostiquer, fmtTime, fmtTimeShort, genHistoryPoints
});
