import type { ImageProbe } from './StudyDataApi';

/** Resolves true when the browser can decode the image, false when it cannot. */
export const browserImageProbe: ImageProbe = (url, signal) =>
  new Promise((resolve) => {
    if (signal?.aborted) return resolve(false);
    const image = new Image();
    const done = (ok: boolean) => {
      image.onload = image.onerror = null;
      signal?.removeEventListener('abort', abort);
      resolve(ok);
    };
    const abort = () => {
      done(false);
      image.src = '';
    };
    image.onload = () => done(true);
    image.onerror = () => done(false);
    signal?.addEventListener('abort', abort, { once: true });
    image.src = url;
  });
