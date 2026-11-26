import { build } from 'esbuild';
import { cp, rm, mkdir, readdir } from 'node:fs/promises';

const production = process.argv.includes('--production');

const excluded = new Set([
    'dist',
    'node_modules',
    'package.json',
    'package-lock.json',
    'build.mjs',
    'app.js',
    'app.css'
]);

await rm('dist', { recursive: true, force: true });
await mkdir('dist');

for (const entry of await readdir('.')) {
    if (!excluded.has(entry) && !entry.startsWith('.')) {
        await cp(entry, `dist/${entry}`, { recursive: true });
    }
}

await build({
    entryPoints: ['app.js', 'app.css', 'sw.js'],
    bundle: true,
    minify: production,
    sourcemap: !production,
    keepNames: true,
    legalComments: 'inline',
    outdir: 'dist'
});