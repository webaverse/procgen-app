import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();
const cubeMaploader = new THREE.CubeTextureLoader();

const _textureError = (err) => {
  console.error('Water Package : Loading texture failed : ', err);
};

const _loadTexture = (u) =>
  new Promise((accept, reject) => {
    textureLoader.load(
      u.value[0],
      (t) => {
        accept(t);
      },
      function onProgress() {},
      _textureError
    );
  });


class WaterPackage {
  constructor(textures) {
    this.textures = textures;
  }

  static async loadUrls(paths) {
    const {shaderTexturePath, cubeMapPath} = paths;

    const mapObjectToArray = (obj) => {
      const res = [];
      for (const key in obj)
        res.push({key: key, value: obj[key]});
      return res;
    }

    const shaderTextureArray = mapObjectToArray(shaderTexturePath);
    const shaderTextures = await Promise.all(shaderTextureArray.map(_loadTexture))
    .then(function(arr) {
      const obj = {};
      for (let i = 0; i < shaderTextureArray.length; i ++) {
        obj[shaderTextureArray[i].key] = arr[i];
        if (shaderTextureArray[i].value[1]) {
          arr[i].wrapS = arr[i].wrapT = THREE.RepeatWrapping;
        }
      }
      return obj;
    });

    
    cubeMaploader.setPath(cubeMapPath);
    const textureCube = cubeMaploader.load( [ 'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png' ] );

    const textures = {};
    textures['shaderTextures'] = shaderTextures;
    textures['textureCube'] = textureCube;
    // * Create new package
    const pkg = new WaterPackage(textures);
    return pkg;
  }
}

export default WaterPackage;
