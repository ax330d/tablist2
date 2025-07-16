import { logError } from "./logging";

/**
 * Chrome Extension favicon handling seems to be buggy. New favicons are not
 * loaded unless cache is busted?
 * This class is analysing image, and if it is a "missing favicon" image, we
 * do bust cache.
 **/
class FaviconAnalyser {
  private imageUrl1: string;
  private hash1: string | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private readonly size = 8;

  /**
   * @param imageUrl1 - The reference image URL (constant across comparisons)
   */
  constructor(imageUrl1: string) {
    this.imageUrl1 = imageUrl1;
    // Set up a single offscreen canvas + 2D context
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Unable to get 2D context');
    }
    this.ctx = ctx;

    this.loadImage(this.imageUrl1).then(async (img) => {
      this.hash1 = await this.computeHash(img);
    })
  }

  /**
   * Load an image from a URL as HTMLImageElement
   */
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      // Uncomment if fetching cross-origin images
      // img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = (_err) => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  /**
   * Compute a simple perceptual hash (average hash) for the given image
   */
  private async computeHash(img: HTMLImageElement): Promise<string> {
    // Return cached if this is the reference image

    // const img = await this.loadImage(url);
    // Clear canvas and draw resized image
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.ctx.drawImage(img, 0, 0, this.size, this.size);

    // Extract pixel data
    const data = this.ctx.getImageData(0, 0, this.size, this.size).data;
    const grayValues: number[] = [];

    // Convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      // simple average method
      grayValues.push((r + g + b) / 3);
    }

    // Compute average
    const sum = grayValues.reduce((acc, v) => acc + v, 0);
    const avg = sum / grayValues.length;

    // Build hash
    let hash = '';
    for (const val of grayValues) {
      hash += val > avg ? '1' : '0';
    }

    // // Cache reference hash
    // if (url === this.imageUrl1) {
    //   this.hash1 = hash;
    // }
    return hash;
  }

  /**
   * Compare the reference image against a second image URL
   * Returns true if hashes match exactly
   */
  public async areImagesSame(img: HTMLImageElement): Promise<boolean> {
    // const [h1, h2] = await Promise.all([
    //   this.computeHash(this.imageUrl1),
    //   this.computeHash(img)
    // ]);
    // return h1 === h2;
    return this.hash1 === await this.computeHash(img);
  }

  /**
   * Analyze a favicon to see if it’s virtually all white or black, reusing the constructor canvas.
   * @param faviconUrl URL of the favicon to test.
   * @returns An object with:
   *   - `white`: true if ≥99.5% of non-transparent pixels are pure white.
   *   - `black`: true if ≥99.5% of non-transparent pixels are pure black.
   */
  public async analyzeColor(faviconUrl: string): Promise<{ white: boolean; black: boolean }> {
    // 1) Load image
    const img = await this.loadImage(faviconUrl);

    // 2) Resize canvas to image dimensions
    const prevW = this.canvas.width;
    const prevH = this.canvas.height;
    this.canvas.width = img.width;
    this.canvas.height = img.height;

    // 3) Draw and extract pixel data
    this.ctx.clearRect(0, 0, img.width, img.height);
    this.ctx.drawImage(img, 0, 0);

    let imageData: ImageData;
    try {
      imageData = this.ctx.getImageData(0, 0, img.width, img.height);
    } catch (e) {
      throw new Error("Failed to analyze favicon color: unable to access pixel data");
    }

    const data = imageData.data;
    let total = 0, whiteCount = 0, blackCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a === 0) continue;
      total++;
      if (r === 255 && g === 255 && b === 255) whiteCount++;
      if (r === 0 && g === 0 && b === 0) blackCount++;
    }

    // 4) Restore canvas to hash size
    this.canvas.width = prevW;
    this.canvas.height = prevH;

    if (total === 0) {
      return { white: false, black: false };
    }

    const whiteRatio = whiteCount / total;
    const blackRatio = blackCount / total;
    return {
      white: whiteRatio >= 0.995,
      black: blackRatio >= 0.995,
    };
  }
}


const optionsURL = chrome.runtime.getURL('options.html');

const EXTENSION_FAV = 'assets/icons/favicon_128.png';
// Fallback for invalid/empty input
const FALLBACK_ICON = 'assets/icons/broken_image_24dp_UNDEFINED_FILL0_wght400_GRAD0_opsz24.png';


export class FaviconHandler {
  private favAnalyser: FaviconAnalyser;
  private baseUrl: string;

  constructor() {
    this.baseUrl = chrome.runtime.getURL('/_favicon/');
    this.favAnalyser = new FaviconAnalyser(`${this.baseUrl}?pageUrl=null&size=32`);
  }

  /**
   * Returns the favicon URL for a given page URL.
   * @param urlStr - The URL of the page for which to retrieve the favicon.
   * @returns The favicon URL as a string, or a fallback icon if the URL is invalid.
   * @throws {Error} Logs an error to the console if the favicon URL construction fails.
   */
  async faviconURL(urlStr: string, bustCache = false): Promise<string> {
    if (urlStr === 'chrome://newtab/' || urlStr === optionsURL) {
      return EXTENSION_FAV;
    }

    if (!urlStr || typeof urlStr !== 'string') {
      return FALLBACK_ICON;
    }

    // Validate and normalize URL
    let pageUrl: string;
    try {
      // Add protocol if missing
      if (!/^https?:\/\//i.test(urlStr)) {
        pageUrl = `https://${urlStr}`;
      } else {
        pageUrl = urlStr;
      }
      new URL(pageUrl); // Throws if still invalid
    } catch (e) {
      logError('[faviconURL]', `Invalid URL for favicon: ${urlStr}`, e);
      return FALLBACK_ICON;
    }

    // Build favicon URL
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set('pageUrl', pageUrl);
      url.searchParams.set('size', '32');
      // TODO: Dont use in incognito?
      // bustCache = await this.favAnalyser.areImagesSame(url.toString()) || bustCache;
      if (bustCache && !urlStr.startsWith('file://')) {
        url.searchParams.set('t', Date.now().toString());
      }
      // TOOD: as a last attempt try loading origin favicon?

      return url.toString();
    } catch (e) {
      logError('[faviconURL]', `Failed to construct favicon URL for: ${pageUrl}`, e);
      return FALLBACK_ICON;
    }
  };

  async checkForCacheBust (img: HTMLImageElement) {
    return await this.favAnalyser.areImagesSame(img);
  }

  async analyzeColor (favUrl: string) {
    return this.favAnalyser.analyzeColor(favUrl);
  }
}