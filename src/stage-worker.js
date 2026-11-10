// Paints the build stages and the X-ray layer off the main thread, so the hero never stutters while
// they are prepared. Each job comes back as an ImageBitmap, ready to upload as a texture.
// (Fonts are not loaded in a worker: the faint room labels printed over the finished plan use the
// fallback sans-serif here. Everything else is shapes and colour.)
import { drawStage, drawTrades } from './plan-stages.js';
import { LAYOUT } from './layout.js';

self.onmessage = ({ data: { job, i, s } }) => {
  try {
    const c = new OffscreenCanvas(1, 1);
    if (job === 'stage') drawStage(c, LAYOUT, s, i); else drawTrades(c, LAYOUT, s);
    const bmp = c.transferToImageBitmap();
    self.postMessage({ job, i, bmp }, [bmp]);
  } catch (err) {
    self.postMessage({ job, i, error: String(err) });
  }
};
