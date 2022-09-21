import * as THREE from 'three';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useCamera, useLocalPlayer, usePhysics, useProcGenManager, useGPUTask, useGenerationTask} = metaversefile;
const {GPUTaskManager} = useGPUTask();
const {GenerationTaskManager} = useGenerationTask();

import {TerrainMesh} from './terrain-mesh.js';
import {WaterMesh} from './water-mesh.js';
import {BarrierMesh} from './barrier-mesh.js';
import {LitterMetaMesh} from './litter-mesh.js';

// locals

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();

// urls

const procgenAssetsBaseUrl = `https://webaverse.github.io/procgen-assets/`;
const urlSpecs = {
  trees: [
    `Tree_1_1.glb`,
    `Tree_1_2.glb`,
    `Tree_2_1.glb`,
    `Tree_2_2.glb`,
    `Tree_3_1.glb`,
    `Tree_3_2.glb`,
    `Tree_4_1.glb`,
    `Tree_4_2.glb`,
    `Tree_4_3.glb`,
    `Tree_5_1.glb`,
    `Tree_5_2.glb`,
    `Tree_6_1.glb`,
    `Tree_6_2.glb`,
  ].map(u => {
    return `${procgenAssetsBaseUrl}vegetation/garden-trees/${u}`;
  }),
  ores: [
    `BlueOre_deposit_low.glb`,
    `Iron_Deposit_low.glb`,
    `Ore_Blue_low.glb`,
    `Ore_BrownRock_low.glb`,
    `Ore_Deposit_Red.glb`,
    `Ore_Red_low.glb`,
    `Ore_metal_low.glb`,
    `Ore_wood_low.glb`,
    `Rock_ore_Deposit_low.glb`,
    `TreeOre_low.glb`,
  ].map(u => {
    return `${procgenAssetsBaseUrl}/litter/ores/${u}`;
  }),
};
const litterUrls = urlSpecs.trees.slice(0, 1)
  .concat(urlSpecs.ores.slice(0, 1));

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

    const litterMesh = new LitterMetaMesh({
      instance,
      gpuTaskManager,
      physics,
    });
    app.add(litterMesh);
    litterMesh.updateMatrixWorld();

    // genration events handling
    lodTracker.onChunkAdd(async chunk => {
      const key = procGenManager.getNodeHash(chunk);
      
      const generation = generationTaskManager.createGeneration(key);
      generation.addEventListener('geometryadd', e => {
        const {result} = e.data;
        const {heightfield, vegetation} = result;
        
        // heightfield
        terrainMesh.addChunk(chunk, heightfield);
        waterMesh.addChunk(chunk, heightfield);
        barrierMesh.addChunk(chunk, heightfield);
      
        // vegetation
        litterMesh.addChunk(chunk, vegetation);
      });
      generation.addEventListener('geometryremove', e => {
        // heightfield
        terrainMesh.removeChunk(chunk);
        waterMesh.removeChunk(chunk);
        barrierMesh.removeChunk(chunk);

        // vegetation
        litterMesh.removeChunk(chunk);
      });

      try {
        const signal = generation.getSignal();
        const [
          heightfield,
          vegetation,
        ] = await Promise.all([
          instance.generateChunk(chunk.min, chunk.lod, chunk.lodArray, {
            signal,
          }),
          instance.generateVegetation(chunk.min, chunk.lod, litterUrls.length, {
            signal,
          }),
        ]);
        generation.finish({
          heightfield,
          vegetation,
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
    await litterMesh.loadUrls(litterUrls);

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
        litterMesh.update();
      };
      _updateLitteMesh();

      gpuTaskManager.update();
    };
  })());

  useFrame(() => {
    frameCb && frameCb();
  });

  return app;
};