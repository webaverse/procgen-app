export function shuffle(array, rng = Math.random) {
  let currentIndex = array.length;
    let randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(rng() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

//

export const align = (v, N) => {
  const r = v % N;
  return r === 0 ? v : v - r + N;
};
export const align4 = v => align(v, 4);

export const getClosestPowerOf2 = size => Math.ceil(Math.log2(size));
export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

export const getBoundingSize = boundingType => {
  switch (boundingType) {
    case 'sphere': return 4;
    case 'box': return 6;
    default: return 0;
  }
};

export const lookAtQuaternion = (dirVec)=>{
  var mx = new THREE.Matrix4().lookAt(new THREE.Vector3(0,0,0), dirVec, new THREE.Vector3(0,1,0));
  return new THREE.Quaternion().setFromRotationMatrix(mx);
};

//

export function makePromise() {
  let resolve, reject;
  const p = new Promise((a, r) => {
    resolve = a;
    reject = r;
  });
  // Object.defineProperty(p, 'accept', {
  //   get() {
  //     console.warn('accept get stack', new Error().stack);
  //   },
  //   set(v) {
  //     console.warn('accept set stack', new Error().stack);
  //   }
  // });
  p.resolve = resolve;
  p.reject = reject;
  return p;
}