function transition() {
    var tl = new TimelineMax();

    tl.to(CSSRulePlugin.getRule('body:before'), 0.2, {cssRule: {top: '50%'}, ease: Power2.easeOut}, 'close')
      .to(CSSRulePlugin.getRule('body:after'), 0.2, {cssRule: {bottom: '50%'}, ease: Power2.easeOut}, 'close')
      .to($('.loader'), 0.2, {opacity: 1})
      .to(CSSRulePlugin.getRule('body:before'), 0.2, {cssRule: {top: '0%'}, ease: Power2.easeOut}, '+=1.5', 'open')
      .to(CSSRulePlugin.getRule('body:after'), 0.2, {cssRule: {bottom: '0%'}, ease: Power2.easeOut}, '-=0.2', 'open')
      .to($('.loader'), 0.2, {opacity: 0}, '-=0.2')
      .fromTo('.cd-main-content', 0.2, {display: 'none'}, {display: 'block', ease: Power2.easeIn});
}

function showLoadingScreen(show) {
    const loadingScreen = document.getElementById('loading-screen');
    if (show) {
        loadingScreen.style.display = 'block';
    } else {
        loadingScreen.style.display = 'none';
    }
}


document.addEventListener('DOMContentLoaded', function() {
    
    loadModel('../static/images/room/scene.gltf', 'Main Room');
    document.getElementsByClassName('save-btn')[0].addEventListener('click', function(e) {
        console.log(modelManager.saveModels());
        e.preventDefault();
        transition() ;
        setTimeout(
        function() {
            window.location.href = "/home";
        }, 
            1800  
        );
    });
    
    
    const modelManager = {
        models: [],
        addModel(model) {
            const id = this.models.length + 1;
            const modelName = model.name || `Model ${id}`;
            this.models.push({ id, model, modelName });
            console.log(`Added: ${modelName}`);
            return id;
        },
        getModel(id) {
            return this.models.find(m => m.id === id)?.model;
        },
        removeModel(id) {
            const modelIndex = this.models.findIndex(m => m.id === id);
            if (modelIndex > -1) {
                const modelData = this.models[modelIndex];
                scene.remove(modelData.model);
                this.models.splice(modelIndex, 1);
                console.log(`Removed: ${modelData.modelName}`);
            }
        },
        saveModels() {
            const modelData = this.models.map(m => ({ id: m.id, name: m.modelName }));
            localStorage.setItem('savedModels', JSON.stringify(modelData));
            console.log('Models saved:', modelData);
        },
        loadModels() {
            const modelData = JSON.parse(localStorage.getItem('savedModels') || '[]');
            modelData.forEach(m => {
                console.log(`Loading model: ${m.name}`);
            });
        }
    };

    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x363A3A);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2500);
    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(document.getElementById('3d-view').clientWidth, document.getElementById('3d-view').clientHeight);
    document.getElementById('3d-view').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xFFFFFF);
    scene.add(light);

    camera.position.z = 5;

    const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    const transformControls = new THREE.TransformControls(camera, renderer.domElement);

    scene.add(transformControls);

    transformControls.addEventListener('dragging-changed', event => {
        const controlsEnabled = !event.value;
        orbitControls.enabled = controlsEnabled; 
    });

    function toScreenPosition(obj, camera) {
        const vector = new THREE.Vector3();
        const context = renderer.getContext();
        const widthHalf = 0.5 * context.canvas.width;
        const heightHalf = 0.5 * context.canvas.height;
    
        obj.updateMatrixWorld();
        vector.setFromMatrixPosition(obj.matrixWorld);
        vector.project(camera);
    
        vector.x = (vector.x * widthHalf) + widthHalf;
        vector.y = -(vector.y * heightHalf) + heightHalf;
    
        return { x: vector.x, y: vector.y };
    }
    
    function createControlButtons(obj) {
        let div = document.getElementById('control-buttons');
        if (!div) {
            div = document.createElement('div');
            div.id = 'control-buttons';
            document.body.appendChild(div);
        }
    
        div.style.display = 'block';

        const pos = toScreenPosition(obj, camera);
        div.style.position = 'absolute';
        div.style.left = `${pos.x}px`;
        div.style.top = `${pos.y - 50}px`;
        div.innerHTML = `
            <button id="translate-btn" style="border:0px transparent; background-color: transparent;"><i class="fa fa-arrows-alt transparent-background"></i></button>
            <button id="rotate-btn" style="border:0px transparent; background-color: transparent;"><i class="fa fa-undo" aria-hidden="true"></i></button>
            <button id="scale-btn" style="border:0px transparent; background-color: transparent;"><i class="fa fa-expand" aria-hidden="true"></i></button>
            <button id="delete-btn" style="border:0px transparent; background-color: transparent;"><i class="fa fa-trash" aria-hidden="true"></i></button>
        `;
    
        setTimeout(() => {
            document.getElementById('translate-btn').addEventListener('click', function() {
                setTransformMode('translate');
            });
    
            document.getElementById('rotate-btn').addEventListener('click', function() {
                rotateModel();
            });
    
            document.getElementById('scale-btn').addEventListener('click', function() {
                setTransformMode('scale');
            });
    
            document.getElementById('delete-btn').addEventListener('click', function() {
                deleteModel();
            });
        }, 0);
    }
    
    window.rotateModel = function() {
        if (transformControls.object) {
            transformControls.object.rotation.y += Math.PI / 2; 
            render();
        }
    };
    
    function deleteModel() {
        if (transformControls.object) {
            const selectedObject = transformControls.object;
    
            const modelData = modelManager.models.find(m => m.model === selectedObject);
            if (modelData) {
                modelManager.removeModel(modelData.id);
            }
    
            scene.remove(selectedObject);
            transformControls.detach();
    
            if (selectedObject.geometry) selectedObject.geometry.dispose();
            if (selectedObject.material) {
                if (Array.isArray(selectedObject.material)) {
                    selectedObject.material.forEach(material => material.dispose());
                } else {
                    selectedObject.material.dispose();
                }
            }
    
            const controlDiv = document.getElementById('control-buttons');
            if (controlDiv) {
                controlDiv.style.display = 'none'; 
            }
    
            render(); 
        }
    }
    
    
    function setTransformMode(mode) {
        transformControls.setMode(mode);
    }

    transformControls.addEventListener('objectChange', function() {
        if (transformControls.object) {
            createControlButtons(transformControls.object);
        } else {
            const div = document.getElementById('control-buttons');
            if (div) div.style.display = 'none';
        }
    });

    window.setTransformMode = function(mode) {
        transformControls.setMode(mode);
    };

    orbitControls.enableZoom = true;
    orbitControls.enableRotate = true;

    const models = [];
    const gridPositions = [];
    const gridSize = 2;
    const spacing = 1.5;

    for (let x = -gridSize; x <= gridSize; x++) {
        for (let z = -gridSize; z <= gridSize; z++) {
            if (Math.abs(x) + Math.abs(z) <= gridSize)
                gridPositions.push({ x: x * spacing, y: 0, z: z * spacing });
        }
    }

    let nextPositionIndex = 0;

    function loadModel(modelPath, modelName) {
        const loader = new THREE.GLTFLoader();
        loader.load(modelPath, function(gltf) {
            const newModel = gltf.scene;
            const position = gridPositions[nextPositionIndex % gridPositions.length];
            newModel.position.set(position.x, position.y, position.z);
    
            // Verifica și evită numele duplicate
            let uniqueName = modelName || `Model ${modelManager.models.length + 1}`;
            let nameExists = modelManager.models.some(m => m.modelName === uniqueName);
            let duplicateCount = 1;
            while (nameExists) {
                uniqueName = `${modelName} (${duplicateCount++})`;
                nameExists = modelManager.models.some(m => m.modelName === uniqueName);
            }
            newModel.name = uniqueName;
    
            const box = new THREE.Box3().setFromObject(newModel);
            const size = box.getSize(new THREE.Vector3());
            const desiredHeight = 1.0;
            const scaleFactor = desiredHeight / size.y;
            newModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
            console.log(models);
            models.push(newModel);
            scene.add(newModel);
            transformControls.attach(newModel);
            createControlButtons(newModel);
            modelManager.addModel(newModel);
            render();
            nextPositionIndex++;
        }, undefined, function(error) {
            console.error('An error happened:', error);
        });
    }
    
    
    function render() {
        orbitControls.update(); 
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }

    render();

    document.querySelectorAll('.config-button').forEach(button => {
        button.addEventListener('click', () => {
            const modelPath = `../static/images/${button.id.replace('add-', '')}/scene.gltf`;
            loadModel(modelPath, `${button.id.replace('add-', '')}`);
        });
    });

    

});

