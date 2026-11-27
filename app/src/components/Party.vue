<script setup>
import {t} from '../dungeon.js';

const {app} = defineProps(['app']);

function add() {
  app.addPlayer(prompt(t('prompt.name')));
}

function clear() {
  if (confirm(t('confirm.clearPlayers'))) app.clearPlayers();
}
</script>
<template>
  <section id="party">
    <div class="party-heading"><h2>{{ t('party.title') }}</h2>
      <div class="party-actions">
        <button @click="add">{{ t('action.addPlayer') }}</button>
        <button :disabled="!app.state.players.length || !!app.state.open" @click="clear">
          {{ t('action.clearPlayers') }}
        </button>
      </div>
    </div>
    <div v-if="app.state.open" class="open-door-status">{{
        t('door.openPair', {
          from: app.name(app.state.open.a),
          to: app.name(app.state.open.b)
        })
      }}
      <button @click="app.closeDoor()">{{ t('action.close') }}</button>
    </div>
    <div v-for="(p,i) in app.state.players" :key="i" class="party-player"><span>{{
        t('player.status', {
          player: p.name,
          room: app.name(p.room),
          state: t(p.alive ? 'player.alive' : 'player.dead')
        })
      }}</span>
      <button :disabled="!app.canCross(p)" @click="app.cross(i)">{{ t('action.cross') }}</button>
      <button @click="app.togglePlayer(i)">{{ t(p.alive ? 'action.dead' : 'action.revive') }}</button>
    </div>
  </section>
</template>
