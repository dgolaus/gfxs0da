// Gera as thumbs do fundo do hero já desfocadas e escurecidas.
//   entrada: assets/work/bg/*.webp   saída: assets/work/bg-soft/*.webp
//
// Antes o desfoque era um `filter: blur()` no CSS de cada <img> da colagem.
// O modo leve (html.lite) tira esse filtro em máquina fraca, e o navegador
// marca a máquina como fraca com facilidade (deviceMemory <= 4 já basta),
// então o fundo aparecia nítido pra muita gente. Com o efeito gravado no
// arquivo, o fundo fica igual em qualquer máquina e não custa nada por frame.
//
// Rodar depois de adicionar ou trocar thumbs em assets/work/bg/:
//   node scripts/build-hero-bg.js
// e incluir o nome novo na lista HERO_BG_POOL do index.html.

const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'work', 'bg');
const OUT = path.join(__dirname, '..', 'assets', 'work', 'bg-soft');

// Mesmo visual do CSS antigo: brightness(0.45) saturate(0.85) blur(2px).
// As thumbs têm 512x288 e aparecem com ~200px de altura, então 2px na tela
// equivalem a ~3px no arquivo.
const BLUR_SIGMA = 3;
const BRIGHTNESS = 0.45;
const SATURATION = 0.85;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const files = (await fs.readdir(SRC)).filter((f) => f.endsWith('.webp'));
  for (const f of files) {
    await sharp(path.join(SRC, f))
      .modulate({ saturation: SATURATION })
      .linear(BRIGHTNESS, 0)
      .blur(BLUR_SIGMA)
      .webp({ quality: 80, effort: 6 })
      .toFile(path.join(OUT, f));
  }
  console.log(`${files.length} thumbs geradas em assets/work/bg-soft/`);
  console.log(JSON.stringify(files.map((f) => f.replace(/\.webp$/, ''))));
}

main().catch((e) => { console.error(e); process.exit(1); });
