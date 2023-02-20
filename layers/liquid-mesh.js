import * as THREE from "three";
// import metaversefile from "metaversefile";
import {
  bufferSize,
  WORLD_BASE_HEIGHT,
  MIN_WORLD_HEIGHT,
  MAX_WORLD_HEIGHT,
} from "../constants.js";
import LiquidPackage from '../meshes/liquid-package.js';
import {liquidTextureUrlSpecs} from '../assets.js';
import _createLiquidMaterial from './liquid-material.js';
import WaterRenderer from '../liquid-effect/water-render.js';
import procGenManager from '../procgen/procgen-manager.js';

import {
  BufferedMesh,
  GeometryAllocator,
} from '../geometries/geometry-buffering.js';

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

// constants
const SHADER_TEXTURE_PATHS = liquidTextureUrlSpecs.shaderTexturePath;
const CUBEMAP_PATHS = liquidTextureUrlSpecs.cubeMapPath;

const SWIM_HEIGHT_THRESHOLD = 0.75;
const SWIM_ONSURFACE_RANGE = 0.05;
const NORMAL_DAMPING = 1;
const MAX_DAMPING = 4.2;
const DAMPING_RATE = 1.03;
const BREASTSTROKE = "breaststroke";
const WATER_HEIGHT = 0;
const INITIAL_SWIM_ACTION = {
  type: 'swim',
  onSurface: false,
  swimDamping: NORMAL_DAMPING,
  animationType: BREASTSTROKE,
};

const getHashKey = (x, y) => {
  return ((x & 0xfff) << 20) | ((y & 0xfff) << 8);
};

export class LiquidMesh extends BufferedMesh {
  constructor({instance, gpuTaskManager, physics, ctx}) {
    if (!ctx) {
      console.warn("missing context", ctx);
      debugger;
    }
    if (!physics) {
      console.warn('need physics', {physics});
      debugger;
    }

    const allocator = new GeometryAllocator(
      [
        {
          name: "position",
          Type: Float32Array,
          itemSize: 3,
        },
        {
          name: "normal",
          Type: Float32Array,
          itemSize: 3,
        },
        {
          name: 'flow',
          Type: Float32Array,
          itemSize: 3,
        },
        {
          name: "factor",
          Type: Float32Array,
          itemSize: 1,
        },
        {
          name: "liquids",
          Type: Int32Array,
          itemSize: 4,
        },
        {
          name: "liquidsWeights",
          Type: Float32Array,
          itemSize: 4,
        },
      ],
      {
        bufferSize,
        boundingType: "box",
        // hasOcclusionCulling: true
        ctx,
      },
    );

    const {geometry} = allocator;
    const material = _createLiquidMaterial();
    super(geometry, material);

    this.ctx = ctx;

    this.instance = instance;
    this.gpuTaskManager = gpuTaskManager;

    this.allocator = allocator;
    this.gpuTasks = new Map();
    this.geometryBindings = new Map();

    this.geometry = geometry;
    this.physics = physics;
    this.physicsObjectsMap = new Map();
    this.chunkPhysicObjcetMap = new Map();
    this.lastUpdateCoord = new THREE.Vector2();

    this.lastSwimmingHand = null;
    this.swimDamping = 1;

    this.depthInvisibleList = [];
  }

  addChunk(chunk, chunkResult, renderer) {
    if (!renderer) {
      console.warn("missing renderer", {renderer});
      debugger;
    }

    const key = procGenManager.getNodeHash(chunk);
    const task = this.gpuTaskManager.transact(() => {
      const _mapOffsettedIndices = (
        srcIndices,
        dstIndices,
        dstOffset,
        positionOffset,
      ) => {
        const positionIndex = positionOffset / 3;
        for (let i = 0; i < srcIndices.length; i++) {
          dstIndices[dstOffset + i] = srcIndices[i] + positionIndex;
        }
      };
      const _renderLiquidMeshDataToGeometry = (
        liquidGeometry,
        geometry,
        geometryBinding,
      ) => {
        const positionOffset = geometryBinding.getAttributeOffset("position");
        const normalOffset = geometryBinding.getAttributeOffset("normal");
        const flowOffset = geometryBinding.getAttributeOffset("flow");
        const factorOffset = geometryBinding.getAttributeOffset("factor");
        const liquidsOffset = geometryBinding.getAttributeOffset("liquids");
        const liquidsWeightsOffset =
          geometryBinding.getAttributeOffset("liquidsWeights");
        const indexOffset = geometryBinding.getIndexOffset();

        _mapOffsettedIndices(
          liquidGeometry.indices,
          geometry.index.array,
          indexOffset,
          positionOffset,
        );

        geometry.attributes.position.update(
          positionOffset,
          liquidGeometry.positions.length,
          liquidGeometry.positions,
          0,
          renderer
        );
        geometry.attributes.normal.update(
          normalOffset,
          liquidGeometry.normals.length,
          liquidGeometry.normals,
          0,
          renderer
        );
        geometry.attributes.normal.update(
          flowOffset,
          liquidGeometry.flows.length,
          liquidGeometry.flows,
          0,
          renderer
        );
        geometry.attributes.factor.update(
          factorOffset,
          liquidGeometry.factors.length,
          liquidGeometry.factors,
          0,
          renderer
        );
        geometry.attributes.liquids.update(
          liquidsOffset,
          liquidGeometry.liquids.length,
          liquidGeometry.liquids,
          0,
          renderer
        );
        geometry.attributes.liquidsWeights.update(
          liquidsWeightsOffset,
          liquidGeometry.liquidsWeights.length,
          liquidGeometry.liquidsWeights,
          0,
          renderer
        );
        geometry.index.update(
          indexOffset,
          liquidGeometry.indices.length,
          geometry.index.array,
          indexOffset,
          renderer
        );
      };
      const _handleLiquidMesh = liquidGeometry => {
        const {chunkSize} = this.instance;

        const boundingBox = localBox.set(
          localVector3D.set(
            chunk.min.x * chunkSize,
            -WORLD_BASE_HEIGHT + MIN_WORLD_HEIGHT,
            chunk.min.y * chunkSize,
          ),
          localVector3D2.set(
            (chunk.min.x + chunk.lod) * chunkSize,
            -WORLD_BASE_HEIGHT + MAX_WORLD_HEIGHT,
            (chunk.min.y + chunk.lod) * chunkSize,
          ),
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
          liquidGeometry.positions.length,
          liquidGeometry.indices.length,
          boundingBox,
          // min,
          // max,
          // this.appMatrix,
          // waterGeometry.peeks
        );
        // console.log(localVector3D);
        _renderLiquidMeshDataToGeometry(
          liquidGeometry,
          this.allocator.geometry,
          geometryBinding,
        );

        this.geometryBindings.set(key, geometryBinding);
      };
      const liquidGeometry = chunkResult.waterGeometry;
      liquidGeometry && _handleLiquidMesh(liquidGeometry);

      const _handlePhysics = async () => {
        const physicsGeo = new THREE.BufferGeometry();
        physicsGeo.setAttribute(
          "position",
          new THREE.BufferAttribute(liquidGeometry.positions, 3),
        );
        physicsGeo.setIndex(
          new THREE.BufferAttribute(liquidGeometry.indices, 1),
        );
        const physicsMesh = new THREE.Mesh(physicsGeo, fakeMaterial);

        const geometryBuffer = await this.physics.cookGeometryAsync(
          physicsMesh,
        );

        if (geometryBuffer && geometryBuffer.length !== 0) {
          this.matrixWorld.decompose(
            localVector3D,
            localQuaternion,
            localVector3D2,
          );
          const physicsObject = this.physics.addCookedGeometry(
            geometryBuffer,
            localVector3D,
            localQuaternion,
            localVector3D2,
          );
          this.physics.disableGeometryQueries(physicsObject); // disable each physicsObject
          this.physicsObjectsMap.set(key, physicsObject);
          const chunkKey = getHashKey(chunk.min.x, chunk.min.y);
          this.chunkPhysicObjcetMap.set(chunkKey, physicsObject); // use chunk.min as a key to map each physicsObject
        }
      };
      liquidGeometry && liquidGeometry.indices.length !== 0 && _handlePhysics();
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
      const chunkKey = getHashKey(chunk.min.x, chunk.min.y);
      this.chunkPhysicObjcetMap.delete(chunkKey);
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
      const height = player.avatar.height;
      const width = player.avatar.shoulderWidth;
      if (player.position.y > waterSurfaceHeight) {
        collisionIds = this.physics.overlapBox(
          width,
          height,
          width,
          player.position,
          player.quaternion,
        ).objectIds;
      } else {
        localVector.set(
          player.position.x,
          waterSurfaceHeight,
          player.position.z,
        );
        collisionIds = this.physics.overlapBox(
          width,
          height,
          width,
          localVector,
          player.quaternion,
        ).objectIds;
      }
      for (const collisionId of collisionIds) {
        if (collisionId === chunkPhysicObject.physicsId) {
          // if we get the collisionId which is the id of the current chunk, then return true (avatar contact the water)
          // Also disable the queries so that we could still go into the water
          this.physics.disableGeometryQueries(chunkPhysicObject);
          return true;
        }
      }
    }
    this.physics.disableGeometryQueries(chunkPhysicObject);
    return false;
  }

  getSwimDamping(player) {
    if (
      this.lastSwimmingHand !== player.avatarCharacterSfx.currentSwimmingHand
    ) {
      this.lastSwimmingHand = player.avatarCharacterSfx.currentSwimmingHand;
      if (player.avatarCharacterSfx.currentSwimmingHand !== null) {
        return NORMAL_DAMPING;
      }
    }
    if (this.swimDamping < MAX_DAMPING && this.lastSwimmingHand) {
      return (this.swimDamping *= DAMPING_RATE);
    } else {
      return MAX_DAMPING;
    }
  }

  setOnSurfaceAction(swimAction, onSurface) {
    swimAction.onSurface = onSurface;
  }

  handleSwimAction(contactWater, player, waterSurfaceHeight) {
    const swimAction = player.actionManager.getActionType('swim');
    const hasSwim = !!swimAction;

    const _setSwimAction = () => {
      if (!hasSwim) {
        player.actionManager.addAction(structuredClone(INITIAL_SWIM_ACTION));
        // console.log('would set swim action', INITIAL_SWIM_ACTION);
        localPlayer.actionManager.hasActionType('fallLoop') && localPlayer.actionManager.removeActionType('fallLoop');
        localPlayer.actionManager.hasActionType('skydive') && localPlayer.actionManager.removeActionType('skydive');
        localPlayer.actionManager.hasActionType('glider') && localPlayer.actionManager.removeActionType('glider');
      }
    };

    const _removeSwimAction = () => {
      hasSwim && player.actionManager.removeActionType('swim');
    };

    if (contactWater) {
      const _calculateSwimHeight = () => {
        const outsideWaterRange =
          player.avatar.height * (1 - SWIM_HEIGHT_THRESHOLD);
        return player.position.y - outsideWaterRange;
      };

      const _calculateSwimSurfaceHeight = swimHeight => {
        const onSurfaceRange = player.avatar.height * SWIM_ONSURFACE_RANGE;
        return swimHeight + onSurfaceRange;
      };

      const swimHeight = _calculateSwimHeight();

      if (waterSurfaceHeight >= swimHeight) {
        // check whether player is swimming on the water surface
        _setSwimAction();
        const swimSurfaceHeight = _calculateSwimSurfaceHeight(swimHeight);
        const addOnSurface = waterSurfaceHeight < swimSurfaceHeight;
        hasSwim && this.setOnSurfaceAction(swimAction, addOnSurface);
      } else {
        _removeSwimAction();
      }
    } else {
      _removeSwimAction();
    }

    // handel swimming damping.
    if (hasSwim) {
      switch (swimAction.animationType) {
        case BREASTSTROKE:
          this.swimDamping = this.getSwimDamping(player);
          break;
        default:
          this.swimDamping = NORMAL_DAMPING;
          break;
      }

      swimAction.swimDamping = this.swimDamping;
    }
  }
  onBeforeRender(renderer, scene, camera) {
    if (this.waterRenderer) {
      this.waterRenderer.renderDepthTexture(this.depthInvisibleList);
      if (this.underWater) {
        this.waterRenderer.renderRefraction(renderer, scene, camera);
      }
      else {
        this.waterRenderer.renderMirror(renderer, scene, camera);
      }
    }
  }
  update(timestamp) {
    const localPlayer = this.ctx.useLocalPlayer();
    const lastUpdateCoordKey = getHashKey(
      this.lastUpdateCoord.x,
      this.lastUpdateCoord.y,
    );
    const currentChunkPhysicObject =
      this.chunkPhysicObjcetMap.get(lastUpdateCoordKey); // use lodTracker.lastUpdateCoord as a key to check which chunk player currently at

    // handel water physic and swimming action if we get the physicObject of the current chunk
    if (currentChunkPhysicObject) {
      const contactWater = this.checkWaterContact(
        currentChunkPhysicObject,
        localPlayer,
        WATER_HEIGHT,
      ); // check whether player contact the water

      // handle swimming action
      this.handleSwimAction(contactWater, localPlayer, WATER_HEIGHT);
    }

    const sunMoonRotationRadius = 500;
    const lightingManager = this.ctx.useLightingManager();
    for (const light of lightingManager.lights) {
      if (light.isDirectionalLight) {
        this.material.uniforms.lightPos.value.copy(light.position).multiplyScalar(sunMoonRotationRadius);
        this.material.uniforms.lightIntensity.value = light.intensity;
        break;
      }
    }
    
    const camera = this.ctx.useCamera();
    this.underWater = camera.position.y < WATER_HEIGHT;
    this.material.uniforms.uTime.value = timestamp / 1000;
    this.material.uniforms.playerPos.value.copy(localPlayer.position);
    this.material.uniforms.cameraInWater.value = this.underWater;
  }
  setPackage(pkg) {
    const shaderTextures = pkg.textures['shaderTextures'];
    const cubeMap = pkg.textures['textureCube'];
  
    const renderer = this.ctx.useRenderer();
    const scene = this.ctx.useScene();
    const camera = this.ctx.useCamera();
    this.waterRenderer = new WaterRenderer(renderer, scene, camera, this, this.ctx);
    
    // depth
    this.material.uniforms.tMask.value = this.waterRenderer.depthRenderTarget.depthTexture;
    this.material.uniforms.tDepth.value = this.waterRenderer.depthRenderTarget.texture;
    this.material.uniforms.cameraNear.value = camera.near;
    this.material.uniforms.cameraFar.value = camera.far;
    this.material.uniforms.resolution.value.set(
        window.innerWidth * window.devicePixelRatio,
        window.innerHeight * window.devicePixelRatio
    );
    // reflection refraction
    this.material.uniforms.refractionTexture.value = this.waterRenderer.refractionRenderTarget.texture;
    this.material.uniforms.mirror.value = this.waterRenderer.mirrorRenderTarget.texture;
    this.material.uniforms.textureMatrix.value = this.waterRenderer.textureMatrix;
    this.material.uniforms.eye.value = this.waterRenderer.eye;
    //foam
    this.material.uniforms.foamTexture.value = shaderTextures.foamTexture;
    this.material.uniforms.tDistortion.value = shaderTextures.tDistortion;

    //river
    this.material.uniforms.waterNormalTexture.value = shaderTextures.waterNormalTexture;
    this.material.uniforms.cubeMap.value = cubeMap;
  }
  async waitForLoad() {
    const paths = {
      shaderTexturePath: SHADER_TEXTURE_PATHS,
      cubeMapPath: CUBEMAP_PATHS,
    };
    const liquidPackage = await LiquidPackage.loadUrls(paths);

    this.setPackage(liquidPackage);
  }
}
