import * as THREE from 'three';
import metaversefile from 'metaversefile';

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const { useLoaders, useScene } = metaversefile;
const rootScene = useScene();

const textureLoader = new THREE.TextureLoader();
const { ktx2Loader } = useLoaders();

const _loadKTX2 = async (path) => {
  const texture = await ktx2Loader.loadAsync(baseUrl + path);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  // higher samples improve the quality
  texture.anisotropy = 16;

  return texture;
};
const _loadTexture = async (path) => {
  const texture = await textureLoader.loadAsync(baseUrl + path);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  return texture;
};

const loadTerrainMaterial = async () => {
  const rockDiffMap = await _loadKTX2(
    'assets/textures/rock/rock_06_diff_8k.ktx2'
  );
  rockDiffMap.encoding = THREE.sRGBEncoding;

  const rockRoughnessMap = await _loadKTX2(
    'assets/textures/rock/rock_06_rough_8k.ktx2'
  );
  rockRoughnessMap.encoding = THREE.LinearEncoding;

  const rockNormalMap = await _loadKTX2(
    'assets/textures/rock/rock_06_nor_dx_8k.ktx2'
  );
  rockNormalMap.encoding = THREE.LinearEncoding;

  const rockAoMap = await _loadKTX2(
    'assets/textures/rock/rock_06_nor_dx_8k.ktx2'
  );
  rockNormalMap.encoding = THREE.LinearEncoding;

  const noiseTexture = await _loadTexture('assets/textures/simplex-noise.png');
  noiseTexture.encoding = THREE.LinearEncoding;

  // define material uniforms here
  const materialUniforms = {
    uDiffMap: { value: rockDiffMap },
    uRoughnessMap: { value: rockRoughnessMap },
    uNormalMap: { value: rockNormalMap },
    uAoMap: { value: rockAoMap },
    uNoiseTexture: { value: noiseTexture },
  };

  const material = new THREE.MeshStandardMaterial({
    roughness: 1,
    metalness: 0,
    onBeforeCompile: (shader) => {
      // ? by installing glsl-literal extension in vscode you can get syntax highlighting for glsl
      const glsl = (x) => x;

      for (const k in materialUniforms) {
        shader.uniforms[k] = materialUniforms[k];
      }

      // vertex shader
      const uvParseVertex = glsl`
        #include <uv_pars_vertex>
        varying mat3 vNormalMatrix;
        varying vec3 vPosition;
        varying vec3 vObjectNormal;
      `;

      const worldPosVertex = glsl`
       #include <worldpos_vertex>

       vPosition = transformed;
       vNormalMatrix = normalMatrix;
       vObjectNormal = normal;
      `;

      // fragment shader
      const mapParseFragment = glsl`
        #include <map_pars_fragment>
  
        varying vec3 vPosition;
        varying mat3 vNormalMatrix;
        varying vec3 vObjectNormal;
  
        uniform sampler2D uDiffMap;
        uniform sampler2D uRoughnessMap;
        uniform sampler2D uNormalMap;
        uniform sampler2D uAoMap;
  
        uniform sampler2D uNoiseTexture;
  
        float TRI_SCALE = 0.05;
        float TRI_SHARPNESS = 10.0;
  
        float sum( vec3 v ) { return v.x+v.y+v.z; }
  
        vec4 hash4(vec2 p) {
          return fract(sin(vec4(1.0 + dot(p, vec2(37.0, 17.0)), 2.0 + dot(p, vec2(11.0, 47.0)), 3.0 + dot(p, vec2(41.0, 29.0)), 4.0 + dot(p, vec2(23.0, 31.0)))) * 103.0);
        }
  
        // ! based on this article : https://iquilezles.org/articles/texturerepetition
        vec4 textureNoTile( sampler2D samp, in vec2 uv  ) {
          float k = vec3(texture2D(uNoiseTexture, 0.0025*uv)).x; // cheap (cache friendly) lookup
          float l = k*8.0;
          float f = fract(l);
          
          float ia = floor(l+0.5); // suslik's method (see comments)
          float ib = floor(l);
          f = min(f, 1.0-f)*2.0;
  
          vec2 offa = vec2(hash4(vec2(300.0,7.0)*ia)); // can replace with any other hash
          vec2 offb = vec2(hash4(vec2(300.0,7.0)*ib)); // can replace with any other hash
  
          vec4 cola = texture2D(samp, vec2(uv + offa));
          vec4 colb = texture2D(samp, vec2(uv + offb));
  
          return mix(cola, colb, smoothstep(0.2,0.8,f-0.1*sum(cola.xyz-colb.xyz)));
        }
  
        vec4 triplanarMap(vec3 inputPosition, vec3 inputNormal, sampler2D inputTexture){
          vec2 uvX = inputPosition.zy * TRI_SCALE;
          vec2 uvY = inputPosition.xz * TRI_SCALE;
          vec2 uvZ = inputPosition.xy * TRI_SCALE;
          
          vec4 colX = textureNoTile(inputTexture, uvX);
          vec4 colY = textureNoTile(inputTexture, uvY);
          vec4 colZ = textureNoTile(inputTexture, uvZ);
  
          vec3 blendWeight = pow(abs(inputNormal), vec3(TRI_SHARPNESS));
          blendWeight /= dot(blendWeight,vec3(1));
  
          return colX * blendWeight.x + colY * blendWeight.y + colZ * blendWeight.z;
        }
  
        vec4 triplanarNormal(vec3 inputPosition, vec3 inputNormal, sampler2D inputTexture) {
          // Tangent Reconstruction
          // Triplanar uvs
          vec2 uvX = inputPosition.zy * TRI_SCALE;
          vec2 uvY = inputPosition.xz * TRI_SCALE;
          vec2 uvZ = inputPosition.xy * TRI_SCALE;
          
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

      const mapFragment = glsl`
        #include <map_fragment>
 
        vec4 triplanarDiffColor = triplanarMap(vPosition, vObjectNormal, uDiffMap);
        diffuseColor *= triplanarDiffColor;
      `;
      const roughnessMapFragment = glsl`
        #include <roughnessmap_fragment>

        vec4 texelRoughness = triplanarMap(vPosition, vObjectNormal, uRoughnessMap);
        roughnessFactor *= texelRoughness.g;
      `;
      const normalFragmentMaps = glsl`
        #include <normal_fragment_maps>

        vec3 triplanarNormalColor = triplanarNormal(vPosition, vObjectNormal, uNormalMap).xyz;
        normal = normalize(vNormalMatrix * triplanarNormalColor);
      `;

      const aoMapFragment = glsl`
        // #include <aomap_fragment>

        vec4 triplanarAoColor = triplanarMap(vPosition, vObjectNormal, uAoMap);

        float ambientOcclusion = triplanarAoColor.r;
        reflectedLight.indirectDiffuse *= ambientOcclusion;

        #if defined( USE_ENVMAP ) && defined( STANDARD )
          float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
          reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
        #endif
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
  //   new THREE.SphereGeometry(25),
  //   new THREE.MeshStandardMaterial({
  //     roughness: 1,
  //     metalness: 0,
  //     map: rockDiffMap,
  //     normalMap: rockNormalMap,
  //     roughnessMap: rockRoughnessMap,
  //     aoMap: rockAoMap
  //   })
  // );
  // rootScene.add(testMesh);

  return material;
};

export default loadTerrainMaterial;
