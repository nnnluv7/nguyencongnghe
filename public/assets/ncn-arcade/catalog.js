export const GAMES=Object.freeze({
 snake:{name:'Rắn Lướt',path:'/ran-luot/',icon:'〰',modes:{arena:'Tự do',daily:'Hôm nay'}},
 flight:{name:'Flappy Bird',path:'/flappy-bird/',icon:'↗',modes:{normal:'Căng thật',easy:'Khởi động',hard:'Thần sầu',daily:'Hôm nay'}},
 pikachu:{name:'Pikachu',path:'/pikachu/',icon:'✦',modes:{classic:'Cổ điển',relax:'Thư giãn',daily:'Hôm nay'}},
 ocean:{name:'Cá lớn nuốt cá bé',path:'/ca-lon-nuot-ca-be/',icon:'◈',modes:{classic:'Đại dương'}},
 blocks:{name:'Khối Sắc 3D',path:'/xep-hinh/',icon:'▧',modes:{classic:'100 màn'}},
 gold:{name:'Đào vàng',path:'/dao-vang/',icon:'⛏',modes:{classic:'Cổ điển',daily:'Hôm nay'}},
 bubble:{name:'Bắn Bóng',path:'/ban-bong/',icon:'◉',modes:{journey:'Hành trình',relax:'Thư giãn',daily:'Hôm nay'}}
});
export const ARCADE_COUNT=Object.keys(GAMES).length;
export const AVATARS=['🐱','🐶','🐼','🦊','🐸','🐯','🐧','🐰'];
export function vietnamDate(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function gameBoard(game,mode,date=vietnamDate()){
 if(!Object.hasOwn(GAMES,game)||!Object.hasOwn(GAMES[game].modes,mode))return null;
 if(mode!=='daily')return mode;
 if(!/^20\d\d-\d\d-\d\d$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return null;
 return 'daily-'+date;
}

export const GAME_ICONS={"snake":"<path d=\"M4 16c-5-9 12-16 15-7s-10 11-10 5 7-8 7-3-5 5-5 2\"/>","flight":"<path d=\"m3 13 7 1 5 7 1-9 5-7-9 2-5-5 1 8Z\"/>","pikachu":"<path d=\"m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z\"/>","ocean":"<ellipse cx=\"14\" cy=\"12\" rx=\"7\" ry=\"6\"/><path d=\"m7 12-6-5v10Zm10-2h.01M11 6l3-3 2 3\"/>","bubble":"<circle cx=\"8\" cy=\"8\" r=\"4\"/><circle cx=\"17\" cy=\"9\" r=\"3\"/><circle cx=\"13\" cy=\"17\" r=\"4\"/>","blocks":"<path d=\"m12 2 9 5v10l-9 5-9-5V7Zm0 10v10M3 7l9 5 9-5M7 5l10 5\"/>"};

GAME_ICONS.gold='<path d="m4 20 9-9M3 6c5-5 11-4 17 2L16 7 7 16l1-4-5-6Z"/>';
