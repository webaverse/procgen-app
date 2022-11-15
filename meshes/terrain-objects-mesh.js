import * as THREE from "three";

export class TerrainObjectSpecs {
  constructor(constructor, urls) {
    this.construct = constructor;
    this.urls = urls;
  }
}
export class TerrainObjectsMesh extends THREE.Object3D {
  constructor(instance, physics, terrainObjectsMeshes) {
    super(); // nothing
    this.meshes = {};

    for (const [key, meshSpecs] of Object.entries(terrainObjectsMeshes)) {
      const mesh = new meshSpecs.construct({
        instance,
        physics,
        urls: meshSpecs.urls,
      });
      this.add(mesh);
      mesh.updateMatrixWorld();
      this.meshes[key] = mesh;
    }
  }

  async waitForLoad() {
    await Promise.all(
      this.children.map((child, i) => {
        child.waitForLoad();
      }),
    );
  }

  addChunks(chunk, chunkResults) {
    for (const [key, mesh] of Object.entries(this.meshes)) {
      const chunkResult = chunkResults[key];
      mesh.addChunk(chunk, chunkResult);
    }
  }

  removeChunks(chunk) {
    for (const [key, mesh] of Object.entries(this.meshes)) {
      mesh.removeChunk(chunk);
    }
  }

  update() {
    for (const [key, mesh] of Object.entries(this.meshes)) {
      mesh.update();
    }
  }
}