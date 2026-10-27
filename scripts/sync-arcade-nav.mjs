// Regenerate the small game-to-game band from the same catalogue as rankings.
import {readFile,writeFile} from 'node:fs/promises';
import {GAMES,GAME_ICONS,ARCADE_COUNT} from '../public/assets/ncn-arcade/catalog.js';
const icon=id=>'<svg class="ncn-arcade-icon" viewBox="0 0 24 24" aria-hidden="true">'+GAME_ICONS[id]+'</svg>';
for(const path of ['/arcade/',...Object.values(GAMES).map(game=>game.path)]){
 const file='public'+path+'index.html',source=await readFile(file,'utf8');
 const links=Object.entries(GAMES).map(([id,game])=>'<a href="'+game.path+'"'+(path===game.path?' aria-current="page"':'')+'>'+icon(id)+game.name+'</a>').join('');
 const nav='<nav class="ncn-arcade-nav" aria-label="NCN Arcade · '+ARCADE_COUNT+' game"><a class="ncn-arcade-brand" href="/arcade/">NCN ARCADE<span>'+ARCADE_COUNT+' GAME · 1 HỒ SƠ</span></a><div class="ncn-arcade-links">'+links+'</div><a class="ncn-arcade-brand" href="#ncn-scoreboard" aria-label="Xem bảng điểm"><svg class="ncn-arcade-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v6a5 5 0 0 1-10 0Zm0 2H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4m-4 2v7m-5 0h10"/></svg></a></nav>';
 if(!/<nav class="ncn-arcade-nav"/.test(source))throw Error('Missing Arcade band in '+file);
 await writeFile(file,source.replace(/<nav class="ncn-arcade-nav"[\s\S]*?<\/nav>/,nav));
}
console.log('Arcade navigation synchronized: '+ARCADE_COUNT+' games.');
