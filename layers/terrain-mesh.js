import * as THREE from 'three';
import metaversefile from 'metaversefile';
import {
  bufferSize,
  WORLD_BASE_HEIGHT,
  MIN_WORLD_HEIGHT,
  MAX_WORLD_HEIGHT,
} from '../constants.js';
const {useProcGenManager, useGeometryBuffering} = metaversefile;
const {BufferedMesh, GeometryAllocator} = useGeometryBuffering();
const procGenManager = useProcGenManager();

//

const fakeMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
});

const localVector3D = new THREE.Vector3();
const localVector3D2 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localBox = new THREE.Box3();

//

export class TerrainMesh extends BufferedMesh {
  constructor({instance, gpuTaskManager, physics}) {
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
        }, */
        /* {
          name: 'seed',
          Type: Float32Array,
          itemSize: 1,
        }, */
        /* {
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

    super(geometry);

    // loading the material
    // (async () => {
    //   const material = await loadTerrainMaterial();
    //   this.material = material;
    // })();

    this.material = new THREE.MeshNormalMaterial();

    this.physics = physics;

    this.instance = instance;
    this.gpuTaskManager = gpuTaskManager;

    this.physicsObjectsMap = new Map();

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
        // let seedsOffset = geometryBinding.getAttributeOffset('seed');
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
        ); */
        /* geometry.attributes.seed.update(
          seedsOffset,
          terrainGeometry.seeds.length,
          terrainGeometry.seeds,
          0
        ); */
        /* geometry.attributes.skylights.update(
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
      const _handleTerrainMesh = (terrainGeometry) => {
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

        const geometryBinding = this.allocator.alloc(
          terrainGeometry.positions.length,
          terrainGeometry.indices.length,
          boundingBox
        );
        _renderTerrainMeshDataToGeometry(
          terrainGeometry,
          this.allocator.geometry,
          geometryBinding
        );

        this.geometryBindings.set(key, geometryBinding);

        /* function downloadFile(file, filename) {
          const blobURL = URL.createObjectURL(file);
          const tempLink = document.createElement('a');
          tempLink.style.display = 'none';
          tempLink.href = blobURL;
          tempLink.setAttribute('download', filename);
        
          document.body.appendChild(tempLink);
          tempLink.click();
          document.body.removeChild(tempLink);
        }
        geometryBinding._positions = terrainGeometry.positions.slice();
        geometryBinding._indices = terrainGeometry.indices.slice();
        globalThis.terrainExport = () => {
          const geometries = [];
          for (const v of this.geometryBindings.values()) {
            // console.log('got v', v._positions, v._indices);
            const {_positions, _indices} = v;
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(_positions, 3));
            geometry.setIndex(new THREE.BufferAttribute(_indices, 1));
            
            geometries.push(geometry);
          }
          const geometry = BufferGeometryUtils.mergeBufferGeometries(geometries);
          const material = new THREE.MeshStandardMaterial({
            color: 0x808080,
          });
          const mesh = new THREE.Mesh(geometry, material);
          const scene = new THREE.Scene();
          scene.add(mesh);
          const exporter = new GLTFExporter();
          exporter.parse(mesh, (gltf) => {
            downloadFile(new Blob([gltf], {type: 'application/octet-stream'}), 'terrain.glb');
          }, {
            binary: true,
          });
        }; */
      };
      const terrainGeometry = chunkResult.terrainGeometry;

      _handleTerrainMesh(terrainGeometry);

      const _handlePhysics = async () => {
        const physicsGeo = new THREE.BufferGeometry();
        physicsGeo.setAttribute(
          'position',
          new THREE.BufferAttribute(terrainGeometry.positions, 3)
        );
        physicsGeo.setIndex(
          new THREE.BufferAttribute(terrainGeometry.indices, 1)
        );
        const physicsMesh = new THREE.Mesh(physicsGeo, fakeMaterial);

        const geometryBuffer = await this.physics.cookGeometryAsync(physicsMesh);

        if (geometryBuffer) {
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
          this.physicsObjectsMap.set(key, physicsObject);
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
      const physicsObject = this.physicsObjectsMap.get(key);

      if (physicsObject) {
        this.physics.removeGeometry(physicsObject);
        this.physicsObjectsMap.delete(key);
      }
    }
    {
      const task = this.gpuTasks.get(key);
      task.cancel();
      this.gpuTasks.delete(key);
    }
  }
}
