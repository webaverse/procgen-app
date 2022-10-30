import { MATERIALS_INFO, TREES_INFO } from "./constants.js";

export const procgenAssetsBaseUrl = `https://webaverse.github.io/procgen-assets/`;

// this file's base url
const BASE_URL = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');
const SERVER_URL = 'http://localhost:8080/';

export const glbUrlSpecs = {
  trees: ['Toon_1.glb'].map(u => `${SERVER_URL}assets/trees/${u}`),
  bushes : ['Toon_Bush_1.glb'].map(u => `${SERVER_URL}assets/trees/${u}`), 

  rocks: ['grey_rock1_v1_texta.glb'].map(u => `${SERVER_URL}assets/rocks/${u}`),
  stones : ['grey_rock1_v1_texta.glb'].map(u => `${SERVER_URL}assets/rocks/${u}`), 

// TREES_INFO.map(t => t.getModelPath())
  // trees: [
  //   'Toon_1.glb',
  //   // 'Tree_1_1.glb',
  //   // 'Tree_1_2.glb',
  //   // 'Tree_2_1.glb',
  //   // 'Tree_2_2.glb',
  //   // 'Tree_3_1.glb',
  //   // 'Tree_3_2.glb',
  //   // 'Tree_4_1.glb',
  //   // 'Tree_4_2.glb',
  //   // 'Tree_4_3.glb',
  //   // 'Tree_5_1.glb',
  //   // 'Tree_5_2.glb',
  //   // 'Tree_6_1.glb',
  //   // 'Tree_6_2.glb',
  // ].map(u => {
  //   return `${procgenAssetsBaseUrl}vegetation/garden-trees/${u}`;
  // }),

  ores : ['grey_rock1_v1_texta.glb'].map(u => `${SERVER_URL}assets/rocks/${u}`), 
  // ores: [
  //   'BlueOre_deposit_low.glb',
  //   'Iron_Deposit_low.glb',
  //   'Ore_Blue_low.glb',
  //   'Ore_BrownRock_low.glb',
  //   'Ore_Deposit_Red.glb',
  //   'Ore_Red_low.glb',
  //   'Ore_metal_low.glb',
  //   'Ore_wood_low.glb',
  //   'Rock_ore_Deposit_low.glb',
  //   'TreeOre_low.glb',
  // ].map(u => {
  //   return `${procgenAssetsBaseUrl}litter/ores/${u}`;
  // }),

  grasses: [
    'assets/trees/ToonGrass_v1.3_Guilty.glb',
  ].map(u => {
    return `${SERVER_URL}/${u}`;
  }),

  // grasses: [
  //   'testgrass_dualquad.glb',
  // ].map(u => {
  //   return `${procgenAssetsBaseUrl}grass/${u}`;
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
