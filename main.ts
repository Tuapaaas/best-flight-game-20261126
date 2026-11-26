// Skylark Courier — the hand-in program (Node 22, standard library only).
// It copies this repository's game/ and screenshots/ into the output
// directory and writes /output/dossier.json, the summary the judge reads,
// using the vendored make.fun game library. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The two runs the grader performs must write identical bytes, so every
// step below is deterministic: files are copied in sorted path order and
// the dossier is canonical JSON written by the library itself.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copySorted(srcDir, dstDir) {
  mkdirSync(dstDir, { recursive: true });
  const names = readdirSync(srcDir).sort();
  for (const name of names) {
    const src = join(srcDir, name);
    const dst = join(dstDir, name);
    const st = statSync(src);
    if (st.isDirectory()) copySorted(src, dst);
    else if (st.isFile()) cpSync(src, dst);
  }
}

function main() {
  // Fail loudly (instead of handing in half a game) when the entry is
  // incomplete: the scorer would refuse it anyway.
  const gameDir = join(here, 'game');
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error(`game/index.html is missing under ${gameDir}`);
  }
  const shotDir = join(here, 'screenshots');
  if (!existsSync(shotDir) || readdirSync(shotDir).filter((f) => !f.startsWith('.')).length < 3) {
    throw new Error('screenshots/ must hold at least 3 images');
  }

  // Start from a clean output directory so a stale file can never leak in.
  // NOTE: never remove the output directory itself — in the grader it is a
  // mounted volume, and rmdir on a mount point fails with EBUSY (that is
  // what killed round 1: rmSync(out) threw "Device or resource busy").
  // Empty its contents instead.
  mkdirSync(out, { recursive: true });
  for (const name of readdirSync(out)) {
    rmSync(join(out, name), { recursive: true, force: true });
  }

  copySorted(gameDir, join(out, 'game'));
  copySorted(shotDir, join(out, 'screenshots'));

  // The scorer's own caps: only text_max_bytes shapes the bytes; the rest
  // refuse an entry the scorer would refuse (too many screenshots, one too
  // big, game/ too large or too many files, a path too long).
  const dossier = buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(out, 'dossier.json'), dossier);
  console.log(`wrote ${out}: game/ + screenshots/ + dossier.json (${dossier.length} bytes)`);
}

main();
