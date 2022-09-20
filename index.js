import * as THREE from 'three';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useCamera, useLocalPlayer, useProcGenManager, useInstancing, usePhysics} = metaversefile;

import {Generation} from './generation.js';
import {TerrainMesh} from './terrain-mesh.js';
import {WaterMesh} from './water-mesh.js';
import {BarrierMesh} from './barrier-mesh.js';

// locals

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();

// classes

class GPUTask {
  constructor(fn, parent) {
    this.fn = fn;
    this.parent = parent;

    this.live = true;
  }
  run() {
    this.live = false;
    this.fn();
  }
  cancel() {
    if (this.live) {
      this.live = false;
      this.parent.removeTask(this);
    }
  }
}
class GPUTaskManager {
  static numTasksPerTick = 4;
  constructor() {
    this.queue = [];
  }
  transact(fn) {
    const task = new GPUTask(fn, this);
    this.queue.push(task);
    return task;
  }
  update() {
    for (let i = 0; i < GPUTaskManager.numTasksPerTick; i++) {
      if (this.queue.length > 0) {
        const task = this.queue.shift();
        task.run();
      } else {
        break;
      }
    }
  }
  removeTask(task) {
    const index = this.queue.indexOf(task);
    this.queue.splice(index, 1);
  }
}

// main

export default e => {
  const app = useApp();
  const camera = useCamera();
  const procGenManager = useProcGenManager();
  const physics = usePhysics();

  // locals

  const generations = new Map();
  let frameCb = null;

  // initialization

  e.waitUntil((async () => {
    const instance = procGenManager.getInstance();

    // lod tracker

    const lodTracker = await instance.createLodChunkTracker({
      lods: 7,
      lod1Range: 2,
      // debug: true,
    });
    // app.add(lodTracker.debugMesh);
    // lodTracker.debugMesh.position.y = 0.1;
    // lodTracker.debugMesh.updateMatrixWorld();

    // lodTracker.onPostUpdate(currentCoord => {
    //   barrierMesh.updateChunk(currentCoord);
    // });

    // meshes

    const gpuTaskManager = new GPUTaskManager();

    const terrainMesh = new TerrainMesh({
      instance,
      gpuTaskManager,
      physics
    });
    terrainMesh.frustumCulled = false;
    terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true; 
    app.add(terrainMesh);
    terrainMesh.updateMatrixWorld();

    const waterMesh = new WaterMesh({
      instance,
      gpuTaskManager,
    });
    waterMesh.frustumCulled = false;
    app.add(waterMesh);
    waterMesh.updateMatrixWorld();

    // const barrierMesh = new BarrierMesh({
    //   instance,
    //   gpuTaskManager,
    // });
    // barrierMesh.frustumCulled = false;
    // app.add(barrierMesh);
    // barrierMesh.updateMatrixWorld();

    // genration events handling

    lodTracker.onChunkAdd(async chunk => {
      const abortController = new AbortController();
      const {signal} = abortController;

      const key = procGenManager.getNodeHash(chunk);
      // console.log('chunk', key, chunk.min.toArray().join(','), 'ADD');
      /* if (generations.has(key)) {
        debugger;
      } */
      const generation = new Generation(key, abortController);
      generations.set(key, generation);

      generation.addEventListener('geometryadd', e => {
        const {geometry} = e.data;
        terrainMesh.addChunk(chunk, geometry);
        waterMesh.addChunk(chunk, geometry);
        // barrierMesh.addChunk(chunk, geometry);
      });
      generation.addEventListener('geometryremove', e => {
        terrainMesh.removeChunk(chunk);
        waterMesh.removeChunk(chunk);
        // barrierMesh.removeChunk(chunk);
      });

      try {
        const result = await instance.generateChunk(chunk.min, chunk.lod, chunk.lodArray, {
          signal,
        });
        // console.log('got chunk add result, add to geometry pool', chunk, result);
        generation.finish(result);
      } catch (err) {
        if (err.isAbortError) {
          // console.log('got chunk add abort', chunk);
        } else {
          throw err;
        }
      } /* finally {
        generations.delete(key);
      } */
    });
    lodTracker.onChunkRemove(chunk => {
      const key = procGenManager.getNodeHash(chunk);
      // console.log('chunk', key, chunk, 'REMOVE');
      const generation = generations.get(key);
      // console.log('got chunk remove', chunk, key, generation);
      /* if (!generation) {
        debugger;
      } */
      generation.cancel();

      generations.delete(key);
    });

    // frame handling
    
    frameCb = () => {
      const _updateLodTracker = () => {
        const localPlayer = useLocalPlayer();

        const appMatrixWorldInverse = localMatrix2.copy(app.matrixWorld).invert();
        localMatrix
          .copy(localPlayer.matrixWorld)
          .premultiply(appMatrixWorldInverse)
          .decompose(localVector, localQuaternion, localVector2);
        const playerPosition = localVector;

        localMatrix
          .copy(camera.matrixWorld)
          .premultiply(appMatrixWorldInverse)
          .decompose(localVector2, localQuaternion, localVector3);
        const cameraPosition = localVector2;
        const cameraQuaternion = localQuaternion;

        lodTracker.update(playerPosition);
        instance.setCamera(
          playerPosition,
          cameraPosition,
          cameraQuaternion,
          camera.projectionMatrix
        );
      };
      _updateLodTracker();

      gpuTaskManager.update();
    };
  })());

  useFrame(() => {
    frameCb && frameCb();
  });

  return app;
};