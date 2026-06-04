# modules/lecteur_sql.py
# Lit les données depuis SQL Server :
#   - Au démarrage : charge les 13 dernières mesures pour remplir le buffer
#   - En continu   : lit la dernière mesure toutes les 5 minutes

import pymssql, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.config import (SQL_SERVER, SQL_DATABASE, SQL_USERNAME,
                            SQL_PASSWORD, SQL_TABLE, SQL_TO_INT, MIN_BUFFER)


class LecteurSQL:

    def __init__(self):
        self.conn = None
        self._connecter()

    def _connecter(self):
        self.conn = pymssql.connect(
            server=SQL_SERVER, user=SQL_USERNAME,
            password=SQL_PASSWORD, database=SQL_DATABASE, timeout=10)
        print('  [SQL] Connecte a SQL Server')

    # ── Démarrage : charge les N dernières mesures ─────────────
    def charger_historique(self, n=None):
        """
        Charge les N dernières mesures pour pré-remplir le buffer.
        Par défaut N = MIN_BUFFER (13 pts = 1h05).
        Retourne une liste de dicts ordonnée du plus ancien au plus récent.
        """
        if n is None:
            n = MIN_BUFFER

        try:
            cur = self.conn.cursor(as_dict=True)
            # Prendre les N dernières (DESC) puis inverser (ASC) pour l'ordre chronologique
            cur.execute(f"""
                SELECT * FROM (
                    SELECT TOP {n} * FROM {SQL_TABLE}
                    ORDER BY timestamp DESC
                ) sub
                ORDER BY timestamp ASC
            """)
            rows = cur.fetchall()
            if not rows:
                print(f'  [SQL] Aucun historique disponible')
                return []

            mesures = []
            for row in rows:
                m = {'timestamp': row['timestamp']}
                for col_sql, col_int in SQL_TO_INT.items():
                    m[col_int] = row.get(col_sql)
                mesures.append(m)

            print(f'  [SQL] Historique charge : {len(mesures)} mesures '
                  f'({mesures[0]["timestamp"]} → {mesures[-1]["timestamp"]})')
            return mesures

        except Exception as e:
            print(f'  [SQL] Erreur chargement historique : {e}')
            try: self._connecter()
            except: pass
            return []

    # ── Cycle normal : lit la dernière mesure ──────────────────
    def lire_derniere_mesure(self):
        """
        Lit uniquement la ligne la plus récente (TOP 1).
        Appelée toutes les 5 minutes par la boucle principale.
        """
        try:
            cur = self.conn.cursor(as_dict=True)
            cur.execute(f'SELECT TOP 1 * FROM {SQL_TABLE} ORDER BY timestamp DESC')
            row = cur.fetchone()
            if not row:
                return None
            mesure = {'timestamp': row['timestamp']}
            for col_sql, col_int in SQL_TO_INT.items():
                mesure[col_int] = row.get(col_sql)
            return mesure

        except Exception as e:
            print(f'  [SQL] Erreur lecture : {e}')
            try: self._connecter()
            except: pass
            return None

    def fermer(self):
        if self.conn:
            self.conn.close()
