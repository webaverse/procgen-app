import * as THREE from 'three';

export class TerrainObjectSpecs {
    constructor(constructor, urls) {
        this.construct = constructor;
        this.urls = urls;
    }
}
export class TerrainObjectsMesh extends THREE.Object3D {
    constructor(instance, physics, meshSpecsArray) {
        super(); // nothing

        for (let i = 0; i < meshSpecsArray.length; i++) {
            const meshSpecs = meshSpecsArray[i];

            const mesh = new meshSpecs.construct({instance, physics, urls: meshSpecs.urls});
            this.add(mesh);
            mesh.updateMatrixWorld();
        }
    }
    async waitForLoad() {
        await Promise.all(this.children.map((child, i) => {
            child.waitForLoad();
        }));
    }
    addChunks(chunk, chunkResults) {
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            child.addChunk(chunk, chunkResults[i]);
        }
    }
    removeChunks(chunk) {
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            child.removeChunk(chunk);
        }
    }
    update() {
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            child.update();
        }
    }
}