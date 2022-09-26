export const procgenAssetsBaseUrl = `https://webaverse.github.io/procgen-assets/`;
export const urlSpecs = {
  trees: [
    `Tree_1_1.glb`,
    `Tree_1_2.glb`,
    `Tree_2_1.glb`,
    `Tree_2_2.glb`,
    `Tree_3_1.glb`,
    `Tree_3_2.glb`,
    `Tree_4_1.glb`,
    `Tree_4_2.glb`,
    `Tree_4_3.glb`,
    `Tree_5_1.glb`,
    `Tree_5_2.glb`,
    `Tree_6_1.glb`,
    `Tree_6_2.glb`,
  ].map(u => {
    return `${procgenAssetsBaseUrl}vegetation/garden-trees/${u}`;
  }),
  ores: [
    `BlueOre_deposit_low.glb`,
    `Iron_Deposit_low.glb`,
    `Ore_Blue_low.glb`,
    `Ore_BrownRock_low.glb`,
    `Ore_Deposit_Red.glb`,
    `Ore_Red_low.glb`,
    `Ore_metal_low.glb`,
    `Ore_wood_low.glb`,
    `Rock_ore_Deposit_low.glb`,
    `TreeOre_low.glb`,
  ].map(u => {
    return `${procgenAssetsBaseUrl}/litter/ores/${u}`;
  }),
  grasses: [
    `testgrass_dualquad.glb`,
  ].map(u => {
    return `${procgenAssetsBaseUrl}/grass/${u}`;
  }),
};