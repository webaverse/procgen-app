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
  constructor(name, scale, dirName = 'terrain/textures/') {
    super(name, dirName);
    this.scale = scale;
  }

  getDiffusePath() {
    return this.dirName + `${this.name}/${this.name}_d.png`;
  }

  getNormalPath() {
    return this.dirName + `${this.name}/${this.name}_n.png`;
  }
}

export const MATERIALS_INFO = [
  new MaterialInfo(GRASS, 0.1),
  new MaterialInfo(DIRT, 0.1),
  new MaterialInfo(ROCK, 6),
  new MaterialInfo(STONE, 6),
];

export const TREES_INFO = [
  new ModelInfo(TOON_TREE_1),
];
