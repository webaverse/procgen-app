export class ENUM {
  constructor(namesArray) {
    for (let i = 0; i < namesArray.length; i++) {
      const name = namesArray[i];
      this[name] = i;
    }
  }
}