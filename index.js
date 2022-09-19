import * as THREE from 'three';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useCamera, useLocalPlayer, usePhysics, useProcGenManager, useGPUTask, useGenerationTask} = metaversefile;
const {GPUTaskManager} = useGPUTask();
const {GenerationTaskManager} = useGenerationTask();

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

// main

export default e => {
  const app = useApp();
  const camera = useCamera();
  const procGenManager = useProcGenManager();
  const physics = usePhysics();

  // locals

  let frameCb = null;

  // initialization

  e.waitUntil((async () => {
    const instance = procGenManager.getInstance('lol');

    // lod tracker

    const lodTracker = await instance.createLodChunkTracker({
      lods: 7,
      lod1Range: 2,
      // debug: true,
    });
    // app.add(lodTracker.debugMesh);
    // lodTracker.debugMesh.position.y = 0.1;
    // lodTracker.debugMesh.updateMatrixWorld();

    lodTracker.onPostUpdate(currentCoord => {
      barrierMesh.updateChunk(currentCoord);
    });

    // meshes

    const gpuTaskManager = new GPUTaskManager();
    const generationTaskManager = new GenerationTaskManager();

    const terrainMesh = new TerrainMesh({
      instance,
      gpuTaskManager,
      physics
    });
    terrainMesh.frustumCulled = false;
    app.add(terrainMesh);
    terrainMesh.updateMatrixWorld();

    const waterMesh = new WaterMesh({
      instance,
      gpuTaskManager,
    });
    waterMesh.frustumCulled = false;
    app.add(waterMesh);
    waterMesh.updateMatrixWorld();

    const barrierMesh = new BarrierMesh({
      instance,
      gpuTaskManager,
    });
    barrierMesh.frustumCulled = false;
    app.add(barrierMesh);
    barrierMesh.updateMatrixWorld();

    // genration events handling

    lodTracker.onChunkAdd(async chunk => {
      const key = procGenManager.getNodeHash(chunk);
      
      const generation = generationTaskManager.createGeneration(key);
      generation.addEventListener('geometryadd', e => {
        const {geometry} = e.data;
        terrainMesh.addChunk(chunk, geometry);
        waterMesh.addChunk(chunk, geometry);
        barrierMesh.addChunk(chunk, geometry);
      });
      generation.addEventListener('geometryremove', e => {
        terrainMesh.removeChunk(chunk);
        waterMesh.removeChunk(chunk);
        barrierMesh.removeChunk(chunk);
      });

      try {
        const signal = generation.getSignal();
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
      generationTaskManager.deleteGeneration(key);
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