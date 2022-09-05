import * as THREE from 'three';
import metaversefile from 'metaversefile';
import {bufferSize} from './constants.js';

const {useInstancing, useProcGenManager} = metaversefile;
const {BatchedMesh, GeometryAllocator} = useInstancing();
const procGenManager = useProcGenManager();

//

const localVector3D = new THREE.Vector3();
const localVector3D2 = new THREE.Vector3();
const localBox = new THREE.Box3();

//

export class TerrainMesh extends BatchedMesh {
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
  addChunk(chunk, chunkResult) {
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
      terrainGeometry,
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
        terrainGeometry.indices,
        geometry.index.array,
        indexOffset,
        positionOffset
      );

      geometry.attributes.position.update(
        positionOffset,
        terrainGeometry.positions.length,
        terrainGeometry.positions,
        0
      );
      geometry.attributes.normal.update(
        normalOffset,
        terrainGeometry.normals.length,
        terrainGeometry.normals,
        0
      );
      /* geometry.attributes.biomes.update(
        biomesOffset,
        terrainGeometry.biomes.length,
        terrainGeometry.biomes,
        0
      ); */
      /* geometry.attributes.biomesWeights.update(
        biomesWeightsOffset,
        terrainGeometry.biomesWeights.length,
        terrainGeometry.biomesWeights,
        0
      ); */
      // console.log('biomes', geometry.attributes.biomesUvs1, geometry.attributes.biomesUvs2);
      geometry.attributes.biomesUvs1.update(
        biomesUvs1Offset,
        terrainGeometry.biomesUvs1.length,
        terrainGeometry.biomesUvs1,
        0
      );
      /* geometry.attributes.biomesUvs2.update(
        biomesUvs2Offset,
        terrainGeometry.biomesUvs2.length,
        terrainGeometry.biomesUvs2,
        0
      );
      geometry.attributes.skylights.update(
        skylightsOffset,
        terrainGeometry.skylights.length,
        terrainGeometry.skylights,
        0
      );
      geometry.attributes.aos.update(
        aosOffset,
        terrainGeometry.aos.length,
        terrainGeometry.aos,
        0
      ); */
      geometry.index.update(indexOffset, terrainGeometry.indices.length);
    };
    const _handleTerrainMesh = terrainGeometry => {
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
        terrainGeometry.positions.length,
        terrainGeometry.indices.length,
        boundingBox,
        min,
        max,
        // this.appMatrix,
        // terrainGeometry.peeks
      );
      // console.log(localVector3D);
      _renderTerrainMeshDataToGeometry(
        terrainGeometry,
        this.allocator.geometry,
        geometryBinding
      );

      const key = procGenManager.getNodeHash(chunk);
      this.geometryBindings.set(key, geometryBinding);
    };
    _handleTerrainMesh(chunkResult.terrainGeometry);

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