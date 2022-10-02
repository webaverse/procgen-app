import metaversefile from 'metaversefile';
import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

const {useAtlasing} = metaversefile;

const {CanvasTextureAtlas} = useAtlasing();

const exrLoader = new EXRLoader();
const textureLoader = new THREE.TextureLoader();

const SUB_TEXTURE_SIZE = 1024;

export const DIFFUSE_MAP = 'diffuse';
export const NORMAL_MAP = 'normal';
export const NOISE_MAP = 'noise';
export const ENV_MAP = 'env';

const _textureError = (err) => {
  console.error('Terrain Package : Loading texture failed : ', err);
};
const _exrError = (err) => {
  console.error('Terrain Package : Loading exr failed : ', err);
};

const _loadTexture = (u) =>
  new Promise((accept, reject) => {
    // TODO : use ktx2 loader instead
    textureLoader.load(
      u,
      (t) => {
        accept(t);
      },
      function onProgress() {},
      _textureError
    );
  });

const _loadExr = (u) =>
  new Promise((accept, reject) => {
    exrLoader.load(
      u,
      (t) => {
        accept(t);
      },
      function onProgress() {},
      _exrError
    );
  });

const _bakeTerrainTextures = (options) => {
  const {diffuseMapArray, normalMapArray, noiseTexture, evnMapTexture} = options;

  const textures = {};

  const diffuseAtlas = new CanvasTextureAtlas(
    diffuseMapArray,
    THREE.sRGBEncoding,
    SUB_TEXTURE_SIZE
  );
  const normalAtlas = new CanvasTextureAtlas(
    normalMapArray,
    THREE.LinearEncoding,
    SUB_TEXTURE_SIZE
  );

  noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;

  textures[DIFFUSE_MAP] = diffuseAtlas.atlasTexture;
  textures[NORMAL_MAP] = normalAtlas.atlasTexture;
  textures[NOISE_MAP] = noiseTexture;
  textures[ENV_MAP] = evnMapTexture;

  return textures;
};

class TerrainPackage {
  constructor(textures) {
    this.textures = textures;
  }

  static async loadUrls(paths) {
    const {diffNames, normalNames, envName, noiseName} = paths;

    // * loading
    const assetsArray = [
      Promise.all(diffNames.map(_loadTexture)),
      Promise.all(normalNames.map(_loadTexture)),
      _loadTexture(noiseName),
      _loadExr(envName),
    ];

    const assets = await Promise.all(assetsArray);

    const diffuseMapArray = assets[0];
    const normalMapArray = assets[1];
    const noiseTexture = assets[2];
    const evnMapTexture = assets[3];

    // * Baking
    const bakeOptions = {
      diffuseMapArray,
      normalMapArray,
      noiseTexture,
      evnMapTexture,
    };
    const textures = _bakeTerrainTextures(bakeOptions);

    // * Create new package
    const pkg = new TerrainPackage(textures);
    return pkg;
  }
}

export default TerrainPackage;
