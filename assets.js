import * as THREE from "three";
import {
  GET_COLOR_PARAMETER_NAME,
  GRASS_COLOR_ABOVE_DIRT,
  GRASS_COLOR_ABOVE_GRASS,
  GRASS_COLOR_NAME
} from "./constants.js";

const LOCAL_URL = "https://local.webaverse.com/scenes/heightfield/procgen-assets/";
const ONLINE_URL = "https://webaverse.github.io/procgen-assets/";
export let procgenAssetsBaseUrl = LOCAL_URL;

export const _setAssetsRootPath = isLocal => {
  if(isLocal) {
    procgenAssetsBaseUrl = LOCAL_URL;
  } else {
    procgenAssetsBaseUrl = ONLINE_URL;
  }
};


// Directories Names
const TERRAIN_TEXTURES_DIRECTORY_NAME = 'terrain/textures/';
const TREE_MODELS_DIRECTORY_NAME = 'vegetation/jungle-trees/';
const BUSH_MODELS_DIRECTORY_NAME = 'vegetation/bushes/';
const ROCK_MODELS_DIRECTORY_NAME = 'rocks/';
const ORE_MODELS_DIRECTORY_NAME = 'ores/';
const GRASS_MODELS_DIRECTORY_NAME = 'grass/';

// File Extensions
const MODEL_FILES_EXTENSION = "glb";
const TEXTURE_FILES_EXTENSION = "png";

// Model Files
const SHORT_TREE_NAME = "jungle_tree_1_variant_texta";
const MEDIUM_TREE_NAME = "jungle_tree_1_variant_texta";
const TALL_TREE_NAME = "jungle_tree_1_variant_texta";
const BUSH_NAME = 'bush_1_dream';
const BIG_ROCK_NAME = 'big_rock_v2';
const MED_ROCK_NAME = 'med_rock_v2';
const GRASS_NAME = 'grass_1_dream';
const ORE_NAME = 'green_biome_ore';

// Texture Files
const GRASS_MATERIAL_NAME = 'grass';
const DIRT_MATERIAL_NAME = 'dirt_ground';
const ROCK_MATERIAL_NAME = 'rock';
const STONE_MATERIAL_NAME = 'stylized_stone';

//

// Generating Paths
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
    return this.dirName + `${this.name}.${MODEL_FILES_EXTENSION}`;
  }
}

class MaterialInfo extends AssetInfo {
  constructor(name, dirName, scale, grassColor) {
    super(name, dirName);
    this.scale = scale;
    this[GRASS_COLOR_NAME] = new THREE.Color(grassColor);
  }

  getDiffusePath() {
    return (
      this.dirName + `${this.name}/${this.name}_d.${TEXTURE_FILES_EXTENSION}`
    );
  }

  getNormalPath() {
    return (
      this.dirName + `${this.name}/${this.name}_n.${TEXTURE_FILES_EXTENSION}`
    );
  }
}

export const MATERIALS_INFO = [
  new MaterialInfo(
    GRASS_MATERIAL_NAME,
    TERRAIN_TEXTURES_DIRECTORY_NAME,
    0.1,
    GRASS_COLOR_ABOVE_GRASS,
  ),
  new MaterialInfo(
    DIRT_MATERIAL_NAME,
    TERRAIN_TEXTURES_DIRECTORY_NAME,
    0.1,
    GRASS_COLOR_ABOVE_DIRT,
  ),
  new MaterialInfo(
    ROCK_MATERIAL_NAME,
    TERRAIN_TEXTURES_DIRECTORY_NAME,
    6,
    GRASS_COLOR_ABOVE_DIRT,
  ),
  new MaterialInfo(
    STONE_MATERIAL_NAME,
    TERRAIN_TEXTURES_DIRECTORY_NAME,
    6,
    GRASS_COLOR_ABOVE_DIRT,
  ),
];

export const TREES_INFO = [
  new ModelInfo(SHORT_TREE_NAME, TREE_MODELS_DIRECTORY_NAME),
  new ModelInfo(MEDIUM_TREE_NAME, TREE_MODELS_DIRECTORY_NAME),
  new ModelInfo(TALL_TREE_NAME, TREE_MODELS_DIRECTORY_NAME),
];
export const BUSHES_INFO = [
  new ModelInfo(BUSH_NAME, BUSH_MODELS_DIRECTORY_NAME),
];
export const ROCKS_INFO = [
  new ModelInfo(BIG_ROCK_NAME, ROCK_MODELS_DIRECTORY_NAME),
];
export const STONES_INFO = [
  new ModelInfo(MED_ROCK_NAME, ROCK_MODELS_DIRECTORY_NAME),
];
export const GRASSES_INFO = [
  new ModelInfo(GRASS_NAME, GRASS_MODELS_DIRECTORY_NAME),
];
export const ORES_INFO = [
  new ModelInfo(ORE_NAME, ORE_MODELS_DIRECTORY_NAME),
];

export const glbUrlSpecs = {
  trees: TREES_INFO.map(t => t.getModelPath()).map(u => {
    return `${procgenAssetsBaseUrl}${u}`;
  }),
  bushes: BUSHES_INFO.map(t => t.getModelPath()).map(u => {
    return `${procgenAssetsBaseUrl}${u}`;
  }),
  rocks: ROCKS_INFO.map(t => t.getModelPath()).map(u => {
    return `${procgenAssetsBaseUrl}${u}`;
  }),
  stones: STONES_INFO.map(t => t.getModelPath()).map(u => {
    return `${procgenAssetsBaseUrl}${u}`;
  }),
  grasses: GRASSES_INFO.map(t => t.getModelPath()).map(u => {
    return `${procgenAssetsBaseUrl}${u}`;
  }),

  ores: ORES_INFO.map(t => t.getModelPath()).map(u => {
    return `${procgenAssetsBaseUrl}${u}`;
  }),

  huds: [
    "alert.svg",
    "book.svg",
    "bow.svg",
    "bullets.svg",
    "car.svg",
    "castle.svg",
    "cave.svg",
    "cpu.svg",
    "danger.svg",
    "death.svg",
    "dragon.svg",
    "drop.svg",
    "fire.svg",
    "horse.svg",
    "house.svg",
    "lightning.svg",
    "mountain.svg",
    "nuclear.svg",
    "ore.svg",
    "pet.svg",
    "pill.svg",
    "pistol.svg",
    "potion.svg",
    "private.svg",
    "question.svg",
    "rifle.svg",
    "rpg.svg",
    "shake.svg",
    "shield.svg",
    "sniper.svg",
    "sword-double.svg",
    "truck.svg",
    "unicorn.svg",
    "water.svg",
  ].map(u => {
    return `${procgenAssetsBaseUrl}icons/${u}`;
  }),
};

export const textureUrlSpecs = {
  simplexMap: `${procgenAssetsBaseUrl}noise/simplex-noise.png`,
  terrainEnvMap: `${procgenAssetsBaseUrl}terrain/envmaps/env.exr`,
  terrainDiffuseMaps: MATERIALS_INFO.map(m => {
    return m.getDiffusePath();
  }).map(u => {
    return `${procgenAssetsBaseUrl}${u}`;
  }),
  terrainNormalMaps: MATERIALS_INFO.map(m => {
    return m.getNormalPath();
  }).map(u => {
    return `${procgenAssetsBaseUrl}${u}`;
  }),
};

const _generateMaterialColorShaderCode = colorName => {
  const _generateColorCodes = () => {
    let string = ``;
    for (let i = 0; i < MATERIALS_INFO.length; i++) {
      const materialInfo = MATERIALS_INFO[i];
      string += /* glsl */ `
        case ${i}: 
          return vec3(${materialInfo[colorName].r}, ${materialInfo[colorName].g}, ${materialInfo[colorName].b});
       `;
    }
    return string;
  };
  const string = /* glsl */ `
    switch(${GET_COLOR_PARAMETER_NAME}) {
      ${_generateColorCodes()}
        default:
          // default color is white
          return vec3(1.0);
    }
  `;
  return string;
};

export const GRASS_COLORS_SHADER_CODE = _generateMaterialColorShaderCode(GRASS_COLOR_NAME);