import metaversefile from 'metaversefile';
import * as THREE from 'three';
const {useApp, useFrame, useCamera, useLocalPlayer, usePhysics, useProcGenManager, useGPUTask, useGenerationTask} = metaversefile;
const {GPUTaskManager} = useGPUTask();
const {GenerationTaskManager} = useGenerationTask();

import { TerrainMesh } from './layers/terrain-mesh.js';
import { WaterMesh } from './layers/water-mesh.js';
// import {BarrierMesh} from './layers/barrier-mesh.js';
import { glbUrlSpecs } from './assets.js';
import { GrassMesh, grassUrls } from './layers/grass-mesh.js';
import { HudMesh, hudUrls } from './layers/hud-mesh.js';
import { GenerationObjectMesh } from './layers/vegetation-mesh.js';

const treeUrls = glbUrlSpecs.trees.slice(0, 1);

const bushUrls = glbUrlSpecs.bushes.slice(0, 1);

const rockUrls = glbUrlSpecs.rocks.slice(0, 1);

const stoneUrls = glbUrlSpecs.stones.slice(0, 1);

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
      minLod: 1,
      maxLod: 7,
      lod1Range: 2,
      // debug: true,
    });
    // app.add(lodTracker.debugMesh);
    // lodTracker.debugMesh.position.y = 0.1;
    // lodTracker.debugMesh.updateMatrixWorld();

    lodTracker.onPostUpdate(position => {
      // barrierMesh.updateChunk(position);
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
    // terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true; 
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

    /* const barrierMesh = new BarrierMesh({
      instance,
      gpuTaskManager,
    });
    barrierMesh.frustumCulled = false;
    app.add(barrierMesh);
    barrierMesh.updateMatrixWorld(); */

    const treeMesh = new GenerationObjectMesh({
      instance,
      physics,
    });
    app.add(treeMesh);
    treeMesh.updateMatrixWorld();

    const bushMesh = new GenerationObjectMesh({
      instance,
      physics,
    });
    // bushMesh.polygonMesh.frustumCulled = false;
    // bushMesh.polygonMesh.castShadow = true;
    // bushMesh.polygonMesh.receiveShadow = true;
    app.add(bushMesh);
    bushMesh.updateMatrixWorld();

    // const rockMesh = new GenerationObjectMesh({
    //   instance,
    //   physics,
    // });
    // app.add(rockMesh);
    // rockMesh.updateMatrixWorld();

    // const stoneMesh = new GenerationObjectMesh({
    //   instance,
    //   physics,
    // });
    // app.add(stoneMesh);
    // stoneMesh.updateMatrixWorld();

    const grassMesh = new GrassMesh({
      instance,
      physics,
    });
    app.add(grassMesh);
    grassMesh.updateMatrixWorld();

    const hudMesh = new HudMesh({
      instance,
    });
    app.add(hudMesh);
    hudMesh.updateMatrixWorld();

    // genration events handling
    lodTracker.onChunkAdd(async chunk => {
      const key = procGenManager.getNodeHash(chunk);
      
      const generation = generationTaskManager.createGeneration(key);
      generation.addEventListener('geometryadd', e => {
        const {result} = e.data;
        const {heightfield} = result;
        const {treeInstances, bushInstances, rockInstances, stoneInstances, grassInstances, poiInstances} = heightfield;

        // console.log('got heightfield', heightfield);

        // heightfield
        terrainMesh.addChunk(chunk, heightfield);
        waterMesh.addChunk(chunk, heightfield);
        // barrierMesh.addChunk(chunk, heightfield);
      
        // trees
        treeMesh.addChunk(chunk, treeInstances);
        
        // bushes
        bushMesh.addChunk(chunk, bushInstances);

        // // rocks
        // rockMesh.addChunk(chunk, rockInstances);
        
        // // stones
        // stoneMesh.addChunk(chunk, stoneInstances);

        // grass
        grassMesh.addChunk(chunk, grassInstances);

        // hud
        hudMesh.addChunk(chunk, poiInstances);
      });
      generation.addEventListener('geometryremove', e => {
        // heightfield
        terrainMesh.removeChunk(chunk);
        waterMesh.removeChunk(chunk);
        // barrierMesh.removeChunk(chunk);

        // tree
        treeMesh.removeChunk(chunk);

        // bush
        bushMesh.removeChunk(chunk);

        // // rock
        // rockMesh.removeChunk(chunk);

        // // stone
        // stoneMesh.removeChunk(chunk);

        // grass
        grassMesh.removeChunk(chunk);

        // hud
        hudMesh.removeChunk(chunk);
      });

      try {
        const signal = generation.getSignal();
        const generateFlags = {
          terrain: true,
          water: true,
          barrier: true,
          vegetation: true,
          rock: true,
          grass: true,
          poi: true,
        };
        const numVegetationInstances = treeUrls.length;
        const numRockInstances = rockUrls.length;
        const numGrassInstances = grassUrls.length;
        const numPoiInstances = hudUrls.length;
        const options = {
          signal,
        };
        const heightfield = await instance.generateChunk(
          chunk.min,
          chunk.lod,
          chunk.lodArray,
          generateFlags,
          numVegetationInstances,
          numRockInstances,
          numGrassInstances,
          numPoiInstances,
          options
        );
        generation.finish({
          heightfield,
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
        terrainMesh.waitForLoad(),
        treeMesh.waitForLoad(treeUrls),
        bushMesh.waitForLoad(bushUrls),
        // rockMesh.waitForLoad(rockUrls),
        // stoneMesh.waitForLoad(stoneUrls),
        grassMesh.waitForLoad(),
        hudMesh.waitForLoad(),
        waterMesh.waitForLoad(),
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

        instance.setCamera(
          playerPosition,
          cameraPosition,
          cameraQuaternion,
          camera.projectionMatrix
        );
        lodTracker.update(playerPosition);
      };
      _updateLodTracker();

      const _updateTreeMesh = () => {
        treeMesh.update(); // update spritesheet uniforms
      };
      _updateTreeMesh();

      const _updateBushMesh = () => {
        bushMesh.update(); // update spritesheet uniforms
      };
      _updateBushMesh();

      // const _updateRockMesh = () => {
        // rockMesh.update(); // update spritesheet uniforms
      // };
      // _updateRockMesh();

      // const _updateStoneMesh = () => {
      //   stoneMesh.update(); // update spritesheet uniforms
      // };
      // _updateStoneMesh();

      const _updateHudMesh = () => {
        hudMesh.update(); // update icon uniforms
      };
      _updateHudMesh();

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