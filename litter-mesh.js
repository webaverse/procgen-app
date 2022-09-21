import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useProcGenManager, useGeometries, useAtlasing, useGeometryBatching, useGeometryChunking, useLoaders, usePhysics, useSpriting} = metaversefile;
const procGenManager = useProcGenManager();
const {createAppUrlSpriteSheet} = useSpriting();
const {DoubleSidedPlaneGeometry} = useGeometries();
const {createTextureAtlas} = useAtlasing();
const {InstancedBatchedMesh, InstancedGeometryAllocator} = useGeometryBatching();
const {ChunkedBatchedMesh, ChunkedGeometryAllocator} = useGeometryChunking();
const {gltfLoader} = useLoaders();
import {
  // bufferSize,
  WORLD_BASE_HEIGHT,
  MIN_WORLD_HEIGHT,
  MAX_WORLD_HEIGHT,
} from './constants.js';

//

const spriteLodCutoff = 16;

//

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localBox = new THREE.Box3();

//

const meshLodSpecs = {
  1: {
    targetRatio: 1,
    targetError: 0,
  },
  2: {
    targetRatio: 0.5,
    targetError: 0.01,
  },
  4: {
    targetRatio: 0.3,
    targetError: 0.05,
  },
  8: {
    targetRatio: 0.15,
    targetError: 0.1,
  },
};
const meshLodSpecKeys = Object.keys(meshLodSpecs).map(Number);
class MeshPackage {
  constructor(lodMeshes) {
    this.lodMeshes = lodMeshes;
  }
  static async loadUrls(urls, physics) {
    // const meshSize = 3;
    const _loadModel = u => new Promise((accept, reject) => {
      gltfLoader.load(u, o => {
        accept(o.scene);
      }, function onProgress() {}, reject);
    });
    const _getMesh = model => {
      let mesh = null;
      const _recurse = o => {
        if (o.isMesh) {
          mesh = o;
          return false;
        } else {
          for (let i = 0; i < o.children.length; i++) {
            if (!_recurse(o.children[i])) {
              return false;
            }
          }
          return true;
        }
      };
      _recurse(model);
      return mesh;
    };
    const _generateLodMeshes = async mesh => {
      const lodMeshes = await Promise.all(meshLodSpecKeys.map(async lod => {
        const meshLodSpec = meshLodSpecs[lod];
        const {targetRatio, targetError} = meshLodSpec;
        if (targetRatio === 1) {
          return mesh;
        } else {
          const lodMesh = await physics.meshoptSimplify(mesh, targetRatio, targetError);
          return lodMesh;
        }
      }));
      return lodMeshes;
    };
    

    const models = await Promise.all(urls.map(_loadModel));
    const meshes = models.map(_getMesh);
    const textureAtlasResult = createTextureAtlas(meshes, {
      textures: ['map', 'normalMap'],
      attributes: ['position', 'normal', 'uv'],
    });
    const {
      meshes: atlasedMeshes,
    } = textureAtlasResult;
    const lodMeshes = await Promise.all(atlasedMeshes.map(_generateLodMeshes));
    
    const pkg = new MeshPackage(lodMeshes);
    return pkg;
  }
}

//

class LitterPolygonMesh extends InstancedBatchedMesh {
  constructor({
    instance,
    // procGenInstance,
    // lodMeshes = [],
    // shapeAddresses = [],
    // physicsGeometries = [],
    // physics = null,
  } = {}) {
    // instancing
    /* const {
      atlasTextures,
      geometries: lod0Geometries,
    } = createTextureAtlas(lodMeshes.map(lods => lods[0]), {
      textures: ['map', 'normalMap'],
      attributes: ['position', 'normal', 'uv'],
    }); */
    
    // allocator
    const allocator = new InstancedGeometryAllocator(lod0Geometries, [
      {
        name: 'p',
        Type: Float32Array,
        itemSize: 3,
      },
      {
        name: 'q',
        Type: Float32Array,
        itemSize: 4,
      },
    ], {
      maxInstancesPerDrawCall,
      maxDrawCallsPerGeometry,
      boundingType: 'box',
    });
    const {geometry, textures: attributeTextures} = allocator;
    for (const k in attributeTextures) {
      const texture = attributeTextures[k];
      texture.anisotropy = maxAnisotropy;
    }

    // material

    const material = new THREE.MeshStandardMaterial({
      map: atlasTextures.map,
      normalMap: atlasTextures.normalMap,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.5,
      onBeforeCompile: (shader) => {
        shader.uniforms.pTexture = {
          value: attributeTextures.p,
          needsUpdate: true,
        };
        shader.uniforms.qTexture = {
          value: attributeTextures.q,
          needsUpdate: true,
        };
        
        // vertex shader

        shader.vertexShader = shader.vertexShader.replace(`#include <uv_pars_vertex>`, `\
#undef USE_INSTANCING

#include <uv_pars_vertex>

uniform sampler2D pTexture;
uniform sampler2D qTexture;

vec3 rotate_vertex_position(vec3 position, vec4 q) { 
  return position + 2.0 * cross(q.xyz, cross(q.xyz, position) + q.w * position);
}
        `);
        shader.vertexShader = shader.vertexShader.replace(`#include <begin_vertex>`, `\
#include <begin_vertex>

int instanceIndex = gl_DrawID * ${maxInstancesPerDrawCall} + gl_InstanceID;
const float width = ${attributeTextures.p.image.width.toFixed(8)};
const float height = ${attributeTextures.p.image.height.toFixed(8)};
float x = mod(float(instanceIndex), width);
float y = floor(float(instanceIndex) / width);
vec2 pUv = (vec2(x, y) + 0.5) / vec2(width, height);
vec3 p = texture2D(pTexture, pUv).xyz;
vec4 q = texture2D(qTexture, pUv).xyzw;

// instance offset
{
  transformed = rotate_vertex_position(transformed, q);
  transformed += p;
}
/* {
  transformed.y += float(gl_DrawID) * 10.;
  transformed.x += float(gl_InstanceID) * 10.;
} */
        `);
        shader.fragmentShader = shader.fragmentShader.replace(`#include <uv_pars_fragment>`, `\
#undef USE_INSTANCING

#if ( defined( USE_UV ) && ! defined( UVS_VERTEX_ONLY ) )
	varying vec2 vUv;
#endif
        `);

        // fragment shader
        
        return shader;
      },
    });

    // mesh

    super(geometry, material, allocator);
    this.frustumCulled = false;
    
    this.procGenInstance = procGenInstance;
    this.meshes = lodMeshes;
    this.shapeAddresses = shapeAddresses;
    this.physicsGeometries = physicsGeometries;
    this.physics = physics;
    this.physicsObjects = [];

    this.instanceObjects = new Map();
  }

  drawChunk(chunk, renderData, tracker){
    const {
      vegetationData,
    } = renderData;
    const localPhysicsObjects = [];
    const _renderVegetationGeometry = (drawCall, ps, qs, index) => {
      // geometry
      const pTexture = drawCall.getTexture('p');
      const pOffset = drawCall.getTextureOffset('p');
      const qTexture = drawCall.getTexture('q');
      const qOffset = drawCall.getTextureOffset('q');

      const px = ps[index * 3];
      const py = ps[index * 3 + 1];
      const pz = ps[index * 3 + 2];
      pTexture.image.data[pOffset] = px;
      pTexture.image.data[pOffset + 1] = py;
      pTexture.image.data[pOffset + 2] = pz;

      const qx = qs[index * 4];
      const qy = qs[index * 4 + 1];
      const qz = qs[index * 4 + 2];
      const qw = qs[index * 4 + 3];
      qTexture.image.data[qOffset] = qx;
      qTexture.image.data[qOffset + 1] = qy;
      qTexture.image.data[qOffset + 2] = qz;
      qTexture.image.data[qOffset + 3] = qw;

      drawCall.updateTexture('p', pOffset, ps.length);
      drawCall.updateTexture('q', qOffset, qs.length);

      // physics
      const shapeAddress = this.#getShapeAddress(drawCall.geometryIndex);
      const physicsObject = this.#addPhysicsShape(shapeAddress, drawCall.geometryIndex, px, py, pz, qx, qy, qz, qw);
      this.physicsObjects.push(physicsObject);
      localPhysicsObjects.push(physicsObject);

      drawCall.incrementInstanceCount();
      
      this.instanceObjects.set(physicsObject.physicsId, drawCall);
      
    };

      
    const drawcalls = [];
    for (let i = 0; i < vegetationData.instances.length; i++) {
      const geometryNoise = vegetationData.instances[i];
      const geometryIndex = Math.floor(geometryNoise * this.meshes.length);
      
      localBox.setFromCenterAndSize(
        localVector.set(
          (chunk.min.x + 0.5) * chunkWorldSize,
          (chunk.min.y + 0.5) * chunkWorldSize,
          (chunk.min.z + 0.5) * chunkWorldSize
        ),
        localVector2.set(chunkWorldSize, chunkWorldSize * 256, chunkWorldSize)
      );

      let drawCall = this.allocator.allocDrawCall(geometryIndex, localBox);
      drawcalls.push(drawCall);
      _renderVegetationGeometry(drawCall, vegetationData.ps, vegetationData.qs, i);
    }

    const onchunkremove = () => {
      drawcalls.forEach(drawcall => {
        this.allocator.freeDrawCall(drawcall);
      });
      tracker.offChunkRemove(chunk, onchunkremove);

      const firstLocalPhysicsObject = localPhysicsObjects[0];
      const firstLocalPhysicsObjectIndex = this.physicsObjects.indexOf(firstLocalPhysicsObject);
      this.physicsObjects.splice(firstLocalPhysicsObjectIndex, localPhysicsObjects.length);
    };
    tracker.onChunkRemove(chunk, onchunkremove);

  }
  
  #getShapeAddress(geometryIndex) {
    return this.shapeAddresses[geometryIndex];
  }
  #getShapeGeometry(geometryIndex){
    return this.physicsGeometries[geometryIndex];
  }
  
  #addPhysicsShape(shapeAddress, geometryIndex, px, py, pz, qx, qy, qz, qw) {    
    localVector.set(px, py, pz);
    localQuaternion.set(qx, qy, qz, qw);
    localVector2.set(1, 1, 1);
    localMatrix.compose(localVector, localQuaternion, localVector2)
      .premultiply(this.matrixWorld)
      .decompose(localVector, localQuaternion, localVector2);

    const position = localVector;
    const quaternion = localQuaternion;
    const scale = localVector2;
    const dynamic = false;
    const external = true;

    const physicsGeometry = this.#getShapeGeometry(geometryIndex);
    const physicsObject = this.physics.addConvexShape(shapeAddress, position, quaternion, scale, dynamic, external,physicsGeometry);
  
    this.physicsObjects.push(physicsObject);

    return physicsObject;
  }
  
  grabInstance(physicsId){
    const phys = metaversefile.getPhysicsObjectByPhysicsId(physicsId);
    this.physics.removeGeometry(phys);
    const drawcall = this.instanceObjects.get(physicsId);
    drawcall.decrementInstanceCount();

  }
  getPhysicsObjects() {
    return this.physicsObjects;
  }
}

//

class SpritesheetPackage {
  constructor(canvas) {
    this.canvas = canvas;
  }
  static async loadUrls(urls) {
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    await Promise.all(urls.map(async (url, index) => {
      const numFrames = 8;
      const spritesheet = await createAppUrlSpriteSheet(url, {
        size: spritesheetSize,
        numFrames,
      });
      const {
        result,
        // numFrames,
        // frameSize,
        // numFramesPerRow,
        // worldWidth,
        // worldHeight,
        // worldOffset,
      } = spritesheet;

      const x = index % spritesheetsPerRow;
      const y = Math.floor(index / spritesheetsPerRow);
      ctx.drawImage(result, x * spritesheetSize, y * spritesheetSize);

      // console.log('got spritesheet', spritesheet);

      // debugging
      /* const canvas = document.createElement('canvas');
      canvas.width = result.width;
      canvas.height = result.height;
      canvas.style.cssText = `\
        position: fixed;
        top: 0;
        left: 0;
        width: 512px;
        height: 512px;
      `;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(result, 0, 0);
      document.body.appendChild(canvas); */

      /* const texture = new THREE.Texture(result);
      texture.needsUpdate = true;
      const numAngles = numFrames;
      const numSlots = numFramesPerRow;
      const worldSize = Math.max(worldWidth, worldHeight);
      const spritesheetMesh = new LitterSpritesheetMesh({
        texture,
        worldSize,
        worldOffset,
        numAngles,
        numSlots,
      });
      spritesheetMesh.position.y = 0.5;
      spritesheetMesh.position.x = (-urls.length / 2 + index) * meshSize;
      spritesheetMesh.position.z += meshSize * 2;
      spritesheetMesh.scale.multiplyScalar(2);
      app.add(spritesheetMesh);
      spritesheetMesh.updateMatrixWorld(); */
    }));

    const pkg = new SpritesheetPackage(canvas);
    return pkg;
  }
}

//

const canvasSize = 2048;
const spritesheetSize = 512;
const spritesheetsPerRow = canvasSize / spritesheetSize;
const numAngles = 8;
const numFramesPow2 = Math.pow(2, Math.ceil(Math.log2(numAngles)));
const numFramesPerRow = Math.ceil(Math.sqrt(numFramesPow2));
const maxDrawCalls = 256;
const maxInstancesPerDrawCall = 1024;
const maxAnisotropy = 16;
class LitterSpritesheetMesh extends ChunkedBatchedMesh {
  constructor({
    instance,
  }) {
    const baseGeometry = new DoubleSidedPlaneGeometry(10, 10);
    const allocator = new ChunkedGeometryAllocator(baseGeometry, [
      {
        name: 'p',
        Type: Float32Array,
        itemSize: 3,
      },
      /* {
        name: 'q',
        Type: Float32Array,
        itemSize: 4,
      }, */
      {
        name: 's',
        Type: Float32Array,
        itemSize: 3,
      },
      {
        name: 'itemIndex',
        Type: Float32Array,
        itemSize: 1,
      },
    ], {
      maxDrawCalls,
      maxInstancesPerDrawCall,
      boundingType: 'box',
    });
    const {geometry, textures: attributeTextures} = allocator;
    for (const k in attributeTextures) {
      const texture = attributeTextures[k];
      texture.anisotropy = maxAnisotropy;
    }
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTex: {
          value: null,
          needsUpdate: null,
        },
        uY: {
          value: 0,
          needsUpdate: false,
        },
        numAngles: {
          value: numAngles,
          needsUpdate: true,
        },
        numFramesPerRow: {
          value: numFramesPerRow,
          needsUpdate: true,
        },

        pTexture: {
          value: attributeTextures.p,
          needsUpdate: true,
        },
        /* qTexture: {
          value: attributeTextures.q,
          needsUpdate: true,
        }, */
        sTexture: {
          value: attributeTextures.s,
          needsUpdate: true,
        },
        itemIndexTexture: {
          value: attributeTextures.itemIndex,
          needsUpdate: true,
        },
      },
      vertexShader: `\
        precision highp float;
        precision highp int;

        uniform sampler2D pTexture;
        // uniform sampler2D qTexture;
        uniform sampler2D sTexture;
        uniform sampler2D itemIndexTexture;
        varying vec2 vUv;

        vec3 rotate_vertex_position(vec3 position, vec4 q) { 
          return position + 2.0 * cross(q.xyz, cross(q.xyz, position) + q.w * position);
        }

        void main() {
          int instanceIndex = gl_DrawID * ${maxInstancesPerDrawCall} + gl_InstanceID;
          const float width = ${attributeTextures.p.image.width.toFixed(8)};
          const float height = ${attributeTextures.p.image.height.toFixed(8)};
          float x = mod(float(instanceIndex), width);
          float y = floor(float(instanceIndex) / width);
          vec2 pUv = (vec2(x, y) + 0.5) / vec2(width, height);
          vec3 p = texture2D(pTexture, pUv).xyz;
          // vec4 q = texture2D(qTexture, pUv).xyzw;
          vec3 s = texture2D(sTexture, pUv).xyz;
          float itemIndex = texture2D(itemIndexTexture, pUv).x;

          vec3 pos = position;
          pos += p;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          vUv = uv;
        }
      `,
      fragmentShader: `\
        precision highp float;
        precision highp int;

        #define PI 3.1415926535897932384626433832795

        uniform sampler2D uTex;
        uniform float uY;
        uniform float numAngles;
        uniform float numFramesPerRow;

        varying vec2 vUv;

        void main() {
          float angleIndex = floor(uY * numAngles);
          float i = angleIndex;
          float x = mod(i, numFramesPerRow);
          float y = (i - x) / numFramesPerRow;

          gl_FragColor = texture(
            uTex,
            vec2(0., 1. - 1./numFramesPerRow) +
              vec2(x, -y)/numFramesPerRow +
              vec2(1.-vUv.x, 1.-vUv.y)/numFramesPerRow
          );

          /* const float alphaTest = 0.5;
          if (gl_FragColor.a < alphaTest) {
            discard;
          } */
          gl_FragColor.a = 1.;
          gl_FragColor.r += 0.5;
        }
      `,
      transparent: true,
      // depthWrite: false,
      // polygonOffset: true,
      // polygonOffsetFactor: -2,
      // polygonOffsetUnits: 1,
      // side: THREE.DoubleSide,
    });
    super(geometry, material, allocator);
    this.frustumCulled = false;

    this.instance = instance;

    this.drawChunks = new Map();
  }
  addChunk(chunk, chunkResult) {
    const vegetationData = chunkResult;

    if (chunk.lod >= spriteLodCutoff && vegetationData.instances.length > 0) {
      const _renderVegetationGeometry = (drawCall, vegetationData) => {
        const pTexture = drawCall.getTexture('p');
        const pOffset = drawCall.getTextureOffset('p');
        // const qTexture = drawCall.getTexture('q');
        // const qOffset = drawCall.getTextureOffset('q');
        const sTexture = drawCall.getTexture('s');
        const sOffset = drawCall.getTextureOffset('s');

        const {instances} = vegetationData;
        let index = 0;
        for (let i = 0; i < instances.length; i++) {
          const instance = instances[i];
          const {ps, qs} = instance;

          for (let j = 0; j < ps.length; j += 3) {
            const indexOffset = index * 4;
            
            // geometry
            const px = ps[index * 3];
            const py = ps[index * 3 + 1];
            const pz = ps[index * 3 + 2];
            pTexture.image.data[pOffset + indexOffset] = px;
            pTexture.image.data[pOffset + indexOffset + 1] = py;
            pTexture.image.data[pOffset + indexOffset + 2] = pz;

            /* const qx = qs[index * 4];
            const qy = qs[index * 4 + 1];
            const qz = qs[index * 4 + 2];
            const qw = qs[index * 4 + 3];
            qTexture.image.data[qOffset + indexOffset] = qx;
            qTexture.image.data[qOffset + indexOffset + 1] = qy;
            qTexture.image.data[qOffset + indexOffset + 2] = qz;
            qTexture.image.data[qOffset + indexOffset + 3] = qw; */

            // XXX get scales from the mapped geometry
            /* const sx = ss[index * 3];
            const sy = ss[index * 3 + 1];
            const sz = ss[index * 3 + 2]; */
            const sx = 1;
            const sy = 1;
            const sz = 1;
            sTexture.image.data[sOffset + indexOffset] = sx;
            sTexture.image.data[sOffset + indexOffset + 1] = sy;
            sTexture.image.data[sOffset + indexOffset + 2] = sz;

            // physics
            // const shapeAddress = this.#getShapeAddress(drawCall.geometryIndex);
            // const physicsObject = this.#addPhysicsShape(shapeAddress, drawCall.geometryIndex, px, py, pz, qx, qy, qz, qw);
            // this.physicsObjects.push(physicsObject);
            // localPhysicsObjects.push(physicsObject);
            // this.instanceObjects.set(physicsObject.physicsId, drawCall);
        
            index++;
          }
        }

        drawCall.updateTexture('p', pOffset, index * 4);
        // drawCall.updateTexture('q', qOffset, index * 4);
        drawCall.updateTexture('s', sOffset, index * 4);
      };

      const {chunkSize} = this.instance;
      const boundingBox = localBox.set(
        localVector.set(
          chunk.min.x * chunkSize,
          -WORLD_BASE_HEIGHT + MIN_WORLD_HEIGHT,
          chunk.min.y * chunkSize
        ),
        localVector2.set(
          (chunk.min.x + chunk.lod) * chunkSize,
          -WORLD_BASE_HEIGHT + MAX_WORLD_HEIGHT,
          (chunk.min.y + chunk.lod) * chunkSize
        )
      );
      const totalInstances = (() => {
        let sum = 0;
        const {instances} = vegetationData;
        for (let i = 0; i < instances.length; i++) {
          const instance = instances[i];
          const {ps} = instance;
          sum += ps.length;
        }
        sum /= 3;
        return sum;
      })();
      // console.log('total instances', totalInstances);
      const drawChunk = this.allocator.allocChunk(
        totalInstances,
        boundingBox
      );
      _renderVegetationGeometry(drawChunk, vegetationData);

      const key = procGenManager.getNodeHash(chunk);
      this.drawChunks.set(key, drawChunk);
    }
  }
  removeChunk(chunk) {
    const key = procGenManager.getNodeHash(chunk);
    const drawChunk = this.drawChunks.get(key);
    if (drawChunk) {
      this.allocator.freeChunk(drawChunk);
      this.drawChunks.delete(key);
    }
  }
  setPackage(pkg) {
    const {canvas} = pkg;
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    this.material.uniforms.uTex.value = texture;
    this.material.uniforms.uTex.needsUpdate = true;
  }
}

//

export class LitterMetaMesh extends THREE.Object3D {
  constructor({
    instance,
    // gpuTaskManager,
    physics,
  }) {
    super();

    this.spritesheetMesh = new LitterSpritesheetMesh({
      instance,
    });
    this.add(this.spritesheetMesh);

    this.physics = physics;
  }
  addChunk(chunk, chunkResult) {
    this.spritesheetMesh.addChunk(chunk, chunkResult);
  }
  removeChunk(chunk) {
    this.spritesheetMesh.removeChunk(chunk);
  }
  async loadUrls(urls) {
    const [
      meshPackage,
      spritesheetPackage,
    ] = await Promise.all([
      MeshPackage.loadUrls(urls, this.physics),
      SpritesheetPackage.loadUrls(urls),
    ]);
    this.spritesheetMesh.setPackage(spritesheetPackage);

    // XXX debugging
    {
      const allLodMeshes = [];
      const {lodMeshes} = meshPackage;
      for (const lodMeshArray of lodMeshes) {
        for (const lodMesh of lodMeshArray) {
          // this.add(lodMesh);
          allLodMeshes.push(lodMesh);
        }
      }
      const meshSize = 3;
      for (let i = 0; i < allLodMeshes.length; i++) {
        const lodMesh = allLodMeshes[i];
        lodMesh.position.x = (-allLodMeshes.length/2 + i) * meshSize;
        lodMesh.position.y = 0.5;
        lodMesh.position.z = 5;
        this.add(lodMesh);
        lodMesh.updateMatrixWorld();
      }
    }
  }
}