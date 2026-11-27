import markdownit from 'markdown-it';
import { DungeonApp } from './dungeon.js';
const markdown = (() => {
    const md = markdownit({html: false, linkify: false});
    md.disable(['image', 'link', 'autolink']);
    md.renderer.rules.table_open = () => '<div class="dm-table"><table>\n';
    md.renderer.rules.table_close = () => '</table></div>\n';
    return md;
})();

export const renderMarkdown = value => markdown.render(String(value ?? ''));
export const icon = kind => DungeonApp.resources.icons.get(kind)?.outerHTML ?? '';
