const asset = name => new URL(name, import.meta.url);

async function loadApplication() {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = asset('app.css').href;
    await new Promise((resolve, reject) => {
        css.onload = resolve;
        css.onerror = reject;
        document.head.append(css);
    });
    await import(/* @vite-ignore */ asset('app.js').href);
}

async function start() {
    if (!('serviceWorker' in navigator)) {
        await loadApplication();
        return;
    }

    const workers = navigator.serviceWorker;
    let reloading = false;
    const reload = () => {
        if (reloading || !workers.controller) return;
        reloading = true;
        location.reload();
    };
    workers.addEventListener('controllerchange', reload);
    if (workers.controller) {
        workers.register(asset('sw.js'), {updateViaCache: 'none'})
            .catch(console.error);
        await loadApplication();
        return;
    }

    const registration = await workers.register(asset('sw.js'), {
        updateViaCache: 'none'
    });
    if (workers.controller) {
        reload();
        return;
    }
    const worker = registration.installing || registration.waiting || registration.active;
    if (worker) {
        const check = () => {
            if (worker.state === 'redundant' && !workers.controller)
                showError(new Error('Service worker installation failed'));
        };
        worker.addEventListener('statechange', check);
        check();
    }
    setTimeout(() => {
        if (!workers.controller) showError(new Error('Service worker activation timed out'));
    }, 30000);
}

function showError(error) {
    console.error(error);
    document.getElementById('app').textContent = 'Unable to load the dungeon. Reload to retry.';
}

start().catch(showError);