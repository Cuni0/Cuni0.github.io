import * as THREE from "../lib/three.module.js";
import { OrbitControls } from "../lib/OrbitControls.module.js";
import * as CANNON from "../lib/cannon-es.js";
import { TWEEN } from "../lib/tween.module.min.js";
import { GUI } from "../lib/lil-gui.module.min.js";
import Stats from '../lib/stats.module.js';
import { FlakesTexture } from '../lib/FlakesTexture.js';




// Objetos y variables globales
let loader, material, materialBase, geometry;
let renderer, scene, camera, world, gui;
let cameraControls;
let canicas = [];
let ultimaColisionIndex = null;
let initialNumber = 0;
let animationInProgress = false;
let animationDuration = 800;
let editar;
let last = false;
let cameraOrtho;
let stats;
let collisionSound;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let radioCirculoGUI, numeroCanicasGUI, alturaGUI, vueltaButtonGUI,animationGUI;

const globalParameters = {
    radioCanica: 0.5,
    radioCirculo: 4.5,
    numeroCanicas: 10,
    heightCanicas: 2,
    loopAnimation: false,
    rotar: true,
    animationDuration: 2,
    mute: true,
};


const calculateAngle = (numeroPuntos) => {
    if (numeroPuntos < 2) { return null; }
    const angle = 360 / numeroPuntos;
    return angle;
};

function calculatePosition(canicaActual, totalCanicas) {
    const radius = globalParameters.radioCirculo;
    const angle = calculateAngle(totalCanicas);
    if (angle === null) { return null; }

    const normalizedAngle = (angle * canicaActual) % 360;
    const centralPoint = new THREE.Vector3(0, 0, 0);
    const x = centralPoint.x + radius * Math.cos((normalizedAngle) * (Math.PI / 180));
    const y = centralPoint.y + globalParameters.heightCanicas;
    const z = centralPoint.z + radius * Math.sin((normalizedAngle) * (Math.PI / 180));

    return new THREE.Vector3(x, y, z);
}



function updateRails() {
    const railRadius = globalParameters.radioCirculo - (globalParameters.radioCanica - 0.2);
    const railHeight = globalParameters.heightCanicas - 0.55;
    const railRadius2 = globalParameters.radioCirculo + (globalParameters.radioCanica - 0.2);
    scene.children.forEach((child) => {
        if (child.name === "rail1") {
            const geometry = new THREE.TorusGeometry(railRadius, 0.1, 16, 200);
            child.geometry.dispose();
            child.geometry = geometry;
            child.position.y = railHeight;
        } else if (child.name === "rail2") {
            const geometry = new THREE.TorusGeometry(railRadius2, 0.1, 16, 200);
            child.geometry.dispose();
            child.geometry = geometry;
            child.position.y = railHeight;
        }
    });
}

function createRail(environmentMap) {
    const railRadius = globalParameters.radioCirculo - (globalParameters.radioCanica - 0.2);
    const railHeight = globalParameters.heightCanicas - 0.55;
    const railSegments = 200;
    const geometry1 = new THREE.TorusGeometry(railRadius, 0.1, 16, railSegments);
    const material1 = new THREE.MeshStandardMaterial({
        color: 0xfffffff,
        metalness: 1,
        roughness: 0,
        envMap: environmentMap,
        envMapIntensity: 1,
    });
    const torus1 = new THREE.Mesh(geometry1, material1);
    torus1.rotation.x = Math.PI / 2;
    torus1.position.y = railHeight;
    torus1.name = "rail1";
    scene.add(torus1);

    const railRadius2 = globalParameters.radioCirculo + (globalParameters.radioCanica - 0.2);
    const geometry2 = new THREE.TorusGeometry(railRadius2, 0.1, 16, railSegments);
    const torus2 = new THREE.Mesh(geometry2, material1);
    torus2.rotation.x = Math.PI / 2;
    torus2.position.y = railHeight;
    torus2.name = "rail2";
    scene.add(torus2);

    torus1.material.needsUpdate = true;
    torus2.material.needsUpdate = true;
    torus1.castShadow = true;
    torus2.castShadow = true;
}

function updateCanicas() {
    while (canicas.length > globalParameters.numeroCanicas) {
        const canicaToRemove = canicas.pop();
        scene.remove(canicaToRemove.mesh);
        world.removeBody(canicaToRemove.body);
    }

    let sphereMaterial = canicas[0].mesh.material;

    for (let i = canicas.length; i < globalParameters.numeroCanicas; i++) {
        const position = calculatePosition(i, globalParameters.numeroCanicas);
        const sphere = new THREE.Mesh(geometry, sphereMaterial);
        const sphereBody = new CANNON.Body({
            mass: 8,
            shape: new CANNON.Sphere(globalParameters.radioCanica),
        });

        sphere.position.copy(position);
        sphereBody.position.copy(position);
        world.addBody(sphereBody);

        canicas.push({
            mesh: sphere,
            body: sphereBody,
            index: i,
        });
        sphere.castShadow = true;
        scene.add(sphere);

    }
    setColision();
    globalParameters.loopAnimation = false

    updateCanicasPosition();
}

function updateCanicasPosition() {
    canicas.forEach((canica, i) => {
        const position = calculatePosition(i, globalParameters.numeroCanicas);
        canica.mesh.position.copy(position);
        canica.body.position.copy(position);
    });
}
function init() {
    world = new CANNON.World();
    world.gravity.set(0, -9.8, 0);
    scene = new THREE.Scene();

    loader = new THREE.TextureLoader();

    setupRenderer();
    setupCamera();
    setupLights();

    window.addEventListener("resize", updateAspectRatio);

    stats = new Stats();
    document.body.appendChild(stats.dom);

}



function setupRenderer() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);
    renderer.antialias = true;
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0xAAAAAA);
    renderer.autoClear = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    //renderer.toneMappingExposure = 1.25;
    //renderer.setPixelRatio(window.devicePixelRatio);
}


function setupCamera() {
    const ar = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, ar, 1, 100);
    camera.position.set(0, 2, 10);
    cameraControls = new OrbitControls(camera, renderer.domElement);
    cameraControls.target.set(0, 1, 0);
    camera.lookAt(0, 1, 0);

    let frustumSize = 2 * globalParameters.radioCirculo + 5;
    cameraOrtho = new THREE.OrthographicCamera(
        -frustumSize / 2,
        frustumSize / 2,
        frustumSize / 2,
        -frustumSize / 2,
    );
    cameraOrtho.position.set(0, 20, 0);
    cameraOrtho.lookAt(0, 0, 0);
}


function setupLights() {
    const ambiental = new THREE.AmbientLight(0x222222);
    scene.add(ambiental);
    const direccional = new THREE.DirectionalLight(0xFFFFFF, 0.3);
    direccional.position.set(1, 6, 0);
    direccional.castShadow = true;
    scene.add(direccional);
    const puntual = new THREE.PointLight(0xFFFFFF, 0.5);
    puntual.position.set(-4, 2, 1);
    scene.add(puntual);
    const focal = new THREE.SpotLight(0xFFFFFF, 0.3);
    focal.position.set(8, 7, 0);
    focal.target.position.set(-7, 2, 0);
    focal.angle = Math.PI / 7;
    focal.penumbra = 0.3;
    focal.castShadow = true;
    focal.shadow.camera.far = 20;
    focal.shadow.camera.fov = 80;
    scene.add(focal);

    const focal2 = new THREE.SpotLight(0xFFFFFF, 0.3);
    focal2.position.set(-8, 7, 0);
    focal2.target.position.set(7, 2, 0);
    focal2.angle = Math.PI / 7;
    focal2.penumbra = 0.3;
    focal2.castShadow = true;
    scene.add(focal2);

    /*const helper = new THREE.PointLightHelper(focal);
    scene.add(helper)
    const helper2 = new THREE.PointLightHelper(focal2);
    scene.add(helper2)*/
}

function createPlatform() {
    const texture = loader.load("../textures/golf.jpg");
    const platformRadius = globalParameters.radioCirculo + 10;
    const textureRepeats = 8;

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.repeat.set(textureRepeats, textureRepeats);

    const matsuelo = new THREE.MeshStandardMaterial({ color: "rgb(150,150,150)", map: texture });
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(platformRadius, 100), matsuelo);
    suelo.rotation.x = Math.PI * -0.5;

    suelo.position.y = -2;
    suelo.receiveShadow = true;
    scene.add(suelo);
}

function loadScene() {
    geometry = new THREE.SphereGeometry(globalParameters.radioCanica, 32, 32);
    material = new THREE.MeshPhysicalMaterial({ color: 0x049ef4 });
    material.emissiveIntensity=0.3;
    material.ior = 2;
    material.reflectivity= 0.5;
    material.roughness = 0;
    materialBase = new THREE.MeshPhysicalMaterial({ color: 0x049ef4 });//
    materialBase.emissiveIntensity=0.3;
    const environmentMap = loader.load(
        './images/background/metro_vijzelgracht.jpg',
        () => {
            environmentMap.mapping = THREE.EquirectangularReflectionMapping;
            environmentMap.colorSpace = THREE.SRGBColorSpace;
            scene.background = environmentMap;
            scene.receiveShadow = true;
            createRail(environmentMap);
            createPlatform();
            gui = new GUI();
            guiControls(gui);
            guiMeshPhysicalMaterial(gui, material, geometry);
            collisionSound = new Audio("../songs/colision-song.mp4");
            collisionSound.volume = 0.4;
        });

    canicas = [];
    for (let i = 0; i < globalParameters.numeroCanicas; i++) {
        const position = calculatePosition(i, globalParameters.numeroCanicas);
        const sphere = new THREE.Mesh(geometry, material);
        const sphereBody = new CANNON.Body({
            mass: 8,
            shape: new CANNON.Sphere(globalParameters.radioCanica),
        });
        sphere.position.copy(position);
        sphereBody.position.copy(position);
        world.addBody(sphereBody);
        canicas.push({
            mesh: sphere,
            body: sphereBody,
            index: i,
        });
        sphere.material.envMap = environmentMap;
        sphere.material.envMapIntensity = 0.5;
        sphere.material.needsUpdate = true;
        sphere.castShadow = true;
        //sphere.receiveShadow = false;
        scene.add(sphere);
    }
    setColision();
    document.addEventListener('click', onClick);
}

function getRandomColor() {
    return Math.random() * 0xffffff;
}

function playCollisionSound() {
    if (collisionSound && !globalParameters.mute) {
        collisionSound.currentTime = 0;
        collisionSound.play();
    }
}

function guiControls(gui) {
    const folder = gui.addFolder('Animación')
    
    animationGUI =folder.add(globalParameters, 'loopAnimation').name('Animación en bucle').onChange(() => {
        if (!globalParameters.loopAnimation) { last = true; animationDuration = 50; }
        else if (!animationInProgress) {togleGuiDisable(true); animateMovement(canicas[initialNumber]); }

    });

    folder.add(globalParameters, 'rotar').name('Rotación').onChange(s => {
        if(!s){
            canicas.forEach((canica) => {
                canica.mesh.rotation.x = 0;
                canica.mesh.rotation.y = 0;
            });
         }
    });

    folder.add(globalParameters, 'animationDuration', 0.1, 10).name('Velocidad Animación')
        .onChange(s => {
            setaAnimationDuration(s);
        });

    radioCirculoGUI = folder.add(globalParameters, 'radioCirculo', 4, 10).name('Radio Circulo').onChange(() => {
        updateRails();
        updateCanicasPosition();
        //updatePlataform();
        updateCameraOrtho();
    });
    numeroCanicasGUI = folder.add(globalParameters, 'numeroCanicas', 3, 20, 1).name('Número Canicas').onChange(() => {
        updateCanicas();
        initialNumber = 0;
        ultimaColisionIndex = 0;

    });
    alturaGUI= folder.add(globalParameters, 'heightCanicas', 1, 5).name('Altura Canicas').onChange(() => {
        updateCanicasPosition();
        updateRails();
    });
    folder.add(globalParameters, 'mute', 0, 1).name('Silenciar');

    const vueltaButton = { vuelta: () => onClickVuelta() };
    vueltaButtonGUI = folder.add(vueltaButton, 'vuelta').name('Una Vuelta');
}

function togleGuiDisable(disable) {
    if (disable) {
        radioCirculoGUI.disable();
        numeroCanicasGUI.disable();
        alturaGUI.disable();
        vueltaButtonGUI.disable();
        animationGUI.disable();
    } else {
        radioCirculoGUI.enable();
        numeroCanicasGUI.enable();
        alturaGUI.enable();
        vueltaButtonGUI.enable();
        animationGUI.enable();
    }
}

function setaAnimationDuration(s) {
    animationDuration = 1000 - s * 100;
}

function setColision() {
    for (let i = 0; i < canicas.length; i++) {
        const currentBody = canicas[i].body;
        const nextIndex = (i + 1) % canicas.length;
        const nextBody = canicas[nextIndex].body;
        currentBody.addEventListener("collide", function (event) {
            if (event.body === nextBody) {
                if (ultimaColisionIndex === null || ultimaColisionIndex == i) {
                    playCollisionSound();
                    animateMovement(canicas[nextIndex]);
                    ultimaColisionIndex = nextIndex;
                }
            }
        });
    }
}

function onClickVuelta() {
    if (animationInProgress) return;
    animationInProgress = true;
    togleGuiDisable(true);
    animateMovement(canicas[initialNumber]);
}

function animateMovement(canicaActual) {
    let angle = calculateAngle(canicas.length);
    let lastNumber = ((initialNumber - 1) % canicas.length + canicas.length) % canicas.length;

    if (angle === null || !canicaActual.mesh) { return; }
    if (canicaActual.index === lastNumber) {
        if (globalParameters.loopAnimation) {
            angle *= 2;
            animationDuration *= 2;
        }
        initialNumber = lastNumber;
    }

    const currentAngle = Math.atan2(canicaActual.mesh.position.z, canicaActual.mesh.position.x) * (180 / Math.PI);
    const nextAngle = (currentAngle + angle) % 360;

    const nextPosition = calculatePositionByAngle(nextAngle);

    const midAngle1 = currentAngle + ((nextAngle - currentAngle) / 3);
    const midPoint1 = calculatePositionByAngle(midAngle1);

    const midAngle2 = currentAngle + 2 * ((nextAngle - currentAngle) / 3);
    const midPoint2 = calculatePositionByAngle(midAngle2);

    new TWEEN.Tween(canicaActual.mesh.position)
        .to({ x: [midPoint1.x, midPoint2.x, nextPosition.x], y: [midPoint1.y, midPoint2.y, nextPosition.y], z: [midPoint1.z, midPoint2.z, nextPosition.z] }, animationDuration)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => {
            if(globalParameters.rotar){
                canicaActual.mesh.rotation.x += 0.05;
                canicaActual.mesh.rotation.y += 0.02; 
            }
        })
        .start();

    new TWEEN.Tween(canicaActual.body.position)
        .to({ x: [midPoint1.x, midPoint2.x, nextPosition.x], y: [midPoint1.y, midPoint2.y, nextPosition.y], z: [midPoint1.z, midPoint2.z, nextPosition.z] }, animationDuration)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onStart(() => {
        })
        .onComplete(() => {
            if (canicaActual.index === lastNumber) {
                syncBodiesWithMeshes();
                if (globalParameters.loopAnimation) {
                    animationInProgress = true;
                    togleGuiDisable(true);
                    animationDuration /= 2;
                } else {
                    animationInProgress = false;
                    togleGuiDisable(false);
                    if (last) {
                        last = false;
                        setaAnimationDuration(globalParameters.animationDuration);
                    }
                }
            }
        })
        .start();

}

function calculatePositionByAngle(angle) {
    const radius = globalParameters.radioCirculo;
    const normalizedAngle = angle % 360;
    const x = radius * Math.cos((normalizedAngle) * (Math.PI / 180));
    const y = globalParameters.heightCanicas;
    const z = radius * Math.sin((normalizedAngle) * (Math.PI / 180));

    return new THREE.Vector3(x, y, z);
}

function syncBodiesWithMeshes() {
    canicas.forEach((canica) => {
        canica.body.position.copy(canica.mesh.position);
        //canica.body.quaternion.copy(canica.mesh.quaternion);
    });
}

function updateAspectRatio() {
    const ar = window.innerWidth / window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = ar;
    camera.updateProjectionMatrix();
}

function updateCameraOrtho() {
    const frustumSize = 2 * globalParameters.radioCirculo + 5;
    cameraOrtho.left = -frustumSize / 2;
    cameraOrtho.right = frustumSize / 2;
    cameraOrtho.top = frustumSize / 2;
    cameraOrtho.bottom = -frustumSize / 2;
    cameraOrtho.updateProjectionMatrix();
}

function render() {
    requestAnimationFrame(render);
    renderer.clear();
    stats.update();
    cameraControls.update();
    TWEEN.update();
    world.fixedStep()
    syncBodiesWithMeshes();
    renderer.render(scene, camera);

    const width = window.innerWidth * 0.20;
    const left = 0;
    const top = window.innerHeight - width;
    renderer.setViewport(left, top, width, width);
    renderer.setScissor(left, top, width, width);
    renderer.setScissorTest(true);

    renderer.render(scene, cameraOrtho);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
}

init();
loadScene();
render();


function guiMeshPhysicalMaterial(gui, material, geometry) {

    const data = {
        color: material.color.getHex(),
        emissive: material.emissive.getHex(),
        envMaps: envMapKeys[0],
        roughnessMap: roughnessMapKeys[0],
        alphaMap: alphaMapKeys[0],
        metalnessMap: alphaMapKeys[0],
        sheenColor: material.sheenColor.getHex(),
        specularColor: material.specularColor.getHex(),
        iridescenceMap: alphaMapKeys[0],
        map: textureKeys[0],
        normalMap: normalMapKeys[0],
        clearcoatNormalMap: clearcoatNormalMapKeys[0],
        presets: { none: 'none', Canica:'canica', Metalica: 'metalica' , Brillante: 'brillante', Fibra: 'fibra', Golf: 'golf', Rallada: 'rallada' },
    };/*Metalizada: 'metalizada'*/
    editar = gui.addFolder('Editar esferas');
    const folderBasic = editar.addFolder('Basic');

    folderBasic.addColor(data, 'color').onChange(handleColorChange(material.color));
    folderBasic.add(material, 'transparent').onChange(needsUpdate(material));
    folderBasic.add(material, 'opacity', 0, 1).step(0.01);
    folderBasic.add(material, 'visible');

    const folder = editar.addFolder('Advanced');

    folder.add(material, 'flatShading').onChange(needsUpdate(material));
    folder.add(material, 'wireframe');
    folder.add(material, 'emissiveIntensity',0, 1);
    folder.addColor(data, 'emissive').onChange(handleColorChange(material.emissive));
    folder.add(material, 'roughness', 0, 1);
    folder.add(material, 'metalness', 0, 1);
    folder.add(material, 'ior', 1, 2.3).setValue(2.3);
    folder.add(material, 'reflectivity', 0, 1).setValue(0.5);;
    folder.addColor(data, 'sheenColor').onChange(handleColorChange(material.sheenColor));
    folder.add(material, 'sheen', 0, 1);
    folder.add(material, 'sheenRoughness', 0, 1);
    folder.add(material, 'clearcoat', 0, 1).step(0.01);
    folder.add(material, 'clearcoatRoughness', 0, 1).step(0.01);


    const textureFolder = editar.addFolder('Texture');
    const vueltaButton = { vuelta: () => onClickImage() };
    textureFolder.add(vueltaButton, 'vuelta').name('Añade tu propia textura');
    textureFolder.add(data, 'map', textureKeys).onChange(updateTexture(material, 'map', textureDictionary)).setValue('Glass');
    
    textureFolder.add(data, 'roughnessMap', roughnessMapKeys).onChange(updateTexture(material, 'roughnessMap', roughnessMaps));
    textureFolder.add(data, 'normalMap', normalMapKeys).onChange(updateTexture(material, 'normalMap', normalMap));
    //textureFolder.add(data, 'Presets', data.presets).onChange(s => presets(s));
    editar.close();
}

function needsUpdate(material) {
    return function () {
        material.needsUpdate = true;
    };
}

function handleColorChange(color) {
    return function (value) {
        if (typeof value === 'string') {
            value = value.replace('#', '0x');
        }
        color.setHex(value);
    };
}

function updateTexture(material, materialKey, textures) {
    return function (key) {
        material[materialKey] = textures[key];
        material.needsUpdate = true;
    };
}

function getObjectsKeys(obj) {
    const keys = [];
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            keys.push(key);
        }
    }
    return keys;
}

/*function guiScene(gui, scene) {
const folder = gui.addFolder('Scene');
const data = {
  background: '#000000',
  'ambient light': ambientLight.color.getHex()
};
folder.addColor(data, 'ambient light').onChange(handleColorChange(ambientLight.color));
guiSceneFog(folder, scene);

}*/

const envMaps = (function () {

    const reflectionCube = loader.load('./images/background/metro_vijzelgracht.jpg');

    //refractionCube.mapping = THREE.CubeRefractionMapping;

    return {
        none: null,
        reflection: reflectionCube,
        refraction: reflectionCube
    };

})();


const roughnessMaps = (function () {

    const bricks = loader.load('./textures/edit/brick_roughness.jpg');
    bricks.wrapT = THREE.RepeatWrapping;
    bricks.wrapS = THREE.RepeatWrapping;
    bricks.repeat.set(9, 1);

    const scratch = loader.load('./textures/glass3.png');

    return {
        none: null,
        bricks: bricks,
        Scratch: scratch
    };

})();

const alphaMaps = (function () {
    const fibers = loader.load('./textures/edit/alphaMap.jpg');
    fibers.wrapT = THREE.RepeatWrapping;
    fibers.wrapS = THREE.RepeatWrapping;
    fibers.repeat.set(9, 1);

    return {
        none: null,
        fibers: fibers
    };

})();


const textureDictionary = (function () {
    const bricks = loader.load('./textures/edit/brick_diffuse.jpg');
    bricks.wrapS = THREE.RepeatWrapping;
    bricks.wrapT = THREE.RepeatWrapping;
    bricks.repeat.set(9, 1);

    const diffuse = loader.load('./textures/Carbon.png');
    diffuse.colorSpace = THREE.SRGBColorSpace;
    diffuse.wrapS = THREE.RepeatWrapping;
    diffuse.wrapT = THREE.RepeatWrapping;
    diffuse.repeat.x = 10;
    diffuse.repeat.y = 10;

    const Glass = loader.load('./textures/glass3.png');
    const Carbon = loader.load('./textures/Carbon.png');
    const Carbon_neutral = loader.load('./textures/Carbon_Normal.png');
    const cloudDark = loader.load('./textures/cloud-dark.png');
    const disturb = loader.load('./textures/disturb.jpg');
    const env_lat_lon = loader.load('./textures/env_lat-lon.png');
    const golf = loader.load('./textures/golf.jpg');
    const hexed = loader.load('./textures/hexed.png');
    const lavatile = loader.load('./textures/lavatile.jpg');
    const noise = loader.load('./textures/noise.png');
    const Scratched1 = loader.load('./textures/Scratched_gold_01_1K_AO.png');
    const Scratched2 = loader.load('./textures/Scratched_gold_01_1K_Roughness.png');
    const ScratchedTexture = loader.load('./textures/Scratched_gold_01_1K_Normal.png');
    const water = loader.load('./textures/water.jpg');
    const waterTexture = loader.load('./textures/Water_1_M_Normal.jpg');
    const waterdudv = loader.load('./textures/waterdudv.jpg');
    const waternormals = loader.load('./textures/waternormals.jpg');
    const Water_2_M_Normal = loader.load('./textures/Water_2_M_Normal.jpg');
    return {
        none: null,
        Bricks: bricks,
        Diffuse: diffuse,
        Glass: Glass,
        Carbon: Carbon,
        Carbon_neutral: Carbon_neutral,
        cloudDark: cloudDark,
        disturb: disturb,
        env_lat_lon: env_lat_lon,
        golf: golf,
        hexed: hexed,
        lavatile: lavatile,
        noise: noise,
        Scratched1: Scratched1,
        Scratched2: Scratched2,
        ScratchedTexture: ScratchedTexture,
        water: water,
        waterTexture: waterTexture,
        waterdudv: waterdudv,
        waternormals: waternormals,
        Water_2_M_Normal: Water_2_M_Normal
    };

})();

const normalMap = (function () {

    const carbonNormal = loader.load('./textures/Carbon_Normal.png');
    carbonNormal.wrapS = THREE.RepeatWrapping;
    carbonNormal.wrapT = THREE.RepeatWrapping;
    carbonNormal.repeat.x = 10;
    carbonNormal.repeat.y = 10;

    const waterNormal = loader.load('./textures/Water_1_M_Normal.jpg');

    const flakes = new THREE.CanvasTexture(new FlakesTexture());
    flakes.wrapS = THREE.RepeatWrapping;
    flakes.wrapT = THREE.RepeatWrapping;
    flakes.repeat.x = 10;
    flakes.repeat.y = 6;
    flakes.anisotropy = 16;

    const golfNormal = loader.load('textures/golf.jpg');

    return {
        none: null,
        carbonNormal: carbonNormal,
        waterNormal: waterNormal,
        flakes: flakes,
        golfNormal: golfNormal,
    };

})();

const clearcoatNormalMap = (function () {

    const scratched = loader.load('./textures/Scratched_gold_01_1K_Normal.png');

    return {
        none: null,
        scratched: scratched,
    };

})();

function presets(preset) {
    materialBase.color= new THREE.Color(0x049ef4);
    switch (preset) {
        case 'none':
            material.copy(materialBase);
            material.emissiveIntensity=0.3;
            break;
        case 'metalizada':
            materialBase.color = new THREE.Color(0xffffff);
            material.copy(materialBase);

            material.emissiveIntensity=0;
            material.metalness = 1.0;
            material.roughness = 0;
            
            break;
        case 'brillante':
            materialBase.color = new THREE.Color(0x0000ff);
            material.copy(materialBase);

            material.emissiveIntensity=0;
            material.clearcoat = 1.0;
            material.clearcoatRoughness = 0.1;
            material.metalness = 0.9;
            material.roughness = 0.5;
            material.normalScale = new THREE.Vector2(0.15, 0.15);
            material['normalMap'] = normalMap['flakes'];
            break;
        case 'fibra':
            material.copy(materialBase);
            material.emissiveIntensity=0;

            material.roughness = 0.5;
            material.clearcoat = 1.0;
            material.clearcoatRoughness = 0.1;
            material['map'] = textureDictionary['Diffuse'];
            material['normalMap'] = normalMap['carbonNormal'];
            break;
        case 'golf':
            material.copy(materialBase);
            material.emissiveIntensity=0;

            material.metalness = 0.0;
            material.roughness = 0.1;
            material.clearcoat = 1.0;
            material['normalMap'] = normalMap['golfNormal'];
            material['clearcoatNormalMap'] = clearcoatNormalMap['scratched'];
            break;
        case 'rallada':
            materialBase.color = new THREE.Color(0xff0000);
            material.copy(materialBase);
            material.emissiveIntensity=0;

            material.clearcoat = 1.0;
            material.metalness = 1.0;
            material['normalMap'] = normalMap['waterNormal'];
            material['clearcoatNormalMap'] = clearcoatNormalMap['scratched'];
            material.normalScale = new THREE.Vector2(0.15, 0.15);
            break;
        case 'canica':
            materialBase.color = new THREE.Color(0x7889ce);
            material.copy(materialBase);
            material.emissiveIntensity=0;

            material.metalness = 1;
            material.roughness = 1;
            material.rougthnessMap = roughnessMaps['Scratch'];
            break;
        case 'metalica':
            materialBase.color = new THREE.Color(0xffffff);
            material.copy(materialBase);
            material.emissiveIntensity=0.3;
            material.metalness = 1;
            material.roughness = 0;
            break;
        default:
            break;
    }
    
    //material.needsUpdate = true;
}

const envMapKeys = getObjectsKeys(envMaps);
const envMapKeysPBR = envMapKeys.slice(0, 2);
const roughnessMapKeys = getObjectsKeys(roughnessMaps);
const alphaMapKeys = getObjectsKeys(alphaMaps);
const textureKeys = getObjectsKeys(textureDictionary);
const normalMapKeys = getObjectsKeys(normalMap);
const clearcoatNormalMapKeys = getObjectsKeys(clearcoatNormalMap);


function onClickImage() {
    const imageInput = document.getElementById('imageInput');
    imageInput.addEventListener('change', handleImageUpload, false);
    imageInput.click();
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    materialBase.color= new THREE.Color(0xffffff);
    material.copy(materialBase);
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const texture = loader.load(e.target.result);
        material.emissiveIntensity=0;
        material.map = texture;
        material.needsUpdate = true;
      };
  
      reader.readAsDataURL(file);
    }
  }

  function onClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(canicas.map(canica => canica.mesh));

    if (intersects.length > 0) {
        const clickedCanica = intersects[0].object;
        focusCameraOnCanica(clickedCanica);
        event.stopPropagation();
    }
}

function focusCameraOnCanica(canica) {
    cameraControls.enabled = false;
    const targetPosition = canica.position.clone();
    const directionToOrigin = new THREE.Vector3(0, globalParameters.heightCanicas-1, 0).sub(targetPosition).normalize();
    const distanciaDeseada = -globalParameters.radioCirculo*0.5;
    const offset = directionToOrigin.multiplyScalar(distanciaDeseada);
    const target = targetPosition.add(offset);
    const loock = new THREE.Vector3(0, globalParameters.heightCanicas, 0); 
    const altura= globalParameters.heightCanicas;
    new TWEEN.Tween(camera.position).to(target, 1000)
    .interpolation( TWEEN.Interpolation.Bezier )
    .start();
    new TWEEN.Tween(camera.lookAt).to(loock, 1000)
    .onComplete(() => {
        cameraControls.enabled = true;
        editar.open();
    })
    .start();
    new TWEEN.Tween( canica.position).
    to( {y:[altura+3,altura+1, altura+2, altura]}, 1500)
    .interpolation( TWEEN.Interpolation.Bezier )
    .easing( TWEEN.Easing.Bounce.Out )
    .start();
    
}

