<script setup>
import { computed } from 'vue';
import { t, DungeonApp } from '../dungeon.js';
import { renderMarkdown } from '../presentation.js';
const {app}=defineProps(['app']);
const counts=computed(()=>{const m=new Map(); for(const id of app.state.collected)m.set(id,(m.get(id)||0)+1);return [...m];});
const items=DungeonApp.resources.itemCatalog;
function toggle(id,e){if(e.target.open)app.expandedItems.add(id);else app.expandedItems.delete(id);}
</script>
<template><section id="inventory"><h2>{{t('inventory.title')}}</h2><p v-if="!counts.length">{{t('inventory.empty')}}</p><details v-for="[id,count] in counts" :key="id" :open="app.expandedItems.has(id)" @toggle="toggle(id,$event)"><summary>{{items[id].name+(count>1?t('inventory.quantity',{count}):'')}}</summary><p class="description">{{items[id].appearance || t('unknown')}}</p><div class="dm-info" v-html="renderMarkdown(items[id].description)"></div></details></section></template>
