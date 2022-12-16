import * as THREE from 'three';
import {NO_LIGHT_MATERIAL_SHADOW_INTENSITY} from '../constants.js';

export class ENUM {
  constructor(namesArray) {
    for (let i = 0; i < namesArray.length; i++) {
      const name = namesArray[i];
      this[name] = i;
    }
  }
}

export const _patchOnBeforeCompileFunction = (material, func) => {
  const previousOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader) => {
    previousOnBeforeCompile(shader);
    func(shader);
  };
};

export const _addNoLightingShaderChunk = () => {
  const outgoingLightChunk = /* glsl */ `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;`;
  const outgoingLightChunkNoLight = /* glsl */ `vec3 outgoingLight = diffuseColor.rgb * (1.0 - ${NO_LIGHT_MATERIAL_SHADOW_INTENSITY} * (1.0 - getShadowMask()));`;

  const _replaceOutgoingLightChunk = (materialName) => {
    THREE.ShaderLib[materialName].fragmentShader = THREE.ShaderLib[materialName].fragmentShader.replace(
      outgoingLightChunk,
      /* glsl */ `
        #ifndef NO_LIGHT
          ${outgoingLightChunk}
        #else
          ${outgoingLightChunkNoLight}
        #endif
        `
    );
  };

  _replaceOutgoingLightChunk("lambert");
  _replaceOutgoingLightChunk("standard");
};


export const _disableOutgoingLights = (material) => {
  material.lights = false;
  material.defines = material.defines || {};
  material.defines.NO_LIGHT = true;
};