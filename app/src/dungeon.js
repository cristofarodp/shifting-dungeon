
'use strict';

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

class DungeonApp {
    static resources = {};

    state = null;
    previous = null;
    selected = 'E';
    expandedItems = new Set();
    expandedNotes = new Set();

    initialize() {
        this.loadState();
    }

    validateSave(state) {
        return validateSave(state);
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
        if (!this.state.grid.includes(this.selected) && !String(this.selected).startsWith('void:')) this.selected = 'E';
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

    newDungeon() {
        this.previous = clone(this.state);
        const players = this.state.players.map(p => ({...p, room: 'E', alive: true}));
        this.state = fresh();
        this.expandedNotes.clear();
        this.state.players = players;
        this.selected = 'E';
        this.save();
    }
    undo() {
        if (!this.previous) return;
        this.state = this.previous;
        this.previous = null;
        this.save();
    }
    importState(value) {
        const next = this.validateSave(value);
        this.previous = clone(this.state);
        this.state = next;
        this.selected = 'E';
        this.save();
    }
    manualDoom() {
        if (!this.state.doom) this.act(() => { this.state.doom = true; this.log('log.manualDoom'); });
    }
    selectRoom(id) { this.selected = id; }
    collapseGrid(id) { return this.state.grid.map(x => x === id ? null : x); }
    canCollapse(id) { return id !== 'E' && id !== this.state.treasure && !this.occupied(id) && !this.state.open && connected(this.collapseGrid(id)); }
    manualCollapse(id) {
        if (!this.canCollapse(id)) return;
        const pos = this.state.grid.indexOf(id);
        this.act(() => { this.state.grid = this.collapseGrid(id); this.selected = 'void:' + pos; this.log('log.manualCollapse', {room: this.roomRef(id)}); });
    }
    shiftOptions(id) {
        const pos = this.state.grid.indexOf(id);
        return this.legal(this.state.open ? [this.state.open.a, this.state.open.b] : []).filter(x => (x.axis === 'row' && x.index === Math.floor(pos / 5)) || (x.axis === 'column' && x.index === pos % 5));
    }
    manualShift(id, direction) {
        const x = this.shiftOptions(id).find(o => o.direction === direction);
        if (!x) return;
        this.act(() => { this.applyShift(x); this.log('log.manualShift', {shift: {shift: {axis: x.axis, index: x.index, step: x.step}}}); });
    }
    teleportCandidates(id) { return this.state.players.map((p,i) => ({p,i})).filter(x => x.p.room !== id); }
    teleport(id, i) {
        if (!this.room(id).seen || this.state.open || !this.teleportCandidates(id).some(x => x.i === i)) return;
        this.act(() => { const p = this.state.players[i]; p.room = id; if (id === this.state.treasure && p.alive) this.state.treasureEntered = true; this.log('log.teleport', {player: p.name, room: this.roomRef(id)}); this.doom(); });
    }
    discover(id) { this.act(() => { this.room(id).seen = true; this.doom(); }); }
    toggleAnchor(id) { this.act(() => { const r = this.room(id); r.anchor = !r.anchor; }); }
    chest(id) { this.act(() => this.collectChest(this.room(id))); }
    solve(id) { this.act(() => { this.room(id).solved = true; }); }
    boss(id) { this.act(() => this.collectBoss(this.room(id))); }
    unlock(a,d,b) { this.act(() => { this.change(a,d,b,'l'); this.log('log.lock'); }); }
    disarm(a,d,b) { this.act(() => { const f = this.effective(a,d,b); this.change(a,d,b,'t'); this.log('log.trap', {trap: ref('trap', f.trap)}); }); }
    addPlayer(name) { if (name) this.act(() => this.state.players.push({name, room:'E', alive:true})); }
    clearPlayers() { this.act(() => { this.state.players = []; this.log('log.playersCleared'); }); }
    togglePlayer(i) { this.act(() => { const p = this.state.players[i]; p.alive = !p.alive; if (p.alive && !this.state.grid.includes(p.room)) p.room = 'E'; }); }

}

export { DungeonApp, t, eventText, roomTypes, dirs, fresh, connected, roomQuotas };
