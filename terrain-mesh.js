import * as THREE from 'three';
import metaversefile from 'metaversefile';
import {
  bufferSize,
  WORLD_BASE_HEIGHT,
  MIN_WORLD_HEIGHT,
  MAX_WORLD_HEIGHT,
} from './constants.js';

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const { useInstancing, useProcGenManager } = metaversefile;
const { BatchedMesh, GeometryAllocator } = useInstancing();
const procGenManager = useProcGenManager();

//

const localVector3D = new THREE.Vector3();
const localVector3D2 = new THREE.Vector3();
const localBox = new THREE.Box3();

const textureLoader = new THREE.TextureLoader();

//

export class TerrainMesh extends BatchedMesh {
  constructor({ instance, gpuTaskManager }) {
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

    const { geometry } = allocator;

    const groundColorTexture = textureLoader.load(
      baseUrl + 'assets/textures/rock_06_diff_8k.jpg'
    );
    groundColorTexture.encoding = THREE.sRGBEncoding;
    groundColorTexture.wrapS = groundColorTexture.wrapT = THREE.RepeatWrapping;

    const groundNormalTexture = textureLoader.load(
      baseUrl + 'assets/textures/rock_06_nor_dx_8k.jpg'
    );
    groundNormalTexture.wrapS = groundNormalTexture.wrapT = THREE.RepeatWrapping;


    const noiseTexture = textureLoader.load(
      baseUrl + 'assets/textures/simplex-noise.png'
    );
    noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;

    // define material uniforms here
    const materialUniforms = {
      uGroundColor: { value: groundColorTexture },
      uGroundNormal: { value: groundNormalTexture },
      uNoiseTexture: { value: noiseTexture}
    };

    const material = new THREE.MeshStandardMaterial({
      onBeforeCompile: (shader) => {
        // ? by installing glsl-literal extension in vscode you can get syntax highlighting for glsl
        const glsl = (x) => x;

        for (const k in materialUniforms) {
          shader.uniforms[k] = materialUniforms[k];
        }

        // vertex shader imports
        const vertexShaderImports = glsl`
            varying vec3 vPosition;
          `;

        // vertex shader
        const vertexShader = glsl`
           vPosition = transformed;
          `;

        // fragment shader imports
        const fragmentShaderImports = glsl`
            varying vec3 vPosition;
            uniform sampler2D uGroundColor;
            uniform sampler2D uGroundNormal;
            uniform sampler2D uNoiseTexture;

            float sum( vec3 v ) { return v.x+v.y+v.z; }

            // ! based on this article : https://iquilezles.org/articles/texturerepetition
            vec4 textureNoTile( sampler2D samp, in vec2 uv  ) {
              float k = vec3(texture2D(uNoiseTexture, 0.0025*uv)).x; // cheap (cache friendly) lookup
              float l = k*8.0;
              float f = fract(l);
              
              float ia = floor(l+0.5); // suslik's method (see comments)
              float ib = floor(l);
              f = min(f, 1.0-f)*2.0;

              vec2 offa = sin(vec2(3.0,7.0)*ia); // can replace with any other hash
              vec2 offb = sin(vec2(3.0,7.0)*ib); // can replace with any other hash

              vec4 cola = texture2D(samp, vec2(uv + offa));
              vec4 colb = texture2D(samp, vec2(uv + offb));

              return mix(cola, colb, smoothstep(0.2,0.8,f-0.1*sum(cola.xyz-colb.xyz)));
            }

            vec4 triplanarTexture(vec3 inputPosition, vec3 inputNormal, sampler2D inputTexture , float scale , float blendSharpness){
              vec2 uvX = inputPosition.zy * scale;
              vec2 uvY = inputPosition.xz * scale;
              vec2 uvZ = inputPosition.xy * scale;
              
              vec4 colX = textureNoTile(inputTexture, uvX);
              vec4 colY = textureNoTile(inputTexture, uvY);
              vec4 colZ = textureNoTile(inputTexture, uvZ);

              vec3 blendWeight = pow(abs(inputNormal), vec3(blendSharpness));
              blendWeight /= dot(blendWeight,vec3(1));

              return colX * blendWeight.x + colY * blendWeight.y + colZ * blendWeight.z;
            }

            vec4 triplanarNormal(vec3 inputPosition, vec3 inputNormal, sampler2D inputTexture , float scale , float blendSharpness) {
              // Tangent Reconstruction
              // Triplanar uvs
              vec2 uvX = inputPosition.zy * scale;
              vec2 uvY = inputPosition.xz * scale;
              vec2 uvZ = inputPosition.xy * scale;
              
              vec4 colX = textureNoTile(inputTexture, uvX);
              vec4 colY = textureNoTile(inputTexture, uvY);
              vec4 colZ = textureNoTile(inputTexture, uvZ);

              // Tangent space normal maps
              vec3 tx = colX.xyz * vec3(2,2,2) - vec3(1,1,1);
              vec3 ty = colY.xyz * vec3(2,2,2) - vec3(1,1,1);
              vec3 tz = colZ.xyz * vec3(2,2,2) - vec3(1,1,1);
              vec3 weights = abs(inputNormal);
              weights = weights / (weights.x + weights.y + weights.z);

              // Get the sign (-1 or 1) of the surface normal
              vec3 axis = sign(inputNormal);

              // Construct tangent to world matrices for each axis
              vec3 tangentX = normalize(cross(inputNormal, vec3(0.0, axis.x, 0.0)));
              vec3 bitangentX = normalize(cross(tangentX, inputNormal)) * axis.x;
              mat3 tbnX = mat3(tangentX, bitangentX, inputNormal);

              vec3 tangentY = normalize(cross(inputNormal, vec3(0.0, 0.0, axis.y)));
              vec3 bitangentY = normalize(cross(tangentY, inputNormal)) * axis.y;
              mat3 tbnY = mat3(tangentY, bitangentY, inputNormal);

              vec3 tangentZ = normalize(cross(inputNormal, vec3(0.0, -axis.z, 0.0)));
              vec3 bitangentZ = normalize(-cross(tangentZ, inputNormal)) * axis.z;
              mat3 tbnZ = mat3(tangentZ, bitangentZ, inputNormal);

              // Apply tangent to world matrix and triblend
              // Using clamp() because the cross products may be NANs
              vec3 worldNormal = normalize(
                  clamp(tbnX * tx, -1.0, 1.0) * weights.x +
                  clamp(tbnY * ty, -1.0, 1.0) * weights.y +
                  clamp(tbnZ * tz, -1.0, 1.0) * weights.z
                  );
              return vec4(worldNormal, 0.0);
            }
          `;

        // fragment shader
        const fragmentShader = glsl`
            // triplanar settings
            float groundScale = 0.025;
            float groundSharpness = 0.025;

            diffuseColor *= triplanarTexture(vPosition, vNormal, uGroundColor, groundScale, groundSharpness);
            normal *= triplanarNormal(vPosition, vNormal, uGroundNormal, groundScale, groundSharpness).xyz;
          `;

        // extend shaders
        shader.vertexShader = shader.vertexShader.replace(
          `#include <uv_pars_vertex>`,
          vertexShaderImports
        );

        shader.vertexShader = shader.vertexShader.replace(
          `#include <worldpos_vertex>`,
          vertexShader
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_pars_fragment>',
          fragmentShaderImports
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          fragmentShader
        );

        return shader;
      },
    });

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
        const { chunkSize } = this.instance;

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

        // XXX defer this to one per frame
        const geometryBinding = this.allocator.alloc(
          terrainGeometry.positions.length,
          terrainGeometry.indices.length,
          boundingBox
          // min,
          // max,
          // this.appMatrix,
          // terrainGeometry.peeks
        );
        // console.log(localVector3D);
        _renderTerrainMeshDataToGeometry(
          terrainGeometry,
          this.allocator.geometry,
          geometryBinding
        );

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
