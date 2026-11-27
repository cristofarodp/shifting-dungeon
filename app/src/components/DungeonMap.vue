<script setup>
import {ref, watchPostEffect} from 'vue';
import {t, roomTypes, DungeonApp} from '../dungeon.js';
import {icon} from '../presentation.js';

const {app} = defineProps(['app']);
const map = ref(null), mark = ref(null);
const resources = DungeonApp.resources;

function type(id) {
  return id ? roomTypes[resources.roomData[app.room(id).content].type] : ['void', null];
}

function face(id, d) {
  const n = app.adjacent(id, d);
  return n ? app.effective(id, d, n) : null;
}

function faceClass(f) {
  return f.l && f.t ? 'both' : f.l ? 'locked' : f.t ? 'trapped' : 'clear';
}

watchPostEffect(onCleanup => {
  const x = app.state.lastShift, m = map.value, h = mark.value;
  if (!x || !m || !h) return;
  const tiles = m.querySelectorAll('.tile');
  const a = tiles[x.axis === 'row' ? x.index * 5 : x.index],
      b = tiles[x.axis === 'row' ? x.index * 5 + 4 : x.index + 20];
  if (!a || !b) return;
  const position = () => {
    const r = m.getBoundingClientRect(), f = a.getBoundingClientRect(), l = b.getBoundingClientRect();
    Object.assign(h.style, {
      left: `${f.left - r.left - 2}px`,
      top: `${f.top - r.top - 2}px`,
      width: `${l.right - f.left + 4}px`,
      height: `${l.bottom - f.top + 4}px`
    });
  };
  position();
  const observer = new ResizeObserver(position);
  [m, a, b].forEach(e => observer.observe(e));
  onCleanup(() => observer.disconnect());
});
</script>
<template>
  <div id="map" ref="map">
    <button v-for="(id,i) in app.state.grid" :key="i" class="tile"
            :class="[type(id)[0], {muted:id && !app.room(id).seen, selected:(id || 'void:'+i) === app.selected}]"
            :aria-label="id ? app.name(id) : t('room.collapsed')" @click="app.selectRoom(id || 'void:'+i)">
      <template v-if="id">
        <span v-if="type(id)[1]" class="roomicon" v-html="icon(type(id)[1])"></span>
        <template v-for="d in [0,1,2,3]" :key="d"><span v-if="face(id,d)" class="doorface"
                                                        :class="['side'+d,faceClass(face(id,d))]"></span></template>
        <span class="players"><span v-for="(p,j) in app.state.players.filter(p=>p.room===id && p.alive)" :key="j"
                                    :title="p.name" v-html="icon('player')"></span></span>
      </template>
    </button>
    <span v-if="app.state.lastShift" ref="mark" class="shift-highlight"
          :class="[app.state.lastShift.axis, app.state.lastShift.step===1?'forward':'backward']"
          aria-hidden="true"></span>
  </div>
</template>
