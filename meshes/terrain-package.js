import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

const exrLoader = new EXRLoader();
const textureLoader = new THREE.TextureLoader();

export const DIFFUSE_MAP = 'diffuse';
export const NORMAL_MAP = 'normal';
export const NOISE_MAP = 'noise';
export const ENV_MAP = 'env';

class TerrainPackage {
  constructor(textures) {
    this.textures = textures;
  }

  get data() {
    return this.textures;
  }

  static async loadUrls(diffNames, normalNames, envName, noiseName) {
    const loader = new THREE.TextureLoader(); // TODO : use ktx2 loader

    const _loadTexture = (u) =>
      new Promise((accept, reject) => {
        loader.load(
          u,
          (t) => {
            accept(t);
          },
          function onProgress() {},
          reject
        );
      });

    const _loadExr = async (path) => {
      const texture = exrLoader.loadAsync(path);
      return texture;
    };

    const _loadTextureRepeated = async (path) => {
      const texture = await textureLoader.loadAsync(path);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

      return texture;
    };

    const textures = {};

    textures[DIFFUSE_MAP] = await Promise.all(diffNames.map(_loadTexture));
    textures[NORMAL_MAP] = await Promise.all(normalNames.map(_loadTexture));
    textures[NOISE_MAP] = await _loadTextureRepeated(noiseName);
    textures[ENV_MAP] = await _loadExr(envName);

    const pkg = new TerrainPackage(textures);
    return pkg;
  }
}

export default TerrainPackage;
