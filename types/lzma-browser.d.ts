declare module "@/lib/vendor/lzma-browser" {
  export function compressFile(input: Uint8Array, properties: {
    a: number; d: number; fb: number; mf: string; lc: number; lp: number; pb: number; eos: boolean;
  }): Uint8Array;
}
