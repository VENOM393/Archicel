/* Genera los PNG del icono a partir de public/icono.svg. Se ejecuta a mano, no en el build. */
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const raiz = process.argv[2];
const svg = readFileSync(`${raiz}/public/icono.svg`, 'utf8');

/* La version "maskable" se recorta en circulo en Android y Windows: el dibujo se encoge
   al 62% para que ningun trazo caiga fuera de la zona segura, el fondo sigue a sangre. */
const seguro = svg
  .replace('<g fill="none"', '<g transform="translate(256 256) scale(.62) translate(-256 -256)" fill="none"')
  .replace('<path d="M104 380h304"', '<path transform="translate(256 256) scale(.62) translate(-256 -256)" d="M104 404h304"');
writeFileSync(`${raiz}/public/icono-maskable.svg`, seguro);

const salidas = [
  ['icono-192.png', svg, 192],
  ['icono-512.png', svg, 512],
  ['icono-maskable-512.png', seguro, 512],
  ['apple-touch-icon.png', svg, 180],
];

for (const [nombre, fuente, lado] of salidas) {
  await sharp(Buffer.from(fuente), { density: 384 })
    .resize(lado, lado)
    .png({ compressionLevel: 9 })
    .toFile(`${raiz}/public/${nombre}`);
  console.log(nombre, lado);
}

/* El favicon del navegador: 32 px, donde el travesano del arco todavia se lee. */
await sharp(Buffer.from(svg), { density: 384 }).resize(32, 32).png().toFile(`${raiz}/src/app/icon.png`);
console.log('src/app/icon.png 32');
