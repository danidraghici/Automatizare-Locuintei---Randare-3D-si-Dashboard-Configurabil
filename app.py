from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_cors import CORS
from flask_socketio import SocketIO
import pymysql.cursors
from flask import send_from_directory
import requests
import logging
import os

# Configurația conexiunii la baza de date
db_connection = pymysql.connect(host='127.0.0.1',
                                user='root',
                                password='Eusuntlapol1',
                                database='homeatutomation',
                                cursorclass=pymysql.cursors.DictCursor)

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'your_secret_key'
socketio = SocketIO(app, cors_allowed_origins="*")


@app.route('/')
def home():
    return render_template('index.html')

@app.route('/configuration')
def configuration():
    return render_template('configuration.html')

@app.route('/home')
def house():
    return render_template('home.html')


@app.route('/data', methods=['POST'])
def receive_data():
    global latest_sensor_data
    data = request.json
    latest_sensor_data = data  # Store the latest data received

    date = data['date']
    average_temperature = data['Temperature']
    average_humidity = data['Humidity']
    daily = data.get('daily')

    if(daily == True):
        with db_connection.cursor() as cursor:
            sql = "INSERT INTO `sensor_data` (`date`, `average_temperature`, `average_humidity`) VALUES (%s, %s, %s)"
            cursor.execute(sql, (date, average_temperature, average_humidity))
        db_connection.commit()
    
    socketio.emit('realTimeValues', data)
    return jsonify({'message': 'Data received and emitted successfully'}), 200

@app.route('/latest-sensor-data')
def send_latest_data():
    print(latest_sensor_data)
    return jsonify(latest_sensor_data)

@app.route('/data')
def sql_data():
    cursor = db_connection.cursor()
    cursor.execute("SELECT date, average_temperature, average_humidity FROM sensor_data")
    rows = cursor.fetchall()
    print(rows)
    return jsonify(rows)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
