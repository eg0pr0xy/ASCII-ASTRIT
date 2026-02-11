declare module 'gif.js' {
  interface GIFOptions {
    workers?: number;
    quality?: number;
    workerScript?: string;
    width?: number;
    height?: number;
    repeat?: number;
    background?: string;
    transparent?: string;
  }

  interface AddFrameOptions {
    delay?: number;
    copy?: boolean;
  }

  type FrameSource = CanvasImageSource | HTMLCanvasElement | CanvasRenderingContext2D;

  export default class GIF {
    constructor(options?: GIFOptions);
    addFrame(source: FrameSource, options?: AddFrameOptions): void;
    on(event: 'finished', callback: (blob: Blob) => void): void;
    on(event: 'progress', callback: (progress: number) => void): void;
    render(): void;
  }
}

declare module 'gif.js/dist/gif.worker.js?url' {
  const workerUrl: string;
  export default workerUrl;
}
