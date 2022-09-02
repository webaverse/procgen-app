import * as THREE from 'three';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useLocalPlayer, useProcGenManager, useInstancing, usePhysics} = metaversefile;

// constants

// const terrainSize = chunkWorldSize * 4;
// const chunkRadius = Math.sqrt(chunkWorldSize * chunkWorldSize * 3);
// const defaultNumNods = 2;
// const defaultMinLodRange = 2;
const bufferSize = 4 * 1024 * 1024;

// locals

const localVector3D = new THREE.Vector3();
const localVector3D2 = new THREE.Vector3();
const localBox = new THREE.Box3();

// errors

const abortError = new Error('aborted');
abortError.isAbortError = true;

// events

const geometryaddEvent = new MessageEvent('geometryadd', {
  data: {
    geometry: null,
  },
});
const geometryremoveEvent = new MessageEvent('geometryremove', {
  data: {
    geometry: null,
  },
});

// main

export default e => {
  const app = useApp();
  const procGenManager = useProcGenManager();
  const {BatchedMesh, GeometryAllocator} = useInstancing();
  const physics = usePhysics();

  // classes

  class Generation extends EventTarget {
    constructor(key, abortController) {
      super();
  
      this.key = key;
      this.abortController = abortController;
  
      this.result = null;
    }
    finish(result) {
      this.result = result;

      // console.log('generation finish', !!result);
  
      geometryaddEvent.data.geometry = result;
      this.dispatchEvent(geometryaddEvent);
    }
    cancel() {
      // console.log('cancel finished 1', !!this.result);
      this.abortController.abort(abortError);

      // console.log('cancel finished 2', !!this.result);
      if (this.result) {
        geometryremoveEvent.data.geometry = this.result;
        this.dispatchEvent(geometryremoveEvent);
      }
    }
  }

  // meshes

  class TerrainMesh extends BatchedMesh {
    constructor({
      instance,
      // physics,
      // biomeUvDataTexture,
      // atlasTextures,
      // appMatrix
    }) {
      const allocator = new GeometryAllocator(
        [
          {
            name: 'position',
            Type: Float32Array,
            itemSize: 3,
          },
          {
            name: 'normal',
            Type: Float32Array,
            itemSize: 3,
          },
          /* {
            name: 'biomesWeights',
            Type: Float32Array,
            itemSize: 4,
          }, */
          {
            name: 'biomesUvs1',
            Type: Float32Array,
            itemSize: 4,
          },
          /* {
            name: 'biomesUvs2',
            Type: Float32Array,
            itemSize: 4,
          },
          {
            name: 'skylights',
            Type: Uint8Array,
            itemSize: 1,
          },
          {
            name: 'aos',
            Type: Uint8Array,
            itemSize: 1,
          },
          {
            name: 'peeks',
            Type: Uint8Array,
            itemSize: 1,
          }, */
        ],
        {
          bufferSize,
          boundingType: 'box',
          // hasOcclusionCulling: true
        }
      );

      const {geometry} = allocator;
      const material = new THREE.MeshNormalMaterial();

      super(geometry, material);

      this.instance = instance;

      this.allocator = allocator;
      this.geometryBindings = new Map();
    }
    addChunk(chunk, chunkData) {
      // non-empty chunk
      // const {chunkData, geometryBuffer} = renderData;

      const _mapOffsettedIndices = (
        srcIndices,
        dstIndices,
        dstOffset,
        positionOffset
      ) => {
        const positionIndex = positionOffset / 3;
        for (let i = 0; i < srcIndices.length; i++) {
          dstIndices[dstOffset + i] = srcIndices[i] + positionIndex;
        }
      };
      const _renderTerrainMeshDataToGeometry = (
        chunkData,
        geometry,
        geometryBinding
      ) => {
        let positionOffset = geometryBinding.getAttributeOffset('position');
        let normalOffset = geometryBinding.getAttributeOffset('normal');
        // let biomesOffset = geometryBinding.getAttributeOffset('biomes');
        // let biomesWeightsOffset = geometryBinding.getAttributeOffset('biomesWeights');
        let biomesUvs1Offset = geometryBinding.getAttributeOffset('biomesUvs1');
        // let biomesUvs2Offset = geometryBinding.getAttributeOffset('biomesUvs2');
        // let skylightsOffset = geometryBinding.getAttributeOffset('skylights');
        // let aosOffset = geometryBinding.getAttributeOffset('aos');
        let indexOffset = geometryBinding.getIndexOffset();

        _mapOffsettedIndices(
          chunkData.indices,
          geometry.index.array,
          indexOffset,
          positionOffset
        );

        geometry.attributes.position.update(
          positionOffset,
          chunkData.positions.length,
          chunkData.positions,
          0
        );
        geometry.attributes.normal.update(
          normalOffset,
          chunkData.normals.length,
          chunkData.normals,
          0
        );
        /* geometry.attributes.biomes.update(
          biomesOffset,
          chunkData.biomes.length,
          chunkData.biomes,
          0
        ); */
        /* geometry.attributes.biomesWeights.update(
          biomesWeightsOffset,
          chunkData.biomesWeights.length,
          chunkData.biomesWeights,
          0
        ); */
        // console.log('biomes', geometry.attributes.biomesUvs1, geometry.attributes.biomesUvs2);
        geometry.attributes.biomesUvs1.update(
          biomesUvs1Offset,
          chunkData.biomesUvs1.length,
          chunkData.biomesUvs1,
          0
        );
        /* geometry.attributes.biomesUvs2.update(
          biomesUvs2Offset,
          chunkData.biomesUvs2.length,
          chunkData.biomesUvs2,
          0
        );
        geometry.attributes.skylights.update(
          skylightsOffset,
          chunkData.skylights.length,
          chunkData.skylights,
          0
        );
        geometry.attributes.aos.update(
          aosOffset,
          chunkData.aos.length,
          chunkData.aos,
          0
        ); */
        geometry.index.update(indexOffset, chunkData.indices.length);
      };
      const _handleMesh = () => {
        const chunkSize = this.instance.chunkSize * chunk.lod;

        const boundingBox = localBox; // XXX
        /* localSphere.center.set(
            (chunk.min.x + 0.5) * chunkSize,
            (chunk.min.y + 0.5) * chunkSize,
            (chunk.min.z + 0.5) * chunkSize
          )
          .applyMatrix4(this.matrixWorld);
        localSphere.radius = chunkRadius; */

        const min = localVector3D.set(chunk.min.x, chunk.min.y, chunk.min.z)
          .multiplyScalar(chunkSize);
        const max = localVector3D2.set(chunk.min.x, chunk.min.y, chunk.min.z)
          .addScalar(chunk.lod)
          .multiplyScalar(chunkSize);

        // console.log(localVector3D.x + ", " + localVector3D2.x);

        const geometryBinding = this.allocator.alloc(
          chunkData.positions.length,
          chunkData.indices.length,
          boundingBox,
          min,
          max,
          // this.appMatrix,
          // chunkData.peeks
        );
        // console.log(localVector3D);
        _renderTerrainMeshDataToGeometry(
          chunkData,
          this.allocator.geometry,
          geometryBinding
        );

        const key = procGenManager.getNodeHash(chunk);
        this.geometryBindings.set(key, geometryBinding);
      };
      _handleMesh();

      /* const _handlePhysics = async () => {
        if (geometryBuffer) {
          this.matrixWorld.decompose(localVector, localQuaternion, localVector2);
          const physicsObject = this.physics.addCookedGeometry(
            geometryBuffer,
            localVector,
            localQuaternion,
            localVector2
          );
          this.physicsObjects.push(physicsObject);
          this.physicsObjectToChunkMap.set(physicsObject, chunk);

          const onchunkremove = () => {
            this.physics.removeGeometry(physicsObject);

            const index = this.physicsObjects.indexOf(physicsObject);
            this.physicsObjects.splice(index, 1);
            this.physicsObjectToChunkMap.delete(physicsObject);

            tracker.offChunkRemove(chunk, onchunkremove);
          };
          tracker.onChunkRemove(chunk, onchunkremove);
        }
      };
      _handlePhysics(); */
    }
    removeChunk(chunk) {
      const key = procGenManager.getNodeHash(chunk);
      // console.log('chunk remove', key, chunk.min.toArray().join(','));
      const geometryBinding = this.geometryBindings.get(key);
      /* if (!geometryBinding) {
        debugger;
      } */

      this.allocator.free(geometryBinding);

      this.geometryBindings.delete(key);
    }
  }

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
        const result = await instance.generateTerrainChunk(chunk.min, chunk.lod, {
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
      lodTracker.update(localPlayer.position);
    };
  })());

  useFrame(() => {
    frameCb && frameCb();
  });

  return app;
};