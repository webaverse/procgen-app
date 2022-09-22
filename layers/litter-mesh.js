import * as THREE from 'three';
import {PolygonPackage, PolygonMesh} from '../meshes/polygon-mesh.js';
import {SpritesheetPackage, SpritesheetMesh} from '../meshes/spritesheet-mesh.js';

//

export class LitterMetaMesh extends THREE.Object3D {
  constructor({
    instance,
    // gpuTaskManager,
    physics,
  }) {
    super();

    this.polygonMesh = new PolygonMesh({
      instance,
    });
    this.add(this.polygonMesh);

    this.spritesheetMesh = new SpritesheetMesh({
      instance,
    });
    this.add(this.spritesheetMesh);

    this.physics = physics;
  }
  update() {
    this.spritesheetMesh.update();
  }
  addChunk(chunk, chunkResult) {
    this.polygonMesh.addChunk(chunk, chunkResult);
    this.spritesheetMesh.addChunk(chunk, chunkResult);
  }
  removeChunk(chunk) {
    this.polygonMesh.removeChunk(chunk);
    this.spritesheetMesh.removeChunk(chunk);
  }
  async loadUrls(urls) {
    const [
      polygonPackage,
      spritesheetPackage,
    ] = await Promise.all([
      PolygonPackage.loadUrls(urls, this.physics),
      SpritesheetPackage.loadUrls(urls),
    ]);
    this.polygonMesh.setPackage(polygonPackage);
    this.spritesheetMesh.setPackage(spritesheetPackage);

    /* // XXX debugging
    {
      const allLodMeshes = [];
      const {lodMeshes} = polygonPackage;
      for (const lodMeshArray of lodMeshes) {
        for (const lodMesh of lodMeshArray) {
          // this.add(lodMesh);
          allLodMeshes.push(lodMesh);
        }
      }
      const meshSize = 3;
      for (let i = 0; i < allLodMeshes.length; i++) {
        const lodMesh = allLodMeshes[i];
        lodMesh.position.x = (-allLodMeshes.length/2 + i) * meshSize;
        lodMesh.position.y = 0.5;
        lodMesh.position.z = 5;
        this.add(lodMesh);
        lodMesh.updateMatrixWorld();
      }
    } */
  }
}