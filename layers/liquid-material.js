import * as THREE from 'three';
import {oceanShader} from '../liquid-effect/ocean-shader.js';
import {riverShader} from '../liquid-effect/river-shader.js';

const _createLiquidMaterial = () => {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: {
        value: 0
      },
      tDepth: {
        value: null
      },
      tMask: {
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
      attribute ivec4 liquids;

      uniform float uTime;
      uniform mat4 textureMatrix;
      uniform sampler2D waterNormalTexture;

      varying vec4 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vPos;
      varying vec3 vNormal;

      flat varying ivec4 vLiquids;

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

      void setOcean (inout vec3 normal, inout vec3 pos) {
        // set wave here, now using 4 waves for ocean
        // 1.dirX  2.dirZ  3.steepness  4.waveLength
        vec4 waveA = vec4(1.0, 1.0, 0.05, 30.);
        vec4 waveB = vec4(1.0, 0.6, 0.05, 15.);
        vec4 waveC = vec4(1.0, 1.3, 0.05, 8.);
        vec4 waveD = vec4(-0.3, -0.7, 0.05, 1.75);

        vec3 tangent = vec3(1.0, 0.0, 0.0);
        vec3 binormal = vec3(0.0, 0.0, 1.0);
        vec3 tempPos = pos;
  
        pos += gerstnerWave(waveA.x, waveA.y, waveA.z, waveA.w, tangent, binormal, tempPos);
        pos += gerstnerWave(waveB.x, waveB.y, waveB.z, waveB.w, tangent, binormal, tempPos);
        pos += gerstnerWave(waveC.x, waveC.y, waveC.z, waveC.w, tangent, binormal, tempPos);
        pos += gerstnerWave(waveD.x, waveD.y, waveD.z, waveD.w, tangent, binormal, tempPos);

        // set normal
        vec3 waveNormal = normalize(cross(binormal, tangent));
        normal = waveNormal;
      }

      void main() {
        vec3 pos = position;
        vPos = position;
        vUv = textureMatrix * vec4( pos, 1.0 );
        vLiquids = liquids;

        switch (liquids.x) {
          case 0:
            setOcean(vNormal, pos);
            break;
          case 1: // river
            break;
          case 2: // lava
            break;
          case 3: // waterfall
            break;
        }

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
        uniform sampler2D tMask;
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
        flat varying ivec4 vLiquids;

        const vec3 eyePosition = vec3(0.7579705245610807, 0.6382203660633491, 0.1347421546456965);

        // cosine gradient 
        const float TAU = 2. * 3.14159265;
        const vec4 phases = vec4(0.28, 0.50, 0.07, 0);
        const vec4 amplitudes = vec4(4.02, 0.34, 0.65, 0);
        const vec4 frequencies = vec4(0.00, 0.48, 0.08, 0);
        const vec4 offsets = vec4(0.00, 0.17, 0.00, 0);

        vec4 cosGradient(float x, vec4 phase, vec4 amp, vec4 freq, vec4 offset){
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

        float readDepth( sampler2D depthSampler, vec2 coord ) {
          float fragCoordZ = texture2D( depthSampler, coord ).x;
          float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
          return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
        }

        vec4 cutout(float depth, float alpha) {
          return vec4(ceil(depth - saturate(alpha)));
        }

        vec4 getNoise(vec2 uv) {
          vec2 uv0 = (uv / 103.0) - vec2(uTime / 17.0, uTime / 29.0);
          vec2 uv1 = uv / 107.0 + vec2( uTime / -19.0, uTime / 31.0 );
          vec2 uv2 = uv / vec2(8907.0, 9803.0) - vec2(uTime / 101.0, uTime / 97.0);
          vec2 uv3 = uv / vec2(1091.0, 1027.0) + vec2(uTime / 109.0, uTime / -113.0);
          vec4 noise = texture2D(waterNormalTexture, uv0) +
            texture2D(waterNormalTexture, uv1) +
            texture2D(waterNormalTexture, uv2) +
            texture2D(waterNormalTexture, uv3);
          return noise * 0.5 - 1.0;
        }
        
        void main() {
          vec2 screenUV = gl_FragCoord.xy / resolution;
          float fragmentLinearEyeDepth = getViewZ(gl_FragCoord.z);
          float linearEyeDepth = getViewZ(getDepth(screenUV));

          switch (vLiquids.x) {
            case 0:
              ${oceanShader}
              break;
            case 1:
            case 3:
              ${riverShader}
              break;
            case 2:
              gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
              break;
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

export default _createLiquidMaterial;