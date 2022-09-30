import * as THREE from 'three';
import {NUM_MATERIALS} from '../layers/terrain-material';

const MAX_TEXTURE_ATLAS_SLOTS = 16;
export const TEXTURE_IMAGE_SIZE = 1024;

export const _calculateTexturePerRow = (numTextures) => {
  for (let t = 1; t < MAX_TEXTURE_ATLAS_SLOTS; t *= 2 * 2) {
    if (numTextures < t) {
      return Math.sqrt(t);
    }
  }
  console.error(
    'Texture Atlas Error : Number of textures in atlas exceeded the maximum amount'
  );
};

const _adjustAtlasTextureSettings = (
  texture,
  encoding = THREE.LinearEncoding
) => {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.NearestMipMapLinearFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.encoding = encoding;
  texture.flipY = false;
};

export const DIFFUSE = 'diffuse';
export const NORMAL = 'normal';
class TextureAtlas {
  constructor() {
    this.onLoadFunctions = [];

    this.onLoadFn = () => {
      this.onLoadFunctions.forEach((fn) => {
        fn();
      });
    };

    this.manager = new THREE.LoadingManager();
    this.loader = new THREE.TextureLoader(this.manager); // TODO : use ktx2 loader

    this.textures = {};
    this.texturePerRow = _calculateTexturePerRow(NUM_MATERIALS);

    this.manager.onLoad = () => {
      this.onLoad();
    };
  }

  get data() {
    return this.textures;
  }

  load(atlas, names) {
    this.textures[atlas] = {};
    const textureAtlas = this.textures[atlas];
    textureAtlas.textures = names.map((n) => this.loader.load(n));
  }

  runOnLoad(onLoadFn) {
    this.onLoadFunctions.push(onLoadFn);
  }

  onLoad() {
    // console.log(renderer.capabilities.maxTextureSize);
    const TEXTURE_PER_ROW = this.texturePerRow;
    for (const k in this.textures) {
      const atlas = this.textures[k];

      const canvas = document.createElement('canvas');

      const width = TEXTURE_IMAGE_SIZE * TEXTURE_PER_ROW;
      const height = TEXTURE_IMAGE_SIZE * TEXTURE_PER_ROW;

      canvas.width = width;
      canvas.height = height;

      // canvas.style.position = 'absolute';
      // canvas.style.top = k == DIFFUSE ? '0' : '2048px';
      // document.body.appendChild(canvas);

      const context = canvas.getContext('2d');

      for (let t = 0; t < atlas.textures.length; t++) {
        const texture = atlas.textures[t];
        const image = texture.image;

        const x = t % TEXTURE_PER_ROW;
        const y = Math.floor(t / TEXTURE_PER_ROW);

        image &&
          context.drawImage(
            image,
            x * TEXTURE_IMAGE_SIZE,
            y * TEXTURE_IMAGE_SIZE
          );
      }

      const atlasTexture = new THREE.CanvasTexture(canvas);

      switch (k) {
        case DIFFUSE:
          _adjustAtlasTextureSettings(atlasTexture, THREE.sRGBEncoding);
          break;
        default:
          _adjustAtlasTextureSettings(atlasTexture);
          break;
      }

      atlas.atlas = atlasTexture;
    }
    this.onLoadFn();
  }
}

export default TextureAtlas;
