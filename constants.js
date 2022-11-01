import * as THREE from 'three';
export const bufferSize = 4 * 1024 * 1024;
export const maxAnisotropy = 16;

export const WORLD_BASE_HEIGHT = 128;

export const MIN_WORLD_HEIGHT = 0;
export const MAX_WORLD_HEIGHT = 2048;
const TOON_TREE_1 = 'Toon_1';
const GRASS = 'stylized_grass';
const DIRT = 'dirt';
const ROCK = 'stylized_rock';
const STONE = 'stylized_stone';

class AssetInfo {
  constructor(name, dirName) {
    this.name = name;
    this.dirName = dirName;
  }
}
class ModelInfo extends AssetInfo {
  constructor(name, dirName = 'vegetation/garden-trees/') {
    super(name, dirName);
  }

  getModelPath() {
    return this.dirName + `${this.name}.glb`
  }
}
class MaterialInfo extends AssetInfo {
  constructor(name, color, scale, dirName = 'terrain/textures/') {
    super(name, dirName);
    this.scale = scale;
    this.color = new THREE.Color(color);
  }

  getDiffusePath() {
    return this.dirName + `${this.name}/${this.name}_d.png`;
  }

  getNormalPath() {
    return this.dirName + `${this.name}/${this.name}_n.png`;
  }
}

export const MATERIALS_INFO = [
  new MaterialInfo(GRASS, '#0de109', 0.1),
  new MaterialInfo(DIRT, '#3b4d00', 0.1),
  new MaterialInfo(ROCK, '#fff', 6),
  new MaterialInfo(STONE, '#fff', 6),
];

export const TREES_INFO = [
  new ModelInfo(TOON_TREE_1),
];

export const GET_COLOR_PARAMETER_NAME = 'materialIndex';
const _generateMaterialColorShaderCode = () => {
  const _generateColorCodes = () => {
    let string = ``;
    for (let i = 0; i < MATERIALS_INFO.length; i++) {
      const materialInfo = MATERIALS_INFO[i];

      // u -> unsigned int

      string += /* glsl */`
        case ${i}u: 
          return vec3(${materialInfo.color.r}, ${materialInfo.color.g}, ${materialInfo.color.b});
       `;
    }
    return string;
  };
  const string = /* glsl */`
    switch(${GET_COLOR_PARAMETER_NAME}) {
      ${_generateColorCodes()}
        default:
          return vec3(1.0);
    }
  `
  return string;
};

export const MATERIALS_COLORS_SHADER_CODE = _generateMaterialColorShaderCode();