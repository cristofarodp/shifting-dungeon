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
            copyFileSync('src/pwa/icon.svg', 'dist/icon.svg');
            copyFileSync('version.json', 'dist/version.json');

            const bootstrap = readFileSync(
                'dist/bootstrap.js', 'utf8'
            ).replace(/<\/script/gi, '<\\/script');

            writeFileSync('dist/index.html', readFileSync('dist/index.html', 'utf8')
                .replace(
                    '</html>',
                    () => `<script type="module">${bootstrap}</script>\n</html>`
                ).replace('<title>', () =>
                    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
                    '<meta name="apple-mobile-web-app-title" content="">\n' +
                    '<meta name="theme-color" content="#172333">\n' +
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
