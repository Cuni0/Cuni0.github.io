import * as THREE from "../lib/three.module.js";
import { GUI } from "../lib/lil-gui.module.min.js";
import { OrbitControls } from "../lib/OrbitControls.module.js";
import Stats from '../lib/stats.module.js';
import { FlakesTexture } from '../lib/FlakesTexture.js';

let container, stats, gui, controls, mesh;
let camera, scene, renderer;
let particleLight;
let loader;
let sphere, material, materialBase, texture;

init();
render();

function init() {
  container = document.getElementById('container');
  document.body.appendChild(container);

  camera = new THREE.PerspectiveCamera(27, window.innerWidth / window.innerHeight, 0.25, 50);
  camera.position.z = 10;

  scene = new THREE.Scene();

  //scene.add(group);

  loader = new THREE.TextureLoader();
  const environmentMap = loader.load(
    './images/background/metro_vijzelgracht.jpg',
    (envTexture) => {
      environmentMap.mapping = THREE.EquirectangularReflectionMapping;
      environmentMap.colorSpace = THREE.SRGBColorSpace;
      scene.background = environmentMap;
      scene.environment = envTexture;
      const geometry = new THREE.SphereGeometry(.8, 64, 32);
      material = new THREE.MeshPhysicalMaterial({ color: 0x049EF4 });
      materialBase = material.clone();
      sphere = new THREE.Mesh(geometry, material);
      scene.add(sphere);
      gui = new GUI();
      guiMaterial(gui, sphere, material, geometry);
      guiMeshPhysicalMaterial(gui, mesh, material, geometry)
    });
  // Luces
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  particleLight = new THREE.Mesh(
    new THREE.SphereGeometry(.05, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  scene.add(particleLight);
  particleLight.add(new THREE.PointLight(0xffffff, 3));


  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;


  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = Math.PI / 2;

  // Cámara
  window.addEventListener('resize', onWindowResize, false);

  stats = new Stats();
  container.appendChild(stats.dom);
}

function guiMaterial(gui, mesh, material, geometry) {

  const folder = gui.addFolder('THREE.Material');

  folder.add(material, 'transparent').onChange(needsUpdate(material));
  folder.add(material, 'opacity', 0, 1).step(0.01);
  folder.add(material, 'depthTest');
  folder.add(material, 'depthWrite');
  folder.add(material, 'visible');

}

function guiMeshPhysicalMaterial(gui, mesh, material, geometry) {

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
    presets: {none : 'none', Brillante: 'brillante', Fibra: 'fibra', Golf: 'golf', Rallada: 'rallada'},
  };

  const folder = gui.addFolder('THREE.MeshPhysicalMaterial');

  folder.addColor(data, 'color').onChange(handleColorChange(material.color));
  folder.addColor(data, 'emissive').onChange(handleColorChange(material.emissive));

  folder.add(material, 'roughness', 0, 1);
  folder.add(material, 'metalness', 0, 1);
  folder.add(material, 'ior', 1, 2.333);
  folder.add(material, 'reflectivity', 0, 1);
  folder.add( material, 'iridescence', 0, 1 );
  folder.add(material, 'iridescenceIOR', 1, 2.333 );
  folder.add(material, 'sheen', 0, 1);
  folder.add(material, 'sheenRoughness', 0, 1);
  folder.addColor(data, 'sheenColor').onChange(handleColorChange(material.sheenColor));
  folder.add(material, 'clearcoat', 0, 1).step(0.01);
  folder.add(material, 'clearcoatRoughness', 0, 1).step(0.01);
  folder.add(material, 'specularIntensity', 0, 1);
  folder.addColor(data, 'specularColor').onChange(handleColorChange(material.specularColor));
  folder.add(material, 'flatShading').onChange(needsUpdate(material));
  folder.add(material, 'wireframe');
  folder.add(material, 'vertexColors').onChange(needsUpdate(material));
  folder.add(material, 'fog').onChange(needsUpdate(material));

  const textureFolder = gui.addFolder('Texture');
  textureFolder.add(data, 'Presets', data.presets).onChange(s => presets(s));
  textureFolder.add(data, 'map', textureKeys).onChange(updateTexture(material, 'map', textureDictionary));
  textureFolder.add(data, 'envMaps', envMapKeysPBR).onChange(updateTexture(material, 'envMap', envMaps));
  textureFolder.add(data, 'roughnessMap', roughnessMapKeys).onChange(updateTexture(material, 'roughnessMap', roughnessMaps));
  textureFolder.add(data, 'alphaMap', alphaMapKeys).onChange(updateTexture(material, 'alphaMap', alphaMaps));
  textureFolder.add(data, 'metalnessMap', alphaMapKeys).onChange(updateTexture(material, 'metalnessMap', alphaMaps));
  textureFolder.add(data, 'iridescenceMap', alphaMapKeys).onChange(updateTexture(material, 'iridescenceMap', alphaMaps));
  textureFolder.add(data, 'normalMap', normalMapKeys).onChange(updateTexture(material, 'normalMap', normalMap));
  textureFolder.add(data, 'clearcoatNormalMap', clearcoatNormalMapKeys).onChange(updateTexture(material, 'clearcoatNormalMap', clearcoatNormalMap));

}

function needsUpdate(material) {
  return function () {

    material.side = parseInt(material.side);
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
    console.log(key);
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


function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
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

function render() {
  requestAnimationFrame(render);
  const timer = Date.now() * 0.00025;
  const radius = 2;
  const rotationSpeed = 0.5 * Math.PI;

  particleLight.position.x = radius * Math.sin(rotationSpeed * timer);
  particleLight.position.y = radius * Math.cos(rotationSpeed * timer);
  particleLight.position.z = radius * Math.cos(rotationSpeed * timer);

  controls.update();
  renderer.render(scene, camera);
}


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
  material.copy(materialBase.clone());
  switch (preset) {
    case 'none':
      break;
    case 'brillante':
      material.clearcoat = 1.0;
      material.clearcoatRoughness = 0.1;
      material.metalness = 0.9;
      material.roughness = 0.5;
      material.color = new THREE.Color( 0x0000ff );
      material.normalScale = new THREE.Vector2(0.15, 0.15);
      material['normalMap'] = normalMap['flakes'];
      break;
    case 'fibra':
      material.roughness = 0.5;
      material.clearcoat = 1.0;
      material.clearcoatRoughness = 0.1;
      material['map'] = textureDictionary['Diffuse'];
      material['normalMap'] = normalMap['carbonNormal'];
      break;
    case 'golf':
      material.metalness = 0.0;
      material.roughness = 0.1;
      material.clearcoat = 1.0;
      material['normalMap'] = normalMap['golfNormal'];
      material['clearcoatNormalMap'] = clearcoatNormalMap['scratched'];
      break;
    case 'rallada':
      material.clearcoat = 1.0;
      material.metalness = 1.0;
      material.color = new THREE.Color( 0xff0000 );
      material['normalMap'] = normalMap['waterNormal'];
      material['clearcoatNormalMap'] = clearcoatNormalMap['scratched'];
      material.normalScale = new THREE.Vector2(0.15, 0.15);
      break;
    default:
      break;
  }
  material.needsUpdate = true;
}

const envMapKeys = getObjectsKeys(envMaps);
const envMapKeysPBR = envMapKeys.slice(0, 2);
const roughnessMapKeys = getObjectsKeys(roughnessMaps);
const alphaMapKeys = getObjectsKeys(alphaMaps);
const textureKeys = getObjectsKeys(textureDictionary);
const normalMapKeys = getObjectsKeys(normalMap);
const clearcoatNormalMapKeys = getObjectsKeys(clearcoatNormalMap);
