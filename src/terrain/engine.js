// Terrain engine - adapted from original terrain.js
// Only change: accepts a container element + counter element instead of appending to body / getElementById
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { perlinRender } from './perlin.js';
import { circleRender, wavesRender } from './waves.js';
import { gaussianRender } from './noise.js';

let mainScene;
let existingShape = false;

class baseWorld {
    constructor(container, counterEl) {
        this._container = container;
        this._counterEl = counterEl;
        this._controls = null;
        this._keyHandler = null;
        this._resizeHandler = null;
        this._Initialize();
    }

    async panelCreate(texture, size, tileCount, spare) {
        const tileXYZ = [size, size, size];
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

        const tileMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
        });
        const geometry = new THREE.BoxGeometry(tileXYZ[0], tileXYZ[1], tileXYZ[2]);

        const filledBox = false;
        for (let x = 0; x < tileCount; x++) {
            for (let y = 0; y < tileCount; y++) {
                const levelcenter = Math.round((map[y][x].r - 120) / 5);
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

    snapToIsometricPerspective() {
        this._camera.position.set(40, 40, 40);
        this._camera.lookAt(40, 40, 40);
    }

    async _Initialize() {
        this._threejs = new THREE.WebGLRenderer({ antialias: true });
        this._threejs.shadowMap.enabled = true;
        this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
        this._threejs.setPixelRatio(window.devicePixelRatio);
        this._threejs.setSize(this._container.clientWidth, this._container.clientHeight);

        this._keyHandler = (e) => {
            if (e.key === 'a') {
                this.snapToIsometricPerspective();
            }
        };
        document.addEventListener('keydown', this._keyHandler);

        this._container.appendChild(this._threejs.domElement);

        this._resizeHandler = () => {
            this._OnWindowResize();
        };
        window.addEventListener('resize', this._resizeHandler, false);

        const fov = 60;
        const aspect = this._container.clientWidth / this._container.clientHeight;
        const near = 1;
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

        const helper = new THREE.DirectionalLightHelper(light, 10);
        mainScene.add(helper);

        light = new THREE.AmbientLight(0x404040, 0.5);
        mainScene.add(light);

        const controls = new OrbitControls(this._camera, this._threejs.domElement);
        controls.target.set(0, 0, 0);
        controls.update();
        this._controls = controls;

        const box = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({
                color: 0x4287f5,
                roughness: 0.5,
                metalness: 0.5
            })
        );
        box.castShadow = true;
        box.receiveShadow = true;
        mainScene.add(box);

        this._RAF();
    }

    _OnWindowResize() {
        this._camera.aspect = this._container.clientWidth / this._container.clientHeight;
        this._camera.updateProjectionMatrix();
        this._threejs.setSize(this._container.clientWidth, this._container.clientHeight);
    }

    timeSinceLast = new Date();
    _RAF() {
        this._rafId = requestAnimationFrame(() => {
            this._threejs.render(mainScene, this._camera);

            const currentCounter = new Date();
            if (this._counterEl) {
                this._counterEl.textContent = (1 / ((currentCounter.getTime() - this.timeSinceLast.getTime()) * 0.001)).toFixed(2);
            }
            this.timeSinceLast = currentCounter;
            this._RAF();
        });
    }

    clearScene() {
        for (let i = mainScene.children.length - 1; i >= 0; i--) {
            const obj = mainScene.children[i];
            if (
                !(obj instanceof THREE.Camera) &&
                !(obj instanceof THREE.Light) &&
                !(obj instanceof THREE.DirectionalLightHelper)
            ) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
                mainScene.remove(obj);
            }
        }
        existingShape = false;
    }

    async generate(texture, size, tileCount, spare) {
        if (!existingShape) {
            await this.panelCreate(texture, size, tileCount, spare);
            existingShape = true;
        }
    }

    dispose() {
        if (this._rafId) cancelAnimationFrame(this._rafId);
        // Remove event listeners
        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
        // Dispose OrbitControls
        if (this._controls) this._controls.dispose();
        // Dispose all scene objects' GPU resources
        if (mainScene) {
            mainScene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            });
        }
        if (this._threejs) {
            this._threejs.dispose();
            if (this._threejs.domElement && this._threejs.domElement.parentNode) {
                this._threejs.domElement.parentNode.removeChild(this._threejs.domElement);
            }
        }
        mainScene = null;
        existingShape = false;
    }
}

export { baseWorld };
