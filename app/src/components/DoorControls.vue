<script setup>
import {computed} from 'vue';
import {t, dirs, DungeonApp} from '../dungeon.js';
import {renderMarkdown} from '../presentation.js';

const props = defineProps(['app', 'a', 'd']);
const app = props.app, b = computed(() => app.adjacent(props.a, props.d));
const f = computed(() => b.value ? app.effective(props.a, props.d, b.value) : null);
const resources = DungeonApp.resources;
const look = computed(() => f.value && resources.doorCatalog[f.value.look]);
const trap = computed(() => f.value?.t ? resources.trapCatalog[f.value.trap] : null);
const disarmDisabled = computed(() => !f.value?.t || !!(app.state.open && !((app.state.open.a === props.a && app.state.open.b === b.value) || (app.state.open.b === props.a && app.state.open.a === b.value))));
</script>
<template>
  <div class="door">
    <template v-if="!b">{{ t('door.collapsed', {direction: t('direction.' + dirs[d])}) }}</template>
    <template v-else>{{
        t('door.status', {
          direction: t('direction.' + dirs[d]),
          room: app.name(b),
          look: look.name,
          lock: t(f.l ? 'door.locked' : 'door.unlocked'),
          trap: t(f.t ? 'door.trapped' : 'door.clear')
        })
      }}
      <p class="description">{{ look.appearance }}</p>
      <div v-if="trap" class="dm-info" v-html="renderMarkdown('**'+trap.name+'**\n\n'+trap.description)"></div>
      <button :disabled="!f.l || !!app.state.open" @click="app.unlock(a,d,b)">{{ t('action.unlock') }}</button>
      <button :disabled="disarmDisabled" @click="app.disarm(a,d,b)">{{ t('action.disarm') }}</button>
      <button :disabled="f.l || !!app.state.open" @click="app.openDoor(a,d,b)">{{ t('action.open') }}</button>
    </template>
  </div>
</template>
