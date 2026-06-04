#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WiFi.h>

// ======================
// WIFI + API PC WINDOWS
// ======================
const char* WIFI_SSID     = "ADSL_inwi_CD1F";
const char* WIFI_PASSWORD = "E44E1271CD1F";
const char* SERVER_URL    = "http://192.168.1.41:5000/api/meteo";
//                                   ↑ IP corrigée (votre PC Windows)

// ======================
// DHT11
// ======================
#define DHTPIN D4
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

float temperature = 0;
float humidity    = 0;
unsigned long lastDHT = 0;

// ======================
// KY-040
// ======================
#define CLK D5
#define DT  D6

int lastCLK;
int pulses = 0;

unsigned long lastEncoderTime = 0;
const int debounce = 2;

unsigned long lastDisplay = 0;
unsigned long lastSend    = 0;
const unsigned long sendInterval = 30000;

// 16 directions
String directions[16] = {
  "N","NNE","NE","ENE",
  "E","ESE","SE","SSE",
  "S","SSW","SW","WSW",
  "W","WNW","NW","NNW"
};

// ======================
// CONNEXION WIFI
// ======================
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connexion WiFi");
  int tentatives = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    tentatives++;
    if (tentatives > 40) {
      Serial.println("\nEchec WiFi - redemarrage...");
      ESP.restart();
    }
  }

  Serial.print("\nWiFi OK - IP ESP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Serveur cible : ");
  Serial.println(SERVER_URL);
}

// ======================
// CALCULS VENT
// ======================
float windAngle() {
  return (pulses * 360.0) / 20.0;
}

String windDirection() {
  int index = (int)(pulses * 16.0 / 20.0) % 16;
  return directions[index];
}

// ======================
// CONSTRUCTION JSON
// ======================
String buildJSON() {
  StaticJsonDocument<256> doc;

  doc["temperature"]      = temperature;
  doc["humidity"]         = humidity;
  doc["pulses"]           = pulses;
  doc["angle"]            = windAngle();
  doc["direction"]        = windDirection();
  doc["device_timestamp"] = millis();

  String output;
  serializeJson(doc, output);
  return output;
}

// ======================
// ENVOI VERS FLASK / SQL
// ======================
void sendToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi perdu - reconnexion...");
    connectWiFi();
  }

  String json = buildJSON();
  Serial.print("JSON envoye : ");
  Serial.println(json);

  WiFiClient client;
  HTTPClient http;

  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000); // timeout 10 secondes

  int code = http.POST(json);

  Serial.print("Code HTTP recu : ");
  Serial.println(code);

  if (code == 200) {
    Serial.println(">>> SUCCES - donnee inseree dans SQL Server");
    Serial.print("Reponse serveur : ");
    Serial.println(http.getString());
  } else if (code < 0) {
    Serial.print("Erreur connexion : ");
    Serial.println(http.errorToString(code));
    Serial.println("Verifiez que Flask tourne sur le PC !");
  } else {
    Serial.print("Erreur serveur HTTP ");
    Serial.println(code);
    Serial.println(http.getString());
  }

  http.end();
}

// ======================
// SETUP
// ======================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=== STATION METEO OCP ===");

  dht.begin();

  pinMode(CLK, INPUT_PULLUP);
  pinMode(DT,  INPUT_PULLUP);
  lastCLK = digitalRead(CLK);

  connectWiFi();

  Serial.println("Systeme pret - envoi toutes les 30s");
}

// ======================
// LOOP
// ======================
void loop() {

  // --- DHT11 : lecture toutes les 2s ---
  if (millis() - lastDHT > 2000) {
    lastDHT = millis();

    float t = dht.readTemperature();
    float h = dht.readHumidity();

    if (isnan(t) || isnan(h)) {
      Serial.println("[WARN] Erreur lecture DHT11 - valeur ignoree");
    } else {
      temperature = t;
      humidity    = h;
    }
  }

  // --- KY-040 : lecture rapide ---
  int currentCLK = digitalRead(CLK);

  if (currentCLK != lastCLK) {
    if (millis() - lastEncoderTime > debounce) {
      lastEncoderTime = millis();

      if (currentCLK == LOW) {
        if (digitalRead(DT) != currentCLK) {
          pulses++;
        } else {
          pulses--;
        }

        if (pulses >= 20) pulses = 0;
        if (pulses <   0) pulses = 19;
      }
    }
  }
  lastCLK = currentCLK;

  // --- Affichage série toutes les 300ms ---
  if (millis() - lastDisplay > 300) {
    lastDisplay = millis();

    Serial.println("--------------------");
    Serial.print("Temp : "); Serial.print(temperature); Serial.println(" C");
    Serial.print("Hum  : "); Serial.print(humidity);    Serial.println(" %");
    Serial.print("Dir  : "); Serial.print(windDirection());
    Serial.print("  Angle : "); Serial.print(windAngle()); Serial.println(" deg");
  }

  // --- Envoi SQL Server toutes les 30s ---
  if (millis() - lastSend > sendInterval) {
    lastSend = millis();
    sendToServer();
  }
}