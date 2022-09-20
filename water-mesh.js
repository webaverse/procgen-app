import * as THREE from 'three';
import metaversefile from 'metaversefile';
import {bufferSize, WORLD_BASE_HEIGHT, MIN_WORLD_HEIGHT, MAX_WORLD_HEIGHT} from './constants.js';

const {useProcGenManager, useGeometryBuffering} = metaversefile;
const {BufferedMesh, GeometryAllocator} = useGeometryBuffering();
const procGenManager = useProcGenManager();

//

const localVector3D = new THREE.Vector3();
const localVector3D2 = new THREE.Vector3();
const localBox = new THREE.Box3();

//

export class WaterMesh extends BufferedMesh {
  constructor({
    instance,
    gpuTaskManager,
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
        {
          name: 'factor',
          Type: Float32Array,
          itemSize: 1,
        },
      ],
      {
        bufferSize,
        boundingType: 'box',
        // hasOcclusionCulling: true
      }
    );

    const {geometry} = allocator;
    const material = new THREE.MeshStandardMaterial({color: '#78c7e3', metalness: 0.75, roughness: 0.1});

    super(geometry, material);

    this.instance = instance;
    this.gpuTaskManager = gpuTaskManager;

    this.allocator = allocator;
    this.gpuTasks = new Map();
    this.geometryBindings = new Map();
  }
  addChunk(chunk, chunkResult) {
    const key = procGenManager.getNodeHash(chunk);
    const task = this.gpuTaskManager.transact(() => {
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
      const _renderWaterMeshDataToGeometry = (
        waterGeometry,
        geometry,
        geometryBinding
      ) => {
        let positionOffset = geometryBinding.getAttributeOffset('position');
        let normalOffset = geometryBinding.getAttributeOffset('normal');
        let factorOffset = geometryBinding.getAttributeOffset('factor');
        let indexOffset = geometryBinding.getIndexOffset();

        _mapOffsettedIndices(
          waterGeometry.indices,
          geometry.index.array,
          indexOffset,
          positionOffset
        );

        geometry.attributes.position.update(
          positionOffset,
          waterGeometry.positions.length,
          waterGeometry.positions,
          0
        );
        geometry.attributes.normal.update(
          normalOffset,
          waterGeometry.normals.length,
          waterGeometry.normals,
          0
        );
        geometry.attributes.factor.update(
          factorOffset,
          waterGeometry.factors.length,
          waterGeometry.factors,
          0
        );
        geometry.index.update(indexOffset, waterGeometry.indices.length);
      };
      const _handleWaterMesh = waterGeometry => {
        const {chunkSize} = this.instance;

        const boundingBox = localBox.set(
          localVector3D.set(
            chunk.min.x * chunkSize,
            -WORLD_BASE_HEIGHT + MIN_WORLD_HEIGHT,
            chunk.min.y * chunkSize
          ),
          localVector3D2.set(
            (chunk.min.x + chunk.lod) * chunkSize,
            -WORLD_BASE_HEIGHT + MAX_WORLD_HEIGHT,
            (chunk.min.y + chunk.lod) * chunkSize
          )
        );
        /* localSphere.center.set(
            (chunk.min.x + 0.5) * chunkSize,
            (chunk.min.y + 0.5) * chunkSize,
            (chunk.min.z + 0.5) * chunkSize
          )
          .applyMatrix4(this.matrixWorld);
        localSphere.radius = chunkRadius; */

        // const min = localVector3D.set(chunk.min.x, chunk.min.y, chunk.min.z)
        //   .multiplyScalar(chunkSize);
        // const max = localVector3D2.set(chunk.min.x, chunk.min.y, chunk.min.z)
        //   .addScalar(chunk.lod)
        //   .multiplyScalar(chunkSize);

        // console.log(localVector3D.x + ", " + localVector3D2.x);

        const geometryBinding = this.allocator.alloc(
          waterGeometry.positions.length,
          waterGeometry.indices.length,
          boundingBox,
          // min,
          // max,
          // this.appMatrix,
          // waterGeometry.peeks
        );
        // console.log(localVector3D);
        _renderWaterMeshDataToGeometry(
          waterGeometry,
          this.allocator.geometry,
          geometryBinding
        );

        this.geometryBindings.set(key, geometryBinding);
      };
      _handleWaterMesh(chunkResult.waterGeometry);

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
    });
    this.gpuTasks.set(key, task);
  }
  removeChunk(chunk) {
    const key = procGenManager.getNodeHash(chunk);

    {
      // console.log('chunk remove', key, chunk.min.toArray().join(','));
      const geometryBinding = this.geometryBindings.get(key);
      if (geometryBinding) {
        /* if (!geometryBinding) {
          debugger;
        } */
        this.allocator.free(geometryBinding);
        this.geometryBindings.delete(key);
      }
    }
    {
      const task = this.gpuTasks.get(key);
      task.cancel();
      this.gpuTasks.delete(key);
    }
  }
}