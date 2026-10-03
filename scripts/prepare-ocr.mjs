import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'), out=resolve(root,'public/ocr-v7');
await mkdir(`${out}/core`,{recursive:true}); await mkdir(`${out}/lang`,{recursive:true});
for(const name of ['worker.min.js','worker.min.js.LICENSE.txt']) await copyFile(`${root}/node_modules/tesseract.js/dist/${name}`,`${out}/${name}`);
for(const name of await readdir(`${root}/node_modules/tesseract.js-core`)) if(name.endsWith('.wasm.js')||name==='LICENSE') await copyFile(`${root}/node_modules/tesseract.js-core/${name}`,`${out}/core/${name}`);
await copyFile(`${root}/node_modules/@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz`,`${out}/lang/fra.traineddata.gz`);
console.log('French browser OCR assets ready.');
