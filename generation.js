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

    geometryaddEvent.data.geometry = result;
    this.dispatchEvent(geometryaddEvent);
  }
  cancel() {
    this.abortController.abort(abortError);

    if (this.result) {
      geometryremoveEvent.data.geometry = this.result;
      this.dispatchEvent(geometryremoveEvent);
    }
  }
}