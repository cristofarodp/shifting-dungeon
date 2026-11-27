import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
    publicDir: false,
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