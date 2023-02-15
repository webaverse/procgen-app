import * as THREE from "three";

export class TerrainObjectSpecs {
  constructor(constructor, urls, shadow) {
    this.construct = constructor;
    this.urls = urls;
    this.shadow = shadow;
  }
}
export class TerrainObjectsMesh extends THREE.Object3D {
  constructor({instance, physics, terrainObjectsMeshes, ctx}) {
    super();

    if (!ctx) {
      console.warn("missing ctx", {instance, physics, terrainObjectsMeshes, ctx});
      debugger;
    }
    if (physics) {
      console.warn('extra physics', {physics, instance, terrainObjectsMeshes, ctx});
      debugger;
    }

    this.meshes = {};

    for (const [key, meshSpecs] of Object.entries(terrainObjectsMeshes)) {
      const mesh = new meshSpecs.construct({
        instance,
        // physics,
        urls: meshSpecs.urls,
        shadow: meshSpecs.shadow,
        ctx,
      });
      this.add(mesh);
      mesh.updateMatrixWorld();
      this.meshes[key] = mesh;
    }
  }

  async waitForLoad(appCtx) {
    if (!appCtx) {
      console.warn("missing appCtx", {appCtx});
      debugger;
    }
    await Promise.all(
      this.children.map((child, i) => {
        child.waitForLoad(appCtx);
      }),
    );
  }

  addChunks(chunk, chunkResults, renderer) {
    if (!renderer) {
      console.warn('missing renderer', {chunk, chunkResults, renderer});
      debugger;
    }
    
    for (const [key, mesh] of Object.entries(this.meshes)) {
      const chunkResult = chunkResults[key];
      mesh.addChunk(chunk, chunkResult, renderer);
    }
  }

  removeChunks(chunk) {
    for (const [key, mesh] of Object.entries(this.meshes)) {
      mesh.removeChunk(chunk);
    }
  }

  update(timestamp) {
    for (const [key, mesh] of Object.entries(this.meshes)) {
      mesh.update(timestamp);
    }
  }
}