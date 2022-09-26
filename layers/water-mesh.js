import * as THREE from 'three';
import metaversefile from 'metaversefile';
import {bufferSize, WORLD_BASE_HEIGHT, MIN_WORLD_HEIGHT, MAX_WORLD_HEIGHT} from '../constants.js';

const {useProcGenManager, useGeometryBuffering, useLocalPlayer} = metaversefile;
const {BufferedMesh, GeometryAllocator} = useGeometryBuffering();
const procGenManager = useProcGenManager();

//
const fakeMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
});
const localVector3D = new THREE.Vector3();
const localVector3D2 = new THREE.Vector3();
const localBox = new THREE.Box3();
const localQuaternion = new THREE.Quaternion();
const localVector = new THREE.Vector3();
//

export class WaterMesh extends BufferedMesh {
  constructor({
    instance,
    gpuTaskManager,
    physics
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
    const material = new THREE.MeshNormalMaterial();

    super(geometry);

    this.instance = instance;
    this.gpuTaskManager = gpuTaskManager;

    this.allocator = allocator;
    this.gpuTasks = new Map();
    this.geometryBindings = new Map();

    this.material = new THREE.MeshBasicMaterial( {color: 0x0000ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9} );
    this.geometry = geometry;
    this.physics = physics;
    this.physicsObjectsMap = new Map();
    this.currentChunkMap = new Map();
    this.currentWaterHeightMap = new Map();
    this.lastUpdateCoord = new THREE.Vector2();
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
      const waterGeometry = chunkResult.waterGeometry
      _handleWaterMesh(waterGeometry);

      const _handlePhysics = async () => {
        const physicsGeo = new THREE.BufferGeometry();
        physicsGeo.setAttribute(
          'position',
          new THREE.BufferAttribute(waterGeometry.positions, 3)
        );
        physicsGeo.setIndex(
          new THREE.BufferAttribute(waterGeometry.indices, 1)
        );
        const physicsMesh = new THREE.Mesh(physicsGeo, fakeMaterial);
        
        const geometryBuffer = await this.physics.cookGeometryAsync(physicsMesh);

        if (geometryBuffer && geometryBuffer.length !== 0) {
          this.matrixWorld.decompose(
            localVector3D,
            localQuaternion,
            localVector3D2
          );
          const physicsObject = this.physics.addCookedGeometry(
            geometryBuffer,
            localVector3D,
            localQuaternion,
            localVector3D2
          );
          this.physics.disableGeometryQueries(physicsObject); // disable each physicsObject
          this.physicsObjectsMap.set(key, physicsObject);
          this.currentChunkMap.set(chunk.min.x + ',' + chunk.min.y, physicsObject); // use string of chunk.min as a key to map each physicsObject
          this.currentWaterHeightMap.set(chunk.min.x + ',' + chunk.min.y, waterGeometry.positions[1]); // use string of chunk.min as a key to map the posY of each chunk
        }
      };
      _handlePhysics();
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
  checkWaterContact(chunkPhysicObject, player, waterSurfaceHeight) {
    // use overlapBox to check whether player contact the water
    this.physics.enableGeometryQueries(chunkPhysicObject);
    if (player.avatar) {
      let collisionIds;
      const height = player.avatar.height * 0.9;
      const width = player.avatar.shoulderWidth
      if (player.position.y > waterSurfaceHeight) {
        collisionIds = this.physics.overlapBox(width, height, width, player.position, player.quaternion).objectIds;
      }
      else {
        localVector.set(player.position.x, waterSurfaceHeight, player.position.z);
        collisionIds = this.physics.overlapBox(width, height, width, localVector, player.quaternion).objectIds;
      } 
      for (const collisionId of collisionIds) {
        if (collisionId === chunkPhysicObject.physicsId) {
          this.physics.disableGeometryQueries(chunkPhysicObject);
          return true;
        }
      }
    }
    this.physics.disableGeometryQueries(chunkPhysicObject);
    return false;
  }
  handleSwimAction(contactWater, player, waterSurfaceHeight) {
    const swimAction = player.getAction('swim');
    const hasSwim = !!swimAction;
    if (contactWater) {
      this.material.color.setHex( 0x0000ff ); // for testing
      if (waterSurfaceHeight >= player.position.y - player.avatar.height + player.avatar.height * 0.8) {
        if (!hasSwim) {
          const swimAction = {
              type: 'swim',
              onSurface: false,
              swimDamping: 1,
              animationType: 'breaststroke'
          };
          player.setControlAction(swimAction);
        }
        // handle onSurface
        if (waterSurfaceHeight < player.position.y - player.avatar.height + player.avatar.height * 0.85) {
          if (hasSwim && !swimAction.onSurface) {
            swimAction.onSurface = true;
          }
        }
        else {
          if (hasSwim && swimAction.onSurface) {
            swimAction.onSurface = false;
          }
        }
      }
      else{
          if (hasSwim) {
            player.removeAction('swim');
          }
      }  
    } 
    else {
      this.material.color.setHex( 0xff0000 ); // for testing
      if (hasSwim) {
        player.removeAction('swim');
      }
    }
  }
  update() {
    const localPlayer = useLocalPlayer();
    const lastUpdateCoordKey = this.lastUpdateCoord.x + ',' + this.lastUpdateCoord.y; 
    const currentChunkPhysicObject = this.currentChunkMap.get(lastUpdateCoordKey); // use lodTracker.lastUpdateCoord as a key to check which chunk player currently at 

    // handel water physic and swimming action if we get the physicObject of the current chunk
    if (currentChunkPhysicObject) { 
      const waterSurfaceHeight = this.currentWaterHeightMap.get(lastUpdateCoordKey); // use lodTracker.lastUpdateCoord as a key to check the water height of the current chunk
      const contactWater = this.checkWaterContact(currentChunkPhysicObject, localPlayer, waterSurfaceHeight); // check whether player contact the water

      // handle swimming action
      this.handleSwimAction(contactWater, localPlayer, waterSurfaceHeight);
    }
  }
}