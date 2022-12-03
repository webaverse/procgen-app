// ! Same order as C++
export const BIOMES = {
  desert: {
    trees: {
      small: "vegetation/garden-trees/jungle_tree_2_variant.glb",
      medium: "vegetation/garden-trees/jungle_tree_1_variant.glb",
      large: "vegetation/garden-trees/jungle_tree_3_variant.glb",
    },
    rocks: {
      small: "rocks/med_rock_v2.glb",
      medium: "rocks/med_rock_v2.glb",
      large: "rocks/big_rock_v2.glb",
    },
  },
  forest: {
    trees: {
      small: "vegetation/garden-trees/jungle_tree_2_variant.glb",
      medium: "vegetation/garden-trees/jungle_tree_1_variant.glb",
      large: "vegetation/garden-trees/jungle_tree_3_variant.glb",
    },
    rocks: {
      small: "rocks/med_rock_v2.glb",
      medium: "rocks/med_rock_v2.glb",
      large: "rocks/big_rock_v2.glb",
    },
  },
  taiga: {
    trees: {
      small: "vegetation/garden-trees/jungle_tree_2_variant.glb",
      medium: "vegetation/garden-trees/jungle_tree_1_variant.glb",
      large: "vegetation/garden-trees/jungle_tree_3_variant.glb",
    },
    rocks: {
      small: "rocks/med_rock_v2.glb",
      medium: "rocks/med_rock_v2.glb",
      large: "rocks/big_rock_v2.glb",
    },
  },
};

// class LevelContainer {
//   constructor(name, obj, constructor) {
//     this.name = name;
//     this.types = [];

//     for (const [key, value] of Object.entries(obj)) {
//       const type = new constructor(key, value);
//       this.types.push(type);
//     }
//   }
// };

class Path {
  constructor(name, path) {
    this.name = name;
    this.path = path;
  }
}

export const _createDataRecursively = (name, obj) => {
  if(typeof obj === "string") {
    // we've reached the end of the recursive loop
    return new Path(name, obj);
  }

  const data = {name: name, types: []};

  for (const [key, value] of Object.entries(obj)) {
    const info = _createDataRecursively(key, value);
    data.types.push(info);
  }

  return data;
};