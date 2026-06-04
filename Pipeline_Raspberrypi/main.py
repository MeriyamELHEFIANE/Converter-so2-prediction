# main.py — Point d'entrée du pipeline Raspberry Pi
# Lancement : cd convertisseur && python main.py
# Dashboard : http://<IP_RPI>:5000

import time, csv, os, sys
from collections import deque
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.config       import INTERVALLE, BUFFER_SIZE, MIN_BUFFER, LOG_FILE, ALARM, PREALARM, URGENCE
from modules.lecteur_sql import LecteurSQL
from modules.lecteur_meteo import LecteurMeteo
from modules.validateur  import ValidateurCapteurs
from modules.predicteur  import Predicteur
from modules.diagnostic  import Diagnostic
from web.app             import demarrer as demarrer_web, mettre_a_jour, mettre_a_jour_meteo

buffer = deque(maxlen=BUFFER_SIZE)

def init_log():
    os.makedirs('logs', exist_ok=True)
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, 'w', newline='') as f:
            csv.writer(f).writerow(['cycle','timestamp','SO2_actuel','SO2_pred',
                                    'zone','diag_statut','cause_racine',
                                    'type_anomalie','action','nb_alertes'])

def ecrire_log(cycle, mesure, so2_pred, zone, diag, nb_alertes):
    r = (diag or {}).get('resume', {})
    with open(LOG_FILE, 'a', newline='') as f:
        csv.writer(f).writerow([cycle,
            str(mesure.get('timestamp',''))[:19],
            round(mesure.get('SO2',0) or 0, 1),
            so2_pred or '', zone,
            r.get('statut',''), r.get('cause_racine',''),
            r.get('type_anomalie',''), r.get('action',''), nb_alertes])

COL = {'URGENCE':'\033[91m','ALARME':'\033[93m','PRE-ALARME':'\033[33m',
       'NORMAL':'\033[92m','ATTENTE':'\033[90m','R':'\033[0m','B':'\033[1m'}

def afficher(cycle, mesure, alertes, so2_pred, zone, diag):
    col=COL.get(zone,COL['R']); rst=COL['R']; bd=COL['B']
    so2=mesure.get('SO2') or 0
    ts=str(mesure.get('timestamp',''))[:19]
    print(f"\n{'='*62}")
    print(f"  {bd}Cycle #{cycle:04d}{rst}  |  {ts}  |  Buffer {len(buffer)}/{BUFFER_SIZE}")
    print(f"{'='*62}")
    print(f"  SO2 actuel : {so2:>8.1f} mg/Nm3")
    if so2_pred is not None:
        bw=int(min(so2_pred,URGENCE*1.1)/(URGENCE*1.1)*36)
        print(f"  SO2 predit : {col}{bd}{so2_pred:>8.1f} mg/Nm3  [{zone}]{rst}")
        print(f"  {'#'*bw}{'.'*(36-bw)}")
    else:
        print(f"  SO2 predit : {COL['ATTENTE']}--- buffer {len(buffer)}/{MIN_BUFFER}{rst}")
    for nm,(e,s,n) in [('M1',('13TE021B','13TE022B',425)),('M2',('13TE023B','13TE024B',445)),
                        ('M3',('13TE025B','13TE026B',445)),('M4',('13TE027B','13TE028B',445))]:
        Te=mesure.get(e); Ts=mesure.get(s)
        if Te and Ts:
            ec=Te-n; cc=COL['ALARME'] if abs(ec)>10 else COL['NORMAL']
            print(f"  {nm}  Te={cc}{Te:>7.1f}°C{rst}  Ts={Ts:>7.1f}°C  dT={Ts-Te:>+6.1f}°C")
    if alertes:
        print(f"  {'─'*60}")
        for a in alertes[:3]:
            print(f"  ! {a['type']:<12} {a['capteur']}  {a.get('valeur','?')} → {a.get('correction','?')}")
    if diag:
        r=diag['resume']; print(f"  {'─'*60}")
        if r['statut']=='ANOMALIE':
            urg=' [URGENT]' if r['urgent'] else ''
            print(f"  {col}{bd}{r['cause_racine']} — {r['type_anomalie']}{urg}{rst}")
            print(f"  Action : {r['action']}")
        else:
            print(f"  {COL['NORMAL']}Temperatures OK{rst}")
    print(f"  Prochaine analyse dans {INTERVALLE//60} min")

def main():
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║   PIPELINE RASPBERRY PI — Convertisseur 13BC01 — OCP Safi   ║")
    print("║   PFE EL HEFIANE Meriyam                                    ║")
    print("╚══════════════════════════════════════════════════════════════╝\n")
    init_log()
    lecteur    = LecteurSQL()
    lecteur_m  = LecteurMeteo()
    validateur = ValidateurCapteurs(buffer)
    predicteur = Predicteur()
    diagnostic = Diagnostic()
    demarrer_web()

    # ── Pré-remplissage du buffer au démarrage ─────────────────
    print(f'\n  Chargement des {MIN_BUFFER} dernieres mesures SQL...')
    historique = lecteur.charger_historique(n=MIN_BUFFER)
    if historique:
        for m in historique:
            m_ok, _ = validateur.valider(m)
            buffer.append(m_ok)
        print(f'  Buffer pre-rempli : {len(buffer)} mesures')
        print(f'  → Premiere prediction disponible immediatement')
    else:
        print(f'  Aucun historique — attente de {MIN_BUFFER} mesures en temps reel')

    cycle = 0
    print(f"\n  Pipeline demarre — dashboard : http://0.0.0.0:5000\n")
    while True:
        t0 = time.time(); cycle += 1
        mesure = lecteur.lire_derniere_mesure()
        if mesure is None:
            print('  [WARN] Aucune donnee SQL — attente 30s')
            time.sleep(30); continue
        mesure_ok, alertes = validateur.valider(mesure)
        buffer.append(mesure_ok)
        so2_pred = predicteur.predire(buffer)
        zone     = predicteur.zone(so2_pred)
        diag     = diagnostic.analyser(mesure_ok, so2_pred)
        afficher(cycle, mesure_ok, alertes, so2_pred, zone, diag)
        temperatures = {k:round(v,2) for k,v in mesure_ok.items()
                        if k.startswith('13TE') and v is not None}
        mettre_a_jour(
            so2_actuel=mesure_ok.get('SO2'), so2_pred=so2_pred,
            zone=zone, timestamp=mesure_ok.get('timestamp'),
            temperatures=temperatures,
            debit_soufre=mesure_ok.get('debit_soufre'),
            vapeur=mesure_ok.get('Vapeur'),
            diagnostic=diag, alertes_capteurs=alertes,
            sante_capteurs=validateur.rapport_sante(),
            buf_size=len(buffer))
        try:
            mettre_a_jour_meteo(lecteur_m.lire_derniere(), lecteur_m.lire_historique(50))
        except Exception as _e:
            pass
        ecrire_log(cycle, mesure_ok, so2_pred, zone, diag, len(alertes))
        time.sleep(max(0, INTERVALLE - (time.time()-t0)))

if __name__ == '__main__':
    try: main()
    except KeyboardInterrupt: print('\n\n  Pipeline arrete.\n')
