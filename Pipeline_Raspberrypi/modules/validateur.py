# modules/validateur.py
# Validation LEGERE des capteurs — SANS modification des valeurs.
# Rôle : détecter et signaler les anomalies capteurs uniquement.
# Les valeurs ne sont JAMAIS modifiées — elles viennent de SQL Server telles quelles.

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.config import PLAGES, SQL_TO_INT


class ValidateurCapteurs:

    def __init__(self, buffer):
        self.buffer = buffer
        self.stuck  = {}
        self.stats  = {
            c: {'hors_plage': 0, 'stuck': 0, 'null': 0}
            for c in PLAGES
        }

    def valider(self, mesure: dict):
        """
        Parcourt la mesure, détecte les anomalies et les signale.
        Les valeurs ne sont PAS modifiées — SQL Server fait foi.
        Retourne (mesure_originale, liste_alertes).
        """
        alertes = []
        m = dict(mesure)   # copie sans modification

        for cap_sql, cap_int in SQL_TO_INT.items():
            if cap_sql not in PLAGES:
                continue

            val = m.get(cap_int)
            pmin, pmax = PLAGES[cap_sql]

            # ── NULL ──────────────────────────────────────────
            if val is None:
                self.stats[cap_sql]['null'] += 1
                alertes.append({
                    'type': 'NULL',
                    'capteur': cap_int,
                    'valeur': None,
                    'info': 'Capteur deconnecte ou valeur manquante'
                })
                continue

            # ── HORS PLAGE (information uniquement) ───────────
            if val < pmin or val > pmax:
                self.stats[cap_sql]['hors_plage'] += 1
                alertes.append({
                    'type': 'HORS_PLAGE',
                    'capteur': cap_int,
                    'valeur': round(val, 2),
                    'info': f'Plage valide : [{pmin}, {pmax}]'
                })
                continue

            # ── STUCK (capteur bloqué — information uniquement) ─
            prev_val, count = self.stuck.get(cap_sql, (None, 0))
            if prev_val is not None and abs(float(val) - float(prev_val)) < 0.001:
                count += 1
                self.stuck[cap_sql] = (val, count)
                if count >= 5:
                    self.stats[cap_sql]['stuck'] += 1
                    alertes.append({
                        'type': 'STUCK',
                        'capteur': cap_int,
                        'valeur': round(val, 2),
                        'info': f'Meme valeur repetee {count} fois'
                    })
            else:
                self.stuck[cap_sql] = (val, 1)

        return m, alertes   # m non modifié

    def rapport_sante(self) -> dict:
        return {cap: dict(s) for cap, s in self.stats.items()
                if any(s.values())}
