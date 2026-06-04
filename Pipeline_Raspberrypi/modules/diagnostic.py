# modules/diagnostic.py
import numpy as np, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.config import MASSES, PREALARM

class Diagnostic:
    def analyser(self, mesure, so2_pred):
        if so2_pred is None or so2_pred < PREALARM: return None
        temps = {k:v for k,v in mesure.items() if k.startswith('13TE') and v is not None}
        details = {}
        for nom, info in MASSES.items():
            d = self._masse(nom, info, temps)
            if d: details[nom] = d
        causes   = {n:d for n,d in details.items() if d['gravite']>=2}
        symptomes= {n:d for n,d in details.items() if d['gravite']==1}
        if causes:
            m = max(causes, key=lambda n: causes[n]['gravite'])
            p = causes[m]['problemes'][0]
            resume = {'statut':'ANOMALIE','cause_racine':m,'type_anomalie':p['type'],
                      'message':p['message'],'organe':p['organe'],'action':p['action'],
                      'urgent':p['urgent'],'autres_causes':[n for n in causes if n!=m],
                      'symptomes':list(symptomes.keys())}
        else:
            resume = {'statut':'TEMPERATURES_OK','cause_racine':None,'type_anomalie':None,
                      'message':'Temperatures dans les plages nominales','organe':None,
                      'action':'Verifier catalyseur V2O5','urgent':False,
                      'autres_causes':[],'symptomes':list(symptomes.keys())}
        return {'resume':resume,'details':details}

    def _masse(self, nom, info, temps):
        Te_v = [temps.get(c) for c in info['cap_e'] if temps.get(c) is not None]
        Ts_v = [temps.get(c) for c in info['cap_s'] if temps.get(c) is not None]
        if not Te_v: return None
        Te = float(np.mean(Te_v)); Ts = float(np.mean(Ts_v)) if Ts_v else None
        dT = round(Ts-Te,1) if Ts is not None else None
        ec = round(Te-info['Te_nom'],1)
        probs = []
        if ec > info['tol']:
            probs.append({'type':'T_ENTREE_HAUTE','gravite':3 if ec>25 else 2,
                'message':f'Te={Te:.1f}C > nominale {info["Te_nom"]}C (+{ec:.1f}C)',
                'organe':info['ctrl'],'action':info['act_c'],'urgent':ec>25})
        elif ec < -info['tol']:
            probs.append({'type':'T_ENTREE_BASSE','gravite':2,
                'message':f'Te={Te:.1f}C < nominale {info["Te_nom"]}C ({ec:.1f}C)',
                'organe':info['ctrl'],'action':info['act_f'],'urgent':False})
        if dT is not None:
            ed = round(dT-info['dT_nom'],1)
            if dT < info['dT_nom']-info['dtb']:
                probs.append({'type':'DT_FAIBLE','gravite':2,
                    'message':f'DeltaT={dT:.1f}C < nominal {info["dT_nom"]}C ({ed:.1f}C)',
                    'organe':'Catalyseur V2O5',
                    'action':'Planifier inspection catalyseur V2O5','urgent':False})
            elif dT > info['dT_nom']+info['dth']:
                probs.append({'type':'DT_ELEVE','gravite':1,
                    'message':f'DeltaT={dT:.1f}C > nominal {info["dT_nom"]}C (+{ed:.1f}C)',
                    'organe':'Masse amont',
                    'action':'Symptome cascade — NE PAS agir ici. Corriger la masse amont.',
                    'urgent':False})
        return {'nom':nom,'Te':round(Te,1),'Ts':round(Ts,1) if Ts else None,'dT':dT,
                'Te_nom':info['Te_nom'],'dT_nom':info['dT_nom'],'problemes':probs,
                'gravite':max([p['gravite'] for p in probs],default=0)}
