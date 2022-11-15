import * as THREE from "three";
import {IconPackage, IconMesh} from "../meshes/icon-mesh.js";
import {glbUrlSpecs} from "../assets.js";

const hudLodDistanceCutoff = 4;

//

export class HudMesh extends THREE.Object3D {
  constructor({instance, urls}) {
    super();

    this.urls = urls;

    this.iconMesh = new IconMesh({
      instance,
      lodCutoff: hudLodDistanceCutoff,
    });
    this.add(this.iconMesh);
  }

  addChunk(chunk, chunkResult) {
    this.iconMesh.addChunk(chunk, chunkResult);
  }

  removeChunk(chunk) {
    this.iconMesh.removeChunk(chunk);
  }

  update() {
    this.iconMesh.update();
  }

  async waitForLoad() {
    const iconPackage = await IconPackage.loadUrls(this.urls);
    this.iconMesh.setPackage(iconPackage);
  }
}