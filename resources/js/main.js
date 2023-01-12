import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import dat from "dat.gui";
import { gsap } from "gsap";

const DEBUG = location.search.indexOf("debug") > -1;

const threeProject = (() => {
  let loadingManager,
    canvas,
    scene,
    renderer,
    camera,
    ambientLight,
    directionalLight,
    gltfLoader,
    url,
    model,
    textureLoader,
    requestToRender,
    raf,
    renderPass,
    bloomPass,
    composer,
    particleGeo,
    particleMesh,
    originParticle = [];

  let areaWidth = window.innerWidth;
  let areaHeight = window.innerHeight;

  const setTheManager = () => {
    loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = () => {};
    loadingManager.onStart = () => {};
    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {};
  };

  const setTheScene = () => {
    scene = new THREE.Scene();
  };

  const setTheRenderer = () => {
    canvas = document.querySelector("canvas");
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas,
    });
    renderer.setClearColor(0x000000);
    renderer.setSize(areaWidth, areaHeight);
    renderer.setPixelRatio(devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
  };

  const setTheCamera = () => {
    camera = new THREE.PerspectiveCamera(45, areaWidth / areaHeight, 0.1, 100);
    camera.position.z = 3;
    camera.position.x = 2;
    camera.position.y = 1;
    camera.lookAt(0, 0, 0);
  };

  const setTheLight = () => {
    ambientLight = new THREE.AmbientLight("#fff", 1);

    scene.add(ambientLight);
  };

  const setTheModel = () => {
    const loader = new GLTFLoader();
    let index = 0;
    let totalPoints = 0;
    loader.load(
      "./resources/models/shiba.glb",
      function (gltf) {
        var object = gltf.scene;
        let positionGroup = [];

        object.traverse((node) => {
          if (!node.isMesh) return;
          let position = node.geometry.attributes.position.array;
          positionGroup.push(position);
        });

        for (let i = 0; i < 3; i++) {
          positionGroup.push();
        }

        for (let i = 0; i < positionGroup.length; i++) {
          totalPoints += positionGroup[i].length;
        }

        particleGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array(totalPoints * 1);

        for (let i = 0; i < positionGroup.length; i++) {
          for (let j = 0; j < positionGroup[i].length; j++) {
            index = 3 * j;
            vertices[j] = positionGroup[i][j] || 0;
            vertices[j + 1] = positionGroup[i][j + 1] || 0;
            vertices[j + 2] = positionGroup[i][j + 2] || 0;
          }
        }

        for (let i = 1; i < 1; i++) {
          for (let j = 0; j < totalPoints; j++) {
            vertices[j + totalPoints * i] = vertices[j] + Math.random() * 0.1;
          }
        }

        particleGeo.setAttribute(
          "position",
          new THREE.BufferAttribute(vertices, 3)
        );

        const particleMat = new THREE.PointsMaterial({
          size: 0.8,
          sizeAttenuation: false,
          color: "orange",
        });

        particleMesh = new THREE.Points(particleGeo, particleMat);
        particleMesh.rotation.x = -Math.PI / 2;
        particleMesh.position.y = 0.4;

        for (let i = 0; i < particleGeo.attributes.position.array.length; i++) {
          originParticle.push(particleGeo.attributes.position.array[i]);
          renderRequest();
        }

        scene.add(particleMesh);
        renderRequest();
      },
      // called while loading is progressing
      function (xhr) {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      // called when loading has errors
      function (error) {
        console.log("An error happened");
      }
    );
  };

  const setupPostprocess = () => {
    renderPass = new RenderPass(scene, camera);
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1,
      0.1,
      0.1
    );
    composer = new EffectComposer(renderer);

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
  };

  const setTheTexture = () => {
    textureLoader = new THREE.TextureLoader(loadingManager);
  };

  let oldTime = Date.now();
  let count = 0;
  let index;

  const setTheRender = () => {
    let newTime = Date.now();
    let deltaTime = newTime - oldTime;
    oldTime = newTime;

    if (particleGeo) {
      for (let i = 0; i < particleGeo.attributes.position.array.length; i++) {
        index = 3 * i;
        particleGeo.attributes.position.array[index] =
          originParticle[index] + Math.sin(i + count * 0.05) * 0.005;
        particleGeo.attributes.position.array[index + 1] =
          originParticle[index + 1] + Math.cos(i + count * 0.05) * 0.005;
        particleGeo.attributes.position.array[index + 2] =
          originParticle[index + 2] + Math.cos(i + count * 0.05) * 0.005;

        particleMesh.geometry.attributes.position.needsUpdate = true;
        renderRequest();
      }

      count += deltaTime * 0.1;
    }
    if (requestToRender) {
      composer.render();
      requestToRender = false;
    }
    raf = requestAnimationFrame(setTheRender);
  };

  const renderRequest = () => {
    requestToRender = true;
  };

  const resize = () => {
    areaWidth = window.innerWidth;
    areaHeight = window.innerHeight;

    camera.aspect = areaWidth / areaHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(areaWidth, areaHeight);
    renderer.setPixelRatio(devicePixelRatio);
    composer.setSize(areaWidth, areaHeight);

    renderRequest();
  };

  const addEvent = () => {
    window.addEventListener("resize", resize);
  };

  const debugMode = () => {
    if (DEBUG) {
      let gui = new dat.GUI();
      gui.domElement.parentNode.style.zIndex = 100;

      const control = new OrbitControls(camera, renderer.domElement);
      control.addEventListener("change", function () {
        renderRequest();
      });

      scene.add(new THREE.AxesHelper());

      gui &&
        gui
          .add(camera.position, "y", 0, 2, 0.00001)
          .name("camera y")
          .onChange(renderRequest);
    }
  };

  const initialize = () => {
    setTheManager();
    setTheScene();
    setTheRenderer();
    setTheCamera();
    setTheLight();
    setTheModel();
    setupPostprocess();
    setTheTexture();
    setTheRender();
    addEvent();
    debugMode();
  };

  return {
    init: initialize,
  };
})();

onload = threeProject.init();
