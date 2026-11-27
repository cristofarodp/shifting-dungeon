const asset = name => new URL(name, import.meta.url);

async function loadApplication() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = asset('app.css').href;
    document.head.append(link);

    await import(asset('app.js').href);
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
    document.getElementById('app').textContent = 'Unable to load the application. Reload to retry.';
}

start().catch(showError);