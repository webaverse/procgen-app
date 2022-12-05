import * as THREE from 'three';

const _createWaterMaterial = () => {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: {
        value: 0
      },
      tDepth: {
        value: null
      },
      cameraNear: {
        value: 0
      },
      cameraFar: {
        value: 0
      },
      resolution: {
        value: new THREE.Vector2()
      },
      foamTexture: {
        value: null
      },
      mirror: {
        value: null
      },
      refractionTexture: {
        value: null
      },
      textureMatrix: {
        value: null
      },
      eye: {
        value: new THREE.Vector3()
      },
      playerPos: {
        value: new THREE.Vector3()
      },
      cameraInWater: {
        value: null
      },
      tDistortion: {
        value: null
      },
      waterNormalTexture: {
        value: null
      },
      cubeMap: {
        value: null
      },
    },
    vertexShader: `\
        
      ${THREE.ShaderChunk.common}
      ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
      uniform float uTime;
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vPos;
      varying vec3 vNormal;

      vec3 gerstnerWave(float dirX, float dirZ, float steepness, float waveLength, inout vec3 tangent, inout vec3 binormal, vec3 pos) {
        vec2 dirXZ = vec2(dirX, dirZ);
        float k = 2. * PI / waveLength;
        float c = sqrt(9.8 / k);
        vec2 d = normalize(dirXZ);
        float f = k * (dot(d, pos.xz) - c * uTime);
        float a = (steepness / k);
        
        tangent += vec3(
          - d.x * d.x * (steepness * sin(f)),
          d.x * (steepness * cos(f)),
          -d.x * d.y * (steepness * sin(f))
        );
        binormal += vec3(
          -d.x * d.y * (steepness * sin(f)),
          d.y * (steepness * cos(f)),
          - d.y * d.y * (steepness * sin(f))
        );
        return vec3(
          d.x * (a * cos(f)),
          a * sin(f),
          d.y * (a * cos(f))
        );
      }
      
      void main() {
        vec3 pos = position;
        vPos = position;
        vUv = textureMatrix * vec4( pos, 1.0 );

        // set wave here, now using 4 waves for ocean
        // 1.dirX  2.dirZ  3.steepness  4.waveLength
        vec4 waveA = vec4(1.0, 1.0, 0.05, 30.);
        vec4 waveB = vec4(1.0, 0.6, 0.05, 15.);
        vec4 waveC = vec4(1.0, 1.3, 0.05, 8.);
        vec4 waveD = vec4(0.6, 1.0, 0.05, 5.);

        vec3 tangent = vec3(1.0, 0.0, 0.0);
        vec3 binormal = vec3(0.0, 0.0, 1.0);
        vec3 tempPos = position;
  
        pos += gerstnerWave(waveA.x, waveA.y, waveA.z, waveA.w, tangent, binormal, tempPos);
        pos += gerstnerWave(waveB.x, waveB.y, waveB.z, waveB.w, tangent, binormal, tempPos);
        pos += gerstnerWave(waveC.x, waveC.y, waveC.z, waveC.w, tangent, binormal, tempPos);
        pos += gerstnerWave(waveD.x, waveD.y, waveD.z, waveD.w, tangent, binormal, tempPos);

        // set normal
        vec3 waveNormal = normalize(cross(binormal, tangent));
        vNormal = waveNormal;

        vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
        vec4 viewPosition = viewMatrix * modelPosition;
        vec4 projectionPosition = projectionMatrix * viewPosition;
        vWorldPosition = modelPosition.xyz;
        gl_Position = projectionPosition;
        ${THREE.ShaderChunk.logdepthbuf_vertex}
      }
    `,
    fragmentShader: `\
        ${THREE.ShaderChunk.logdepthbuf_pars_fragment}
        #include <common>
        #include <packing>
        
        uniform mat4 textureMatrix;
        uniform vec3 eye;
        uniform vec3 playerPos;
        uniform sampler2D mirror;
        uniform sampler2D refractionTexture;
        uniform bool cameraInWater;

        uniform float uTime;
        uniform sampler2D tDepth;
        uniform sampler2D foamTexture;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform vec2 resolution;
        uniform sampler2D tDistortion;

        uniform sampler2D waterNormalTexture;
        uniform samplerCube cubeMap;
      
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec4 vUv;
        varying vec3 vPos;

        const float TAU = 2. * 3.14159265;

        const vec3 eyePosition = vec3(0.7579705245610807, 0.6382203660633491, 0.1347421546456965);

        // cosine gradient 
        const vec4 phases = vec4(0.28, 0.50, 0.07, 0);
        const vec4 amplitudes = vec4(4.02, 0.34, 0.65, 0);
        const vec4 frequencies = vec4(0.00, 0.48, 0.08, 0);
        const vec4 offsets = vec4(0.00, 0.17, 0.00, 0);

        vec4 cosine_gradient(float x, vec4 phase, vec4 amp, vec4 freq, vec4 offset){
          phase *= TAU;
          x *= TAU;

          return vec4(
            offset.r + amp.r * 0.5 * cos(x * freq.r + phase.r) + 0.5,
            offset.g + amp.g * 0.5 * cos(x * freq.g + phase.g) + 0.5,
            offset.b + amp.b * 0.5 * cos(x * freq.b + phase.b) + 0.5,
            offset.a + amp.a * 0.5 * cos(x * freq.a + phase.a) + 0.5
          );
        }

        float getDepth(const in vec2 screenPosition) {
          return unpackRGBAToDepth(texture2D(tDepth, screenPosition));
        }

        float getViewZ(const in float depth) {
          return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
        }  

        float getDepthFade(float fragmentLinearEyeDepth, float linearEyeDepth, float depthScale, float depthFalloff) {
          return pow(saturate(1. - (fragmentLinearEyeDepth - linearEyeDepth) / depthScale), depthFalloff);
        }

        vec4 cutout(float depth, float alpha) {
          return vec4(ceil(depth - saturate(alpha)));
        }

        vec4 getNoise( vec2 uv ) {
          vec2 uv0 = ( uv / 103.0 ) - vec2(uTime / 17.0, uTime / 29.0);
          vec2 uv1 = uv / 107.0 + vec2( uTime / -19.0, uTime / 31.0 );
          vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) - vec2( uTime / 101.0, uTime / 97.0 );
          vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) + vec2( uTime / 109.0, uTime / -113.0 );
          vec4 noise = texture2D( waterNormalTexture, uv0 ) +
            texture2D( waterNormalTexture, uv1 ) +
            texture2D( waterNormalTexture, uv2 ) +
            texture2D( waterNormalTexture, uv3 );
          return noise * 0.5 - 1.0;
        }
        
        void main() {
          vec2 screenUV = gl_FragCoord.xy / resolution;

          float fragmentLinearEyeDepth = getViewZ(gl_FragCoord.z);
          float linearEyeDepth = getViewZ(getDepth(screenUV));

          if (vPos.y <= 0.01) { // ocean shader, for temporary. TODO: We should have attribute to indicate the water type(ocean, river, waterfall, etc.,)
            if (!cameraInWater) {
              //################################## compute waterColor ##################################
              float depthScale = 15.;
              float depthFalloff = 3.;
              float sceneDepth = getDepthFade(fragmentLinearEyeDepth, linearEyeDepth, depthScale, depthFalloff);

              // set green water color below player. 
              vec3 viewIncidentDir = normalize(eye - vWorldPosition.xyz);
              vec3 viewReflectDir = reflect(viewIncidentDir, vec3(0., 1.0, 0.));
              float fresnelCoe = (dot(viewIncidentDir,viewReflectDir) + 1.) / 2.;
              fresnelCoe = clamp(fresnelCoe, 0., 1.0);
              float waterColorDepth = getDepthFade(fragmentLinearEyeDepth, linearEyeDepth, 20., 1.);
              float colorLerp = mix(fresnelCoe, 1. - waterColorDepth, waterColorDepth);
              colorLerp = mix(colorLerp, 1. - waterColorDepth, saturate(distance(eye, vWorldPosition) / 150.));

              // water color
              vec4 cos_grad = cosine_gradient(saturate(1. - colorLerp), phases, amplitudes, frequencies, offsets);
              cos_grad = clamp(cos_grad, vec4(0.), vec4(1.));
              vec4 waterColor = vec4(cos_grad.rgb, 1. - sceneDepth);
              
              //################################## handle foam ##################################
              float fadeoutDistance = 50.;
              float fadeoutScale = 3.;
              float fadeoutLerp = pow(saturate(distance(playerPos, vWorldPosition) / fadeoutDistance), fadeoutScale);
          
              // foam distortion
              vec4 ds2 = texture2D( 
                tDistortion, 
                vec2(
                  0.25 * vWorldPosition.x + uTime * 0.01,
                  0.25 * vWorldPosition.z + uTime * 0.01
                ) 
              );
              vec4 ds = texture2D( 
                tDistortion, 
                vec2(
                  0.3 * vWorldPosition.x + uTime * 0.005,
                  0.3 * vWorldPosition.z + uTime * 0.005
                ) 
              );
              float foamDistortionDepth = getDepthFade(fragmentLinearEyeDepth, linearEyeDepth, 8., 2.);
              float foamDistortionScale = 0.2;
              float foamDistortionDegree = pow(clamp((1. - foamDistortionDepth), 0.2, 1.0), foamDistortionScale);
              vec2 foamDistortion = vec2(ds2.r + ds.r, ds2.g + ds.g) * foamDistortionDegree;

              // foam
              float foamDepth = getDepthFade(fragmentLinearEyeDepth, linearEyeDepth, 8., 2.);
              float foamDiff = saturate( fragmentLinearEyeDepth - linearEyeDepth );
              float foamScale = -0.02;
              float foamSpeed = 0.4;
              float foamUvX = (vWorldPosition.x + vWorldPosition.z) * foamScale;
              float foamUvY = (vWorldPosition.x + vWorldPosition.z) * foamScale + foamDepth * 1.5 - uTime * foamSpeed;
              float foamDistortionLerp = 0.15;
              vec2 foamUv = mix(vec2(foamUvX, foamUvY), foamDistortion, foamDistortionLerp);
              vec4 foamTex = texture2D(foamTexture, foamUv);
              foamTex = step(vec4(0.9), foamTex);
              float foamTextScale = 2.;
              vec4 foamT = vec4(foamTex.r * (1.0 - foamDepth) * foamTextScale);
              foamT = mix(vec4(0.), foamT, foamDepth * fadeoutLerp);
              vec4 foamLineCutOut = saturate(foamT);
              waterColor = waterColor * ((vec4(1.0) - foamLineCutOut)) + foamT;
  
              //################################## handle mirror ##################################
              vec3 surfaceNormal = normalize(vNormal * vec3(1.5, 1.0, 1.5));
              vec3 worldToEye = eye - vWorldPosition.xyz;
              float distance = length(worldToEye);
              float distortionScale = 3.;
              vec2 distortion = surfaceNormal.xz * (0.001 + 1.0 / distance) * distortionScale;
              vec3 reflectionSample = vec3(texture2D(mirror, vUv.xy / vUv.w + distortion));
              float theta = max(dot(eyePosition, surfaceNormal), 0.0);
              float rf0 = 0.1;
              float reflectance = rf0 + (1.0 - rf0) * pow((1.0 - theta), 5.0);
              float reflectanceScale = 5.;
              vec3 col1 = reflectionSample * 0.6;
              vec3 col2 = reflectionSample * 0.2;
              vec3 albedo = mix(col1, col2, reflectance * reflectanceScale);
              gl_FragColor = vec4(albedo, waterColor.a);
              gl_FragColor.rgb += waterColor.rgb;
            }
            else{
              //################################## refraction ##################################
              vec3 waterColor = vec3(0.126, 0.47628, 0.6048);
              
              vec3 surfaceNormal = normalize(vNormal * vec3(1.5, 1.0, 1.5));
              vec3 worldToEye = eye - vWorldPosition.xyz;
              float distance = length(worldToEye);
              float distortionScale = 0.1;
              vec2 distortion = surfaceNormal.xz * (0.001 + 1.0 / distance) * distortionScale;
              vec3 reflectionSample = vec3(texture2D(refractionTexture, vUv.xy / vUv.w + distortion));
              float theta = max(dot(eyePosition, surfaceNormal), 0.0);
              float rf0 = 0.1;
              float reflectance = rf0 + (1.0 - rf0) * pow((1.0 - theta), 5.0);
              float reflectanceScale = 5.;
              vec3 col1 = reflectionSample * 0.6;
              vec3 col2 = reflectionSample * 0.2;
              vec3 albedo = mix(col1, col2, reflectance * reflectanceScale);
              gl_FragColor = vec4(albedo, 1.0);
              gl_FragColor.rgb += waterColor.rgb;
            }
          }
          else { // river, for temporary
            float depthScale = 15.;
            float depthFalloff = 3.;
            float sceneDepth = getDepthFade(fragmentLinearEyeDepth, linearEyeDepth, depthScale, depthFalloff);

            vec4 cos_grad = cosine_gradient(sceneDepth, phases, amplitudes, frequencies, offsets);
            cos_grad = clamp(cos_grad, vec4(0.), vec4(1.));
            vec4 waterColor = vec4(cos_grad.rgb, 1. - sceneDepth);
           
            vec3 surfaceNormal = normalize(getNoise(vWorldPosition.xz)).rgb;
            vec3 worldToEye = eye - vWorldPosition.xyz;
            vec3 eyeDirection = normalize(worldToEye);
            float distance = length(worldToEye);
            float distortionScale = 3.;
            vec3 distortion = surfaceNormal.xyz * (0.001 + 1.0 / distance) * distortionScale;
            vec3 normalizedVWorldPosition = normalize(vWorldPosition);

            vec3 cameraToFrag = normalize(vWorldPosition.xyz - eye);
            vec3 reflectionSample = textureCube(cubeMap, cameraToFrag + distortion).rgb;
            
            float theta = max(dot(eyePosition, surfaceNormal), 0.0);
            float rf0 = 0.3;
            float reflectance = rf0 + (1.0 - rf0) * pow((1.0 - theta), 5.0);
            vec3 col1 = reflectionSample * 0.6;
            vec3 col2 = reflectionSample * 0.4;
            vec3 albedo = mix(col1, col2, reflectance);
            gl_FragColor = vec4(albedo, waterColor.a);
            gl_FragColor.rgb += waterColor.rgb;    
          }
          ${THREE.ShaderChunk.logdepthbuf_fragment}
        }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    // depthWrite: false,
    // blending: THREE.AdditiveBlending,
  });
  return material;
};

export default _createWaterMaterial;