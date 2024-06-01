let arduinoURL = 'http://192.168.1.2:5000';
let dataURL = 'http://192.168.1.5:5000';

let currentRoom = '';
let temperatureChart;
let humidityChart;

let checkTemperatureSlider = true;
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        x: {
            display: false, // Ascunde axa X
            ticks: {
                color: 'black',
                fontSize: 14
            }
        },
        y: {
            ticks: {
                color: 'black',
                fontSize: 14, 
                stepSize: 1,
            }, grid: {
                display: false
            }
        }
    },
    plugins: {
        legend: {
            labels: {
                color: 'black',
                fontSize: 14
            }
        },
        tooltip: {
            enabled: true,
            mode: 'nearest',
            intersect: false,
            axis: 'x'
        },
        zoom: {
        pan: {
            enabled: true,
            mode: 'x',
            rangeMin: {
                x: null
            },
            rangeMax: {
                x: null
            },
        },
        
        zoom: {
            wheel: {
                enabled: true, 
            },
            pinch: {
                enabled: true, 
                mode: 'x', 
                
            },
            mode: 'x'
        }
    
    },
    },
    interaction: {
        mode: 'nearest',
        intersect: false,
        axis: 'x'
    }
    
};

window.addEventListener('beforeunload', function() {
    localStorage.clear();  
});

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    restoreSavedModels();
    fetchAndDisplayData();

    const targetNode = document.body;  
    const config = { childList: true, subtree: true };

    const observer = new MutationObserver(function(mutationsList, observer) {
        for(let mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    // Verificăm dacă nodul adăugat are atributul specificat
                    if (node.nodeType === 1 && node.getAttribute('data-widget-type') === 'Lights Control') {
                        const switchElement = node.querySelector('#switch');
                        if (switchElement) {
                            attachSwitchEvent(switchElement);
                        }
                    }

                    if (node.nodeType === 1 && node.getAttribute('data-widget-type') === 'Security Control') {
                        const switchElement = node.querySelector('#security-switch');
                        if (switchElement) {
                            initializeSwitchState('security-state-switch', switchElement);
                            attachSecuritySwitchEvent(switchElement);
                        }
                    }

                    if (node.nodeType === 1 && node.getAttribute('data-widget-type') === 'Leaking Control') {
                        const switchElement = node.querySelector('#leak-switch');
                        if (switchElement) {
                            initializeSwitchState('leak-state-switch', switchElement);
                            attachLeakingSwitchEvent(switchElement);
                        }
                    }

                    if (node.nodeType === 1 && node.getAttribute('data-widget-type') === 'Fire Control') {
                        const switchElement = node.querySelector('#fire-switch');
                        if (switchElement) {
                            initializeSwitchState('fire-state-switch', switchElement);
                            attachFireSwitchEvent(switchElement);
                        }
                    }

                    if (node.nodeType === 1 && node.getAttribute('data-widget-type') === 'Blinds Control') {
                        const blindsSlider = node.querySelector('input[type="range"]');
                        if (blindsSlider) {
                            attachBlindsSliderEvent(blindsSlider);
                            restoreBlindsSliderValue(blindsSlider);
                        }
                    }

                    if (node.nodeType === 1 && node.getAttribute('data-widget-type') === 'Temperature Control') {
                        const temperatureSlider = node.querySelector('input[type="range"]');
                        if (temperatureSlider) {
                            attachTemperatureSliderEvent(temperatureSlider);
                            restoreTemperatureSliderValue(temperatureSlider);
                        }
                    }
                });
            }
        }
    });

    observer.observe(targetNode, config);

    function attachSwitchEvent(switchElement) {
        // Restaurăm starea din Local Storage la încărcarea switch-ului
        let str = getAssociatedSensor('Lights Control');
        let ledNumber = str.match(/\d+/)[0];
        const savedState = localStorage.getItem(`ledState${ledNumber}`);
        if (savedState !== null) {
            switchElement.checked = (savedState === 'true');
        }
    
        switchElement.addEventListener('change', function() {
            console.log(`Toggle LED ${ledNumber}`);
    
            var xhr = new XMLHttpRequest();
            xhr.open("GET", arduinoURL + `/toggle?led=${ledNumber}`, true);
            xhr.send();
    
            xhr.onload = function() {
                console.log(`Response for LED ${ledNumber}: ${xhr.responseText}`);
                // Actualizăm starea în Local Storage
                localStorage.setItem(`ledState${ledNumber}`, switchElement.checked);
            };
        });
    }

    function attachSecuritySwitchEvent(switchElement) {
        
        switchElement.addEventListener('change', function() {
    
            var xhr = new XMLHttpRequest();
            xhr.open("GET", arduinoURL + `/toggleSecurity`, true);
            xhr.send();
    
            xhr.onload = function() {
                console.log(`Response for Security: ${xhr.responseText}`);
                updateSwitchState('security-state-switch', switchElement);
            };
        });
    }

    function attachLeakingSwitchEvent(switchElement) {
        
        switchElement.addEventListener('change', function() {
    
            var xhr = new XMLHttpRequest();
            xhr.open("GET", arduinoURL + `/toggleLeaking`, true);
            xhr.send();
    
            xhr.onload = function() {
                console.log(`Response for leaking: ${xhr.responseText}`);
                updateSwitchState('leak-state-switch', switchElement);
            };
        });
    }

    function attachFireSwitchEvent(switchElement) {
        switchElement.addEventListener('change', function() {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", arduinoURL + `/toggleFire`, true);
            xhr.send();
    
            xhr.onload = function() {
                console.log(`Response for Fire: ${xhr.responseText}`);
                updateSwitchState('fire-state-switch', switchElement);
            };
        });
    }
    
    function initializeSwitchState(switchName, switchElement) {
        const fireSwitchState = localStorage.getItem(switchName) === 'true';
        switchElement.checked = fireSwitchState; 
    }
    
    function updateSwitchState(switchName, switchElement) {
        localStorage.setItem(switchName, switchElement.checked); 
    }

    function attachBlindsSliderEvent(blindsSlider) {
        blindsSlider.addEventListener('input', function(event) {
            const value = event.target.value;
            document.getElementById('blindsSliderValue').textContent = value;

            // Save the current slider value in localStorage
            localStorage.setItem('blindsSliderValue', value);

            var xhr = new XMLHttpRequest();
            xhr.open("GET", arduinoURL + `/setBlinds?value=${value}`, true);
            xhr.send();

            xhr.onload = function() {
                console.log(`Response for Blinds Position: ${xhr.responseText}`);
            };
        });
    }

    function restoreBlindsSliderValue(blindsSlider) {
        const savedValue = localStorage.getItem('blindsSliderValue');
        if (savedValue !== null) {
            blindsSlider.value = savedValue;
            document.getElementById('blindsSliderValue').textContent = savedValue;
        }
    }

    function attachTemperatureSliderEvent(temperatureSlider) {
        temperatureSlider.addEventListener('input', function(event) {
            const value = event.target.value;
            document.getElementById('sliderTemperatureValue').textContent = value;

            // Salvăm valoarea curentă a slider-ului pentru camera curentă în localStorage
            localStorage.setItem(`sliderTemperatureValue${currentRoom}`, value);
            checkTemperatureSlider = false;
            var xhr = new XMLHttpRequest();
            if(getAssociatedSensor('Temperature Control') == 'bme680'){
                xhr.open("GET", arduinoURL + `/setTemperature?valueBME=${value}`, true);
            } else {
                xhr.open("GET", arduinoURL + `/setTemperature?valueDHT=${value}`, true);
            }
            xhr.send();

            xhr.onload = function() {
                console.log(`Response for Temperature Control: ${xhr.responseText}`);
            };
        });

        
    }

    function restoreTemperatureSliderValue(temperatureSlider) {
        const savedValue = localStorage.getItem(`sliderTemperatureValue${currentRoom}`);
        if (savedValue !== null) {
            temperatureSlider.value = savedValue;
            document.getElementById('sliderTemperatureValue').textContent = savedValue;
        }
    }
});

function getAssociatedSensor(widgetName) {
    let roomDevices = JSON.parse(localStorage.getItem(currentRoom + '_devices')) || {};
    return roomDevices[widgetName] || "Niciun senzor asociat";
}

function openWidgetDetailsPopup(widgetType) {
    const widgetNameElement = document.getElementById('widget-name');
    const widgetImageElement = document.getElementById('widget-image');
    const widgetDetailsPopupElement = document.getElementById('widget-details-popup');
    const editButtonElement = document.getElementById('edit-popup'); // Presupunem că există un buton cu acest ID

    if (widgetNameElement && widgetImageElement && widgetDetailsPopupElement && editButtonElement) {
        // Ascunde imaginea și butonul de editare inițial pentru a-i afișa doar când este necesar
        widgetImageElement.style.display = 'none';
        editButtonElement.style.display = 'none'; // Ascunde butonul de editare

        // Tratează cazurile speciale pentru 'Blinds Control' și 'Music Player'
        if (widgetType === 'Blinds Control' || widgetType === 'Music Player') {
            widgetNameElement.textContent = widgetType;
            widgetNameElement.style.textAlign = 'center';
        } else if (widgetType === 'Lights Control') {
            // Comportament specific pentru 'Lights Control'
            let roomDevices = JSON.parse(localStorage.getItem(currentRoom + '_devices')) || {};
            let associatedDevice = roomDevices[widgetType] || "Niciun LED asociat";
            let ledNumber = associatedDevice.split(' ')[1] || "n/a";
            widgetNameElement.textContent = `LED ${ledNumber}`;
            widgetNameElement.style.textAlign = 'center';
            editButtonElement.style.display = 'block'; // Afișează butonul de editare
        } else {
            // Comportament standard pentru restul widget-urilor
            let sensorImage = getAssociatedSensor(widgetType);
            widgetNameElement.textContent = widgetType;
            widgetNameElement.style.textAlign = 'left';
            widgetImageElement.src = `../static/images/sensors/${sensorImage}.png`;
            widgetImageElement.style.display = 'block';
            editButtonElement.style.display = 'block'; // Afișează butonul de editare
        }

        // Afișează popup-ul
        widgetDetailsPopupElement.style.display = 'block';
    } else {
        console.error('Required elements not found in the document.');
    }
}

function closeWidgetDetailsPopup() {
    document.getElementById('widget-details-popup').style.display = 'none';
}

function closeWidgetPopup() {
    document.getElementById('widget-popup').style.display = 'none';
}

function openSensorPopup() {
    document.getElementById('sensor-popup').style.display = 'block';
}

function closeSensorPopup() {
    document.getElementById('sensor-popup').style.display = 'none';
}

function closeChartPopup(){
    document.getElementById('main-content').style.display = 'grid';
    document.getElementById('nav-bar').style.display = 'block';
    document.getElementById('chart-display-popup').style.display = 'none';
}

function selectSensor(sensorType, widgetName) {
    console.log(widgetName, ": sensor selected:", sensorType);
    saveSelectedDevice(widgetName, sensorType); 
    checkTemperatureSlider = true;
    fetchLatestSensorData();
    closeSensorPopup();
}

function showSensorPopup(sensors, widgetName, callback) {
    document.getElementById('widget-popup').style.display = 'none';
    const sensorList = document.getElementById('sensor-list');
    sensorList.innerHTML = '';
    sensors.forEach(sensor => {
        const sensorContainer = document.createElement('div');
        sensorContainer.className = 'sensor-container';

        const sensorImage = document.createElement('img');
        sensorImage.src = `../static/images/sensors/${sensor}.png`; 
        sensorImage.alt = sensor;
        sensorImage.className = 'sensor-image';

        const button = document.createElement('button');
        button.className = 'sensor-button';
        button.appendChild(sensorImage);
        button.onclick = function() {
            selectSensor(sensor, widgetName);
            callback(); // Apelăm callback-ul după selectarea senzorului
        };

        sensorContainer.appendChild(button);
        sensorList.appendChild(sensorContainer);
    });
    openSensorPopup();
    closeWidgetDetailsPopup();
    closeLedPopup();
}

function openLedPopup(widgetName, callback) {
    closeWidgetPopup();
    document.getElementById('led-popup').style.display = 'block';
    document.getElementById('set-led-button').onclick = function() {
        configureLED(widgetName);
        fetchLatestSensorData();
        callback(); // Apelăm callback-ul după configurarea LED-ului
    };
}

function closeLedPopup() {
    document.getElementById('led-popup').style.display = 'none';
}

function configureLED() {
    const ledNumber = document.getElementById('led-number').value;
    console.log("LED configured to number:", ledNumber);

    saveSelectedDevice('Lights Control', `LED ${ledNumber}`);
    updateLEDNumberInDetailsPopup(ledNumber);
    closeLedPopup();
}

function updateLEDNumberInDetailsPopup(ledNumber) {
    const widgetNameElement = document.getElementById('widget-name');
    if (widgetNameElement) {
        widgetNameElement.textContent = `LED ${ledNumber}`; 
    }
}

function saveSelectedDevice(widgetName, device) {
    let roomDevices = JSON.parse(localStorage.getItem(currentRoom + '_devices')) || {};
    roomDevices[widgetName] = device;
    localStorage.setItem(currentRoom + '_devices', JSON.stringify(roomDevices));
}

function setupEventListeners() {
    document.getElementById('widget-button').addEventListener('click', function() {
        document.getElementById('widget-popup').style.display = 'block';
    });

    document.getElementById('chart-button').addEventListener('click', function() {
        document.getElementById('main-content').style.display = 'none';
        document.getElementById('nav-bar').style.display = 'none';
        document.getElementById('chart-display-popup').style.display = 'flex';
    });

    document.querySelector('.close-button').addEventListener('click', function() {
        document.getElementById('widget-popup').style.display = 'none';
    });

    var sidebar = document.getElementById('nav-content');
    sidebar.addEventListener('click', function(e) {
        if (e.target && e.target.matches(".nav-button span")) {
            var roomName = e.target.textContent;
            loadRoomContent(roomName);
        }
    });

    document.getElementById('delete-popup').addEventListener('click', function() {
        deleteWidget();
        fetchLatestSensorData()
        closeWidgetDetailsPopup(); 
    });

    document.getElementById('edit-popup').addEventListener('click', function() {
        var widgetName = document.getElementById('widget-name').textContent;
        
        const finalizeWidgetAddition = () => {
            closeWidgetDetailsPopup();
            loadWidgetsForRoom(currentRoom);
            fetchLatestSensorData();
        };

        if (widgetName.includes('LED')) {
            openLedPopup(widgetName, finalizeWidgetAddition);
            closeWidgetDetailsPopup();
        } else {
            switch (widgetName) {
                case 'Temperature Display':
                case 'Humidity Display':
                case 'Temperature Control':
                    showSensorPopup(['bme680', 'dht11'], widgetName, finalizeWidgetAddition);
                    break;
                case 'Pressure Display':
                case 'Altitude Display':
                case 'CO2 Display':
                case 'IAQ Display':
                    showSensorPopup(['bme680'], widgetName, finalizeWidgetAddition);
                    break;
                case 'Security Control':
                    showSensorPopup(['pir'], widgetName, finalizeWidgetAddition);
                    break;
                case 'Leaking Control':
                    showSensorPopup(['water_level_sensor'], widgetName, finalizeWidgetAddition);
                    break;
                case 'Fire Control':
                    showSensorPopup(['mq135'], widgetName, finalizeWidgetAddition);
                    break;
                default:
                    console.error("Unsupported widget type:", widgetName);
                    break;
            }
            
        }    
    });

    document.getElementById('set-led-button').addEventListener('click', function() {
        configureLED(); 
    });
}

function deleteWidget() {
    const widgetNameElement = document.getElementById('widget-name');
    const widgetName = widgetNameElement ? widgetNameElement.textContent : '';
    const widgetType = widgetName.includes('LED') ? 'Lights Control' : widgetName.split(' - ')[0];

    removeWidgetFromLocalStorage(widgetType);

    removeWidgetFromDOM(widgetType).then(() => {
        console.log('Widget successfully removed from DOM');
    }).catch(error => {
        console.error('Error removing widget from DOM:', error);
    });

    loadWidgetsForRoom(currentRoom);
}

function removeWidgetFromLocalStorage(widgetType) {
    let roomWidgets = JSON.parse(localStorage.getItem(currentRoom)) || [];
    roomWidgets = roomWidgets.filter(widget => widget !== widgetType);
    localStorage.setItem(currentRoom, JSON.stringify(roomWidgets));
}

function removeWidgetFromDOM(widgetType) {
    const contentArea = document.getElementById('main-content');
    const widgetToRemove = contentArea.querySelector(`div[data-widget-type='${widgetType}']`);
    if (widgetToRemove) {
        contentArea.removeChild(widgetToRemove);
        return Promise.resolve();
    } else {
        return Promise.reject("Widget not found in DOM");
    }
}

function restoreSavedModels() {
    var savedModels = JSON.parse(localStorage.getItem('savedModels'));
    if (savedModels && savedModels.length > 0) {
        const sidebar = document.getElementById('nav-content');
        savedModels.forEach((model, index) => {
            const modelElement = document.createElement('div');
            modelElement.className = 'nav-button';
            modelElement.innerHTML = `<i class="fas fa-home"></i><span>${model.name}</span>`;
            modelElement.addEventListener('mouseenter', function() {
                document.getElementById('nav-content-highlight').style.top = `${index * 54 + 16}px`;
            });
            modelElement.addEventListener('click', function() {
                loadRoomContent(model.name);
            });
            sidebar.appendChild(modelElement);
        });
    }
}

function loadRoomContent(roomName) {
    if (currentRoom !== roomName) {
        currentRoom = roomName;
        loadWidgetsForRoom(roomName);
        fetchLatestSensorData();

        // Restaurează valorile slider-ului de temperatură pentru camera curentă
        const temperatureSlider = document.querySelector('input[type="range"][data-widget-type="Temperature Control"]');
        if (temperatureSlider) {
            restoreTemperatureSliderValue(temperatureSlider);
        }
    }
}

function loadWidgetsForRoom(roomName) {
    const roomWidgets = JSON.parse(localStorage.getItem(roomName)) || [];
    const contentArea = document.getElementById('main-content');
    contentArea.innerHTML = '';

    const roomTypeHeader = document.createElement('div');
    roomTypeHeader.className = 'room-type';
    roomTypeHeader.innerHTML = roomName;
    contentArea.appendChild(roomTypeHeader);

    const widgetPromises = roomWidgets.map(widget => {
        return loadWidgetAsync(widget);
    });

    Promise.all(widgetPromises).then(widgetElements => {
        widgetElements.forEach(widgetElement => {
            if (widgetElement) {
                contentArea.appendChild(widgetElement);
            }
        });
    }).catch(error => {
        console.error("Failed to load one or more widgets", error);
    });

    fetchLatestSensorData();
}

function loadWidgetAsync(widgetType) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const fileName = getFileName(widgetType);
        if (!fileName) {
            console.error(`Invalid widget type: ${widgetType}`);
            reject(`Invalid widget type: ${widgetType}`);
            return;
        }
        xhr.open('GET', `../static/widgets/${fileName}`, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    if (xhr.responseText) {
                        const widgetElement = document.createElement('div');
                        widgetElement.innerHTML = xhr.responseText;
                        widgetElement.setAttribute('data-widget-type', widgetType);
                        widgetElement.addEventListener('click', function(event) {
                            console.log(event.target.className);
                            if (event.target.className.includes('circle') || event.target.className.includes('content') || event.target.className.includes('phone')|| 
                                event.target.className.includes('container') || event.target.className.includes('card') || event.target.className.includes('info-wrapper')) {
                                openWidgetDetailsPopup(widgetType);
                            }
                        });
                        
                        resolve(widgetElement);
                    } else {
                        reject("No response text for widget");
                    }
                } else {
                    console.error("xhr status is not 200");
                    reject("xhr status is not 200");
                }
            }
        };
        xhr.send();
    });
}

function getFileName(widgetType) {
    switch (widgetType) {
        case 'Temperature Display':
            return 'temperature-card.html';
        case 'Humidity Display':
            return 'humidity-card.html';
        case 'Pressure Display':
            return 'pressure-card.html';
        case 'Altitude Display':
            return 'altitude-card.html';
        case 'CO2 Display':
            return 'co2-card.html';
        case 'IAQ Display':
            return 'iaq-card.html';
        case 'Lights Control':
            return 'led-toggle.html';
        case 'Security Control':
            return 'security-toggle.html';
        case 'Leaking Control':
            return 'leaking-toggle.html';
        case 'Fire Control':
            return 'fire-toggle.html';
        case 'Temperature Control':
            return 'temperature-wrapper.html';
        case 'Blinds Control':
            return 'blinds-wrapper.html';
        case 'Music Player':
            return 'music-card.html'
        default:
            return null;
    }
}

window.addWidgetToRoom = function(widgetName) {
    const contentArea = document.getElementById('main-content');
    const finalizeWidgetAddition = () => {
        saveWidgetForRoom(widgetName);
        loadWidgetsForRoom(currentRoom);
        document.getElementById('widget-popup').style.display = 'none';
    };

    switch (widgetName) {
        case 'Temperature Display':
        case 'Humidity Display':
        case 'Temperature Control':
            showSensorPopup(['bme680', 'dht11'], widgetName, finalizeWidgetAddition);
            break;
        case 'Pressure Display':
        case 'Altitude Display':
        case 'CO2 Display':
        case 'IAQ Display':
            showSensorPopup(['bme680'], widgetName, finalizeWidgetAddition);
            break;
        case 'Lights Control':
            openLedPopup(widgetName, finalizeWidgetAddition);
            break;
        case 'Security Control':
            showSensorPopup(['pir'], widgetName, finalizeWidgetAddition);
            break;
        case 'Leaking Control':
            showSensorPopup(['water_level_sensor'], widgetName, finalizeWidgetAddition);
            break;
        case 'Fire Control':
            showSensorPopup(['mq135'], widgetName, finalizeWidgetAddition);
            break;
        case 'Blinds Control':
                finalizeWidgetAddition();
                break;
        case 'Music Player':
            finalizeWidgetAddition();
            break;
        default:
            console.error("Unsupported widget type:", widgetName);
            break;
    }
    fetchLatestSensorData();
}

function saveWidgetForRoom(widgetName) {
    let roomWidgets = JSON.parse(localStorage.getItem(currentRoom)) || [];
    if (!roomWidgets.includes(widgetName)) {
        roomWidgets.push(widgetName); 
        localStorage.setItem(currentRoom, JSON.stringify(roomWidgets));
    }
}

function createChart(chartId, label, borderColor, data) {
    const ctx = document.getElementById(chartId).getContext('2d');
    const visibleData = data.slice(0); 
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: visibleData.map(item => item.date),
            datasets: [{
                label: label,
                data: visibleData.map(item => item.value),
                borderColor: borderColor,
                borderWidth: 1
            }]
        },
        options: chartOptions
    });
    
updateChartWidth(temperatureChart, tempData.length, 20); 
updateChartWidth(humidityChart, humData.length, 20);

}

function updateCharts(data) {
    const tempData = data.map(item => ({ date: item.date, value: item.average_temperature }));
    const humData = data.map(item => ({ date: item.date, value: item.average_humidity }));

    if (!temperatureChart) {
        temperatureChart = createChart('temperatureChart', 'Temperature', 'rgb(255, 99, 132)', tempData);
    } else {
        updateChartData(temperatureChart, tempData);
    }

    if (!humidityChart) {
        humidityChart = createChart('humidityChart', 'Humidity', 'rgb(54, 162, 235)', humData);
    } else {
        updateChartData(humidityChart, humData);
    }

    updateChartWidth(temperatureChart, tempData.length, 30); // Ensure this is called after chart updates
    updateChartWidth(humidityChart, humData.length, 30); // Ensure this is called after chart updates
}

function updateChartData(chart, data) {
    chart.data.labels = data.map(item => item.date);
    chart.data.datasets.forEach((dataset) => {
        dataset.data = data.map(item => item.value);
    });
    chart.update('none');
}

function updateChartWidth(chart, dataLength, minWidthPerDataPoint) {
    minWidthPerDataPoint = 300; 
    const newWidth = Math.max(chart.canvas.parentElement.offsetWidth, dataLength * minWidthPerDataPoint);
    chart.canvas.style.width = `${newWidth}px`;
    chart.canvas.parentElement.style.width = `${newWidth}px`;
    chart.resize();
}

function updateRealtimeValues(data) {
    console.log(data);

    var elementTemperatureDisplay = document.querySelector('div[data-widget-type="Temperature Display"]');
    var elementTemperatureControl = document.querySelector('div[data-widget-type="Temperature Control"]');
    var elementHumidityDisplay = document.querySelector('div[data-widget-type="Humidity Display"]');
    var elementPressureDisplay = document.querySelector('div[data-widget-type="Pressure Display"]');
    var elementAltitudeDisplay = document.querySelector('div[data-widget-type="Altitude Display"]');
    var elementCO2Display = document.querySelector('div[data-widget-type="CO2 Display"]');
    var elementIAQDisplay = document.querySelector('div[data-widget-type="IAQ Display"]');
    
    if(elementTemperatureDisplay) {
        if(getAssociatedSensor('Temperature Display') == 'bme680'){
            document.getElementById('temp').textContent = `${data.Temperature}`;
        } else {     
            document.getElementById('temp').textContent = `${data.DHTtemp}`;
        }
    }

    if(elementTemperatureControl && checkTemperatureSlider) {
        if(getAssociatedSensor('Temperature Control') == 'bme680'){
            document.getElementById('sliderTemperatureValue').textContent = `${data.Temperature}`;
            document.getElementById('temperatureWrapper').value = `${data.Temperature}`;
        } else {     
            document.getElementById('sliderTemperatureValue').textContent = `${data.DHTtemp}`;
            document.getElementById('temperatureWrapper').value = `${data.DHTtemp}`;
        }
    }

    if(elementHumidityDisplay) {
        if(getAssociatedSensor('Humidity Display') == 'bme680'){
            document.getElementById('hum').textContent = `${data.Humidity}`;
        } else {     
            document.getElementById('hum').textContent = `${data.DHThum}`;
        }
    }

    if(elementPressureDisplay) {
        document.getElementById('pressure').textContent = `${Math.round(data.Pressure)}`;
    } 

    if(elementAltitudeDisplay) {
        document.getElementById('altitude').textContent = `${data.Altitude}`;
    } 

    if(elementCO2Display) {
        document.getElementById('co2').textContent = `${data.CO2Eq}`;
    } 

    if(elementIAQDisplay) {
        document.getElementById('iaq').textContent = `${data.IAQsts}`;
    } 
}

function fetchAndDisplayData() {
    fetch(dataURL + '/data')
        .then(response => response.json())
        .then(data => {
            updateCharts(data);
        }).catch(error => console.error('Error fetching initial data:', error));
}

function fetchLatestSensorData() {
    fetch(dataURL + '/latest-sensor-data')
        .then(response => response.json())
        .then(data => {
            if (Object.keys(data).length > 0) {  
                updateRealtimeValues(data);  
            }
        }).catch(error => console.error('Error fetching latest sensor data:', error));
}
