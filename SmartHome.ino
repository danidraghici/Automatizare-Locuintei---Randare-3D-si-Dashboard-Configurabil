#include <Wire.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <FS.h>
#include <Adafruit_Sensor.h>
#include "Adafruit_BME680.h"
#include <TimeLib.h>
#include <Servo.h>
#include <time.h>
#include "DHT.h"

#define SEALEVELPRESSURE_HPA (1013.25)
const long interval = 600000;
bool firstReadBME = true;
bool firstRead = true;

// WiFi credentials.
const char *ssid = "DIGI_960d20";
const char *password = "aff569f2";
const char *serverUrl = "http://192.168.1.5:5000/data";

// URL pentru a declanșa evenimentul IFTTT
const char *iftttPIRURL = "http://maker.ifttt.com/trigger/pir_alert/with/key/oWl3M5mImQUFBuNr7AHV2Y_e7tB2VchM7YD-teCkLWO";
const char *iftttLeakURL = "http://maker.ifttt.com/trigger/leak_alert/with/key/oWl3M5mImQUFBuNr7AHV2Y_e7tB2VchM7YD-teCkLWO";
const char *iftttFireAlert = "http://maker.ifttt.com/trigger/gas_alert/with/key/b5LMZAcvBNkA2W7tTDxQt878bAQOJf0ctOUcBjABFpa";

const char *ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 3600;
const int daylightOffset_sec = 3600;
Adafruit_BME680 bme; // I2C is used by default

float temperature;
float lastTemperature;
float humidity;
float lastHumidity;
float pressure;
float gas;
float altitude;
String IAQsts;
double dewpoint;

float temperatureSum = 0;
float humiditySum = 0;
int measurementCount = 0;
String currentDay;

float dhtTemperature;
float dhtHumidity;
float mqGas;

float compareTemp;

ESP8266WebServer server(5000);
WiFiClient client;

const int dhtPin = D5;
const int mqPin = D0;
int mqValue = 0;
int mqState = LOW;

DHT dht(dhtPin, DHT11);

const int ledPins[] = {13, 15, 3};  // D7, D8, RX (GPIO13, GPIO15, GPIO3)
const int numLeds = sizeof(ledPins) / sizeof(ledPins[0]);

const int RELAY_PIN = D3;

const int pirPin = D4;
int pirState = LOW; // assuming no motion detected
int pirValue = 0;

// Thresholds for significant changes
const float temperatureChangeThreshold = 1;
const float humidityChangeThreshold = 10;

// Fan Controller
int sliderValue = 0;
const char *PARAM_INPUT = "value";

// blinds slider
Servo blindsServo;
const int servoPin = D6;
int currentBlindsPosition = 90;

const int leakPin = A0;
int leakValue = 0;
int leakState = LOW;
int leakDiff = 0;

void setup()
{
    Serial.begin(115200);

    for (int i = 0; i < numLeds; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
  
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);

    pinMode(pirPin, INPUT);
    digitalWrite(pirPin, LOW);

    pinMode(leakPin, INPUT);

    pinMode(mqPin, INPUT);
    digitalWrite(mqPin, LOW);

    Wire.begin();

    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }

    Serial.println("");
    Serial.print("WiFi connected: ");
    Serial.println(WiFi.localIP());

    // Configurarea timpului
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

    // Așteaptă sincronizarea timpului
    while (!time(nullptr))
    {
        Serial.print(".");
        delay(1000);
    }
    Serial.println("Timp sincronizat");
    currentDay = getCurrentDay(); // Inițializează ziua curentă la pornire
    // Afișează timpul
    Serial.println(currentDay);

    dht.begin();

    if (!SPIFFS.begin())
    {
        Serial.println("An Error has occurred while mounting SPIFFS");
        return;
    }

    if (!bme.begin())
    {
        Serial.println("Could not find a valid BME680 sensor, check wiring!");
        while (1)
            ;
    }

    // Set up oversampling and filter initialization
    bme.setTemperatureOversampling(BME680_OS_8X);
    bme.setHumidityOversampling(BME680_OS_2X);
    bme.setPressureOversampling(BME680_OS_4X);
    bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
    bme.setGasHeater(320, 150); // 320°C for 150 ms

    // Servirea paginii index.html
    server.on("/", HTTP_GET, handleRoot);

    server.on("/toggle", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    if (server.hasArg("led")) {
      int ledIndex = server.arg("led").toInt();
      if (ledIndex < numLeds) {
        int ledPin = ledPins[ledIndex];
        digitalWrite(ledPin, !digitalRead(ledPin));
        server.send(200, "text/plain", digitalRead(ledPin) ? "LED is ON" : "LED is OFF");
      } else {
        server.send(404, "text/plain", "Invalid LED number");
      }
    } else {
      server.send(400, "text/plain", "No LED number specified");
    }
  });

   server.on("/toggleSecurity", HTTP_GET, []() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  pirValue = !pirValue;
  server.send(200, "text/plain", pirValue ? "ON" : "OFF");
  
 });

 server.on("/toggleFire", HTTP_GET, []() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  mqValue = !mqValue;
  server.send(200, "text/plain", mqValue ? "ON" : "OFF");
  
 });

 server.on("/toggleLeaking", HTTP_GET, []() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  leakValue = !leakValue;
  server.send(200, "text/plain", leakValue ? "ON" : "OFF");
  
 });

server.on("/setBlinds", HTTP_GET, []() {
        server.sendHeader("Access-Control-Allow-Origin", "*");
        if (server.hasArg("value")) {
            blindsServo.attach(servoPin);
            int newPosition = server.arg("value").toInt();
            bool shouldMoveLeft = newPosition < currentBlindsPosition;

            Serial.print("Current Position: ");
            Serial.println(currentBlindsPosition);
            Serial.print("New Position: ");
            Serial.println(newPosition);

            // Determine the direction and execute the movement
            if (shouldMoveLeft) {
                // Move left (decreasing positions)
                for (int pos = currentBlindsPosition; pos >= newPosition; pos-=5) {
                    blindsServo.write(0);
                    delay(100);  // Short delay to allow the servo to move smoothly
                    Serial.println(pos);
                }
            } else {
                // Move right (increasing positions)
                for (int pos = currentBlindsPosition; pos <= newPosition; pos+=5) {
                    blindsServo.write(180);
                    delay(100);  // Short delay to allow the servo to move smoothly
                    Serial.println(pos);
                }
            }
            
            currentBlindsPosition = newPosition;  // Update the current position
            blindsServo.detach();  // Detach servo to save power and minimize wear
            server.send(200, "text/plain", "Position Updated");
        } else {
            server.send(500, "text/plain", "Invalid Request - 'position' parameter is missing");
        }
    });

  server.on("/setTemperature", HTTP_GET, [] () {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    String inputMessage;
    if (server.hasArg("valueBME")) {
      inputMessage = server.arg("valueBME");
      sliderValue = inputMessage.toInt();
      controlFan("bme");
    } else if (server.hasArg("valueDHT")) {
      inputMessage = server.arg("valueDHT");
      sliderValue = inputMessage.toInt();
      controlFan("dht");
    } else {
      inputMessage = "No message sent";
    }
    Serial.println(inputMessage);
    server.send(200, "text/plain");
  });
    
  server.begin();
}


void handleRoot()
{
    File file = SPIFFS.open("/index.html", "r");
    if (!file)
    {
        Serial.println("Failed to open index.html");
        return;
    }
    String htmlContent = file.readString();
    file.close();
    server.send(200, "text/html", htmlContent);
}

void controlFan(String tempSensor) {
  if (tempSensor == "bme"){
    compareTemp = temperature;
  } else {
    compareTemp = dhtTemperature;
  }
  Serial.print("Sensor Temperature: ");
  Serial.println(compareTemp);
  Serial.print("Slider Value: ");
  Serial.println(sliderValue);

  if (abs(compareTemp - sliderValue) <= 1) {
    digitalWrite(RELAY_PIN, LOW); // Turn off the fan
    Serial.println("Fan stopped");
  } else {
    digitalWrite(RELAY_PIN, HIGH); // Turn on the fan
    Serial.println("Fan running");
  }
}

String getCurrentDay()
{
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo))
    {
        Serial.println("Eroare la obtinerea timpului");
    }
    char buffer[64];
    strftime(buffer, sizeof(buffer), "%Y-%m-%d", &timeinfo);
    return buffer;
}

void sendAlert(const char* iftttURL) {
  HTTPClient http;
  http.begin(client, iftttURL);
  int httpCode = http.GET();

  if (httpCode > 0){
    String payload = http.getString();
    Serial.println(payload);
  } else {
      Serial.println("Error on HTTP request");
    }

  http.end();
}

void sendDataToServer(String date, float temperature, float humidity, float pressure, float altitude, float gas, String IAQsts, float dhtHumidity, float dhtTemperature, float mqGas, bool daily)
{
    if (WiFi.status() == WL_CONNECTED)
    {

        HTTPClient http;

        http.begin(client, serverUrl);
        http.addHeader("Content-Type", "application/json");
        String payload = "{\"date\":\"" + currentDay + "\", \"Temperature\":" + String(temperature) + ", \"Humidity\":" + String(humidity) + ", \"Pressure\":" + String(pressure) + ", \"Altitude\":" + String(altitude) + ", \"CO2Eq\":" + String(gas) + ", \"CO2MQ\":" + String(mqGas) + ", \"DHTtemp\":" + String(dhtTemperature) + ", \"DHThum\":" + String(dhtHumidity) + ", \"IAQsts\":\"" + IAQsts + "\", \"daily\":" + String(daily) + "}";
        Serial.println(payload);
        int httpResponseCode = http.POST(payload);

        if (httpResponseCode > 0)
        {
            String response = http.getString();
            Serial.println(response);
        }
        else
        {
            Serial.print("Error on sending POST: ");
            Serial.println(httpResponseCode);
        }
        http.end();
        delay(10000);
    }
}

void saveDailyAverage()
{

    temperatureSum += temperature;
    humiditySum += humidity;
    measurementCount++;

    dhtHumidity = dht.readHumidity();
    dhtTemperature = dht.readTemperature();

    if (isnan(dhtHumidity) || isnan(dhtTemperature))
    {
        Serial.println("Failed to read from DHT sensor!");
        return;
    }

    mqGas = digitalRead(mqPin);

    if (getCurrentDay() != currentDay)
    {

        float averageTemperature = temperatureSum / measurementCount;
        float averageHumidity = humiditySum / measurementCount;

        sendDataToServer(currentDay, averageTemperature, averageHumidity, pressure, altitude, gas, IAQsts, dhtHumidity, dhtTemperature, mqGas, true);

        temperatureSum = 0;
        humiditySum = 0;
        measurementCount = 0;
        currentDay = getCurrentDay();
    }
    else
    {
        sendDataToServer(currentDay, temperature, humidity, pressure, altitude, gas, IAQsts, dhtHumidity, dhtTemperature, mqGas, false);
    }
}

void bme680()
{
    temperature = bme.readTemperature();
    humidity = bme.readHumidity();

    // Check for significant temperature change
    if (abs(temperature - lastTemperature) > temperatureChangeThreshold)
    {
        Serial.print("Significant temperature change detected: ");
        Serial.print(temperature);
        Serial.println(" *C");
        lastTemperature = temperature;
    }

    // Check for significant humidity change
    if (abs(humidity - lastHumidity) > humidityChangeThreshold)
    {
        Serial.print("Significant humidity change detected: ");
        Serial.print(humidity);
        Serial.println(" %");
        lastHumidity = humidity;
    }

    pressure = bme.readPressure() / 100.0F;
    Serial.print("Pressure: ");
    Serial.print(pressure);
    Serial.println(" hPa");

    altitude = bme.readAltitude(SEALEVELPRESSURE_HPA);
    Serial.print("Altitude: ");
    Serial.print(altitude);
    Serial.println(" m");

    gas = (bme.gas_resistance / 1000.0);
    Serial.print("gas Resistance: ");
    Serial.print(gas);
    Serial.println(" KOhms");

    // IAQ interpretation - Just for demonstration, not scientifically accurate
    if ((gas > 0) && (gas <= 50))
    {
        IAQsts = "GOOD";
        Serial.println("IAQ Good");
    }
    if ((gas > 51) && (gas <= 100))
    {
        IAQsts = "Average";
        Serial.println("IAQ Average");
    }
    if ((gas > 101) && (gas <= 150))
    {
        IAQsts = "Little Bad";
        Serial.println("IAQ Little Bad");
    }
    if ((gas > 151) && (gas <= 200))
    {
        IAQsts = "Bad";
        Serial.println("IAQ Bad");
    }
    if ((gas > 201) && (gas <= 300))
    {
        IAQsts = "Worse";
        Serial.print("IAQ Worse");
    }
    if ((gas > 301) && (gas <= 500))
    {
        IAQsts = "Very Bad";
        Serial.println("IAQ Very Bad");
    }
}

void updateValuesBME()
{
    static unsigned long previousMillis = 0;
    unsigned long currentMillis = millis();
    if (firstReadBME)
    {
        bme680();
        saveDailyAverage();
        firstReadBME = false;
    }

    if (currentMillis - previousMillis >= interval)
    {
        bme680();
        saveDailyAverage();
        previousMillis = currentMillis;
    }
}

void checkMotion(){
  int sensorValue = digitalRead(pirPin); 
    if (sensorValue == HIGH) {
      if (pirState == LOW) {
        Serial.println("Motion detected!");
        sendAlert(iftttPIRURL);
        pirState = HIGH;
      }
    } else {
      if (pirState == HIGH) {
        Serial.println("Motion ended!");
        pirState = LOW;
      }
    }
    }


void checkFire() {
  int gasValue = digitalRead(mqPin); 

  if (gasValue == HIGH) {
    if (mqState == LOW) {
      sendAlert(iftttFireAlert);
      Serial.println("Gaz detectat!");
      mqState = HIGH;
    }
  } else {
     if (mqState == HIGH) {
      Serial.println("Niciun gaz detectat.");
      mqState = LOW;
     }
  }

}



void checkLeak() {
    int sensorValue = analogRead(leakPin);
    
    if(sensorValue > 100) {
        if(leakState == LOW) {
          Serial.println("Leaking alert!");
          sendAlert(iftttLeakURL);
          leakState = HIGH;
        } 
    } else {if(sensorValue < 50) {
        Serial.println("Nicio scurgere detectata");
        leakState = LOW;
      }  
      }
}



  

void loop() {

  server.handleClient();

  if(firstRead) {
    digitalRead(pirPin); 
    analogRead(leakPin);
    digitalRead(mqPin);
    firstRead = false;
  }
  
  if (pirValue and !firstRead) {
    checkMotion();
  }

  if (mqValue and !firstRead) {
    checkFire();
  }

  if (leakValue and !firstRead) {
    checkLeak();
  }
  updateValuesBME();
}
