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
  material.onBeforeCompile = shader => {
    previousOnBeforeCompile(shader);
    func(shader);
  };
};