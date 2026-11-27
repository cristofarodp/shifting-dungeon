import * as jsyaml from 'js-yaml';
import { DungeonApp, roomTypes, roomQuotas } from './dungeon.js';
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

async function loadResources() {
    DungeonApp.resources.messages = await loadMessages();
    DungeonApp.resources.icons = await loadIcons();
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



export { loadResources };
