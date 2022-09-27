import * as THREE from 'three';

import metaversefile from 'metaversefile';
const { useRenderer } = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const renderer = useRenderer();

const _adjustTextureSettings = (texture, encoding = THREE.LinearEncoding) => {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.encoding = encoding;
  texture.anisotropy = 16;
};

export const TEXTURE_IMAGE_SIZE = 1024;
export const TEXTURE_PER_ROW = 2;

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
    this.loader = new THREE.TextureLoader(this.manager);
    this.textures = {};

    this.manager.onLoad = () => {
      this.onLoad();
    };
  }

  load(atlas, names) {
    this.textures[atlas] = {
      textures: names.map((n) => this.loader.load(n)),
    };
  }

  get data() {
    return this.textures;
  }

  runOnLoad(onLoadFn) {
    this.onLoadFunctions.push(onLoadFn);
  }

  onLoad() {
    // console.log(renderer.capabilities.maxTextureSize);
    for (const k in this.textures) {
      const atlas = this.textures[k];
      const canvas = document.createElement('canvas');
      const width = TEXTURE_IMAGE_SIZE * TEXTURE_PER_ROW;
      const height = TEXTURE_IMAGE_SIZE * TEXTURE_PER_ROW;

      canvas.width = width;
      canvas.height = height;

      // canvas.style.position = 'absolute';
      // canvas.style.top = '0';
      // document.body.appendChild(canvas);

      const context = canvas.getContext('2d');

      for (let t = 0; t < atlas.textures.length; t++) {
        const texture = atlas.textures[t];
        _adjustTextureSettings(texture);

        const image = texture.image;
        const x = t % TEXTURE_PER_ROW;
        const y = Math.floor(t / TEXTURE_PER_ROW);

        image && context.drawImage(image, x * TEXTURE_IMAGE_SIZE, y * TEXTURE_IMAGE_SIZE);
      }

      // * Using a canvas texture is necessary
      const atlasTexture = new THREE.CanvasTexture(canvas);

      switch (k) {
        case DIFFUSE:
          _adjustTextureSettings(atlasTexture, THREE.sRGBEncoding);
          break;
        default:
          _adjustTextureSettings(atlasTexture);
          break;
      }

      atlas.atlas = atlasTexture;
    }
    this.onLoadFn();
  }
}

export default TextureAtlas;
