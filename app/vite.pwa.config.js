import {defineConfig} from 'vite';
import {
    copyFileSync,
    readFileSync,
    writeFileSync,
    unlinkSync
} from 'node:fs';

export default defineConfig(({mode}) => ({
    publicDir: false,
    plugins: [{
        name: 'configure-pwa', closeBundle() {
            copyFileSync('src/pwa/manifest.json', 'dist/manifest.json');

            const bootstrap = readFileSync(
                'dist/bootstrap.js', 'utf8'
            ).replace(/<\/script/gi, '<\\/script');

            writeFileSync('dist/index.html', readFileSync('dist/index.html', 'utf8')
                .replace('<link rel="stylesheet" crossorigin href="./app.css">', '')
                .replace('<script type="module" crossorigin src="./app.js"></script>', '')
                .replace(
                    '</html>',
                    () => `<script type="module">${bootstrap}</script>\n</html>`
                ).replace('<title>', () =>
                    '<link rel="manifest" href="manifest.json">\n<title>'));

            unlinkSync('dist/bootstrap.js');
        }
    }],
    build: {
        outDir: 'dist',
        emptyOutDir: false,
        minify: mode !== 'development',
        sourcemap: mode === 'development',
        rollupOptions: {
            input: {
                bootstrap: 'src/pwa/bootstrap.js',
                sw: 'src/pwa/sw.js'
            },
            output: {
                format: 'es',
                entryFileNames: '[name].js'
            }
        }
    }
}));
