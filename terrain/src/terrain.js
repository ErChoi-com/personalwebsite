import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { perlinRender } from '../textures/perlin.js';
import { centralRender, circleRender, wavesRender } from '../textures/waves.js';
import { gaussianRender } from '../textures/noise.js';

let mainScene;
let existingShape = false;
let arrayTextures = [];
class baseWorld {
    constructor() {
        this._Initialize();
    }

    async panelCreate(texture, size, tileCount, spare) {
        /*
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0x808080, side: THREE.DoubleSide })
        );
        plane.castShadow = true;
        plane.receiveShadow = true;
        plane.rotation.x = -Math.PI / 2;
        mainScene.add(plane);
        */
        // above code was used to generate a single plane, below is for a grid of tiles. 
        const tileXYZ = [size, size, size];
        // parameters for the tile generation
        let map;
        let o = 0;
        let f = 0;
        let po;
        let direction;
        let mean;
        let stdev;
        switch (texture) {
            case 'perlin':
                o = spare;
                map = perlinRender(tileCount, tileCount, o);
                break;
            case 'waves':
                f = spare;
                po = 1;
                direction = 'x';
                map = wavesRender(tileCount, tileCount, f, po, direction);
                break;
            case 'circle':
                f = 0.25;
                po = spare;
                map = circleRender(tileCount, tileCount, f, po);
                break;
            case 'gaussian':
                stdev = spare;
                mean = 2;
                map = gaussianRender(tileCount, tileCount, mean, stdev);
                break;
        }
        console.log(Math.round(map[3][2].g/10));
        //console.log(Math.round(circleRender(5,5,1,[1,1])[3][2].g/10));

        const tileMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
        });
        const geometry = new THREE.BoxGeometry(tileXYZ[0], tileXYZ[1], tileXYZ[2]);
        //geometry + material = mesh
        
        const filledBox = false
        map.forEach(row => {
            
        })
        for (let x = 0; x < tileCount; x++) {
            for (let y = 0; y < tileCount; y++) {
                const levelcenter = Math.round((map[y][x].r - 120) / 5);
                // height's good enough
                if (filledBox === true) {
                    try {
                        const tile = new THREE.Mesh(geometry, tileMaterial);
                        tile.position.set(x * (tileXYZ[0] + 0.5), levelcenter, y * (tileXYZ[2] + 0.5));
                        tile.castShadow = true;
                        tile.receiveShadow = true;
                        mainScene.add(tile);
                    } catch (error) {
                        console.error("(fillbox true) Error creating tile:", error);
                    }
                } else if (filledBox === false) {
                    for (let l = 0; l < Math.abs(levelcenter); l++) {
                        try {
                            const tile = new THREE.Mesh(geometry, tileMaterial);
                            tile.position.set(x * (tileXYZ[0] + 0.5), l * (tileXYZ[1] + 0.5), y * (tileXYZ[2] + 0.5));
                            tile.castShadow = true;
                            tile.receiveShadow = true;
                            mainScene.add(tile);
                        } catch (error) {
                            console.error("(fillbox false) Error creating tile:", error);
                        }
                    }
                }
            }
        }
    }

    async panelAnimate() {

    }

    snapToIsometricPerspective() {
        const coordinates = [40, 40, 40];
        // keep the camera coordinates for a fixed isometric viewpoint
        this._camera.position.set(40, 40, 40);
        this._camera.lookAt(coordinates[0], coordinates[1], coordinates[2]);
    }

    async _Initialize() {
        this._threejs = new THREE.WebGLRenderer();
        this._threejs.shadowMap.enabled = true;
        this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
        this._threejs.setPixelRatio(window.devicePixelRatio);
        this._threejs.setSize(window.innerWidth, window.innerHeight);

        document.addEventListener('keydown', (e) => {
        if (e.key === ('a')) {
            this.snapToIsometricPerspective();
        }
    })

        document.body.appendChild(this._threejs.domElement);

        window.addEventListener('resize', () => {
            this._OnWindowResize();
        }, false);

        const fov = 60;
        const aspect = window.innerWidth / window.innerHeight;
        const near =  1;
        const far = 1000;
        this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this._camera.position.set(75, 20, 0);

        mainScene = new THREE.Scene();

        let light = new THREE.DirectionalLight(0xFFFFFF, 1);
        light.position.set(100, 100, 100);
        light.target.position.set(0, 0, 0);
        light.castShadow = true;
        light.shadow.bias = -0.01;
        light.shadow.mapSize.width = 2048;
        light.shadow.mapSize.height = 2048;
        mainScene.add(light);

        // Add a helper to visualize the first directional light
        const helper = new THREE.DirectionalLightHelper(light, 10);
        mainScene.add(helper);

        light = new THREE.AmbientLight(0x404040, 0.5); // Reduced ambient light intensity
        mainScene.add(light);

        const controls = new OrbitControls(this._camera, this._threejs.domElement);
        controls.target.set(0, 0, 0);
        controls.update();

        // Create a box mesh with geometry and material
        const box = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1), // Width, Height, Depth
        new THREE.MeshStandardMaterial({
            color: 0x4287f5, // Blue color
            roughness: 0.5,
            metalness: 0.5
        })
        );

        

        // Enable shadows
        box.castShadow = true;
        box.receiveShadow = true;

        // Add box to the scene
        mainScene.add(box);

        this._RAF();
    }

    _OnWindowResize() {
        this._camera.aspect = window.innerWidth / window.innerHeight;
        this._camera.updateProjectionMatrix();
        this._threejs.setSize(window.innerWidth, window.innerHeight);
    }

    timeSinceLast = new Date();
    _RAF() {
        requestAnimationFrame(() => {
            this._threejs.render(mainScene, this._camera);

            const currentCounter = new Date();
            let counter = document.getElementById('counter');
            counter.textContent = (1 / ((currentCounter.getTime() - this.timeSinceLast.getTime()) * 0.001)).toFixed(2);
            this.timeSinceLast = currentCounter;

            console.log("Frame generated");
            this._RAF();  // Keep the animation loop going, recursive loop
        });
    }
}

// below makes the button function lol

document.getElementById('clear').onclick = () => {
    for (let i = mainScene.children.length - 1; i >= 0; i--) {
        const obj = mainScene.children[i];
        if (
            !(obj instanceof THREE.Camera) &&
            !(obj instanceof THREE.Light) &&
            !(obj instanceof THREE.DirectionalLightHelper)
        ) {
            mainScene.remove(obj);
        }
    }
    existingShape = false;
    console.log("Scene cleared");
};

document.getElementById('generate').onclick = async (event) => {
    let texture = document.getElementById('textures').value;
    let parameter1 = document.getElementById('parameterOne').value;
    let parameter2 = document.getElementById('parameterTwo').value;
    let parameter3 = document.getElementById('parameterThree').value;

    // Convert to numbers or arrays as needed
    let size = Number(parameter1);
    let tileCount = Number(parameter2);
    let spare;
    if (texture === 'circle') {
        // For circle, use parameter3 directly as a number
        spare = Number(parameter3);
    } else if (texture === 'waves' || texture === 'perlin' || texture === 'gaussian') {
        spare = Number(parameter3);
    }

    if (!existingShape) {
        app.panelCreate(texture, size, tileCount, spare);
        existingShape = true;
    }

    //Animate the panels
        //this.panelCreate('perlin', 1, 200, 5);
        //this.panelCreate('waves', 1, 160, 0.25);
        //this.panelCreate('circle', 1, 40, [80, 80]);
        //this.panelCreate('gaussian', 1, 90, 1)
};

// Create an instance of the baseWorld class
let app = new baseWorld();

// Add event listeners to update slider value displays in real-time
document.getElementById('parameterOne').addEventListener('input', function() {
    document.getElementById('param1Value').textContent = this.value;
});

document.getElementById('parameterTwo').addEventListener('input', function() {
    document.getElementById('param2Value').textContent = this.value;
});

document.getElementById('parameterThree').addEventListener('input', function() {
    document.getElementById('param3Value').textContent = this.value;
});
