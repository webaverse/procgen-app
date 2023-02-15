import {
  createObjectSpriteSheet,
} from './object-spriter.js';
// import metaversefile from './metaversefile-api.js';

export async function createAppUrlSpriteSheet(appUrl, opts) {
  if (!opts?.ctx?.useEngine) {
    console.warn('missing arguments', {appUrl, opts});
    debugger;
  }
  const engine = opts.ctx.useEngine();
  const app = await engine.createAppAsync({
    contentId: appUrl,
    // components: [
    //   {
    //     key: 'physics',
    //     value: true,
    //   },
    // ],
  });
  const spritesheet = await createObjectSpriteSheet(app, opts);
  app.destroy();
  return spritesheet;
}