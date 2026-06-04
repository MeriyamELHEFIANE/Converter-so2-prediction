# web/app.py
from flask import Flask, send_from_directory, jsonify, request
import os
import sys
import pymssql
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.config import (FLASK_HOST, FLASK_PORT,
                            SQL_SERVER, SQL_DATABASE,
                            SQL_USERNAME, SQL_PASSWORD)

TEMPLATES_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'templates')
app = Flask(__name__, static_folder=None)

# ══════════════════════════════════════════════
# ÉTAT GLOBAL SCADA
# ══════════════════════════════════════════════
etat_global = {
    'so2_actuel':       None,
    'so2_pred':         None,
    'zone':             'ATTENTE',
    'timestamp':        None,
    'temperatures':     {},
    'debit_soufre':     None,
    'Vapeur':           None,
    'diagnostic':       None,
    'alertes_capteurs': [],
    'sante_capteurs':   {},
    'buffer_size':      0,
    'historique':       [],
}

# ══════════════════════════════════════════════
# ÉTAT GLOBAL MÉTÉO ESP8266
# ══════════════════════════════════════════════
meteo_global = {
    'temperature': None,
    'humidity':    None,
    'pulses':      None,
    'angle':       None,
    'direction':   None,
    'device_ms':   None,
    'timestamp':   None,
    'historique':  [],
}

# ══════════════════════════════════════════════
# ROUTES STATIQUES
# ══════════════════════════════════════════════
@app.route('/')
def index():
    return send_from_directory(TEMPLATES_DIR, 'index.html')

@app.route('/<path:filename>')
def static_file(filename):
    return send_from_directory(TEMPLATES_DIR, filename)

# ══════════════════════════════════════════════
# ROUTES SCADA
# ══════════════════════════════════════════════
@app.route('/api/etat')
def api_etat():
    return jsonify(etat_global)

@app.route('/api/historique')
def api_historique():
    return jsonify(etat_global.get('historique', []))

# ══════════════════════════════════════════════
# ROUTES MÉTÉO ESP8266
# ══════════════════════════════════════════════
@app.route('/api/meteo', methods=['GET'])
def get_meteo():
    return jsonify(meteo_global)

@app.route('/api/meteo', methods=['POST'])
def receive_meteo():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'JSON invalide'}), 400

    try:
        ts = datetime.now()

        # Mise à jour état en mémoire
        meteo_global.update({
            'temperature': data.get('temperature'),
            'humidity':    data.get('humidity'),
            'pulses':      data.get('pulses'),
            'angle':       data.get('angle'),
            'direction':   data.get('direction'),
            'device_ms':   data.get('device_timestamp'),
            'timestamp':   str(ts)[:19],
        })

        # Historique 50 points glissants
        meteo_global['historique'].append({
            'ts':          str(ts)[:19],
            'temperature': data.get('temperature'),
            'humidity':    data.get('humidity'),
            'angle':       data.get('angle'),
            'direction':   data.get('direction'),
            'pulses':      data.get('pulses'),
        })
        meteo_global['historique'] = meteo_global['historique'][-50:]

        # ── Insertion SQL Server via config.py ────────────────────
        conn = pymssql.connect(
            server=SQL_SERVER,
            user=SQL_USERNAME,
            password=SQL_PASSWORD,
            database=SQL_DATABASE,
            timeout=10
        )
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO [dbo].[meteo_station]
                (timestamp, temperature, humidity, pulses, angle,
                 direction, device_ms)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            ts,
            data.get('temperature'),
            data.get('humidity'),
            data.get('pulses'),
            data.get('angle'),
            data.get('direction'),
            data.get('device_timestamp'),
        ))
        conn.commit()
        conn.close()

        print(f"[METEO OK] T={data.get('temperature')}°C  "
              f"H={data.get('humidity')}%  "
              f"Dir={data.get('direction')}  "
              f"Angle={data.get('angle')}°")

        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        print(f'[METEO ERREUR] {e}')
        return jsonify({'error': str(e)}), 500

# ══════════════════════════════════════════════
# MISE À JOUR ÉTAT (appelées par main.py)
# ══════════════════════════════════════════════
def mettre_a_jour_meteo(derniere, historique):
    if not derniere:
        return
    meteo_global.update({
        'temperature': derniere.get('temperature'),
        'humidity':    derniere.get('humidity'),
        'pulses':      derniere.get('pulses'),
        'angle':       derniere.get('angle'),
        'direction':   derniere.get('direction'),
        'timestamp':   derniere.get('timestamp'),
    })
    if historique:
        meteo_global['historique'] = [{
            'ts':          r.get('ts'),
            'temperature': r.get('temperature'),
            'humidity':    r.get('humidity'),
            'angle':       r.get('angle'),
            'direction':   r.get('direction'),
            'pulses':      r.get('pulses'),
        } for r in historique][-50:]


def mettre_a_jour(so2_actuel, so2_pred, zone, timestamp,
                  temperatures, debit_soufre, vapeur,
                  diagnostic, alertes_capteurs,
                  sante_capteurs, buf_size):
    etat_global.update({
        'so2_actuel':       so2_actuel,
        'so2_pred':         so2_pred,
        'zone':             zone,
        'timestamp':        str(timestamp)[:19] if timestamp else None,
        'temperatures':     temperatures,
        'debit_soufre':     round(debit_soufre, 3) if debit_soufre else None,
        'Vapeur':           round(vapeur, 3) if vapeur else None,
        'diagnostic':       diagnostic,
        'alertes_capteurs': alertes_capteurs,
        'sante_capteurs':   sante_capteurs,
        'buffer_size':      buf_size,
    })
    if so2_actuel is not None:
        etat_global['historique'].append({
            'ts':       str(timestamp)[:19] if timestamp else None,
            'so2':      round(so2_actuel, 1),
            'so2_pred': so2_pred,
            'zone':     zone,
        })
        etat_global['historique'] = etat_global['historique'][-50:]


# ══════════════════════════════════════════════
# DÉMARRAGE
# ══════════════════════════════════════════════
def demarrer():
    import threading
    threading.Thread(
        target=lambda: app.run(
            host=FLASK_HOST,
            port=FLASK_PORT,
            debug=False,
            use_reloader=False
        ),
        daemon=True
    ).start()
    print(f'  [WEB] Dashboard : http://0.0.0.0:{FLASK_PORT}')
