import {defineConfig} from 'vite';
import {copyFileSync} from 'node:fs';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({mode}) => ({
    base: './', plugins: [vue(), {
        name: 'release-manifest', closeBundle() {
            copyFileSync('version.json', 'dist/version.json');
        }
    }],
    build: {
        minify: mode !== 'development',
        sourcemap: mode === 'development',
        cssCodeSplit: false,
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
                entryFileNames: 'app.js',
                assetFileNames: asset => asset.name?.endsWith('.css') ? 'app.css' : 'assets/[name][extname]'
            }
        }
    }
}));
