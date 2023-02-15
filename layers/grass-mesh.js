import * as THREE from "three";
import {
  PolygonPackage,
  PolygonMesh,
  GrassPolygonMesh,
} from "../meshes/polygon-mesh.js";
import {glbUrlSpecs} from "../assets.js";

const spriteLodCutoff = 4;
const meshLodSpecs = {
  1: {
    targetRatio: 1,
    targetError: 0,
  },
  2: {
    targetRatio: 0.3,
    targetError: 0.01,
  },
  4: {
    targetRatio: 0.2,
    targetError: 0.01,
  },
  /* 8: {
    targetRatio: 0.2,
    targetError: 0.05,
  },
  16: {
    targetRatio: 0.1,
    targetError: 0.1,
  }, */
};
const maxNumGeometries = 1;
const maxInstancesPerGeometryPerDrawCall = 16384;
const maxDrawCallsPerGeometry = 256;

//

export class GrassMesh extends THREE.Object3D {
  constructor({instance, physics, urls, shadow}) {
    super();

    if (physics) {
      console.warn('extra physics', {physics, instance, urls, shadow});
      debugger;
    }

    this.urls = urls;

    this.polygonMesh = new GrassPolygonMesh({
      instance,
      lodCutoff: spriteLodCutoff,
      maxNumGeometries,
      maxInstancesPerGeometryPerDrawCall,
      maxDrawCallsPerGeometry,
      shadow,
    });
    this.add(this.polygonMesh);

    this.instance = instance;
  }

  addChunk(chunk, chunkResult, renderer) {
    if (!renderer) {
      console.warn("missing renderer", {chunk, chunkResult, renderer});
      debugger;
    }
    
    this.polygonMesh.addChunk(chunk, chunkResult, renderer);
  }

  removeChunk(chunk) {
    this.polygonMesh.removeChunk(chunk);
  }

  async waitForLoad(appCtx) {
    if (!appCtx) {
      console.warn("missing appCtx", {appCtx});
      debugger;
    }
    const polygonPackage = await PolygonPackage.loadUrls(
      this.urls,
      meshLodSpecs,
      this.instance,
      appCtx,
    );
    this.polygonMesh.setPackage(polygonPackage);
  }

  update(timestamp) {
    this.polygonMesh.update(timestamp);
  }
}