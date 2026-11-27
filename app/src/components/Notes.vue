<script setup>
import { t, DungeonApp } from '../dungeon.js';
const {app}=defineProps(['app']);
const resources=DungeonApp.resources;
function toggle(id,e){if(e.target.open)app.expandedNotes.add(id);else app.expandedNotes.delete(id);}
</script>
<template><section id="notes"><h2>{{t('notes.title',{count:app.state.notes.length,total:resources.noteData.length})}}</h2><p v-if="!app.state.notes.length">{{t('notes.empty')}}</p><details v-for="id in app.state.notes" :key="id" :open="app.expandedNotes.has(id)" @toggle="toggle(id,$event)"><summary>{{resources.adventurerNotes[id].title}}</summary><p>{{resources.adventurerNotes[id].text}}</p></details></section></template>
