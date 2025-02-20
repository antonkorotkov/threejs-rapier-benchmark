import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import Stats from 'stats.js';;

const stats = new Stats();
document.body.appendChild(stats.dom);

const canvas = document.querySelector('canvas.webgl');

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

const updateLoadingBar = progress => {
    const bar = document.getElementById('loadingBar');
    bar.style.width = `${progress}%`;
};

const hideLoadingIndicator = () => {
    document.getElementById('loadingBarContainer').style.display = 'none';
};

const isCoinHorizontal = rotation => {
    const d = 0.3;
    const upVector = new THREE.Vector3(0, 1, 0);
    const transformedUp = upVector.clone().applyQuaternion(rotation);
    const isHorizontal = Math.abs(transformedUp.x) < d && Math.abs(transformedUp.z) < d;

    return isHorizontal;
};

let coinModel = null;

const gui = new GUI();
gui.title('Coins: 0');

const debug = {
    dropCoin: () => {
        if (coinModel) {
            createCoin({
                x: Math.random() * 2 - 1,
                y: 8,
                z: Math.random() * 2 - 1
            });
        }
    },
    reset: () => {
        for (const object of objectsToUpdate) {
            world.removeCollider(object.body)
            world.removeRigidBody(object.rigidBody)
            scene.remove(object.mesh)
        }
        objectsToUpdate.length = 0;
        gui.title('Coins: 0');
    }
};
gui.add(debug, 'dropCoin').name('Drop Coin');
gui.add(debug, 'reset').name('Reset');

const loadingManager = new THREE.LoadingManager(
    hideLoadingIndicator,
    (_, loaded, total) => {
        const progress = Math.round((loaded / total) * 100);
        updateLoadingBar(progress);
    }
);

const modelLoader = new GLTFLoader(loadingManager);
const textureLoader = new THREE.TextureLoader(loadingManager);
const cubeTextureLoader = new THREE.CubeTextureLoader(loadingManager);

modelLoader.load('./models/coin/model.glb', model => {
    coinModel = model.scene;
    coinModel.scale.set(0.5, 0.5, 0.5);

    const box = new THREE.Box3().setFromObject(coinModel);
    const center = box.getCenter(new THREE.Vector3());
    coinModel.position.sub(center);

    coinModel.traverse((node) => {
        if (node.userData.name?.includes('Cylinder')) {
            node.castShadow = true;
        }
    });
});

const woodArm = textureLoader.load('/textures/wood/wood_floor_deck_arm_1k.jpg');
const woodDiff = textureLoader.load('/textures/wood/wood_floor_deck_diff_1k.jpg');
const woodNorm = textureLoader.load('/textures/wood/wood_floor_deck_nor_gl_1k.jpg');
woodDiff.colorSpace = THREE.SRGBColorSpace

const environmentMapTexture = cubeTextureLoader.load([
    '/textures/environmentMaps/3/px.png',
    '/textures/environmentMaps/3/nx.png',
    '/textures/environmentMaps/3/py.png',
    '/textures/environmentMaps/3/ny.png',
    '/textures/environmentMaps/3/pz.png',
    '/textures/environmentMaps/3/nz.png'
]);

const scene = new THREE.Scene();
scene.environmentIntensity = 5;
scene.background = environmentMapTexture;
scene.environment = environmentMapTexture;
scene.rotation.y = Math.PI;

const gravity = new RAPIER.Vector3(0, -9.82, 0);
const world = new RAPIER.World(gravity);

const tableColliderDesc = RAPIER.ColliderDesc.cuboid(10, 0.1, 10)
    .setFriction(.9)
    .setRestitution(.3);
world.createCollider(tableColliderDesc);

const table = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({
        side: THREE.DoubleSide,
        map: woodDiff,
        aoMap: woodArm,
        roughnessMap: woodArm,
        metalnessMap: woodArm,
        normalMap: woodNorm
    })
);
table.position.y = 0.09;
table.receiveShadow = true;
table.rotation.x = -Math.PI * 0.5;
scene.add(table);

const ambientLight = new THREE.AmbientLight(0xffffff, 10);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.far = 15;
directionalLight.shadow.camera.left = -7;
directionalLight.shadow.camera.top = 7;
directionalLight.shadow.camera.right = 7;
directionalLight.shadow.camera.bottom = -7;
directionalLight.position.set(3.5, 5, -5);
scene.add(directionalLight);

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.set(-3, 3, 3);
scene.add(camera);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const renderer = new THREE.WebGLRenderer({
    canvas: canvas
});

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const objectsToUpdate = [];

const createCoin = position => {
    const mesh = new THREE.Group();
    mesh.add(coinModel.clone());
    scene.add(mesh);
    mesh.position.copy(position);

    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setCanSleep(true)
        .setTranslation(position.x, position.y, position.z)
        .setRotation({ x: Math.random(), y: Math.random(), z: Math.random(), w: 1 });

    const rigidBody = world.createRigidBody(rigidBodyDesc);
    mesh.quaternion.copy(rigidBody.rotation());

    const colliderDesc = RAPIER.ColliderDesc.cylinder(0.16 / 4, 0.5)
        .setRestitution(.5)
        .setFriction(.5);

    const body = world.createCollider(colliderDesc, rigidBody);
    objectsToUpdate.push({ mesh, body, rigidBody });

    gui.title(`Coins: ${objectsToUpdate.length}`);
};

const checkSleep = () => {
    for (let body of world.bodies.getAll()) {
        const linvel = body.linvel();
        const vm = Math.sqrt(linvel.x * linvel.x + linvel.y * linvel.y + linvel.z * linvel.z);

        if (isCoinHorizontal(body.rotation()) && vm < 0.03)
            body.sleep();
    }
};

const fixedTimeStep = 1 / 120;
let accumulator = 0;
let lastTime = 0;

const tick = (time) => {
    stats.begin();

    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;
    accumulator += deltaTime;

    while (accumulator >= fixedTimeStep) {
        world.step();
        checkSleep();
        accumulator -= fixedTimeStep;
    }

    for (const object of objectsToUpdate) {
        object.mesh.position.copy(object.rigidBody.translation());
        object.mesh.quaternion.copy(object.rigidBody.rotation());
    }

    controls.update();
    renderer.render(scene, camera);

    stats.end();
    window.requestAnimationFrame(tick);
}

window.requestAnimationFrame(tick);