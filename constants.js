import * as THREE from 'three';
export const bufferSize = 4 * 1024 * 1024;
export const maxAnisotropy = 16;

export const WORLD_BASE_HEIGHT = 128;

export const MIN_WORLD_HEIGHT = 0;
export const MAX_WORLD_HEIGHT = 2048;
const TREE_1 = 'Tree_1';
const BUSH_1 = 'Bush_1_kiiba';
const BIG_ROCK_1 = 'big_rock_v2';
const MED_ROCK_1 = 'med_rock_v2';
const GRASS_1 = 'ToonGrass_v1.3_Guilty';
const ORE_1 = 'big_rock_v2';
const GRASS_MATERIAL = 'stylized_grass';
const DIRT_MATERIAL = 'dirt';
const ROCK_MATERIAL = 'stylized_rock';
const STONE_MATERIAL = 'stylized_stone';

class AssetInfo {
  constructor(name, dirName) {
    this.name = name;
    this.dirName = dirName;
  }
}
class ModelInfo extends AssetInfo {
  constructor(name, dirName) {
    super(name, dirName);
  }

  getModelPath() {
    return this.dirName + `${this.name}.glb`
  }
}

const GRASS_COLOR_NAME = 'grassColor';
const COLOR_NAMES = [GRASS_COLOR_NAME];
class MaterialInfo extends AssetInfo {
  constructor(name, scale, grassColor, dirName = 'terrain/textures/') {
    super(name, dirName);
    this.scale = scale;
    this[GRASS_COLOR_NAME]= new THREE.Color(grassColor);
  }

  getDiffusePath() {
    return this.dirName + `${this.name}/${this.name}_d.png`;
  }

  getNormalPath() {
    return this.dirName + `${this.name}/${this.name}_n.png`;
  }
}

export const MATERIALS_INFO = [
  new MaterialInfo(GRASS_MATERIAL, 0.1, '#07a63f'),
  new MaterialInfo(DIRT_MATERIAL, 0.1, '#73ed35'),
  new MaterialInfo(ROCK_MATERIAL, 6, '#07a61f'),
  new MaterialInfo(STONE_MATERIAL, 6, '#71ed95'),
];

export const TREES_INFO = [
  new ModelInfo(TREE_1, 'vegetation/garden-trees/'),
];
export const BUSHES_INFO = [
  new ModelInfo(BUSH_1, 'vegetation/garden-trees/'),
];
export const ROCKS_INFO = [
  new ModelInfo(BIG_ROCK_1, 'rocks/'),
];
export const STONES_INFO = [
  new ModelInfo(MED_ROCK_1, 'rocks/'),
];
export const GRASSES_INFO = [
  new ModelInfo(GRASS_1, 'grass/'),
];
export const ORES_INFO = [
  new ModelInfo(ORE_1, 'rocks/'),
];


export const GET_COLOR_PARAMETER_NAME = 'materialIndex';
const _generateMaterialColorShaderCode = (colorName) => {
  const _generateColorCodes = () => {
    let string = ``;
    for (let i = 0; i < MATERIALS_INFO.length; i++) {
      const materialInfo = MATERIALS_INFO[i];
      string += /* glsl */`
        case ${i}: 
          return vec3(${materialInfo[colorName].r}, ${materialInfo[colorName].g}, ${materialInfo[colorName].b});
       `;
    }
    return string;
  };
  const string = /* glsl */`
    switch(${GET_COLOR_PARAMETER_NAME}) {
      ${_generateColorCodes()}
        default:
          // default color is white
          return vec3(1.0);
    }
  `
  return string;
};

export const GRASS_COLORS_SHADER_CODE = _generateMaterialColorShaderCode(GRASS_COLOR_NAME);