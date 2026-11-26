'use strict';
const ROOT = new URL(self.registration.scope);
const META = 'release-loader:scope:' + JSON.stringify(ROOT.href);
const PREFIX = META + ':release:';
const POINTER = new URL('__active_release__', ROOT).href;
const MANIFEST = new URL('version.json', ROOT).href;
const WORKER = new URL(self.location.href).pathname;
let pending;

function assetURL(path) {
    if (typeof path !== 'string' || !/^([\w.-]+\/)*[\w.-]+$/.test(path) || path.split('/').some(part => part === '.' || part === '..')) throw new Error('Invalid asset path');
    const url = new URL(path, ROOT);
    if (url.href === MANIFEST || url.pathname === WORKER) throw new Error('Reserved asset path');
    return url.href;
}

function matchesLanguage(language, browserLanguage = self.navigator.language) {
    const candidate = language.toLowerCase();
    const code = (browserLanguage || '').toLowerCase();
    return candidate === code || (!candidate.includes('-') && code.startsWith(candidate + '-'));
}

function localizedURL(release, href, browserLanguage = self.navigator.language) {
    for (const entry of release?.localization ?? []) {
        if (!matchesLanguage(entry.language, browserLanguage)) continue;
        for (const [path, target] of Object.entries(entry.assets)) {
            if (assetURL(path) === href) return assetURL(target);
        }
    }
    return href;
}

function releaseAssets(release) {
    return [...new Set([ROOT.href, ...release.assets.map(assetURL), ...(release.localization ?? []).flatMap(entry => Object.entries(entry.assets).flatMap(([path, target]) => [assetURL(path), assetURL(target)]))])];
}

function validate(release) {
    if (!release || typeof release.version !== 'string' || !/^[\w.-]+$/.test(release.version) || !Array.isArray(release.assets) || (release.localization !== undefined && !Array.isArray(release.localization))) throw new Error('Invalid release manifest');
    for (const entry of release.localization ?? []) {
        if (!entry || typeof entry.language !== 'string' || !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(entry.language) || !entry.assets || typeof entry.assets !== 'object' || Array.isArray(entry.assets)) throw new Error('Invalid localization entry');
    }
    releaseAssets(release);
    return release;
}

async function active() {
    const response = await (await caches.open(META)).match(POINTER);
    if (!response) return null;
    const release = await response.json();
    return typeof release.cache === 'string' && release.cache.startsWith(PREFIX) && await caches.has(release.cache) ? release : null;
}

async function refresh() {
    if (pending) return pending;
    pending = (async () => {
        let old = null;
        let staging;
        try {
            old = await active();
            const check = new URL(MANIFEST);
            check.searchParams.set('_', Date.now());
            const response = await fetch(check, {cache: 'no-store'});
            if (!response.ok) throw new Error('Manifest unavailable');
            const release = validate(await response.json());
            if (old?.version === release.version) return old;
            staging = PREFIX + release.version + ':' + Date.now() + ':' + Math.random().toString(36).slice(2);
            const cache = await caches.open(staging);
            const results = await Promise.allSettled(releaseAssets(release).map(async href => {
                const request = new URL(href);
                request.searchParams.set('_release', release.version);
                const asset = await fetch(request, {cache: 'no-store', redirect: 'error'});
                if (!asset.ok || asset.status === 206) throw new Error('Asset unavailable');
                await cache.put(href, asset);
            }));
            if (results.some(result => result.status === 'rejected')) throw new Error('Incomplete release');
            await cache.put(MANIFEST, new Response(JSON.stringify(release), {headers: {'Content-Type': 'application/json'}}));
            const next = {version: release.version, cache: staging};
            await (await caches.open(META)).put(POINTER, new Response(JSON.stringify(next)));
            staging = null;
            try {
                await Promise.allSettled((await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== next.cache).map(key => caches.delete(key)));
            } catch (_) {
            }
            return next;
        } catch (_) {
            if (staging) await caches.delete(staging).catch(() => {
            });
            return old;
        }
    })().finally(() => {
        pending = null;
    });
    return pending;
}

self.addEventListener('install', event => {
    event.waitUntil(refresh().then(release => {
        if (!release) throw new Error('No complete release');
        return self.skipWaiting();
    }));
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || !url.href.startsWith(ROOT.href) || url.pathname === WORKER) return;
    const href = url.origin + url.pathname;
    if (href === MANIFEST) {
        if (url.searchParams.get('active') === '1') {
            event.respondWith((async () => {
                const release = await active();
                const response = release && await (await caches.open(release.cache)).match(MANIFEST);
                return response || new Response('{}', {status: 503});
            })());
        } else event.respondWith(fetch(request, {cache: 'no-store'}));
        return;
    }
    event.respondWith((async () => {
        const release = request.mode === 'navigate' ? await refresh() : await active();
        if (release) {
            const cache = await caches.open(release.cache);
            const manifest = await cache.match(MANIFEST);
            const config = manifest && await manifest.json();
            const target = localizedURL(config, href);
            const hit = await cache.match(target);
            if (hit) return hit;
        }
        return fetch(request);
    })());
});
