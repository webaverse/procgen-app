import { BUSHES_INFO, GRASSES_INFO, MATERIALS_INFO, ORES_INFO, ROCKS_INFO, STONES_INFO, TREES_INFO } from "./constants.js";

export const procgenAssetsBaseUrl = `https://webaverse.github.io/procgen-assets/`;

// this file's base url
// const BASE_URL = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');
// const SERVER_URL = 'http://localhost:8080/';

export const glbUrlSpecs = {
  // trees: ['Toon_1.glb'].map(u => `${SERVER_URL}assets/trees/${u}`),
  // bushes : ['Bush_1_kiiba.glb'].map(u => `${SERVER_URL}assets/trees/${u}`), 

  // rocks: ['big_rock_v2.glb'].map(u => `${SERVER_URL}assets/rocks/${u}`),
  // stones : ['med_rock_v2.glb'].map(u => `${SERVER_URL}assets/rocks/${u}`), 

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

  // grasses: [
  //   'assets/trees/ToonGrass_v1.3_Guilty.glb',
  // ].map(u => {
  //   return `${SERVER_URL}/${u}`;
  // }),

  huds: [
    'alert.svg',
    'book.svg',
    'bow.svg',
    'bullets.svg',
    'car.svg',
    'castle.svg',
    'cave.svg',
    'cpu.svg',
    'danger.svg',
    'death.svg',
    'dragon.svg',
    'drop.svg',
    'fire.svg',
    'horse.svg',
    'house.svg',
    'lightning.svg',
    'mountain.svg',
    'nuclear.svg',
    'ore.svg',
    'pet.svg',
    'pill.svg',
    'pistol.svg',
    'potion.svg',
    'private.svg',
    'question.svg',
    'rifle.svg',
    'rpg.svg',
    'shake.svg',
    'shield.svg',
    'sniper.svg',
    'sword-double.svg',
    'truck.svg',
    'unicorn.svg',
    'water.svg',
  ].map(u => {
    return `${procgenAssetsBaseUrl}icons/${u}`;
  }),
};

export const textureUrlSpecs = {
  simplexMap: `${procgenAssetsBaseUrl}noise/simplex-noise.png`,
  terrainEnvMap: `${procgenAssetsBaseUrl}terrain/envmaps/env.exr`,
  terrainDiffuseMaps: MATERIALS_INFO.map((m) => {
    return m.getDiffusePath();
  }).map((u) => {
    return `${procgenAssetsBaseUrl}${u}`;
  }),
  terrainNormalMaps: MATERIALS_INFO.map((m) => {
    return m.getNormalPath();
  }).map((u) => {
    return `${procgenAssetsBaseUrl}${u}`;
  }),

  // terrainDiffuseMaps: [
  //   'stylized_stone/stylized_stone_d.png',
  //   'stylized_grass/stylized_grass_d.png',
  //   'stylized_stone/stylized_stone_d.png',
  //   'stylized_stone/stylized_stone_d.png',
  // ].map(u => {
  //   return `${SERVER_URL}assets/textures/${u}`;
  // }),
  // terrainNormalMaps: [
  // 'stylized_stone/stylized_stone_n.png',
  // 'stylized_stone/stylized_stone_n.png',
  // 'stylized_stone/stylized_stone_n.png',
  // 'stylized_stone/stylized_stone_n.png',
  // ].map(u => {
  // return `${BASE_URL}assets/textures/${u}`;
  // }),
};
