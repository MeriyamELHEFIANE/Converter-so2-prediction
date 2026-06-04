from flask import Flask, request, jsonify
import pyodbc
from datetime import datetime

app = Flask(__name__)

CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost;"
    "DATABASE=OCP;"
    "Trusted_Connection=yes;"
)

def get_conn():
    return pyodbc.connect(CONN_STR)

@app.route('/api/meteo', methods=['POST'])
def receive_meteo():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON invalide"}), 400
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO [dbo].[meteo_station]
                (timestamp, temperature, humidity, pulses, angle, direction, device_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
            datetime.now(),
            data.get('temperature'),
            data.get('humidity'),
            data.get('pulses'),
            data.get('angle'),
            data.get('direction'),
            data.get('device_timestamp')
        )
        conn.commit()
        conn.close()
        print(f"[OK] T={data.get('temperature')}°C  H={data.get('humidity')}%  Dir={data.get('direction')}")
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        print(f"[ERREUR] {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Serveur Flask démarré — port 5000")
    app.run(host='0.0.0.0', port=5000, debug=True)