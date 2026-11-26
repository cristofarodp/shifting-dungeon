import markdownit from 'markdown-it';
import * as jsyaml from 'js-yaml';

'use strict';

const markdown = (() => {
    const md = markdownit({html: false, linkify: false});
    md.disable(['image', 'link', 'autolink']);
    md.renderer.rules.table_open = () => '<div class="dm-table"><table>\n';
    md.renderer.rules.table_close = () => '</table></div>\n';
    return md;
})();

const roomTypes = {
    entrance: ['special', 'entrance'],
    treasure: ['special', 'treasure'],
    empty: ['safe', null],
    puzzle: ['safe', 'puzzle'],
    easy_trap: ['tricky', 'trap'],
    easy_fight: ['tricky', 'encounter'],
    hard_trap: ['danger', 'trap'],
    hard_fight: ['danger', 'encounter'],
    boss_fight: ['danger', 'boss'],
    illusion: ['danger', 'trap']
};
const roomQuotas = {safe: 5, tricky: 7, danger: 11};
const dirs = ['N', 'E', 'S', 'W'];
const key = 'shifting-dungeon-v1';
const schemaVersion = 1;
const oldestSupportedSchemaVersion = 1;

function t(key, values = {}) {
    const template = DungeonApp.resources.messages?.[key];
    if (typeof template !== 'string')
        return key;
    return template.replace(/\{(\w+)}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}

async function loadIcons() {
    const icons = new Map();
    const response = await fetch('assets/map-symbols.svg');
    if (!response.ok)
        throw Error('Unable to load SVG icons');
    const root = new DOMParser().parseFromString(await response.text(), 'image/svg+xml').documentElement;
    if (root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg')
        throw Error('Unable to load SVG icons');
    icons.clear();
    for (const child of root.children) {
        if (!child.id || icons.has(child.id))
            throw Error('Unable to load SVG icons');
        const svg = root.cloneNode(false);
        svg.setAttribute('aria-hidden', 'true');
        svg.appendChild(child.cloneNode(true));
        icons.set(child.id, svg);
    }
    return icons;
}

async function loadMessages() {
    const response = await fetch('locale/i18n.yaml');
    if (!response.ok)
        throw Error('Unable to load localization data');
    const messages = jsyaml.load(await response.text(), {schema: jsyaml.JSON_SCHEMA});
    if (!messages || typeof messages !== 'object' || Array.isArray(messages))
        throw Error('Invalid localization data');
    return messages;
}

async function load(name) {
    const r = await fetch('content/' + name + '.yaml', {cache: 'no-cache'});
    if (!r.ok)
        throw Error(`Unable to load ${name}: HTTP ${r.status}`);
    return jsyaml.load(await r.text(), {schema: jsyaml.JSON_SCHEMA});
}

function unique(list, field) {
    return list.every(x => typeof x[field] === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x[field])) && new Set(list.map(x => x[field])).size === list.length;
}

function validateSave(x) {
    if (x?.version !== oldestSupportedSchemaVersion || !Array.isArray(x.grid) || x.grid.length !== 25 || !x.rooms?.E || !x.rooms[x.treasure] || !x.grid.every(id => id === null || x.rooms[id]?.faces?.length === 4) || !Array.isArray(x.players) || !Array.isArray(x.security) || !Array.isArray(x.log) || !Array.isArray(x.drawn) || !Array.isArray(x.notes) || !Array.isArray(x.collected) || typeof x.treasureEntered !== 'boolean')
        throw Error('Invalid or unsupported save');
    const missing = id => {
        throw Object.assign(Error(`Saved content ID is missing or incompatible: ${id}`), {missingContent: true});
    };
    const check = (id, catalog) => {
        if (!Object.hasOwn(catalog, id))
            missing(id);
    };
    for (const r of Object.values(x.rooms)) {
        check(r.content, DungeonApp.resources.roomData);
        if (DungeonApp.resources.roomData[r.content].type === 'illusion') {
            check(r.illusionId, DungeonApp.resources.roomData);
            if (DungeonApp.resources.roomData[r.illusionId].type !== 'treasure')
                missing(r.illusionId);
        }
        if (!Array.isArray(r.faces) || r.faces.length !== 4)
            throw Error('Invalid or unsupported save');
        for (const f of r.faces) {
            check(f.look, DungeonApp.resources.doorCatalog);
            if (f.trap !== null || f.t)
                check(f.trap, DungeonApp.resources.trapCatalog);
        }
    }
    if (x.security.length !== 4)
        throw Error('Invalid or unsupported save');
    for (const f of x.security)
        check(f.trap, DungeonApp.resources.trapCatalog);
    for (const id of [...x.collected, ...x.drawn])
        check(id, DungeonApp.resources.itemCatalog);
    for (const id of x.notes)
        check(id, DungeonApp.resources.adventurerNotes);
    for (const event of x.log) {
        if (!event || typeof event.key !== 'string' || !event.values || !Object.hasOwn(DungeonApp.resources.messages, event.key))
            throw Error('Invalid or unsupported save');
        for (const value of Object.values(event.values)) {
            if (value && typeof value === 'object' && value.catalog) {
                const catalog = DungeonApp.resources.catalogs[value.catalog];
                if (!catalog)
                    throw Error('Invalid or unsupported save');
                check(value.id, catalog);
            }
        }
    }
    return x;
}

function ref(catalog, id) {
    return ({catalog, id});
}

function eventText(event) {
    const values = Object.fromEntries(Object.entries(event.values).map(([key, value]) => [key,
        value?.catalog ? (DungeonApp.resources.catalogs[value.catalog][value.id].name ?? DungeonApp.resources.catalogs[value.catalog][value.id].title) :
            value?.shift ? shiftLabel(value.shift) : value]));
    return t(event.key, values);
}

function opp(d) {
    return (d + 2) % 4;
}

function rand(n) {
    return Math.floor(Math.random() * n);
}

function pick(a) {
    return a[rand(a.length)];
}

function clone(x) {
    return JSON.parse(JSON.stringify(x));
}

function el(id) {
    return document.getElementById(id);
}

function esc(x) {
    return String(x).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

function renderMarkdown(value) {
    return markdown.render(String(value ?? ''));
}

function dmInfo(value) {
    const div = document.createElement('div');
    div.className = 'dm-info';
    div.innerHTML = renderMarkdown(value);
    return div;
}

function neighbor(i, d) {
    let r = Math.floor(i / 5), c = i % 5;
    return ((r + [-1, 0, 1, 0][d] + 5) % 5) * 5 + (c + [0, 1, 0, -1][d] + 5) % 5;
}

function samplePairs(pool, count) {
    const available = pool.slice(), chosen = new Set();
    for (let i = 0; i < count; i++)
        chosen.add(available.splice(rand(available.length), 1)[0]);
    return chosen;
}

function generateDoors(grid, rooms) {
    const pairs = [];
    for (let i = 0; i < 25; i++)
        for (const d of [1, 2])
            pairs.push({a: grid[i], b: grid[neighbor(i, d)], d});
    const eligible = pairs.filter(({a, b}) => a !== 'E' && b !== 'E');
    const locked = samplePairs(eligible, 10), trapped = samplePairs(eligible, 5);
    for (const pair of pairs) {
        const {a, b, d} = pair, l = locked.has(pair), t = trapped.has(pair),
            f = {l, t, look: pick(DungeonApp.resources.looks), trap: t ? pick(DungeonApp.resources.traps) : null};
        rooms[a].faces[d] = clone(f);
        rooms[b].faces[opp(d)] = clone(f);
    }
}

function assignIllusions(rooms, treasure) {
    const unused = DungeonApp.resources.treasureRooms.filter(t => t.id !== rooms[treasure].content);
    const pool = unused.length ? unused : DungeonApp.resources.treasureRooms;
    for (const r of Object.values(rooms)) {
        if (DungeonApp.resources.roomData[r.content].type === 'illusion' && !r.illusionId)
            r.illusionId = pick(pool).id;
    }
}

function ordinaryDraw() {
    const result = [];
    for (const [category, count] of Object.entries(roomQuotas)) {
        const pool = DungeonApp.resources.roomPools[category].slice();
        for (let i = 0; i < count; i++)
            result.push(pool.splice(rand(pool.length), 1)[0]);
    }
    return result;
}

function fresh() {
    let pool = ordinaryDraw(), grid = Array.from({length: 25}, (_, i) => i === 12 ? 'E' : String(i)),
        treasure = pick(grid.filter((x, i) => {
            let dr = Math.abs(Math.floor(i / 5) - 2), dc = Math.abs(i % 5 - 2);
            return Math.min(dr, 5 - dr) + Math.min(dc, 5 - dc) >= 3;
        })), rooms = {};
    for (let id of grid) {
        let content = id === 'E' ? pick(DungeonApp.resources.entrance).id : id === treasure ? pick(DungeonApp.resources.treasureRooms).id : pool.splice(rand(pool.length), 1)[0];
        rooms[id] = {
            content,
            seen: id === 'E',
            chest: false,
            solved: false,
            boss: false,
            anchor: false,
            faces: Array(4)
        };
    }
    assignIllusions(rooms, treasure);
    generateDoors(grid, rooms);
    return {
        version: schemaVersion,
        lastShift: null,
        collected: [],
        grid,
        rooms,
        treasure,
        security: dirs.map(() => ({l: true, t: true, trap: pick(DungeonApp.resources.traps)})),
        players: [],
        open: null,
        doom: false,
        treasureEntered: false,
        drawn: [],
        notes: [],
        log: [{key: 'log.generated', values: {}}]
    };
}

function connected(g) {
    let start = g.findIndex(Boolean);
    if (start < 0)
        return false;
    let seen = new Set([start]), q = [start];
    while (q.length) {
        let i = q.pop();
        for (let d = 0; d < 4; d++) {
            let j = neighbor(i, d);
            if (g[j] && !seen.has(j)) {
                seen.add(j);
                q.push(j);
            }
        }
    }
    return seen.size === g.filter(Boolean).length;
}

function shiftLabel(x) {
    const direction = x.axis === 'row' ? (x.step === 1 ? 'east' : 'west') : (x.step === 1 ? 'south' : 'north');
    return t('shift.' + x.axis, {number: x.index + 1, direction: t('direction.' + direction)});
}

function btn(label, fn, disabled = false) {
    let b = document.createElement('button');
    b.textContent = label;
    b.disabled = disabled;
    b.onclick = fn;
    return b;
}

function mapIcon(kind) {
    return DungeonApp.resources.icons.get(kind)?.cloneNode(true) ?? document.createDocumentFragment();
}

function choiceButton(...args) {
    const button = btn(...args);
    button.dataset.choice = 'true';
    return button;
}

function syncThemeColor() {
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.body).getPropertyValue("--browser-theme").trim();
}

function setupThemeSwitcher() {
    const deviceTheme = matchMedia("(prefers-color-scheme: light)");
    if (deviceTheme.addEventListener)
        deviceTheme.addEventListener("change", syncThemeColor);
    else
        deviceTheme.addListener(syncThemeColor);
    syncThemeColor();
}

async function showReleaseVersion() {
    const root = new URL('./', location.href);
    const valid = r => typeof r?.version === 'string' && /^[\w.-]+$/.test(r.version);
    let release;
    try {
        const response = await fetch(new URL('version.json?active=1', root), {cache: 'no-store'});
        if (response.ok)
            release = await response.json();
    } catch (e) {
    }
    if (!valid(release) && !navigator.serviceWorker?.controller) {
        try {
            const response = await fetch(new URL('version.json', root), {cache: 'no-store'});
            if (response.ok)
                release = await response.json();
        } catch (e) {
        }
    }
    if (valid(release))
        document.getElementById('releaseVersion').textContent = t('app.version', {version: release.version});
}

class DungeonApp {
    static resources = {};

    state = null;
    previous = null;
    selected = 'E';
    shiftObserver;
    expandedItems = new Set();
    expandedNotes = new Set();
    modalButtons = [];

    initialize() {
        this.bindEvents();
        this.loadState();
    }

    validateSave(state) {
        return validateSave(state);
    }

    bindEvents() {
        el('choices').addEventListener('close', () => {
            if (!el('choices').open)
                this.restoreChoices();
        });
        el('cancelChoice').onclick = this.closeChoices.bind(this);
        el('doomsday').onclick = () => {
            if (!this.state.doom)
                this.act(() => {
                    this.state.doom = true;
                    this.log('log.manualDoom');
                });
        };
        el('new').onclick = () => {
            if (confirm(t('confirm.new'))) {
                this.previous = clone(this.state);
                let players = this.state.players.map(p => ({...p, room: 'E', alive: true}));
                this.state = fresh();
                this.expandedNotes.clear();
                this.state.players = players;
                this.selected = 'E';
                this.save();
            }
        };
        el('undo').onclick = () => {
            if (this.previous) {
                this.state = this.previous;
                this.previous = null;
                this.save();
            }
        };
        el('export').onclick = () => {
            let u = URL.createObjectURL(new Blob([JSON.stringify(this.state, null, 2)], {type: 'application/json'})),
                a = document.createElement('a');
            a.href = u;
            a.download = "dungeon-save.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(u), 1000);
        };
        el('import').onclick = () => el('file').click();
        el('file').onchange = async (e) => {
            let x;
            try {
                const file = e.target.files[0];
                if (!file)
                    return;
                x = this.validateSave(JSON.parse(await file.text()));
            } catch (e) {
                alert(t('error.import', {error: e.message}));
                return;
            } finally {
                el('file').value = '';
            }
            this.previous = clone(this.state);
            this.state = x;
            this.selected = 'E';
            this.save();
        };
    }

    loadState() {
        const stored = localStorage.getItem(key);
        try {
            this.state = stored ? this.validateSave(JSON.parse(stored)) : fresh();
        } catch (e) {
            alert(t('error.reset', {error: e.message}));
            this.state = fresh();
        }
        this.save();
    }

    roomRef(id) {
        return ref('room', this.room(id).content);
    }

    save() {
        try {
            localStorage.setItem(key, JSON.stringify(this.state));
        } catch (e) {
            alert(t('error.backup', {error: e.message}));
        }
        this.render();
    }

    act(fn) {
        this.previous = clone(this.state);
        fn();
        this.save();
    }

    log(key, values = {}) {
        this.state.log.unshift({key, values});
    }

    room(id) {
        return this.state.rooms[id];
    }

    name(id) {
        return DungeonApp.resources.roomData[this.room(id).content].name;
    }

    adjacent(id, d) {
        let i = this.state.grid.indexOf(id);
        return i < 0 ? null : this.state.grid[neighbor(i, d)];
    }

    security(a, d, b) {
        return a === this.state.treasure ? opp(opp(d)) : b === this.state.treasure ? opp(d) : null;
    }

    effective(a, d, b) {
        let k = this.security(a, d, b), f = this.room(a).faces[d];
        if (k === null)
            return f;
        let g = this.state.security[k];
        return {...f, l: g.l, t: g.t, trap: g.trap};
    }

    change(a, d, b, field) {
        let k = this.security(a, d, b);
        if (k !== null) {
            this.state.security[k][field] = false;
            return;
        }
        let f = this.room(a).faces[d];
        f[field] = false;
        Object.assign(this.room(b).faces[opp(d)], {l: f.l, t: f.t, trap: f.trap});
    }

    legal(exclude = []) {
        let out = [];
        for (let axis of ['row', 'column'])
            for (let k = 0; k < 5; k++) {
                let ix = Array.from({length: 5}, (_, j) => axis === 'row' ? k * 5 + j : j * 5 + k);
                if (ix.some(i => this.state.grid[i] && (exclude.includes(this.state.grid[i]) || this.state.grid[i] === 'E' || this.room(this.state.grid[i]).anchor)))
                    continue;
                for (let step of [-1, 1]) {
                    let g = this.state.grid.slice();
                    ix.forEach((i, j) => g[ix[(j + step + 5) % 5]] = this.state.grid[i]);
                    if (connected(g))
                        out.push({
                            g,
                            axis,
                            index: k,
                            step,
                            direction: axis === 'row' ? (step === 1 ? 'east' : 'west') : (step === 1 ? 'south' : 'north')
                        });
                }
            }
        return out;
    }

    applyShift(x) {
        this.state.lastShift = x ? {axis: x.axis, index: x.index, step: x.step} : null;
        if (x)
            this.state.grid = x.g;
    }

    renderShift(map) {
        this.shiftObserver?.disconnect();
        const x = this.state.lastShift;
        if (!x || !['row', 'column'].includes(x.axis) || !Number.isInteger(x.index) || x.index < 0 || x.index > 4 || ![-1, 1].includes(x.step))
            return;
        const tiles = map.querySelectorAll('.tile'), first = tiles[x.axis === 'row' ? x.index * 5 : x.index],
            last = tiles[x.axis === 'row' ? x.index * 5 + 4 : x.index + 20];
        if (!first || !last)
            return;
        const mark = document.createElement('span');
        mark.className = 'shift-highlight ' + x.axis + ' ' + (x.step === 1 ? 'forward' : 'backward');
        mark.setAttribute('aria-hidden', 'true');
        map.append(mark);

        function position() {
            const m = map.getBoundingClientRect(), a = first.getBoundingClientRect(), b = last.getBoundingClientRect();
            Object.assign(mark.style, {
                left: (a.left - m.left - 2) + 'px',
                top: (a.top - m.top - 2) + 'px',
                width: (b.right - a.left + 4) + 'px',
                height: (b.bottom - a.top + 4) + 'px'
            });
        }

        position();
        this.shiftObserver = new ResizeObserver(position);
        this.shiftObserver.observe(map);
        this.shiftObserver.observe(first);
        this.shiftObserver.observe(last);
    }

    doom() {
        if (!this.state.open && !this.state.doom && (this.state.treasureEntered || Object.values(this.state.rooms).filter(r => !r.seen).length <= 4)) {
            this.state.doom = true;
            this.log('log.doom');
        }
    }

    occupied(id) {
        return this.state.players.some(p => p.alive && p.room === id);
    }

    collapse(id) {
        if (!this.state.doom || this.occupied(id) || id === 'E' || id === this.state.treasure)
            return;
        let g = this.state.grid.map(x => x === id ? null : x);
        if (connected(g)) {
            this.state.grid = g;
            this.log('log.collapse', {room: this.roomRef(id)});
        } else
            this.log('log.preserved', {room: this.roomRef(id)});
    }

    openDoor(a, d, b) {
        if (this.state.open)
            return;
        let f = this.effective(a, d, b);
        if (f.l)
            return;
        this.act(() => {
            let k = this.security(a, d, b);
            if (k === null)
                Object.assign(this.room(b).faces[opp(d)], {l: false, t: f.t, trap: f.trap});
            this.state.open = {a, b, d, crossed: false};
            let shifts = this.legal([a, b]);
            this.applyShift(null);
            if (shifts.length) {
                let x = pick(shifts);
                this.applyShift(x);
                this.log('log.shift', {shift: {shift: {axis: x.axis, index: x.index, step: x.step}}});
            } else
                this.log('log.noShift');
            this.room(a).seen = true;
            this.room(b).seen = true;
            this.log('log.open', {from: this.roomRef(a), to: this.roomRef(b)});
            this.doom();
        });
    }

    closeDoor() {
        this.act(() => {
            let o = this.state.open;
            if (!o)
                return;
            this.state.open = null;
            if (o.crossed && this.state.doom) {
                this.collapse(o.a);
                this.collapse(o.b);
            }
            this.log('log.closed');
            this.doom();
        });
    }

    canCross(p) {
        return !!(this.state.open && p?.alive && (String(p.room) === String(this.state.open.a) || String(p.room) === String(this.state.open.b)));
    }

    cross(i) {
        if (!this.canCross(this.state.players[i]))
            return;
        this.act(() => {
            let p = this.state.players[i], o = this.state.open;
            p.room = String(p.room) === String(o.a) ? o.b : o.a;
            o.crossed = true;
            this.room(p.room).seen = true;
            if (p.room === this.state.treasure)
                this.state.treasureEntered = true;
            this.log('log.enter', {player: p.name, room: this.roomRef(p.room)});
            this.doom();
        });
    }

    respawn(a) {
        if (this.state.open || !this.state.grid.includes(a) || !this.room(a).seen || !this.state.players.some(p => !p.alive))
            return;
        this.act(() => {
            const revived = this.state.players.filter(p => !p.alive);
            for (const p of revived) {
                p.alive = true;
                p.room = a;
            }
            if (a === this.state.treasure)
                this.state.treasureEntered = true;
            this.log('log.respawn', {players: revived.map(p => p.name).join(', '), room: this.roomRef(a)});
            this.doom();
        });
    }

    renderInventory() {
        const inv = el('inventory');
        inv.innerHTML = `<h2>${esc(t("inventory.title"))}</h2>`;
        const counts = new Map();
        for (const name of this.state.collected)
            counts.set(name, (counts.get(name) || 0) + 1);
        if (!counts.size) {
            inv.append(document.createElement('p'));
            inv.lastChild.textContent = t('inventory.empty');
        }
        for (const [name, count] of counts) {
            const d = document.createElement('details'), summary = document.createElement('summary'),
                p = document.createElement('div');
            summary.textContent = DungeonApp.resources.itemCatalog[name].name + (count > 1 ? t('inventory.quantity', {count}) : '');
            p.className = 'dm-info';
            p.innerHTML = renderMarkdown(DungeonApp.resources.itemData.find(x => x.id === name)?.description || '');
            const appearance = document.createElement('p');
            appearance.className = 'description';
            appearance.textContent = DungeonApp.resources.itemData.find(x => x.id === name)?.appearance || t('unknown');
            d.open = this.expandedItems.has(name);
            d.ontoggle = () => {
                if (d.open)
                    this.expandedItems.add(name);
                else
                    this.expandedItems.delete(name);
            };
            d.append(summary, appearance, p);
            inv.append(d);
        }
    }

    collectChest(r) {
        if (r.chest)
            return;
        r.chest = true;
        const pool = DungeonApp.resources.items.filter(x => !this.state.drawn.includes(x)),
            item = pick(pool.length ? pool : DungeonApp.resources.bossRewards),
            keyItem = pick(DungeonApp.resources.keyItems);
        if (pool.length)
            this.state.drawn.push(item);
        this.state.collected.push(item, keyItem);
        this.log('log.chest', {item: ref('item', item), key: ref('item', keyItem)});
        this.collectNote();
    }

    collectBoss(r) {
        if (r.boss)
            return;
        r.boss = true;
        const reward = pick(DungeonApp.resources.bossRewards);
        this.state.collected.push(reward);
        this.log('log.reward', {reward: ref('item', reward)});
    }

    collectNote() {
        const pool = Object.keys(DungeonApp.resources.adventurerNotes).filter(i => !this.state.notes.includes(i));
        if (!pool.length)
            return;
        const i = pick(pool);
        this.state.notes.push(i);
        this.log('log.note', {note: ref('note', i)});
    }

    renderNotes() {
        const nt = el('notes');
        nt.innerHTML = `<h2>${esc(t("notes.title", {
            count: this.state.notes.length,
            total: DungeonApp.resources.noteData.length
        }))}</h2>`;
        if (!this.state.notes.length) {
            const p = document.createElement('p');
            p.textContent = t('notes.empty');
            nt.append(p);
        }
        for (const i of this.state.notes) {
            const body = DungeonApp.resources.adventurerNotes[i].text, d = document.createElement('details'),
                summary = document.createElement('summary'), p = document.createElement('p');
            summary.textContent = DungeonApp.resources.adventurerNotes[i].title;
            p.textContent = body;
            d.open = this.expandedNotes.has(i);
            d.ontoggle = () => {
                if (d.open)
                    this.expandedNotes.add(i);
                else
                    this.expandedNotes.delete(i);
            };
            d.append(summary, p);
            nt.append(d);
        }
    }

    closeChoices() {
        const d = el('choices');
        if (d.open)
            d.close();
        this.restoreChoices();
    }

    restoreChoices() {
        for (const [b, disabled] of this.modalButtons)
            b.disabled = disabled;
        this.modalButtons = [];
    }

    showChoices(title, ra, build) {
        const d = el('choices');
        if (d.open)
            return;
        this.modalButtons = [...ra.querySelectorAll('button')].filter(b => b.dataset.choice === 'true').map(b => [b, b.disabled]);
        for (const [b] of this.modalButtons)
            b.disabled = true;
        el('choiceTitle').textContent = title;
        const panel = el('choiceOptions');
        panel.replaceChildren();
        build(panel);
        d.showModal();
    }

    render() {
        document.body.classList.toggle('doomsday', !!this.state.doom);
        el('doomsdayBanner').hidden = !this.state.doom;
        syncThemeColor();
        el('doomsday').disabled = this.state.doom;
        let alive = this.state.grid.filter(Boolean).length;
        el('status').textContent = t('status', {
            discovered: Object.values(this.state.rooms).filter(r => r.seen).length,
            remaining: alive,
            doom: t(this.state.doom ? "doom" : "doom.inactive"),
            doors: t(this.state.open ? "door.openStatus" : "door.allClosed")
        });
        let map = el('map');
        map.replaceChildren();
        this.state.grid.forEach((id, i) => {
            let b = btn('', () => {
                this.selected = id || 'void:' + i;
                this.render();
            });
            let r = id ? this.room(id) : null;
            let type = !r ? 'void' : roomTypes[DungeonApp.resources.roomData[r.content].type][0];
            b.className = 'tile ' + type + (r && !r.seen ? ' muted' : '') + ((id || 'void:' + i) === this.selected ? ' selected' : '');
            b.setAttribute('aria-label', id ? this.name(id) : t('room.collapsed'));
            if (r) {
                let icon = roomTypes[DungeonApp.resources.roomData[r.content].type][1];
                if (icon) {
                    let span = document.createElement('span');
                    span.className = 'roomicon';
                    span.append(mapIcon(icon));
                    b.append(span);
                }
                for (let d = 0; d < 4; d++) {
                    let n = this.adjacent(id, d);
                    if (!n)
                        continue;
                    let f = this.effective(id, d, n), mark = document.createElement('span');
                    mark.className = 'doorface side' + d + ' ' + (f.l && f.t ? 'both' : f.l ? 'locked' : f.t ? 'trapped' : 'clear');
                    b.append(mark);
                }
                let players = document.createElement('span');
                players.className = 'players';
                for (let p of this.state.players.filter(p => p.room === id && p.alive)) {
                    let x = document.createElement('span');
                    x.append(mapIcon('player'));
                    x.title = p.name;
                    players.append(x);
                }
                b.append(players);
            }
            map.append(b);
        });
        this.renderShift(map);
        if (!this.state.grid.includes(this.selected) && !String(this.selected).startsWith('void:'))
            this.selected = 'E';
        if (String(this.selected).startsWith('void:')) {
            el('detail').innerHTML = `<h2>${esc(t("room.collapsed"))}</h2>${["collapse", "shift", "teleport", "respawn"].map(k => `<button disabled>${esc(t("action." + k))}</button>`).join("")}`;
        } else {
            let a = this.selected, r = this.room(a), dt = el('detail');
            dt.innerHTML = `<h2>${esc(this.name(a))}</h2><small>${esc(t("room.status", {
                id: a,
                state: t(r.seen ? "room.discovered" : "room.undiscovered")
            }))}</small><p class="description">${esc(DungeonApp.resources.roomData[r.illusionId ?? r.content].appearance)}</p>${DungeonApp.resources.roomData[r.content].description ? `<div class="dm-info">${renderMarkdown(DungeonApp.resources.roomData[r.content].description)}</div>` : ''}<div id="roomactions"></div><div id="doors"></div>`;
            let ra = el('roomactions');
            let pos = this.state.grid.indexOf(a),
                options = this.legal(this.state.open ? [this.state.open.a, this.state.open.b] : []).filter(x => (x.axis === 'row' && x.index === Math.floor(pos / 5)) || (x.axis === 'column' && x.index === pos % 5));
            let g = this.state.grid.map(x => x === a ? null : x);
            ra.append(btn(t('action.collapse'), () => {
                if (confirm(t('confirm.collapse', {room: this.name(a)})))
                    this.act(() => {
                        this.state.grid = g;
                        this.selected = 'void:' + pos;
                        this.log('log.manualCollapse', {room: this.roomRef(a)});
                    });
            }, a === 'E' || a === this.state.treasure || this.occupied(a) || !connected(g) || !!this.state.open));
            ra.append(choiceButton(t('action.shift'), () => {
                this.showChoices(t('action.shiftRoom'), ra, panel => {
                    for (let dir of ['north', 'south', 'west', 'east']) {
                        let x = options.find(o => o.direction === dir);
                        panel.append(btn(t("direction." + dir), () => {
                            this.closeChoices();
                            this.act(() => {
                                this.applyShift(x);
                                this.log('log.manualShift', {
                                    shift: {
                                        shift: {
                                            axis: x.axis,
                                            index: x.index,
                                            step: x.step
                                        }
                                    }
                                });
                            });
                        }, !x));
                    }
                });
            }, !options.length));
            let candidates = this.state.players.map((p, i) => ({p, i})).filter(x => x.p.room !== a);
            ra.append(choiceButton(t('action.teleport'), () => {
                this.showChoices(t('action.teleportPlayer'), ra, panel => {
                    for (let {p, i} of candidates)
                        panel.append(btn(p.name, () => {
                            this.closeChoices();
                            this.act(() => {
                                this.state.players[i].room = a;
                                if (a === this.state.treasure && this.state.players[i].alive)
                                    this.state.treasureEntered = true;
                                this.log('log.teleport', {player: p.name, room: this.roomRef(a)});
                                this.doom();
                            });
                        }));
                });
            }, !r.seen || !candidates.length || !!this.state.open));
            ra.append(btn(t('action.respawn'), () => this.respawn(a), !r.seen || !!this.state.open || !this.state.players.some(p => !p.alive)));
            ra.append(btn(t('action.discover'), () => this.act(() => {
                r.seen = true;
                this.doom();
            }), r.seen), btn(r.anchor ? t('action.removeAnchor') : t('action.anchor'), () => this.act(() => {
                r.anchor = !r.anchor;
            })));
            if (['puzzle', 'easy_trap', 'easy_fight'].includes(DungeonApp.resources.roomData[r.content].type))
                ra.append(btn(t('action.chest'), () => this.act(() => {
                    this.collectChest(r);
                }), r.chest));
            if (DungeonApp.resources.roomData[r.content].type === 'puzzle')
                ra.append(btn(t('action.puzzle'), () => this.act(() => {
                    r.solved = true;
                }), r.solved));
            if (DungeonApp.resources.roomData[r.content].type === 'boss_fight')
                ra.append(btn(t('action.boss'), () => this.act(() => {
                    this.collectBoss(r);
                }), r.boss));
            for (let d = 0; d < 4; d++) {
                let b = this.adjacent(a, d), div = document.createElement('div');
                div.className = 'door';
                if (!b) {
                    div.textContent = t('door.collapsed', {direction: t("direction." + dirs[d])});
                    el('doors').append(div);
                    continue;
                }
                let f = this.effective(a, d, b);
                div.textContent = t('door.status', {
                    direction: t("direction." + dirs[d]),
                    room: this.name(b),
                    look: DungeonApp.resources.doorCatalog[f.look].name,
                    lock: t(f.l ? "door.locked" : "door.unlocked"),
                    trap: t(f.t ? "door.trapped" : "door.clear")
                });
                let description = document.createElement('p');
                description.className = 'description';
                let trap = f.t ? DungeonApp.resources.trapCatalog[f.trap] : null;
                description.textContent = DungeonApp.resources.doorCatalog[f.look].appearance;
                div.append(description);
                if (trap) {
                    div.append(dmInfo(`**${trap.name}**\n\n${trap.description}`));
                }
                div.append(btn(t('action.unlock'), () => this.act(() => {
                    this.change(a, d, b, 'l');
                    this.log('log.lock');
                }), !f.l || !!this.state.open), btn(t('action.disarm'), () => this.act(() => {
                    this.change(a, d, b, 't');
                    this.log('log.trap', {trap: ref('trap', f.trap)});
                }), !f.t || !!(this.state.open && !((this.state.open.a === a && this.state.open.b === b) || (this.state.open.a === b && this.state.open.b === a)))), btn(t('action.open'), () => this.openDoor(a, d, b), f.l || !!this.state.open));
                el('doors').append(div);
            }
        }
        let p = el('party');
        p.innerHTML = `<div class=party-heading><h2>${esc(t("party.title"))}</h2><div class=party-actions></div></div>`;
        let pa = p.querySelector('.party-actions');
        pa.append(btn(t('action.addPlayer'), () => {
            let n = prompt(t('prompt.name'));
            if (n)
                this.act(() => this.state.players.push({name: n, room: 'E', alive: true}));
        }));
        pa.append(btn(t('action.clearPlayers'), () => {
            if (confirm(t('confirm.clearPlayers')))
                this.act(() => {
                    this.state.players = [];
                    this.log('log.playersCleared');
                });
        }, !this.state.players.length || !!this.state.open));
        if (this.state.open) {
            let line = document.createElement('div');
            line.className = 'open-door-status';
            line.append(document.createTextNode(t('door.openPair', {
                from: this.name(this.state.open.a),
                to: this.name(this.state.open.b)
            })), btn(t('action.close'), this.closeDoor.bind(this)));
            p.append(line);
        }
        this.state.players.forEach((x, i) => {
            let div = document.createElement('div');
            div.className = 'party-player';
            let info = document.createElement('span');
            info.textContent = t('player.status', {
                player: x.name,
                room: this.name(x.room),
                state: t(x.alive ? "player.alive" : "player.dead")
            });
            div.append(info);
            div.append(btn(t('action.cross'), () => this.cross(i), !this.canCross(x)), btn(x.alive ? t('action.dead') : t('action.revive'), () => this.act(() => {
                x.alive = !x.alive;
                if (x.alive && !this.state.grid.includes(x.room))
                    x.room = 'E';
            })));
            p.append(div);
        });
        this.renderInventory();
        this.renderNotes();
        el('log').innerHTML = this.state.log.map(x => `<div>${esc(eventText(x))}</div>`).join('');
        el('undo').disabled = !this.previous;
    }
}

async function loadResources() {
    setupThemeSwitcher();
    DungeonApp.resources.messages = await loadMessages();
    DungeonApp.resources.icons = await loadIcons();
    showReleaseVersion();
    document.documentElement.lang = t('app.language');
    document.title = t('app.title');
    document.querySelector('meta[name="apple-mobile-web-app-title"]').content = t('app.title');
    for (const element of document.querySelectorAll('[data-i18n]'))
        element.textContent = t(element.dataset.i18n);
    [DungeonApp.resources.roomList, DungeonApp.resources.doorData, DungeonApp.resources.trapData, DungeonApp.resources.itemData, DungeonApp.resources.noteData] = await Promise.all(['rooms', 'doors', 'traps', 'items', 'notes'].map(load));
    DungeonApp.resources.roomData = Object.fromEntries(DungeonApp.resources.roomList.map(x => [x.id, x]));
    DungeonApp.resources.entrance = DungeonApp.resources.roomList.filter(x => x.type === 'entrance');
    DungeonApp.resources.treasureRooms = DungeonApp.resources.roomList.filter(x => x.type === 'treasure');
    DungeonApp.resources.roomPools = Object.fromEntries(Object.keys(roomQuotas).map(category => [category, DungeonApp.resources.roomList.filter(x => roomTypes[x.type]?.[0] === category).map(x => x.id)]));
    for (const [category, count] of Object.entries(roomQuotas))
        if (DungeonApp.resources.roomPools[category].length < count)
            throw Error(`Not enough ${category} rooms: need ${count}, found ${DungeonApp.resources.roomPools[category].length}`);
    if (!unique([...DungeonApp.resources.roomList, ...DungeonApp.resources.doorData, ...DungeonApp.resources.trapData, ...DungeonApp.resources.itemData, ...DungeonApp.resources.noteData], 'id') || DungeonApp.resources.roomList.some(x => !Object.hasOwn(roomTypes, x.type) || (x.type !== 'illusion' && !x.appearance)) || DungeonApp.resources.entrance.length < 1 || DungeonApp.resources.treasureRooms.length < 1 || !DungeonApp.resources.doorData.length || !DungeonApp.resources.trapData.length || DungeonApp.resources.itemData.some(x => !['key', 'boss_reward', 'challenge_reward'].includes(x.type)) || !DungeonApp.resources.itemData.some(x => x.type === 'key') || !DungeonApp.resources.itemData.some(x => x.type === 'boss_reward') || DungeonApp.resources.noteData.some(x => !x.text))
        throw Error('Invalid content data');
    DungeonApp.resources.looks = DungeonApp.resources.doorData.map(x => x.id);
    DungeonApp.resources.lookDescriptions = DungeonApp.resources.doorData.map(x => x.appearance);
    DungeonApp.resources.traps = DungeonApp.resources.trapData.map(x => x.id);
    DungeonApp.resources.items = DungeonApp.resources.itemData.filter(x => x.type === 'challenge_reward').map(x => x.id);
    DungeonApp.resources.keyItems = DungeonApp.resources.itemData.filter(x => x.type === 'key').map(x => x.id);
    DungeonApp.resources.bossRewards = DungeonApp.resources.itemData.filter(x => x.type === 'boss_reward').map(x => x.id);
    DungeonApp.resources.adventurerNotes = Object.fromEntries(DungeonApp.resources.noteData.map(x => [x.id, x]));
    DungeonApp.resources.doorCatalog = Object.fromEntries(DungeonApp.resources.doorData.map(x => [x.id, x]));
    DungeonApp.resources.trapCatalog = Object.fromEntries(DungeonApp.resources.trapData.map(x => [x.id, x]));
    DungeonApp.resources.itemCatalog = Object.fromEntries(DungeonApp.resources.itemData.map(x => [x.id, x]));
    DungeonApp.resources.catalogs = {
        room: DungeonApp.resources.roomData,
        door: DungeonApp.resources.doorCatalog,
        trap: DungeonApp.resources.trapCatalog,
        item: DungeonApp.resources.itemCatalog,
        note: DungeonApp.resources.adventurerNotes
    };
}

async function start() {
    await loadResources();
    window.app = new DungeonApp();
    window.app.initialize();
}

start().catch(e => {
    document.getElementById('status').textContent = DungeonApp.resources.messages ? t('error.startFailed') : 'Failed to load dungeon content';
    alert(t('error.start', {error: e.message}));
    console.error(e);
});