# config/config.py
# ─── Modifier uniquement ce fichier si quelque chose change ───

# SQL Server
SQL_SERVER   = '192.168.1.41'
SQL_DATABASE = 'OCP'
SQL_USERNAME = 'sa'
SQL_PASSWORD = '1234'
SQL_TABLE    = 'Convertisseur_SO2'

# Modèle (chemins depuis la racine convertisseur/)
# model.json = format universel compatible toutes versions XGBoost
MODEL_JSON    = 'model/model.json'   # prioritaire
MODEL_PKL     = 'model/model.pkl'    # fallback (ancien format)
SCALER_FILE   = 'model/scaler.pkl'
FEATURES_FILE = 'model/features.pkl'

# Pipeline
INTERVALLE  = 5 * 60   # secondes entre chaque cycle
BUFFER_SIZE = 60        # taille buffer glissant
MIN_BUFFER  = 13        # points minimum avant 1ère prédiction (max lag = l12)

# Seuils SO2 (mg/Nm³)
PREALARM = 1700
ALARM    = 1960
URGENCE  = 2200
HORIZON  = 12

# Plages physiques valides
PLAGES = {
    'TE021B': (200, 700), 'TE022B': (200, 700),
    'TE031B': (200, 700), 'TE032B': (200, 700),
    'TE023B': (200, 700), 'TE024B': (200, 700),
    'TE033B': (200, 700), 'TE034B': (200, 700),
    'TE025B': (200, 700), 'TE026B': (200, 700),
    'TE035B': (200, 700), 'TE036B': (200, 700),
    'TE027B': (200, 700), 'TE028B': (200, 700),
    'TE037B': (200, 700), 'TE038B': (200, 700),
    'debit_soufre': (0, 40),
    'vapeur':       (0, 110),
    'SO2':          (0, 5000),
}

# Colonnes SQL → noms internes
SQL_TO_INT = {
    'TE021B': '13TE021B', 'TE022B': '13TE022B',
    'TE031B': '13TE031B', 'TE032B': '13TE032B',
    'TE023B': '13TE023B', 'TE024B': '13TE024B',
    'TE033B': '13TE033B', 'TE034B': '13TE034B',
    'TE025B': '13TE025B', 'TE026B': '13TE026B',
    'TE035B': '13TE035B', 'TE036B': '13TE036B',
    'TE027B': '13TE027B', 'TE028B': '13TE028B',
    'TE037B': '13TE037B', 'TE038B': '13TE038B',
    'debit_soufre': 'debit_soufre',
    'vapeur':       'Vapeur',
    'SO2':          'SO2',
}

# Masses catalytiques
MASSES = {
    'Masse 1': {
        'cap_e': ['13TE021B', '13TE031B'], 'cap_s': ['13TE022B', '13TE032B'],
        'Te_nom': 425, 'dT_nom': 175, 'tol': 10, 'dtb': 30, 'dth': 25,
        'ctrl': 'Echangeur inter-lits 1-2',
        'act_c': 'Ouvrir vanne echangeur inter-lits 1-2 → refroidir vers 425°C',
        'act_f': 'Fermer vanne echangeur inter-lits 1-2 → rechauffer vers 425°C',
    },
    'Masse 2': {
        'cap_e': ['13TE023B', '13TE033B'], 'cap_s': ['13TE024B', '13TE034B'],
        'Te_nom': 445, 'dT_nom': 75, 'tol': 10, 'dtb': 20, 'dth': 20,
        'ctrl': 'Echangeur inter-lits 2-3',
        'act_c': 'Ouvrir vanne echangeur inter-lits 2-3 → refroidir vers 445°C',
        'act_f': 'Fermer vanne echangeur inter-lits 2-3 → rechauffer vers 445°C',
    },
    'Masse 3': {
        'cap_e': ['13TE025B', '13TE035B'], 'cap_s': ['13TE026B', '13TE036B'],
        'Te_nom': 445, 'dT_nom': 25, 'tol': 10, 'dtb': 12, 'dth': 12,
        'ctrl': 'Vanne bypass 3',
        'act_c': 'Fermer vanne bypass 3 → refroidir gaz entrant vers 445°C',
        'act_f': 'Ouvrir vanne bypass 3 → rechauffer gaz entrant vers 445°C',
    },
    'Masse 4': {
        'cap_e': ['13TE037B', '13TE027B'], 'cap_s': ['13TE038B', '13TE028B'],
        'Te_nom': 445, 'dT_nom': 7, 'tol': 10, 'dtb': 7, 'dth': 8,
        'ctrl': 'Vanne bypass 4',
        'act_c': 'Fermer vanne bypass 4 → refroidir gaz entrant vers 445°C',
        'act_f': 'Ouvrir vanne bypass 4 → rechauffer gaz entrant vers 445°C',
    },
}

# Flask
FLASK_HOST = '0.0.0.0'
FLASK_PORT = 5000

# Log
LOG_FILE = 'logs/log_pipeline.csv'
