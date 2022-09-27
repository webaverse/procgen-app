import * as THREE from 'three';
import {EXRLoader} from 'three/examples/jsm/loaders/EXRLoader.js';
import metaversefile from 'metaversefile';
import TextureAtlas, { DIFFUSE, NORMAL, TEXTURE_PER_ROW } from '../utils/texture-atlas';

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const { useLoaders, useScene } = metaversefile;

const rootScene = useScene();
const exrLoader = new EXRLoader();
const textureLoader = new THREE.TextureLoader();
const { ktx2Loader } = useLoaders();

const _loadKTX2 = async (path) => {
  const texture = await ktx2Loader.loadAsync(baseUrl + path);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  // higher samples improve the quality
  texture.anisotropy = 16;

  return texture;
};
const _loadExr = async (path) => {
  const texture = exrLoader.loadAsync(baseUrl + path);
  return texture;

};
const _loadTexture = async (path) => {
  const texture = await textureLoader.loadAsync(baseUrl + path);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  return texture;
};

const loadTerrainMaterial = async () => {
  // const rockDiffMap = await _loadKTX2(
  //   '../assets/textures/rock/rock_06_diff_8k.ktx2'
  // );
  // rockDiffMap.encoding = THREE.sRGBEncoding;

  // const rockRoughnessMap = await _loadKTX2(
  //   '../assets/textures/rock/rock_06_rough_8k.ktx2'
  // );
  // rockRoughnessMap.encoding = THREE.LinearEncoding;

  // const rockNormalMap = await _loadKTX2(
  //   '../assets/textures/rock/rock_06_nor_dx_8k.ktx2'
  // );
  // rockNormalMap.encoding = THREE.LinearEncoding;

  // const rockAoMap = await _loadKTX2(
  //   '../assets/textures/rock/rock_06_nor_dx_8k.ktx2'
  // );
  // rockNormalMap.encoding = THREE.LinearEncoding;

  const materialUniforms = {
    uDiffMap: {},
    uRoughnessMap: {},
    uMetalnessMap: {},
    uNormalMap: {},
    uAoMap: {},
    uNoiseTexture: {},
  };

  const envMap = await _loadExr('../assets/env.exr');

  const textureAtlas = new TextureAtlas();

  const _loadDiffuse = () => {
   materialUniforms.uDiffMap.value = textureAtlas.data[DIFFUSE].atlas;
  };
  textureAtlas.runOnLoad(_loadDiffuse);

  textureAtlas.load(DIFFUSE, [
    baseUrl + '../assets/textures/stylized_grass/stylized_grass1_d.png',
    baseUrl + '../assets/textures/dirt/dirt1_d.png'
  ]);

  const _loadNormal = () => {
    materialUniforms.uNormalMap.value = textureAtlas.data[NORMAL].atlas;
  };
  textureAtlas.runOnLoad(_loadNormal);

  textureAtlas.load(NORMAL, [
    baseUrl + '../assets/textures/stylized_grass/stylized_grass1_n.png',
    baseUrl + '../assets/textures/dirt/dirt1_n.png'
  ]);


  // const grassDiffMap = await _loadTexture('../assets/textures/stylized_grass/stylized_grass1_d.png');
  // grassDiffMap.encoding = THREE.sRGBEncoding;

  // const grassNormalMap = await _loadTexture('../assets/textures/stylized_grass/stylized_grass1_n.png');
  // grassNormalMap.encoding = THREE.LinearEncoding;

  // const grassRoughnessMap = await _loadTexture('../assets/textures/stylized_grass/stylized_grass_r.png');
  // grassRoughnessMap.encoding = THREE.LinearEncoding;

  // const grassMetalnessMap = await _loadTexture('../assets/textures/stylized_grass/stylized_grass_m.png');
  // grassMetalnessMap.encoding = THREE.LinearEncoding;

  // const rockDiffMap = await _loadTexture('../assets/textures/dirt/dirt1_d.png');
  // rockDiffMap.encoding = THREE.sRGBEncoding;

  // const rockNormalMap = await _loadTexture('../assets/textures/dirt/dirt1_n.png');
  // rockNormalMap.encoding = THREE.LinearEncoding;

  // const rockRoughnessMap = await _loadTexture('../assets/textures/dirt/dirt_r.png');
  // rockRoughnessMap.encoding = THREE.LinearEncoding;

  // const rockMetalnessMap = await _loadTexture('../assets/textures/dirt/dirt_m.png');
  // rockMetalnessMap.encoding = THREE.LinearEncoding;

  const noiseTexture = await _loadTexture('../assets/textures/simplex-noise.png');
  noiseTexture.encoding = THREE.LinearEncoding;

  materialUniforms.uNoiseTexture.value = noiseTexture;

  const material = new THREE.MeshStandardMaterial({
    roughness: 0.95,
    metalness: 0.1,
    envMap: envMap,
    envMapIntensity: 1,
    onBeforeCompile: (shader) => {
      for (const k in materialUniforms) {
        shader.uniforms[k] = materialUniforms[k];
      }

      // ? by installing glsl-literal extension in vscode you can get syntax highlighting for glsl
      // vertex shader
      const uvParseVertex = /* glsl */`
        #include <uv_pars_vertex>

        // attribute ivec4 biomeTypes = ivec4(0); // TODO: implement biome types as an attribute
        // attribute vec4 biomeWeights = vec4(1., 0., 0., 0.);
        attribute vec4 materialsWeights;

        varying vec4 vMaterialsWeights;

        flat varying ivec4 vBiomeTypes; 
        varying vec4 vBiomeWeights;

        varying mat3 vNormalMatrix;
        varying vec3 vPosition;
        varying vec3 vObjectNormal;

        ivec4 biomeTypes = ivec4(0);
        vec4 biomeWeights = vec4(1., 1., 1., 1.);
      `;

      const worldPosVertex = /* glsl */`
       #include <worldpos_vertex>

       vMaterialsWeights = materialsWeights;

       vBiomeTypes = biomeTypes;
       vBiomeWeights = biomeWeights;

       vPosition = transformed;
       vNormalMatrix = normalMatrix;
       vObjectNormal = normal;
      `;

      // fragment shader
      const mapParseFragment = /* glsl */`
        #include <map_pars_fragment>

        precision highp sampler2D;
        precision highp float;
        precision highp int;

        varying vec4 vMaterialsWeights;

        flat varying ivec4 vBiomeTypes; 
        varying vec4 vBiomeWeights;

        varying vec3 vPosition;
        varying mat3 vNormalMatrix;
        varying vec3 vObjectNormal;
  
        uniform sampler2D uDiffMap;
        uniform sampler2D uRoughnessMap;
        uniform sampler2D uMetalnessMap;
        uniform sampler2D uNormalMap;
        uniform sampler2D uAoMap;

        uniform sampler2D uNoiseTexture;
        uniform sampler2D uGrassDiff;
  
        float TRI_SCALE = 0.1;
        float TRI_SHARPNESS = 7.5;

        vec4 blendSamples(vec4 samples[4], vec4 weights) {
          float weightSum = weights.x + weights.y + weights.z + weights.w;
          return (samples[0] * weights.x + samples[1] * weights.y + samples[2] * weights.z + samples[3] * weights.w) / weightSum;
        }

        float sum( vec3 v ) { return v.x+v.y+v.z; }

        vec4 hash4(vec2 p) {
          return fract(sin(vec4(1.0 + dot(p, vec2(37.0, 17.0)), 2.0 + dot(p, vec2(11.0, 47.0)), 3.0 + dot(p, vec2(41.0, 29.0)), 4.0 + dot(p, vec2(23.0, 31.0)))) * 103.0);
        }

        #define saturate(a) clamp( a, 0.0, 1.0 )
              
        vec3 ACESFilmicToneMapping(vec3 x) {
          float a = 2.51;
          float b = 0.03;
          float c = 2.43;
          float d = 0.59;
          float e = 0.14;
          return saturate((x*(a*x+b))/(x*(c*x+d)+e));
        }

        // ! based on this article : https://iquilezles.org/articles/texturerepetition
        vec2 mirrorFract(vec2 uv) {
          return abs(2. * (fract(0.5 * uv + 0.5))-1.);
        }
        vec4 textureNoTile(sampler2D textureSample, int textureIndex, vec2 uv ) {
          int index = textureIndex;
          float ax = float(index % ${TEXTURE_PER_ROW});
          float ay = floor(float(index) / float(${TEXTURE_PER_ROW}));
          vec2 textureSize = vec2(1. / float(${17.125}));
          vec2 textureOffset = vec2(ax, ay) * textureSize;
          vec2 newUv = mirrorFract(uv) * textureSize + textureOffset;

          float k = vec3(texture2D(uNoiseTexture, 0.0025*newUv)).x; // cheap (cache friendly) lookup
          float l = k*8.0;
          float f = fract(l);
          
          float ia = floor(l+0.5); // suslik's method (see comments)
          float ib = floor(l);
          f = min(f, 1.0-f)*2.0;

          vec2 offa = vec2(hash4(vec2(30.0,7.0)*ia)); // can replace with any other hash
          vec2 offb = vec2(hash4(vec2(30.0,7.0)*ib)); // can replace with any other hash

          vec4 cola = texture2D(textureSample, vec2(newUv + offa));
          vec4 colb = texture2D(textureSample, vec2(newUv + offb));

          return mix(cola, colb, smoothstep(0.2,0.8,f-0.1*sum(cola.xyz-colb.xyz)));
        }

        vec4 blendBiomes(sampler2D inputTextures, vec2 uv) {
          vec4 samples[4];

          // samples[0] = textureNoTile(inputTextures, vBiomeTypes.x, uv);
          // samples[1] = textureNoTile(inputTextures, vBiomeTypes.y, uv);
          // samples[2] = textureNoTile(inputTextures, vBiomeTypes.z, uv);
          // samples[3] = textureNoTile(inputTextures, vBiomeTypes.w, uv);
          // float slope = max(0.f, 1.f - vObjectNormal.y);
          // float blend = clamp(slope * 2.5 - 0.1, 0., 1.);
          // float grassW = 1.0 - blend;
          // float rockW = blend;
          float grassWeight = vMaterialsWeights.x;
          float rockWeight = vMaterialsWeights.y;

          // TODO : use vMaterial as index
          samples[0] = textureNoTile(inputTextures, 1, uv);
          samples[1] = textureNoTile(inputTextures, 1, uv);
          samples[2] = textureNoTile(inputTextures, 0, uv);
          samples[3] = textureNoTile(inputTextures, 0, uv);

          vec4 weights = vec4(grassWeight, rockWeight, 0., 0.);

          return blendSamples(samples, weights);
        }

        vec4 triplanarMap(vec3 inputPosition, vec3 inputNormal, sampler2D inputTextures){
          vec2 uvX = inputPosition.zy * TRI_SCALE;
          vec2 uvY = inputPosition.xz * TRI_SCALE;
          vec2 uvZ = inputPosition.xy * TRI_SCALE;
          
          vec4 colX = blendBiomes(inputTextures, uvX);
          vec4 colY = blendBiomes(inputTextures, uvY);
          vec4 colZ = blendBiomes(inputTextures, uvZ);
 
          vec3 blendWeight = pow(abs(inputNormal), vec3(TRI_SHARPNESS));
          blendWeight /= dot(blendWeight,vec3(1));

          return colX * blendWeight.x + colY * blendWeight.y + colZ * blendWeight.z;
        }

        vec4 triplanarNormal(vec3 inputPosition, vec3 inputNormal, sampler2D inputTextures) {
          // Tangent Reconstruction
          // Triplanar uvs
          vec2 uvX = inputPosition.zy * TRI_SCALE;
          vec2 uvY = inputPosition.xz * TRI_SCALE;
          vec2 uvZ = inputPosition.xy * TRI_SCALE;
          
          vec4 colX = blendBiomes(inputTextures, uvX);
          vec4 colY = blendBiomes(inputTextures, uvY);
          vec4 colZ = blendBiomes(inputTextures, uvZ);

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

      const mapFragment = /* glsl */`
        #include <map_fragment>
 
        vec4 triplanarDiffColor = triplanarMap(vPosition, vObjectNormal, uDiffMap);
        triplanarDiffColor.rgb = ACESFilmicToneMapping(triplanarDiffColor.rgb);
        diffuseColor *= triplanarDiffColor;
      `;
      const roughnessMapFragment = /* glsl */`
        #include <roughnessmap_fragment>

        // vec4 texelRoughness = triplanarMap(vPosition, vObjectNormal, uRoughnessMap);
        // roughnessFactor *= texelRoughness.g;
      `;
      const metalnessMapFragment = /* glsl */`
        #include <metalnessmap_fragment>

        // vec4 texelMetalness = triplanarMap(vPosition, vObjectNormal, uMetalnessMap);
        // metalnessFactor *= texelMetalness.g;
      `;
      const normalFragmentMaps = /* glsl */`
        #include <normal_fragment_maps>

        vec3 triplanarNormalColor = triplanarNormal(vPosition, vObjectNormal, uNormalMap).xyz;
        // normal = normalize(vNormalMatrix * triplanarNormalColor); 
      `;

      const aoMapFragment = /* glsl */`
        #include <aomap_fragment>

        // vec4 triplanarAoColor = triplanarMap(vPosition, vObjectNormal, uAoMap);

        // float ambientOcclusion = triplanarAoColor.r;
        // reflectedLight.indirectDiffuse *= ambientOcclusion;

        // #if defined( USE_ENVMAP ) && defined( STANDARD )
        //   float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
        //   reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
        // #endif
      `;

      // extend shaders
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_pars_vertex>',
        uvParseVertex
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        worldPosVertex
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_pars_fragment>',
        mapParseFragment
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        roughnessMapFragment
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <metalnessmap_fragment>',
        metalnessMapFragment
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        mapFragment
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        normalFragmentMaps
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <aomap_fragment>',
        aoMapFragment
      );

      return shader;
    },
  });

  // const testMesh = new THREE.Mesh(
  //   new THREE.SphereGeometry(10),
  //   new THREE.MeshStandardMaterial({
  //     roughness: 1,
  //     metalness: 0,
  //     map: grassDiffMap,
  //     normalMap: grassNormalMap,
  //     roughnessMap: grassRoughnessMap,
  //     metalnessMap: grassMetalnessMap,
  //     envMap: envMap,
  //     envMapIntensity: 1
  //   })
  // );
  // rootScene.add(testMesh);

  return material;
};

export default loadTerrainMaterial;
