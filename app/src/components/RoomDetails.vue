<script setup>
import {computed, ref, nextTick} from 'vue';
import {t, dirs, DungeonApp} from '../dungeon.js';
import {renderMarkdown} from '../presentation.js';
import DoorControls from "./DoorControls.vue";

const {app} = defineProps(['app']);
const a = computed(() => app.selected), r = computed(() => app.state.grid.includes(a.value) ? app.room(a.value) : null);
const resources = DungeonApp.resources;
const content = computed(() => r.value && resources.roomData[r.value.content]);
const options = computed(() => r.value ? app.shiftOptions(a.value) : []);
const candidates = computed(() => r.value ? app.teleportCandidates(a.value) : []);
const dialog = ref(null), mode = ref('shift');

function choose(m) {
  mode.value = m;
  nextTick(() => dialog.value.showModal());
}

function finish(fn) {
  dialog.value.close();
  fn();
}

function collapse() {
  if (confirm(t('confirm.collapse', {room: app.name(a.value)}))) app.manualCollapse(a.value);
}
</script>
<template>
  <section id="detail">
    <template v-if="!r"><h2>{{ t('room.collapsed') }}</h2>
      <button v-for="k in ['collapse','shift','teleport','respawn']" :key="k" disabled>{{ t('action.' + k) }}</button>
    </template>
    <template v-else>
      <h2>{{ app.name(a) }}</h2><small>{{
        t('room.status', {
          id: a,
          state: t(r.seen ? 'room.discovered' : 'room.undiscovered')
        })
      }}</small>
      <p class="description">{{ resources.roomData[r.illusionId ?? r.content].appearance }}</p>
      <div v-if="content.description" class="dm-info" v-html="renderMarkdown(content.description)"></div>
      <div id="roomactions">
        <button :disabled="!app.canCollapse(a)" @click="collapse">{{ t('action.collapse') }}</button>
        <button :disabled="!options.length" @click="choose('shift')">{{ t('action.shift') }}</button>
        <button :disabled="!r.seen || !candidates.length || !!app.state.open" @click="choose('teleport')">
          {{ t('action.teleport') }}
        </button>
        <button :disabled="!r.seen || !!app.state.open || !app.state.players.some(p=>!p.alive)" @click="app.respawn(a)">
          {{ t('action.respawn') }}
        </button>
        <button :disabled="r.seen" @click="app.discover(a)">{{ t('action.discover') }}</button>
        <button @click="app.toggleAnchor(a)">{{ t(r.anchor ? 'action.removeAnchor' : 'action.anchor') }}</button>
        <button v-if="['puzzle','easy_trap','easy_fight'].includes(content.type)" :disabled="r.chest"
                @click="app.chest(a)">{{ t('action.chest') }}
        </button>
        <button v-if="content.type==='puzzle'" :disabled="r.solved" @click="app.solve(a)">{{ t('action.puzzle') }}
        </button>
        <button v-if="content.type==='boss_fight'" :disabled="r.boss" @click="app.boss(a)">{{ t('action.boss') }}
        </button>
      </div>
      <div id="doors">
        <DoorControls v-for="d in [0,1,2,3]" :key="d" :app="app" :a="a" :d="d"/>
      </div>
    </template>
    <dialog id="choices" ref="dialog" aria-labelledby="choiceTitle"><h2 id="choiceTitle">
      {{ t(mode === 'shift' ? 'action.shiftRoom' : 'action.teleportPlayer') }}</h2>
      <div id="choiceOptions">
        <template v-if="mode==='shift'">
          <button v-for="dir in ['north','south','west','east']" :key="dir"
                  :disabled="!options.some(o=>o.direction===dir)" @click="finish(()=>app.manualShift(a,dir))">
            {{ t('direction.' + dir) }}
          </button>
        </template>
        <template v-else>
          <button v-for="{p,i} in candidates" :key="i" @click="finish(()=>app.teleport(a,i))">{{ p.name }}</button>
        </template>
      </div>
      <button id="cancelChoice" @click="dialog.close()">{{ t('action.cancel') }}</button>
    </dialog>
  </section>
</template>
