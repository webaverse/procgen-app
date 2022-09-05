import * as THREE from 'three';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useCamera, useLocalPlayer, useProcGenManager, useInstancing, usePhysics} = metaversefile;

import {Generation} from './generation.js';
import {TerrainMesh} from './terrain-mesh.js';

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

  const generations = new Map();
  let frameCb = null;

  // initialization

  e.waitUntil((async () => {
    const instance = procGenManager.getInstance();

    const lodTracker = await instance.createLodChunkTracker({
      lods: 3,
      lod1Range: 2,
      debug: true,
    });
    app.add(lodTracker.debugMesh);
    lodTracker.debugMesh.position.y = 0.1;
    lodTracker.debugMesh.updateMatrixWorld();

    const terrainMesh = new TerrainMesh({
      instance,
    });
    terrainMesh.frustumCulled = false;
    app.add(terrainMesh);
    terrainMesh.updateMatrixWorld();

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
        // console.log('got geometry add', e.data);
        const {geometry} = e.data;
        terrainMesh.addChunk(chunk, geometry);
      });
      generation.addEventListener('geometryremove', e => {
        // const {geometry} = e.data;
        terrainMesh.removeChunk(chunk);
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
    
    frameCb = () => {
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
  })());

  useFrame(() => {
    frameCb && frameCb();
  });

  return app;
};