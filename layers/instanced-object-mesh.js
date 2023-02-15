import * as THREE from "three";
import {PolygonMesh, PolygonPackage} from "../meshes/polygon-mesh.js";
import {
  SpritesheetMesh,
  SpritesheetPackage,
} from "../meshes/spritesheet-mesh.js";

//

//

const spriteLodCutoff = 8;
const meshLodSpecs = {
  1: {
    targetRatio: 1,
    targetError: 0,
  },
  2: {
    targetRatio: 0.5,
    targetError: 0.01,
  },
  4: {
    targetRatio: 0.3,
    targetError: 0.05,
  },
  8: {
    targetRatio: 0.15,
    targetError: 0.1,
  },
};
const maxNumGeometries = 1;
const maxInstancesPerGeometryPerDrawCall = 8192;
const maxDrawCallsPerGeometry = 256;

//

export class InstancedObjectMesh extends THREE.Object3D {
  constructor({instance, physics, urls, shadow, ctx}) {
    super();

    if (!ctx) {
      console.warn("missing ctx", {instance, physics, urls, shadow, ctx});
      debugger;
    }
    if (physics) {
      console.warn('extra physics', {physics, instance, urls, shadow, ctx});
      debugger;
    }

    this.urls = urls;

    this.polygonMesh = new PolygonMesh({
      instance,
      lodCutoff: spriteLodCutoff,
      maxNumGeometries,
      maxInstancesPerGeometryPerDrawCall,
      maxDrawCallsPerGeometry,
      shadow,
    });
    this.add(this.polygonMesh);

    this.spritesheetMesh = new SpritesheetMesh({
      instance,
      lodCutoff: spriteLodCutoff,
      ctx,
    });
    this.add(this.spritesheetMesh);

    this.instance = instance;
  }

  update() {
    this.spritesheetMesh.update();
  }

  addChunk(chunk, chunkResult, renderer) {
    if (!renderer) {
      console.warn("missing renderer", {chunk, chunkResult, renderer});
      debugger;
    }
    this.polygonMesh.addChunk(chunk, chunkResult, renderer);
    this.spritesheetMesh.addChunk(chunk, chunkResult, renderer);
  }

  removeChunk(chunk) {
    this.polygonMesh.removeChunk(chunk);
    this.spritesheetMesh.removeChunk(chunk);
  }

  async waitForLoad(appCtx) {
    if (!appCtx) {
      console.warn("missing appCtx", {appCtx});
      debugger;
    }
    const [polygonPackage, spritesheetPackage] = await Promise.all([
      PolygonPackage.loadUrls(this.urls, meshLodSpecs, this.instance, appCtx),
      SpritesheetPackage.loadUrls(this.urls, appCtx),
    ]);
    this.polygonMesh.setPackage(polygonPackage);
    this.spritesheetMesh.setPackage(spritesheetPackage);
  }
}

export class InstancedObjectGroup extends THREE.Object3D {
  constructor({instance, urls, physics, shadow, ctx}) {
    super();

    if (!ctx) {
      console.warn('missing ctx', {instance, urls, physics, shadow, ctx});
      debugger;
    }
    if (physics) {
      console.warn('extra physics', {physics, instance, urls, shadow, ctx});
      debugger;
    }

    this.urls = urls;
    this.meshes = [];

    for (let i = 0; i < urls.length; i++) {
      const meshUrl = urls[i];
      const mesh = new InstancedObjectMesh({
        urls: [meshUrl],
        shadow,
        instance,
        // physics,
        ctx,
      });
      this.meshes.push(mesh);
      this.add(mesh);
    }
  }

  update() {
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i];
      mesh.update();
    }
  }

  addChunk(chunk, chunkResults, renderer) {
    if (!renderer) {
      console.warn('missing renderer', {chunk, chunkResults, renderer});
      debugger;
    }

    if (chunkResults) {
      for (let i = 0; i < this.meshes.length; i++) {
        const mesh = this.meshes[i];
        const chunkResult = chunkResults[i];
        if(chunkResult) {
          const chunkResultInstances = chunkResult.instances;
          mesh.addChunk(chunk, chunkResultInstances, renderer);
        }
      }
    }
  }

  removeChunk(chunk) {
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i];
      mesh.removeChunk(chunk);
    }
  }

  async waitForLoad(appCtx) {
    if (!appCtx) {
      console.warn('missing appCtx', {appCtx});
      debugger;
    }
    await Promise.all(
      this.meshes.map((mesh, i) => {
        mesh.waitForLoad(appCtx);
      }),
    );
  }
}