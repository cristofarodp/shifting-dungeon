<script setup>
import {ref, watchEffect} from 'vue';
import {t, eventText} from './dungeon.js';
import DungeonMap from './components/DungeonMap.vue';
import RoomDetails from './components/RoomDetails.vue';
import Party from './components/Party.vue';
import Inventory from './components/Inventory.vue';
import Notes from './components/Notes.vue';

const {app, release} = defineProps(['app', 'release']);
const file = ref(null);

function reset() {
  if (confirm(t('confirm.new'))) app.newDungeon();
}

function exportSave() {
  const u = URL.createObjectURL(new Blob([JSON.stringify(app.state, null, 2)], {type: 'application/json'}));
  const a = document.createElement('a');
  a.href = u;
  a.download = 'dungeon-save.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}

async function importSave(e) {
  try {
    const f = e.target.files[0];
    if (f) app.importState(JSON.parse(await f.text()));
  } catch (err) {
    alert(t('error.import', {error: err.message}));
  } finally {
    e.target.value = '';
  }
}

watchEffect(() => {
  document.body.classList.toggle('doomsday', !!app.state.doom);
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.content = getComputedStyle(document.body).getPropertyValue('--browser-theme').trim();
  }
});
</script>
<template>
  <h1>{{ t('app.title') }}</h1>
  <div class="toolbar">
    <button id="new" @click="reset">{{ t('action.new') }}</button>
    <button id="export" @click="exportSave">{{ t('action.export') }}</button>
    <button id="import" @click="file.click()">{{ t('action.import') }}</button>
    <input id="file" ref="file" type="file" accept="application/json" hidden @change="importSave">
    <button id="undo" :disabled="!app.previous" @click="app.undo()">{{ t('action.undo') }}</button>
    <button id="doomsday" :disabled="app.state.doom" @click="app.manualDoom()">{{ t('action.doom') }}</button>
    <a class="download-guide" href="assets/DM-Guide.pdf" target="_blank" rel="noopener">{{ t('action.guide') }}</a>
  </div>
  <div id="status">{{
      t('status', {
        discovered: Object.values(app.state.rooms).filter(r => r.seen).length,
        remaining: app.state.grid.filter(Boolean).length,
        doom: t(app.state.doom ? 'doom' : 'doom.inactive'),
        doors: t(app.state.open ? 'door.openStatus' : 'door.allClosed')
      })
    }}
  </div>
  <section>
    <div id="doomsdayBanner" role="status" :hidden="!app.state.doom">{{ t('doom') }}</div>
    <DungeonMap :app="app"/>
  </section>
  <RoomDetails :app="app"/>
  <Party :app="app"/>
  <Inventory :app="app"/>
  <Notes :app="app"/>
  <section><h2>{{ t('history.title') }}</h2>
    <div id="log">
      <div v-for="(event,i) in app.state.log" :key="i">{{ eventText(event) }}</div>
    </div>
  </section>
  <footer><small>{{ t('app.title') }}<span id="releaseVersion">{{ release }}</span> · <a
      href="https://github.com/cristofarodp/shifting-dungeon" target="_blank"
      rel="noopener">{{ t('app.source') }}</a></small></footer>
</template>
