import * as THREE from 'three';
import {NO_LIGHT_MATERIAL_SHADOW_INTENSITY} from '../constants.js';

//

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localMatrix = new THREE.Matrix4();

//

export function fitCameraToBoundingBox(camera, box, fitOffset = 1) {
  const size = box.getSize(localVector);
  const center = box.getCenter(localVector2);

  const maxSize = Math.max(size.x, size.y, size.z);
  const fitHeightDistance =
    maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);

  const direction = center
    .clone()
    .sub(camera.position)
    .normalize()
    .multiplyScalar(distance);

  camera.position.copy(center).add(direction);
  camera.quaternion.setFromRotationMatrix(
    localMatrix.lookAt(camera.position, center, camera.up)
  );
}

//

export class ENUM {
  constructor(namesArray) {
    for (let i = 0; i < namesArray.length; i++) {
      const name = namesArray[i];
      this[name] = i;
    }
  }
}

//

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