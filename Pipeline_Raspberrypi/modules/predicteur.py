# modules/predicteur.py
import json
import numpy as np
import xgboost as xgb
import pandas as pd
import pickle
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.config import (SCALER_FILE, FEATURES_FILE, ALARM, PREALARM,
                            URGENCE, MIN_BUFFER, MODEL_JSON, MODEL_PKL)


class Predicteur:

    def __init__(self):
        print('  [MODEL] Chargement du modele XGBoost...')
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        model_json    = os.path.join(base, MODEL_JSON)
        model_pkl     = os.path.join(base, MODEL_PKL)
        scaler_json   = os.path.join(base, 'model', 'scaler.json')
        features_json = os.path.join(base, 'model', 'features.json')
        scaler_pkl    = os.path.join(base, SCALER_FILE)
        features_pkl  = os.path.join(base, FEATURES_FILE)

        # ── Modèle ────────────────────────────────────────────────
        self.model = xgb.Booster()
        if os.path.exists(model_json):
            self.model.load_model(model_json)
            print(f'  [MODEL] Charge depuis model.json (universel)')
        elif os.path.exists(model_pkl):
            self.model.load_model(model_pkl)
            print(f'  [MODEL] Charge depuis model.pkl (fallback)')
        else:
            raise FileNotFoundError('Aucun modele trouve (model.json ou model.pkl)')

        # ── Scaler : JSON prioritaire (pas de dépendance sklearn) ─
        if os.path.exists(scaler_json):
            with open(scaler_json, 'r') as f:
                sd = json.load(f)
            self.mean_  = np.array(sd['mean_'])
            self.scale_ = np.array(sd['scale_'])
            self._use_json_scaler = True
            print(f'  [MODEL] Scaler charge depuis scaler.json')
        elif os.path.exists(scaler_pkl):
            with open(scaler_pkl, 'rb') as f:
                sk = pickle.load(f)
            self.mean_  = sk.mean_
            self.scale_ = sk.scale_
            self._use_json_scaler = False
            print(f'  [MODEL] Scaler charge depuis scaler.pkl')
        else:
            raise FileNotFoundError('Aucun scaler trouve (scaler.json ou scaler.pkl)')

        # ── Features ──────────────────────────────────────────────
        if os.path.exists(features_json):
            with open(features_json, 'r') as f:
                self.features = json.load(f)
            print(f'  [MODEL] Features charges depuis features.json')
        elif os.path.exists(features_pkl):
            with open(features_pkl, 'rb') as f:
                self.features = pickle.load(f)
            print(f'  [MODEL] Features charges depuis features.pkl')
        else:
            raise FileNotFoundError('Aucun fichier features trouve')

        print(f'  [MODEL] OK — {len(self.features)} features')

    def predire(self, buffer):
        """Retourne la prediction SO2 +1h ou None si buffer insuffisant."""
        if len(buffer) < MIN_BUFFER:
            return None
        try:
            feats = self._build_features(list(buffer))

            # Debug
            so2_l1  = feats['l1'].values[0]
            ial_val = feats['ial'].values[0]
            dal_val = feats['dal'].values[0]
            nan_cnt = feats.isnull().sum().sum()
            print(f'  [DEBUG] l1={so2_l1:.1f}  ial={ial_val}  '
                  f'dal={dal_val:.1f}  NaN={nan_cnt}')

            # Normalisation — sans dépendance sklearn
            X_raw    = feats[self.features].values.astype(float)
            X_scaled = (X_raw - self.mean_) / self.scale_

            pred = round(float(
                self.model.predict(xgb.DMatrix(X_scaled))[0]
            ), 1)
            print(f'  [DEBUG] Prediction brute = {pred}')
            return pred

        except Exception as e:
            print(f'  [MODEL] Erreur prediction : {e}')
            import traceback
            traceback.print_exc()
            return None

    def zone(self, so2):
        if so2 is None:     return 'ATTENTE'
        if so2 >= URGENCE:  return 'URGENCE'
        if so2 >= ALARM:    return 'ALARME'
        if so2 >= PREALARM: return 'PRE-ALARME'
        return 'NORMAL'

    def _build_features(self, buffer):
        """Construit les 33 features temporelles depuis le buffer."""
        df = pd.DataFrame(buffer)

        # Normaliser colonne vapeur
        if 'Vapeur' not in df.columns and 'vapeur' in df.columns:
            df.rename(columns={'vapeur': 'Vapeur'}, inplace=True)

        # Timestamp
        ts = 'timestamp' if 'timestamp' in df.columns else 'Date/heure'
        df[ts] = pd.to_datetime(df[ts])
        df['mois']  = df[ts].dt.month
        df['heure'] = df[ts].dt.hour

        for col in df.columns:
            if col not in (ts, 'mois', 'heure'):
                df[col] = pd.to_numeric(df[col], errors='coerce')

        t = 'SO2'

        # Lags
        for lag in [1, 2, 3, 6, 12]:
            df[f'l{lag}'] = df[t].shift(lag)

        # Rolling stats
        for w in [6, 12]:
            df[f'rm{w}'] = df[t].shift(1).rolling(w, min_periods=1).mean()
            df[f'rs{w}'] = df[t].shift(1).rolling(w, min_periods=2).std()

        # Dérivées
        df['d1'] = df[t].diff(1)
        df['d6'] = df[t].diff(6)

        # EWMA
        df['e6'] = df[t].shift(1).ewm(span=6, adjust=False).mean()

        # Contexte alarme
        df['dal']  = df[t].shift(1) - ALARM
        df['ial']  = (df[t].shift(1) >= ALARM).astype(float)
        df['acnt'] = (df[t].shift(1) >= ALARM).astype(int).rolling(
            12, min_periods=1).sum()

        # Débits
        df['vl1'] = df['Vapeur'].shift(1) if 'Vapeur' in df.columns else 0.0
        df['vl6'] = df['Vapeur'].shift(6) if 'Vapeur' in df.columns else 0.0
        df['dl1'] = df['debit_soufre'].shift(1) if 'debit_soufre' in df.columns else 0.0
        df['chB'] = (df['debit_soufre'] * df['13TE021B']
                     if ('debit_soufre' in df.columns
                         and '13TE021B' in df.columns) else 0.0)

        # ΔT masses
        for i, (a, b) in enumerate([
            ('13TE021B', '13TE022B'), ('13TE023B', '13TE024B'),
            ('13TE025B', '13TE026B'), ('13TE027B', '13TE028B')
        ]):
            df[f'dTm{i+1}'] = (df[b] - df[a]
                                if a in df.columns and b in df.columns
                                else 0.0)

        # Températures d'entrée décalées
        for cap in ['13TE021B', '13TE031B', '13TE023B', '13TE033B',
                    '13TE025B', '13TE035B', '13TE037B', '13TE027B']:
            df[f'Te_{cap[-4:]}'] = df[cap].shift(1) if cap in df.columns else 0.0

        # Saisonnalité cyclique
        df['hsin'] = np.sin(2 * np.pi * df['heure'] / 24)
        df['msin'] = np.sin(2 * np.pi * df['mois']  / 12)

        # Colonnes manquantes → 0
        for col in self.features:
            if col not in df.columns:
                print(f'  [WARN] Feature manquante : {col} → 0.0')
                df[col] = 0.0

        last = df.tail(1)[self.features].copy()

        nan_feats = last.columns[last.isnull().any()].tolist()
        if nan_feats:
            print(f'  [WARN] Features NaN avant fillna : {nan_feats}')

        return last.fillna(0)
