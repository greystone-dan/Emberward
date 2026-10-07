import { deflateSync } from 'node:zlib';

// Minimal PNG encoder (RGBA8, no deps) for sprite atlases and contact sheets.
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf: Uint8Array): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** A simple RGBA canvas for composing sheets. */
export class Canvas {
  readonly data: Uint8Array;
  constructor(
    readonly width: number,
    readonly height: number,
    fill: [number, number, number] = [0, 0, 0],
  ) {
    this.data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      this.data[i * 4] = fill[0];
      this.data[i * 4 + 1] = fill[1];
      this.data[i * 4 + 2] = fill[2];
      this.data[i * 4 + 3] = 255;
    }
  }
  blit(src: Uint8Array, srcW: number, srcH: number, x0: number, y0: number): void {
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const si = (y * srcW + x) * 4;
        if (src[si + 3] === 0) continue;
        const dx = x0 + x,
          dy = y0 + y;
        if (dx < 0 || dy < 0 || dx >= this.width || dy >= this.height) continue;
        const di = (dy * this.width + dx) * 4;
        this.data[di] = src[si]!;
        this.data[di + 1] = src[si + 1]!;
        this.data[di + 2] = src[si + 2]!;
        this.data[di + 3] = 255;
      }
    }
  }
  toPng(): Buffer {
    return encodePng(this.width, this.height, this.data);
  }
}
