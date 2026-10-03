import lzma from "lzma-purejs";

export function compressFile(input, properties) {
  return lzma.compressFile(input, undefined, properties);
}
