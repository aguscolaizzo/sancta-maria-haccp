import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const amdToCommonJs = {
  name: "lzma-purejs-amd",
  setup(builder) {
    builder.onLoad({ filter: /lzma-purejs\/(?:main|lib\/.*)\.js$/ }, async ({ path }) => {
      let source = await readFile(path, "utf8");
      source = source.replace(/^if \(typeof define[^\n]+\n/, "");
      if (path.endsWith("/lib/Util.js")) {
        source = source
          .replaceAll("new Buffer(", "new Uint8Array(")
          .replace("this.buffer.copy(newBuffer);", "newBuffer.set(this.buffer);")
          .replace("this.buffer.copy(newBuffer, 0, 0, this.pos);", "newBuffer.set(this.buffer.subarray(0, this.pos));");
      }
      const definition = /define\((\[[^\]]*\]),\s*function\(([^)]*)\)\s*\{/.exec(source);
      if (!definition) throw new Error(`Définition AMD inconnue : ${path}`);
      const dependencies = JSON.parse(definition[1].replaceAll("'", '"'));
      const end = source.lastIndexOf("});");
      if (end < 0) throw new Error(`Fin AMD inconnue : ${path}`);
      const body = source.slice((definition.index ?? 0) + definition[0].length, end);
      const parameters = definition[2];
      const requires = dependencies.map((dependency) => `require(${JSON.stringify(dependency)})`).join(",");
      return { contents: `module.exports=(function(${parameters}){${body}})(${requires});`, loader: "js" };
    });
  },
};

await build({
  entryPoints: ["scripts/lzma-browser-entry.mjs"],
  bundle: true,
  platform: "browser",
  format: "esm",
  outfile: "lib/vendor/lzma-browser.js",
  legalComments: "inline",
  plugins: [amdToCommonJs],
});
