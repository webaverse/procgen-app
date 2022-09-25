import * as THREE from 'three';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useCamera, useLocalPlayer, usePhysics, useProcGenManager, useGPUTask, useGenerationTask} = metaversefile;
const {GPUTaskManager} = useGPUTask();
const {GenerationTaskManager} = useGenerationTask();

import {TerrainMesh} from './layers/terrain-mesh.js';
import {WaterMesh} from './layers/water-mesh.js';
// import {BarrierMesh} from './layers/barrier-mesh.js';
// import {LitterMetaMesh, litterUrls} from './layers/litter-mesh.js';
// import {GrassMesh, grassUrls} from './layers/grass-mesh.js';

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
      // barrierMesh.updateChunk(currentCoord);
    });

    // managers
    const gpuTaskManager = new GPUTaskManager();
    const generationTaskManager = new GenerationTaskManager();

    // meshes
    const terrainMesh = new TerrainMesh({
      instance,
      gpuTaskManager,
      physics,
    });
    terrainMesh.frustumCulled = false;
    app.add(terrainMesh);
    terrainMesh.updateMatrixWorld();

    const waterMesh = new WaterMesh({
      instance,
      gpuTaskManager,
      physics,
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

    // const litterMesh = new LitterMetaMesh({
    //   instance,
    //   gpuTaskManager,
    //   physics,
    // });
    // app.add(litterMesh);
    // litterMesh.updateMatrixWorld();

    // const grassMesh = new GrassMesh({
    //   instance,
    //   gpuTaskManager,
    //   physics,
    // });
    // app.add(grassMesh);
    // grassMesh.updateMatrixWorld();

    // genration events handling
    lodTracker.onChunkAdd(async chunk => {
      const key = procGenManager.getNodeHash(chunk);
      
      const generation = generationTaskManager.createGeneration(key);
      generation.addEventListener('geometryadd', e => {
        const {result} = e.data;
        const {heightfield, vegetation, grass} = result;
        
        // heightfield
        terrainMesh.addChunk(chunk, heightfield);
        waterMesh.addChunk(chunk, heightfield);
        // barrierMesh.addChunk(chunk, heightfield);
      
        // vegetation
        // litterMesh.addChunk(chunk, vegetation);
        
        // grass
        // grassMesh.addChunk(chunk, grass);
      });
      generation.addEventListener('geometryremove', e => {
        // heightfield
        terrainMesh.removeChunk(chunk);
        waterMesh.removeChunk(chunk);
        // barrierMesh.removeChunk(chunk);

        // vegetation
        // litterMesh.removeChunk(chunk);

        // grass
        // grassMesh.removeChunk(chunk);
      });

      try {
        const signal = generation.getSignal();
        const generateFlags = {
          terrain: true,
          water: true,
          // barrier: true,
          // vegetation: true,
          // grass: true,
        };
        const options = {
          signal,
        };
        const [
          heightfield,
          vegetation,
          grass,
        ] = await Promise.all([
          instance.generateChunk(chunk.min, chunk.lod, chunk.lodArray, generateFlags, options),
          // instance.generateVegetation(chunk.min, chunk.lod, litterUrls.length, options),
          // instance.generateGrass(chunk.min, chunk.lod, grassUrls.length, options),
        ]);
        generation.finish({
          heightfield,
          // vegetation,
          // grass,
        });
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

    // load
    const _waitForLoad = async () => {
      await Promise.all([
        // litterMesh.waitForLoad(),
        // grassMesh.waitForLoad(),
      ]);
    };
    await _waitForLoad();

    // frame handling
    frameCb = () => {
      const _updateLodTracker = () => {
        const localPlayer = useLocalPlayer();

        const appMatrixWorldInverse = localMatrix2.copy(app.matrixWorld)
          .invert();
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

      const _updateLitteMesh = () => {
        // litterMesh.update(); // update spritesheet uniforms
      };
      _updateLitteMesh();

      const _updateWaterMesh = () => {
        waterMesh.update();
        waterMesh.lastUpdateCoord.set(lodTracker.lastUpdateCoord.x, lodTracker.lastUpdateCoord.y);
      };
      _updateWaterMesh();

      gpuTaskManager.update();
    };
  })());

  useFrame(() => {
    frameCb && frameCb();
  });

  return app;
};