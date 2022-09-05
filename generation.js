// errors

const abortError = new Error('aborted');
abortError.isAbortError = true;

// events

const geometryaddEvent = new MessageEvent('geometryadd', {
  data: {
    geometry: null,
  },
});
const geometryremoveEvent = new MessageEvent('geometryremove', {
  data: {
    geometry: null,
  },
});

// main

export class Generation extends EventTarget {
  constructor(key, abortController) {
    super();

    this.key = key;
    this.abortController = abortController;

    this.result = null;
  }
  finish(result) {
    this.result = result;

    // console.log('generation finish', !!result);

    geometryaddEvent.data.geometry = result;
    this.dispatchEvent(geometryaddEvent);
  }
  cancel() {
    // console.log('cancel finished 1', !!this.result);
    this.abortController.abort(abortError);

    // console.log('cancel finished 2', !!this.result);
    if (this.result) {
      geometryremoveEvent.data.geometry = this.result;
      this.dispatchEvent(geometryremoveEvent);
    }
  }
}