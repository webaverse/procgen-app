import * as THREE from 'three';

import metaversefile from 'metaversefile';
const {useRenderer} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const renderer = useRenderer();

// Taken from https://github.com/mrdoob/three.js/issues/758
const _addImageToCanvas = (image) => {

}

const IMAGE_SIZE = 1024;

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
      textures: names.map(n => this.loader.load(n)),
    };
  }

  get data() {
    return this.textures;
  }

  runOnLoad(onLoadFn) {
    this.onLoadFunctions.push(onLoadFn);
  }

  onLoad() {
    console.log(renderer.capabilities.maxTextureSize);
    for (const k in this.textures) {
      const atlas = this.textures[k];

      const canvas = document.createElement('canvas');
      const atlasSize = 4;
      const width = IMAGE_SIZE * atlasSize;
      const height = IMAGE_SIZE * atlasSize;

      canvas.width = width;
      canvas.height = height;

      // canvas.style.position = 'absolute';
      // canvas.style.top = '0';
      // document.body.appendChild(canvas);

      const context = canvas.getContext('2d');

      for (let t = 0; t < atlas.textures.length; t++) {
        const curTexture = atlas.textures[t];
        const image = curTexture.image;
        const x = t % atlasSize;
        const y = Math.floor(t / atlasSize);

        image && context.drawImage(image, x * IMAGE_SIZE, y * IMAGE_SIZE);
      }

      // * Using a canvas texture is necessary
      const atlasTexture = new THREE.CanvasTexture(canvas) 
      atlasTexture.wrapS = atlasTexture.wrapT = THREE.RepeatWrapping;

      atlas.atlas = atlasTexture;
    }
    this.onLoadFn();
  }
}

export default TextureAtlas;