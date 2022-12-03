import metaversefile from "metaversefile";
import * as THREE from "three";
import {GRASS_COLORS_SHADER_CODE} from "../assets.js";
import {
  GET_COLOR_PARAMETER_NAME,
  maxAnisotropy,
  MAX_WORLD_HEIGHT,
  MIN_WORLD_HEIGHT,
  // bufferSize,
  WORLD_BASE_HEIGHT,
} from "../constants.js";
import {_patchOnBeforeCompileFunction} from "../utils/utils.js";
const {
  useCamera,
  useProcGenManager,
  useGeometries,
  useAtlasing,
  useGeometryBatching,
  useGeometryChunking,
  useLoaders,
  usePhysics,
  useSpriting,
} = metaversefile;
const procGenManager = useProcGenManager();
const {createTextureAtlas} = useAtlasing();
const {InstancedBatchedMesh, InstancedGeometryAllocator} =
  useGeometryBatching();
const {gltfLoader} = useLoaders();

//

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
// const localQuaternion = new THREE.Quaternion();
// const localEuler = new THREE.Euler();
// const localMatrix = new THREE.Matrix4();
const localBox = new THREE.Box3();

//
const _writeToTexture = (array, texture, textureOffset, index, number) => {
  const indexOffset = index * 4;
  for (let j = 0; j < number; j++) {
    const value = array[index * number + j];
    texture.image.data[textureOffset + indexOffset + j] = value;
  }
};

const _addDepthPackingShaderCode = shader => {
  return /* glsl */ `#define DEPTH_PACKING 3201` + "\n" + shader;
};

const _setupPolygonMeshShaderCode = (
  shader,
  {
    customUvParsVertex,
    customBeginVertex,
    customUvParsFragment,
    customColorFragment,
  },
) => {
  shader.vertexShader = shader.vertexShader.replace(
    `#include <uv_pars_vertex>`,
    customUvParsVertex,
  );
  shader.vertexShader = shader.vertexShader.replace(
    `#include <begin_vertex>`,
    customBeginVertex,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <uv_pars_fragment>`,
    customUvParsFragment,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <alphamap_fragment>`,
    customColorFragment,
  );
};

export class PolygonPackage {
  constructor(lodMeshes, textureNames) {
    this.lodMeshes = lodMeshes;
    this.textureNames = textureNames;
  }

  static async loadUrls(urls, meshLodSpecs, physics) {
    const _loadModel = u =>
      new Promise((accept, reject) => {
        gltfLoader.load(
          u,
          o => {
            accept(o.scene);
          },
          function onProgress() {},
          reject,
        );
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
    const _generateLodMesh = (() => {
      const promiseCache = new Map();
      return (mesh, meshLodSpec) => {
        const {targetRatio, targetError} = meshLodSpec;
        let promiseMap = promiseCache.get(mesh);
        if (!promiseMap) {
          promiseMap = new Map();
          promiseCache.set(mesh, promiseMap);
        }
        const key = `${targetRatio}:${targetError}`;
        let promise = promiseMap.get(key);
        if (!promise) {
          promise = (async () => {
            if (targetRatio === 1) {
              return mesh;
            } else {
              const lodMesh = await physics.meshoptSimplify(
                mesh,
                targetRatio,
                targetError,
              );
              return lodMesh;
            }
          })();
          promiseMap.set(key, promise);
        }
        return promise;
      };
    })();
    const _generateLodMeshes = async mesh => {
      const meshLodSpecKeys = Object.keys(meshLodSpecs).map(Number);
      const lodMeshes = await Promise.all(
        meshLodSpecKeys.map(async lod => {
          const meshLodSpec = meshLodSpecs[lod];
          const lodMesh = await _generateLodMesh(mesh, meshLodSpec);
          return lodMesh;
        }),
      );
      return lodMeshes;
    };

    const models = await Promise.all(urls.map(_loadModel));
    const meshes = models.map(_getMesh);
    const textureAtlasResult = createTextureAtlas(meshes, {
      textures: ["map", "normalMap"],
      attributes: ["position", "normal", "uv"],
    });
    const {meshes: atlasMeshes, textureNames} = textureAtlasResult;
    const lodMeshes = await Promise.all(atlasMeshes.map(_generateLodMeshes));

    const pkg = new PolygonPackage(lodMeshes, textureNames);
    return pkg;
  }
}

//

export class PolygonMesh extends InstancedBatchedMesh {
  constructor({
    instance,
    lodCutoff,
    maxNumGeometries,
    maxInstancesPerGeometryPerDrawCall,
    maxDrawCallsPerGeometry,
    shadow,
  } = {}) {
    // allocator
    const allocator = new InstancedGeometryAllocator(
      [
        {
          name: "p",
          Type: Float32Array,
          itemSize: 3,
        },
        {
          name: "q",
          Type: Float32Array,
          itemSize: 4,
        },
      ],
      {
        maxNumGeometries,
        maxInstancesPerGeometryPerDrawCall,
        maxDrawCallsPerGeometry,
        boundingType: "box",
      },
    );
    const {textures: attributeTextures} = allocator;
    for (const k in attributeTextures) {
      const texture = attributeTextures[k];
      texture.anisotropy = maxAnisotropy;
    }

    let geometry;

    // custom shaders
    const _setupUniforms = shader => {
      shader.uniforms.pTexture = {
        value: attributeTextures.p,
        needsUpdate: true,
      };
      shader.uniforms.qTexture = {
        value: attributeTextures.q,
        needsUpdate: true,
      };
    };

    const customUvParsVertex = /* glsl */ `
      #undef USE_INSTANCING

      #include <uv_pars_vertex>

      uniform sampler2D pTexture;
      uniform sampler2D qTexture;

      vec3 rotate_vertex_position(vec3 position, vec4 q) { 
        return position + 2.0 * cross(q.xyz, cross(q.xyz, position) + q.w * position);
      }
    `;

    const customBeginVertex = /* glsl */ `
      #include <begin_vertex>

      int instanceIndex = gl_DrawID * ${maxInstancesPerGeometryPerDrawCall} + gl_InstanceID;
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
    `;

    const customUvParsFragment = /* glsl */ `
      #undef USE_INSTANCING

      #include <uv_pars_fragment>
    `;

    const customColorFragment = /* glsl */ `
      #include <alphamap_fragment>
    `;

    // material
    const material = new THREE.MeshPhongMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.1,
      onBeforeCompile: shader => {
        _setupUniforms(shader);
        _setupPolygonMeshShaderCode(shader, {
          customUvParsVertex,
          customBeginVertex,
          customUvParsFragment,
          customColorFragment,
        });
        return shader;
      },
    });

    const customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      alphaTest: 0.5,
    });
    customDepthMaterial.onBeforeCompile = shader => {
      _setupUniforms(shader);
      _setupPolygonMeshShaderCode(shader, {
        customUvParsVertex: _addDepthPackingShaderCode(customUvParsVertex),
        customBeginVertex: customBeginVertex,
        customUvParsFragment: _addDepthPackingShaderCode(customUvParsFragment),
        customColorFragment,
      });
    };

    const customDistanceMaterial = new THREE.MeshDistanceMaterial({
      depthPacking: THREE.RGBADepthPacking,
      alphaTest: 0.5,
    });
    customDistanceMaterial.onBeforeCompile = shader => {
      _setupUniforms(shader);
      _setupPolygonMeshShaderCode(shader, {
        customUvParsVertex: _addDepthPackingShaderCode(customUvParsVertex),
        customBeginVertex: customBeginVertex,
        customUvParsFragment: _addDepthPackingShaderCode(customUvParsFragment),
        customColorFragment,
      });
    };

    // mesh
    super(geometry, material, allocator);
    this.frustumCulled = false;
    this.visible = false;

    if (shadow) {
      // ? See more details here : https://discourse.threejs.org/t/shadow-for-instances/7947/10
      this.customDepthMaterial = customDepthMaterial;
      this.customDistanceMaterial = customDistanceMaterial;
      this.castShadow = true;
      this.receiveShadow = true;
    }

    this.instance = instance;
    this.lodCutoff = lodCutoff;

    this.allocatedChunks = new Map();
  }

  addChunk(chunk, chunkResult) {
    if (chunkResult) {
      const instances = chunkResult;
      if (chunk.lod < this.lodCutoff && instances.length > 0) {
        const _renderPolygonGeometry = (drawCall, ps, qs) => {
          const pTexture = drawCall.getTexture("p");
          const pOffset = drawCall.getTextureOffset("p");
          const qTexture = drawCall.getTexture("q");
          const qOffset = drawCall.getTextureOffset("q");

          let index = 0;
          for (let j = 0; j < ps.length; j += 3) {
            // geometry
            _writeToTexture(ps, pTexture, pOffset, index, 3);
            _writeToTexture(qs, qTexture, qOffset, index, 4);

            index++;
          }

          drawCall.updateTexture("p", pOffset, index * 4);
          drawCall.updateTexture("q", qOffset, index * 4);
        };

        const {chunkSize} = this.instance;
        const boundingBox = localBox.set(
          localVector.set(
            chunk.min.x * chunkSize,
            -WORLD_BASE_HEIGHT + MIN_WORLD_HEIGHT,
            chunk.min.y * chunkSize,
          ),
          localVector2.set(
            (chunk.min.x + chunk.lod) * chunkSize,
            -WORLD_BASE_HEIGHT + MAX_WORLD_HEIGHT,
            (chunk.min.y + chunk.lod) * chunkSize,
          ),
        );
        const lodIndex = Math.log2(chunk.lod);
        const drawChunks = Array(instances.length);
        for (let i = 0; i < instances.length; i++) {
          const {instanceId, ps, qs} = instances[i];
          const geometryIndex = instanceId;
          const numInstances = ps.length / 3;

          const drawChunk = this.allocator.allocDrawCall(
            geometryIndex,
            lodIndex,
            numInstances,
            boundingBox,
          );
          _renderPolygonGeometry(drawChunk, ps, qs);
          drawChunks[i] = drawChunk;
        }
        const key = procGenManager.getNodeHash(chunk);
        this.allocatedChunks.set(key, drawChunks);
      }
    }
  }

  removeChunk(chunk) {
    const key = procGenManager.getNodeHash(chunk);
    const drawChunks = this.allocatedChunks.get(key);
    if (drawChunks) {
      for (const drawChunk of drawChunks) {
        this.allocator.freeDrawCall(drawChunk);
      }
    }
    this.allocatedChunks.delete(key);
  }

  grabInstance(physicsId) {
    const phys = metaversefile.getPhysicsObjectByPhysicsId(physicsId);
    this.physics.removeGeometry(phys);
    const drawcall = this.instanceObjects.get(physicsId);
    drawcall.decrementInstanceCount();
  }

  setPackage(pkg) {
    // console.log('set package', pkg);
    const {lodMeshes, textureNames} = pkg;
    this.allocator.setGeometries(
      lodMeshes.map(lodMeshesArray => {
        return lodMeshesArray.map(lodMesh => {
          return lodMesh.geometry;
        });
      }),
    );
    this.geometry = this.allocator.geometry;

    for (const textureName of textureNames) {
      this.material[textureName] = lodMeshes[0][0].material[textureName];
    }

    this.visible = true;
  }
}

export class GrassPolygonMesh extends InstancedBatchedMesh {
  constructor({
    instance,
    lodCutoff,
    maxNumGeometries,
    maxInstancesPerGeometryPerDrawCall,
    maxDrawCallsPerGeometry,
    shadow,
  } = {}) {
    // allocator
    const allocator = new InstancedGeometryAllocator(
      [
        {
          name: "p",
          Type: Float32Array,
          itemSize: 3,
        },
        {
          name: "q",
          Type: Float32Array,
          itemSize: 4,
        },
        {
          name: "materials",
          Type: Float32Array,
          itemSize: 4,
        },
        {
          name: "materialsWeights",
          Type: Float32Array,
          itemSize: 4,
        },
        {
          name: "grassProps",
          Type: Float32Array,
          itemSize: 4,
        },
      ],
      {
        maxNumGeometries,
        maxInstancesPerGeometryPerDrawCall,
        maxDrawCallsPerGeometry,
        boundingType: "box",
      },
    );
    const {textures: attributeTextures} = allocator;
    for (const k in attributeTextures) {
      const texture = attributeTextures[k];
      texture.anisotropy = maxAnisotropy;
    }

    let geometry;

    // custom shaders
    const _setupUniforms = shader => {
      shader.uniforms.pTexture = {
        value: attributeTextures.p,
        needsUpdate: true,
      };
      shader.uniforms.qTexture = {
        value: attributeTextures.q,
        needsUpdate: true,
      };
      shader.uniforms.materialsTexture = {
        value: attributeTextures.materials,
        needsUpdate: true,
      };
      shader.uniforms.materialsWeightsTexture = {
        value: attributeTextures.materialsWeights,
        needsUpdate: true,
      };
      shader.uniforms.grassPropsTexture = {
        value: attributeTextures.grassProps,
        needsUpdate: true,
      };
      shader.uniforms.uGrassBladeHeight = {
        value: null,
      };
    };

    const customUvParsVertex = /* glsl */ `
      #undef USE_INSTANCING

      #include <uv_pars_vertex>

      precision highp isampler2D;

      uniform sampler2D pTexture;
      uniform sampler2D qTexture;
      uniform sampler2D materialsTexture;
      uniform sampler2D materialsWeightsTexture;
      uniform sampler2D grassPropsTexture;
      uniform float uGrassBladeHeight;

      varying vec2 vObjectUv;
      varying vec3 vObjectNormal;
      varying vec3 vPosition;

      flat varying ivec4 vMaterials;
      varying vec4 vMaterialsWeights;

      varying float vGrassHeight;
      varying vec3 vGrassColorMultiplier;

      vec3 rotate_vertex_position(vec3 position, vec4 q) { 
        return position + 2.0 * cross(q.xyz, cross(q.xyz, position) + q.w * position);
      }
    `;

    const customBeginVertex = /* glsl */ `
      #include <begin_vertex>

      int instanceIndex = gl_DrawID * ${maxInstancesPerGeometryPerDrawCall} + gl_InstanceID;

      const float width = ${attributeTextures.p.image.width.toFixed(8)};
      const float height = ${attributeTextures.p.image.height.toFixed(8)};

      float x = mod(float(instanceIndex), width);
      float y = floor(float(instanceIndex) / width);
      vec2 pUv = (vec2(x, y) + 0.5) / vec2(width, height);

      vec3 p = texture2D(pTexture, pUv).xyz;
      vec4 q = texture2D(qTexture, pUv).xyzw;

      vec4 materials = texture2D(materialsTexture, pUv).xyzw;
      vec4 materialsWeights = texture2D(materialsWeightsTexture, pUv).xyzw;

      vec4 grassProps = texture2D(grassPropsTexture, pUv).xyzw;
      vec3 grassColorMultiplier = grassProps.xyz;
      float grassHeightMultiplier = grassProps.w;

      // * Grass Height Range -> [0.0, 1.0]
      float grassHeight = transformed.y / uGrassBladeHeight * grassHeightMultiplier;
      vec3 scaledPosition = transformed;
      scaledPosition.y *= grassHeight;

      transformed = rotate_vertex_position(scaledPosition, q);
      transformed += p;

      // vObjectUv = uv;
      vObjectNormal = normal;
      vPosition = transformed;
      vGrassHeight = grassHeight;
      vGrassColorMultiplier = grassColorMultiplier;
      vMaterials = ivec4(materials);
      vMaterialsWeights = materialsWeights;
      `;

    const customUvParsFragment = /* glsl */ `
      #undef USE_INSTANCING

      #include <uv_pars_fragment>

      varying vec2 vObjectUv;
      varying vec3 vObjectNormal;
      varying vec3 vPosition;

      flat varying ivec4 vMaterials;
      varying vec4 vMaterialsWeights;

      varying float vGrassHeight;
      varying vec3 vGrassColorMultiplier;

      // uniform sampler2D map;

      vec3 getGrassColor(int ${GET_COLOR_PARAMETER_NAME}) {
        ${GRASS_COLORS_SHADER_CODE};
      }
      vec3 blendSamples(vec3 samples[4], vec4 weights) {
        float weightSum = weights.x + weights.y + weights.z + weights.w;
        return (samples[0] * weights.x + samples[1] * weights.y + samples[2] * weights.z + samples[3] * weights.w) / weightSum;
      }
      vec3 blendGrassColors(ivec4 materials, vec4 weights) {
        vec3 samples[4];

        samples[0] = getGrassColor(materials.x);
        samples[1] = getGrassColor(materials.y);
        samples[2] = getGrassColor(materials.z);
        samples[3] = getGrassColor(materials.w);

        return blendSamples(samples, weights);
      }
    `;

    const customColorFragment = /* glsl */ `
      #include <alphamap_fragment>

      float grassAlpha = diffuseColor.a * vGrassHeight;
      vec3 grassColor = blendGrassColors(vMaterials, vMaterialsWeights);

      grassColor.r += vGrassHeight / 1.5;
      grassColor.g += vGrassHeight / 1.5;
      grassColor.b += vGrassHeight / 4.0;

      grassColor *= vGrassColorMultiplier;

      diffuseColor = vec4(grassColor, grassAlpha);
    `;

    THREE.ShaderLib.lambert.fragmentShader =
      THREE.ShaderLib.lambert.fragmentShader.replace(
      /* glsl */ `
        vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
      `,
       /* glsl */ `
        #ifndef NO_LIGHT
          vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
        #else
          vec3 outgoingLight = diffuseColor.rgb * (1.0 - 0.5 * (1.0 - getShadowMask())); // shadow intensity hardwired to 0.5 here
        #endif
    `,
    );

    // material
    const material = new THREE.MeshLambertMaterial({
      metalness: 0.8,
      roughness: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      // alphaTest: 0.01,
      onBeforeCompile: shader => {
        _setupUniforms(shader);
        _setupPolygonMeshShaderCode(shader, {
          customUvParsVertex,
          customBeginVertex,
          customUvParsFragment,
          customColorFragment,
        });
        return shader;
      },
    });

    material.lights = false;

    material.defines = material.defines || {};
    material.defines.NO_LIGHT = "";

    const customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      alphaTest: 0.5,
    });
    customDepthMaterial.onBeforeCompile = shader => {
      _setupUniforms(shader);
      _setupPolygonMeshShaderCode(shader, {
        customUvParsVertex: _addDepthPackingShaderCode(customUvParsVertex),
        customBeginVertex: customBeginVertex,
        customUvParsFragment: _addDepthPackingShaderCode(customUvParsFragment),
        customColorFragment,
      });
    };

    const customDistanceMaterial = new THREE.MeshDistanceMaterial({
      depthPacking: THREE.RGBADepthPacking,
      alphaTest: 0.5,
    });
    customDistanceMaterial.onBeforeCompile = shader => {
      _setupUniforms(shader);
      _setupPolygonMeshShaderCode(shader, {
        customUvParsVertex: _addDepthPackingShaderCode(customUvParsVertex),
        customBeginVertex: customBeginVertex,
        customUvParsFragment: _addDepthPackingShaderCode(customUvParsFragment),
        customColorFragment,
      });
    };

    // mesh
    super(geometry, material, allocator);

    this.shadow = shadow;

    if (shadow) {
      // ? See more details here : https://discourse.threejs.org/t/shadow-for-instances/7947/10
      this.customDepthMaterial = customDepthMaterial;
      this.customDistanceMaterial = customDistanceMaterial;
      // this.castShadow = true;
      this.receiveShadow = true;
    }

    this.frustumCulled = false;
    this.visible = false;

    this.instance = instance;
    this.lodCutoff = lodCutoff;

    this.modelHeight = 0;

    this.allocatedChunks = new Map();
  }

  addChunk(chunk, instances) {
    if (instances) {
      if (chunk.lod < this.lodCutoff && instances.length > 0) {
        const _renderGrassPolygonGeometry = (
          drawCall,
          ps,
          qs,
          materials,
          materialsWeights,
          grassProps,
        ) => {
          const pTexture = drawCall.getTexture("p");
          const pOffset = drawCall.getTextureOffset("p");
          const qTexture = drawCall.getTexture("q");
          const qOffset = drawCall.getTextureOffset("q");
          const materialsTexture = drawCall.getTexture("materials");
          const materialsOffset = drawCall.getTextureOffset("materials");
          const materialsWeightsTexture =
            drawCall.getTexture("materialsWeights");
          const materialsWeightsOffset =
            drawCall.getTextureOffset("materialsWeights");
          const grassPropsTexture = drawCall.getTexture("grassProps");
          const grassPropsOffset = drawCall.getTextureOffset("grassProps");

          let index = 0;
          for (let j = 0; j < ps.length; j += 3) {
            // geometry
            _writeToTexture(ps, pTexture, pOffset, index, 3);
            _writeToTexture(qs, qTexture, qOffset, index, 4);

            // materials
            _writeToTexture(
              materials,
              materialsTexture,
              materialsOffset,
              index,
              4,
            );
            _writeToTexture(
              materialsWeights,
              materialsWeightsTexture,
              materialsWeightsOffset,
              index,
              4,
            );

            // grass props
            _writeToTexture(
              grassProps,
              grassPropsTexture,
              grassPropsOffset,
              index,
              4,
            );

            index++;
          }

          drawCall.updateTexture("p", pOffset, index * 4);
          drawCall.updateTexture("q", qOffset, index * 4);
          drawCall.updateTexture("materials", materialsOffset, index * 4);
          drawCall.updateTexture(
            "materialsWeights",
            materialsWeightsOffset,
            index * 4,
          );
          drawCall.updateTexture("grassProps", grassPropsOffset, index * 4);
        };

        const {chunkSize} = this.instance;
        const boundingBox = localBox.set(
          localVector.set(
            chunk.min.x * chunkSize,
            -WORLD_BASE_HEIGHT + MIN_WORLD_HEIGHT,
            chunk.min.y * chunkSize,
          ),
          localVector2.set(
            (chunk.min.x + chunk.lod) * chunkSize,
            -WORLD_BASE_HEIGHT + MAX_WORLD_HEIGHT,
            (chunk.min.y + chunk.lod) * chunkSize,
          ),
        );
        const lodIndex = Math.log2(chunk.lod);
        const drawChunks = Array(instances.length);
        for (let i = 0; i < instances.length; i++) {
          const {instanceId, ps, qs, materials, materialsWeights, grassProps} =
            instances[i];
          const geometryIndex = instanceId;
          const numInstances = ps.length / 3;

          const drawChunk = this.allocator.allocDrawCall(
            geometryIndex,
            lodIndex,
            numInstances,
            boundingBox,
          );
          _renderGrassPolygonGeometry(
            drawChunk,
            ps,
            qs,
            materials,
            materialsWeights,
            grassProps,
          );
          drawChunks[i] = drawChunk;
        }
        const key = procGenManager.getNodeHash(chunk);
        this.allocatedChunks.set(key, drawChunks);
      }
    }
  }

  removeChunk(chunk) {
    const key = procGenManager.getNodeHash(chunk);
    const drawChunks = this.allocatedChunks.get(key);
    if (drawChunks) {
      for (const drawChunk of drawChunks) {
        this.allocator.freeDrawCall(drawChunk);
      }
    }
    this.allocatedChunks.delete(key);
  }

  grabInstance(physicsId) {
    const phys = metaversefile.getPhysicsObjectByPhysicsId(physicsId);
    this.physics.removeGeometry(phys);
    const drawcall = this.instanceObjects.get(physicsId);
    drawcall.decrementInstanceCount();
  }

  setPackage(pkg) {
    const {lodMeshes, textureNames} = pkg;

    const LOD0Mesh = lodMeshes[0][0];
    localBox.setFromObject(LOD0Mesh);

    const LOD0MeshHeight = localBox.getSize(localVector).y;

    this.allocator.setGeometries(
      lodMeshes.map(lodMeshesArray => {
        return lodMeshesArray.map(lodMesh => {
          return lodMesh.geometry;
        });
      }),
    );
    this.geometry = this.allocator.geometry;

    for (const textureName of textureNames) {
      this.material[textureName] = lodMeshes[0][0].material[textureName];
    }

    const setUniforms = shader => {
      shader.uniforms.uGrassBladeHeight = {value: LOD0MeshHeight};
    };

    _patchOnBeforeCompileFunction(this.material, setUniforms);
    if (this.shadow) {
      _patchOnBeforeCompileFunction(this.customDepthMaterial, setUniforms);
      _patchOnBeforeCompileFunction(this.customDistanceMaterial, setUniforms);
    }

    this.visible = true;
  }
}