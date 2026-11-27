import {createApp, reactive, ref, h} from 'vue';
import App from './App.vue';
import {loadResources} from './resources.js';
import {DungeonApp, t} from './dungeon.js';
import './styles/app.css';

async function releaseVersion() {
    const valid = r => typeof r?.version === 'string' && /^[\w.-]+$/.test(r.version);
    let release;
    try {
        const r = await fetch('version.json?active=1', {cache: 'no-store'});
        if (r.ok) release = await r.json();
    } catch {
    }
    if (!valid(release) && !navigator.serviceWorker?.controller) {
        try {
            const r = await fetch('version.json', {cache: 'no-store'});
            if (r.ok) release = await r.json();
        } catch {
        }
    }
    return valid(release) ? t('app.version', {version: release.version}) : '';
}

async function start() {
    await loadResources();
    document.documentElement.lang = t('app.language');
    document.title = t('app.title');
    document.querySelector('meta[name="apple-mobile-web-app-title"]').content = t('app.title');
    const app = reactive(new DungeonApp());
    window.app = app;
    app.initialize();
    const release = ref('');
    createApp({setup: () => () => h(App, {app, release: release.value})}).mount('#app');
    release.value = await releaseVersion();
    const theme = matchMedia('(prefers-color-scheme: light)');
    const sync = () => {
        document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.body).getPropertyValue('--browser-theme').trim();
    }
    if (theme.addEventListener) theme.addEventListener('change', sync); else theme.addListener(sync);
}

start().catch(e => {
    document.getElementById('app').textContent = DungeonApp.resources.messages ? t('error.startFailed') : 'Failed to load dungeon content';
    alert(t('error.start', {error: e.message}));
    console.error(e);
});
