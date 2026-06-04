import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.config import SQL_SERVER, SQL_DATABASE, SQL_USERNAME, SQL_PASSWORD
import pymssql

class LecteurMeteo:

    def __init__(self):
        self.conn = None
        self._connecter()

    def _connecter(self):
        self.conn = pymssql.connect(
            server=SQL_SERVER, user=SQL_USERNAME,
            password=SQL_PASSWORD, database=SQL_DATABASE, timeout=10)
        print('  [METEO] Connecte a meteo_station')

    def lire_derniere(self):
        try:
            cur = self.conn.cursor(as_dict=True)
            cur.execute("""
                SELECT TOP 1 timestamp, temperature, humidity,
                             pulses, angle, direction
                FROM meteo_station
                ORDER BY timestamp DESC
            """)
            row = cur.fetchone()
            if not row:
                return None
            return {
                'timestamp'  : str(row['timestamp'])[:19],
                'temperature': round(float(row['temperature']), 1) if row['temperature'] else None,
                'humidity'   : round(float(row['humidity']),    1) if row['humidity']    else None,
                'angle'      : round(float(row['angle']),       1) if row['angle']       else 0,
                'direction'  : row['direction'] or 'N',
                'pulses'     : int(row['pulses']) if row['pulses'] else 0,
            }
        except Exception as e:
            print(f'  [METEO] Erreur : {e}')
            try: self._connecter()
            except: pass
            return None

    def lire_historique(self, n=288):
        try:
            cur = self.conn.cursor(as_dict=True)
            cur.execute(f"""
                SELECT * FROM (
                    SELECT TOP {n} timestamp, temperature,
                                   humidity, angle, direction
                    FROM meteo_station
                    ORDER BY timestamp DESC
                ) sub ORDER BY timestamp ASC
            """)
            rows = cur.fetchall()
            return [{
                'ts'         : str(r['timestamp'])[:19],
                'temperature': round(float(r['temperature']), 1) if r['temperature'] else None,
                'humidity'   : round(float(r['humidity']),    1) if r['humidity']    else None,
                'angle'      : round(float(r['angle']),       1) if r['angle']       else 0,
                'direction'  : r['direction'] or 'N',
            } for r in rows]
        except Exception as e:
            print(f'  [METEO] Erreur historique : {e}')
            return []
