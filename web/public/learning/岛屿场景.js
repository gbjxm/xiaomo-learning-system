/* 独立草图场景。只绘图与分发点击，不读取或写入学习记录。 */
(function () {
  'use strict';
  let serial = 0;
  const ink = '#708775';
  const shadow = (x, y, rx, ry = 10) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#708778" opacity=".12"/>`;
  const path = (d, stroke = ink, width = 2, fill = 'none') => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const line = (x1, y1, x2, y2, stroke = ink, width = 2) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
  const rect = (x, y, w, h, fill, r = 4, stroke = ink) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  const circle = (x, y, r, fill, stroke = 'none') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  const group = (x, y, body, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})">${body}</g>`;
  const pot = (x, y, s = 1) => group(x, y, `${path('M-11 0h22l-3 20H-8Z','#9c9577',1.5,'#d6b58d')}${path('M0 1V-21M0-8Q-21-8-14-23Q1-22 0-8M0-14Q16-34 20-16Q15-5 0-14','#809b76',1.5,'#a4b98a')}`, s);
  const tree = (x, y, s = 1, color = '#a8bb90', blossom = false) => group(x, y, `${shadow(0,6,28,7)}${path('M-3 4 0-54 5 4','#b2a080',8)}<g class="scene-leaf">${path('M-2-42C-38-22-56-59-33-72C-46-101-17-117 2-100C25-122 46-99 39-79C69-54 33-25 9-43Z','#91a17d',1.5,color)}${path('M-21-64Q-6-76 8-75M12-54Q29-64 34-77','#7e9774',1.6)}${blossom ? circle(-22,-79,5,'#e9c7b9')+circle(15,-92,6,'#f0d2bd')+circle(29,-60,4,'#e7bea6') : ''}</g>`, s);
  const pine = (x,y,s=1) => group(x,y,`${shadow(0,4,22,6)}${line(0,3,0,-77,'#a4977c',7)}<g class="scene-leaf">${path('M0-102-26-57H-17L-38-24H38L17-57H26Z','#8da089',1.5,'#acbfa8')}${path('M-16-54H16M-21-32H22','#96ad91',1.5)}</g>`,s);
  const flowers = (x,y,s=1,color='#d5ac85') => group(x,y,`${line(-9,0,-9,-16,'#94a175',1.5)}${line(8,3,8,-9,'#94a175',1.5)}${circle(-9,-19,5,color)}${circle(8,-12,4,'#f2dda7')}${circle(-9,-19,1.5,'#faf1d3')}${path('M-9-5Q-25-18-18-4M8-3Q24-16 18 0','#8fa174',1.2,'#aabd85')}`,s);
  const stones = (x,y) => group(x,y,`${path('M-20 3Q-25-8-10-9Q4-4 0 5Z','#a8b4a3',1,'#c1cbb8')}${path('M4 5Q1-6 15-5Q29 4 18 9Z','#a8b4a3',1,'#d3d7c3')}`);
  const lamp = (x,y) => group(x,y,`${shadow(0,5,13,4)}${line(0,0,0,-69,'#87917b',3)}${path('M0-68Q0-78 14-78M8-78h16l5 10H3Z','#89927b',1.5,'#c1ba94')}${rect(7,-67,19,21,'#f3ddb1',3)}${circle(16,-57,16,'#f4dfb2')}<circle class="scene-lamp" cx="16" cy="-57" r="24" fill="#f6e9c8" opacity=".6"/>${line(6,-46,26,-46,'#8c947c',2)}`);
  const bench = () => `${shadow(0,45,69,10)}${rect(-63,-21,126,13,'#c6b58e',4)}${rect(-63,-2,126,13,'#c6b58e',4)}${path('M-52-27V38M52-27V38','#8e987d',4)}${path('M-70 17H70L58 30H-61Z','#a69e80',1.5,'#d4c39c')}${line(-55,29,-57,43,'#8e987d',4)}${line(55,29,57,43,'#8e987d',4)}${pot(76,16,.75)}${rect(-40,8,23,13,'#f0e6cb',2)}${path('M-37 8V3Q-25-5-18 3V8','#97a291',1.5)}`;
  const books = (x,y,count=6,colors=['#bea5a0','#a7b3b0','#d2bd90','#a6b891']) => Array.from({length:count},(_,i)=>rect(x+i*12,y-(i%3)*4,9,32+(i%3)*4,colors[i%colors.length],1)).join('');
  const shelf = (variant = 'book') => `${shadow(0,45,70,10)}${rect(-60,-79,120,122,'#d7c6a2',5)}${rect(-50,-70,100,101,'#e9dec2',1,'#b4a989')}${line(-52,-26,52,-26,'#b2a380',5)}${line(-52,20,52,20,'#b2a380',5)}${line(-46,43,-47,50,ink,4)}${line(46,43,47,50,ink,4)}${variant==='records' ? `${circle(-23,-48,19,'#889693')}${circle(-23,-48,7,'#d9bd96')}${rect(3,-65,37,33,'#b9b4a2',2)}${circle(22,-48,12,'#e7d8b9')}${books(-43,-12,7)}` : variant==='camera' ? `${rect(-42,-55,50,27,'#9eaea0',5)}${circle(-15,-43,13,'#dee2cb',ink)}${circle(-15,-43,7,'#91a8a1')}${rect(-34,-63,18,8,'#9eaea0',2)}${books(18,-61,2)}${books(-43,-12,6)}` : `${books(-44,-61,7)}${books(-43,-12,5)}${pot(30,4,.6)}`}${pot(65,17,.85)}`;
  const house = (roof = '#b9ba90', kind = 'home') => {
    const body = `${shadow(0,51,100,12)}${rect(-80,-57,160,107,'#f1e8cc',7,'#b0ad8f')}${path('M-96-57 0-117 96-57Z','#999e83',2,roof)}${line(-86,-56,86,-56,'#e9dbb6',5)}${rect(-62,-31,33,40,'#bdcfbd',3)}${rect(29,-31,33,40,'#bdcfbd',3)}${line(-45,-31,-45,9,'#e9ead7',3)}${line(-62,-11,-29,-11,'#e9ead7',3)}${line(45,-31,45,9,'#e9ead7',3)}${line(29,-11,62,-11,'#e9ead7',3)}${path('M-18 49V-18Q0-33 18-18V49Z','#a79f7e',1.5,'#baa889')}${circle(8,19,2,'#7c876e')}${rect(-28,49,56,8,'#d4c7a7',3)}${rect(-39,57,78,6,'#ddd0b1',3)}${pot(-85,29,.95)}${pot(85,31,.8)}`;
    if (kind === 'story') return body+`${path('M-65-79V-106H-44V-93','#aaa284',2,'#d0baa0')}${path('M-17-75Q-7-83 0-77Q8-83 18-75V-58Q7-65 0-58Q-9-65-17-58Z','#8c9a7c',1.5,'#efe6c9')}${line(0,-77,0,-59,'#9eaa8f',1)}`;
    return body+`${rect(-14,-90,28,23,'#d0d7b3',4)}${line(0,-88,0,-69,'#e9e8cf',2)}${line(-11,-79,11,-79,'#e9e8cf',2)}${path('M46-89V-119H65V-77','#a49e85',1.5,'#d8c6a4')}`;
  };
  const workshop = () => `${shadow(0,51,113,12)}${rect(-98,-67,196,116,'#efdfbb',5)}${path('M-112-68-48-105H63L112-68Z','#aaa889',2,'#d5cba0')}${path('M-43-98H14L39-70H-79Z','#a7b8a7',1.5,'#c6d6c2')}${line(-19,-98,-8,-70,'#edf0da',2)}${line(-46,-86,26,-86,'#edf0da',2)}${rect(-82,-52,101,66,'#c9d6be',2)}${line(-49,-51,-49,14,'#eee7cf',4)}${line(-14,-51,-14,14,'#eee7cf',4)}${line(-80,-20,18,-20,'#eee7cf',4)}${rect(39,-32,41,80,'#b4b89b',2)}${rect(46,-23,27,32,'#d6dfc9',1)}${circle(69,26,2,'#7c8d74')}${rect(-79,19,103,10,'#cebf97',3)}${line(-71,29,-71,45,'#a69d7e',3)}${line(16,29,16,45,'#a69d7e',3)}${rect(-65,3,25,15,'#ece5cc',1)}${pot(-102,26,.9)}${pot(101,31,.8)}${path('M39-59H76','#949d83',3)}`;
  const studio = () => `${shadow(0,49,106,13)}${rect(-87,-70,174,117,'#eee2c5',8)}${path('M-103-69-53-99H67L104-69Z','#8d9b90',2,'#aebfb1')}${rect(-68,-50,58,48,'#b3c4b5',3)}${path('M-61-25Q-53-48-44-25T-25-25T-15-25','#e7ecd9',2)}${rect(12,-50,56,48,'#b3c4b5',3)}${rect(22,-40,36,28,'#d5dcca',2)}${path('M-39 46V10H1V46Z','#a69e83',1.5,'#bdad8b')}${rect(23,11,36,35,'#99aaa1',4)}${circle(41,29,11,'#d3d8bf')}${circle(41,29,5,'#9cab9e')}${pot(-95,26,.8)}${path('M-48-82Q0-94 48-82','#cad3b8',2)}`;
  const screen = (night = false) => `${shadow(0,48,84,11)}${path('M-69-68V41M69-68V41','#899780',4)}${rect(-77,-70,154,90,night?'#a9bdb0':'#d0d6b6',5)}${rect(-69,-62,138,71,'#ede8d0',2)}${path('M-68 8-23-33 8-3 30-26 68 8Z','#a8b89b',1,'#b7c7a7')}${circle(37,-41,10,'#ddc89d')}${path('M-77-76H77','#d2c4a3',5)}${rect(-53,34,42,13,'#cdb993',3)}${rect(14,34,42,13,'#cdb993',3)}${line(-49,47,-49,52,ink,3)}${line(51,47,51,52,ink,3)}${rect(-91,8,21,33,'#b1b8a0',3)}${circle(-81,28,6,'#dae0c8')}`;
  const table = (kind) => {
    let top = '';
    if (kind==='board') top = `${rect(-46,-22,91,45,'#f5edd7',2)}${Array.from({length:3},(_,i)=>rect(-39+i*27,-15,22,16,['#bbcbb6','#d9c8a8','#b7c5c1'][i],1)).join('')}${path('M-37 11h18M-10 11H9M18 11h20','#b4ac8d',2)}${line(56,-21,48,17,'#a38e72',3)}`;
    else if (kind==='edit') top = `${rect(-48,-50,76,48,'#90a9a0',4)}${rect(-42,-44,64,35,'#dce3cb',2)}${path('M-37-18h16v-8h16v11h17','#a59f81',2)}${line(-10,-3,-10,8,ink,4)}${rect(-29,7,41,5,'#b0b59c',2)}${rect(-37,16,63,12,'#dfd7b8',2)}${rect(39,-16,18,36,'#a4b5a4',3)}${circle(48,8,5,'#d7dfc5')}`;
    else top = `${path('M-48-20Q-23-27-4-19Q18-27 42-20V14Q19 7-4 15Q-23 7-48 14Z','#a7a688',1.5,'#f3ead1')}${line(-4,-19,-4,13,'#c3baa0',1)}${path('M-38-11h23M-38-4h18M7-11H31M7-4H25','#b2b29a',1.5)}${line(53,-26,43,16,'#a88c73',3)}`;
    return `${shadow(0,54,83,11)}${path('M-66 5V48M66 5V48','#a79f7c',6)}${path('M-80-30H75L85 29H-88Z','#b3a681',1.5,'#d8c7a2')}${top}${rect(-21,45,42,11,'#c7b590',3)}${line(-16,56,-18,62,ink,3)}${line(16,56,18,62,ink,3)}${pot(83,22,.65)}`;
  };
  const traces = (count) => `${shadow(0,46,76,10)}${line(-54,-64,-54,47,'#a89b7d',5)}${line(54,-64,54,47,'#a89b7d',5)}${rect(-66,-70,132,92,'#d2c9a4',6)}${rect(-56,-59,112,70,'#eae3c9',2)}${count>0 ? Array.from({length:Math.min(count,5)},(_,i)=>{const x=-45+i*20;return `${path(`M${x} -42h15v37l-7-6-8 6Z`,'#a6a087',1,['#bbc5a1','#cdb595','#aabdb4','#d0bcba','#d7ceac'][i])}${circle(x+7,-36,2,'#f6edd5')}`;}).join('') : `${path('M-26-27Q0-41 26-27M-18-15Q0-24 18-15','#c6bfa0',2)}${circle(0,-2,2,'#c6bfa0')}`}${path('M-62 29H61','#b9af8d',4)}${pot(72,27,.65)}`;
  const cat = () => `${shadow(0,24,26,7)}<path class="scene-cat-tail" d="M15 16Q47 12 34-8Q27-19 24-6" fill="none" stroke="#c8ad85" stroke-width="9" stroke-linecap="round"/><ellipse cx="0" cy="10" rx="19" ry="20" fill="#d7bf95" stroke="#aa977c" stroke-width="1.5"/>${path('M-19-10-20-32-7-24Q0-27 7-24L21-32 19-10Q18 6 0 7Q-17 5-19-10Z','#a7957b',1.5,'#e0caa5')}${path('M-15-18-15-25-9-22M10-22 16-26 16-18','#bd9e82',1.5,'#c8a38d')}${path('M-11-9-6-7M7-7 12-9','#7f8372',1.8)}${path('M-2-3H2L0 0Z','#b48d78',1,'#b48d78')}${path('M-18-4-29-7M-18 0-28 1M18-4 28-7M18 0 28 2','#a68f76',1.2)}${path('M-8 23v-8M7 23v-8','#b49b7b',1.5)}`;
  function place(x,y,label,action,art,opts={}) {
    const w = Math.max(82,label.length*15+38), ly = opts.labelY ?? 75;
    return `<g class="scene-place" data-place="${action}" transform="translate(${x} ${y})" tabindex="0" role="button" aria-label="${label}"><title>${label}，点击进入</title><rect class="scene-hit" x="-106" y="-121" width="212" height="${ly+139}" rx="22"/><g class="scene-prop">${art}</g><g transform="translate(0 ${ly})"><rect class="scene-label-bg" x="${-w/2}" y="-16" width="${w}" height="31" rx="15.5"/><circle class="scene-label-dot" cx="${-w/2+15}" cy="0" r="3"/><text class="scene-label" text-anchor="middle" x="7" y="5">${label}</text></g></g>`;
  }
  const catPlace = (x,y) => `<g class="scene-place scene-cat" data-place="cat" transform="translate(${x} ${y})" role="button" tabindex="0" aria-label="和小猫待一会儿"><title>和小猫待一会儿</title><rect class="scene-hit" x="-38" y="-40" width="84" height="79" rx="20"/><g class="scene-prop">${cat()}</g></g>`;
  const waves = () => [[58,215],[824,220],[66,505],[801,529],[370,614],[557,67],[832,382],[104,100],[203,610]].map(([x,y],i)=>`<g class="scene-wave">${path(`M${x} ${y}q8 5 16 0t16 0`,'#bad1c6',1.5)}${i%2===0?path(`M${x+8} ${y+12}h17`,'#c5d8cb',1.2):''}</g>`).join('');
  const grass = (x,y,color='#bdc6a1') => group(x,y,`${path('M-9 0-13-7M-2 0-3-11M6 0 11-6',color,1.5)}`);
  const pathRoad = d => `<path d="${d}" fill="none" stroke="#eae0c1" stroke-width="29" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#d9ceb0" stroke-width="1.2" stroke-dasharray="2 10" opacity=".65"/>`;
  const shore = (d,fill='#dce2bc') => `<path d="${d}" fill="none" stroke="#c7d9c9" stroke-width="45" opacity=".6"/><path d="${d}" fill="none" stroke="#f1e9cb" stroke-width="24"/><path d="${d}" fill="${fill}" stroke="#c8cbac" stroke-width="1.8"/>`;
  const pond = (x,y,s=1) => group(x,y,`${path('M-72-6Q-61-39-24-29Q14-48 51-25Q80-8 57 17Q29 43-15 30Q-67 39-72-6Z','#b3c7b2',5,'#bfd5c6')}${path('M-40 4h20M4-15h23M15 18h27','#e0e7d0',2)}${path('M-12 0Q-2-13 7-2L-3 7Z','#a5b596',1,'#b0c397')}${circle(-2,-1,3,'#eee0b6')}`,s);
  const pennants = (x,y,w=140) => group(x,y,`${path(`M0 0Q${w/2} 30 ${w} 0`,'#a9ad8c',1.4)}${Array.from({length:5},(_,i)=>{const px=15+i*(w-30)/4,py=16*Math.sin((i+1)*Math.PI/6);return path(`M${px} ${py}l10 1-5 13Z`,'none',0,['#c9b597','#b3bf9d','#d2c3a1'][i%3]);}).join('')}`);

  function home(count) {
    const d='M111 274Q98 182 208 139Q263 75 374 98Q451 55 561 102Q720 93 768 214Q821 300 770 395Q808 496 693 534Q620 594 502 554Q367 608 269 555Q151 568 125 473Q67 395 111 274Z';
    return shore(d)+pathRoad('M429 253Q418 300 372 333Q281 333 225 407M373 333Q477 367 481 445M380 333Q579 346 675 264M479 445Q587 471 688 456')+
      `${pond(575,136,.63)}${tree(127,270,.95)}${tree(206,143,.84)}${tree(731,206,.7)}${tree(781,407,.8)}${tree(369,563,.6)}${pine(634,96,.58)}${flowers(285,159,.9)}${flowers(763,462,1.2)}${stones(107,411)}${grass(276,346)}${grass(578,387)}${grass(440,519)}${lamp(338,311)}${pennants(245,131,132)}`+
      place(423,208,'安排今天','plan',house())+
      place(206,252,'我的课程架','courses',shelf())+
      place(674,240,'海边放映场','watch',screen())+
      place(226,434,'轻练习桌','practice',table('story'))+
      place(480,441,'旅行手记','traces',traces(count))+
      place(698,456,'歇一会儿','rest',bench(),{labelY:64})+
      catPlace(557,314)+flowers(153,492,.8)+flowers(596,504,.85)+grass(378,467)+
      `<text class="scene-caption" x="98" y="625">HOME ISLAND · 留一点时间，慢慢开始</text>`;
  }
  function story(count) {
    const d='M131 243Q135 141 264 122Q333 68 448 105Q546 70 666 125Q781 142 777 250Q823 334 757 415Q772 521 666 554Q543 591 421 560Q312 602 203 551Q93 513 115 404Q67 313 131 243Z';
    return shore(d,'#e1dfba')+pathRoad('M257 250Q292 335 435 365Q524 359 587 215M435 365Q331 421 232 457M435 365Q531 447 670 461M576 349Q657 333 704 316')+
      `${tree(136,220,1.15,'#c4c7a1',true)}${tree(351,132,.95,'#c6c6a0',true)}${tree(739,169,.78,'#b6c3a0',true)}${tree(763,521,.86,'#b8be96',true)}${tree(131,505,.7,'#c9c8a5',true)}${pond(524,532,.7)}${flowers(385,246,1.1,'#cba892')}${flowers(579,375,.9)}${grass(333,517)}${stones(113,379)}${lamp(385,298)}${pennants(122,298,135)}`+
      place(247,208,'故事书屋','desk',house('#c5ad99','story'))+
      place(585,196,'故事与课程','courses',shelf())+
      place(436,374,'写一小段','practice',table('story'))+
      place(225,450,'一起看片','watch',screen(true),{labelY:69})+
      place(706,315,'故事留下来','traces',traces(count),{labelY:64})+
      place(681,473,'树荫长椅','rest',bench(),{labelY:61})+
      catPlace(331,288)+flowers(626,553,.85)+flowers(188,341,.9)+grass(292,401)+
      `<text class="scene-caption" x="98" y="625">STORY GARDEN · 好故事，也从一个小念头开始</text>`;
  }
  function visual(count) {
    const d='M106 276Q99 182 227 146Q284 72 409 100Q525 50 641 130Q749 119 788 247Q825 341 757 414Q791 516 660 547Q542 589 444 552Q315 594 212 541Q106 519 121 419Q70 360 106 276Z';
    return shore(d,'#e4e3bd')+pathRoad('M413 258Q392 329 439 392Q386 455 243 491M439 392Q566 426 672 453M435 330Q572 288 682 254M396 322Q274 291 183 312')+
      `${tree(133,221,.8)}${pine(254,127,.75)}${tree(703,160,.85,'#b5c7a0')}${tree(779,399,.75)}${tree(586,562,.62)}${pond(285,207,.6)}${path('M397 83l-13 32M412 88l-8 28M427 91l-2 25','#f5ebc3',3)}${lamp(563,316)}${flowers(182,415,.85)}${flowers(668,556,.9)}${stones(108,467)}${grass(382,501)}${grass(577,224)}${pennants(595,130,122)}`+
      place(424,204,'采光学习室','desk',workshop())+
      place(182,322,'镜头与课程','courses',shelf('camera'),{labelY:66})+
      place(451,411,'分镜练习台','practice',table('board'),{labelY:72})+
      place(698,250,'看片小剧场','watch',screen())+
      place(697,466,'我的分镜墙','traces',traces(count),{labelY:67})+
      place(232,494,'去看一会儿海','rest',bench(),{labelY:61})+
      catPlace(524,302)+flowers(338,339,.8)+grass(562,474)+
      `<text class="scene-caption" x="98" y="625">VISUAL ATELIER · 看见一个镜头，也试着做出来</text>`;
  }
  function post(count) {
    const d='M119 265Q104 159 223 123Q347 77 447 104Q550 62 679 133Q776 164 778 270Q827 362 755 421Q765 504 673 540Q594 562 534 535Q475 574 365 556Q252 580 171 513Q82 486 116 394Q70 333 119 265Z';
    return shore(d,'#d9e0bc')+pathRoad('M325 244Q323 321 240 386M326 311Q466 298 630 222M439 310Q562 350 683 375M418 333Q382 409 386 483M389 479Q489 510 598 504')+
      `${path('M98 563Q230 590 308 578','#c5d8c6',3)}${path('M621 569H742V581H621Z','#b2aa8c',1.5,'#d7c5a0')}${line(640,569,640,588,'#a9a185',3)}${line(720,569,720,588,'#a9a185',3)}${path('M673 597h74q-10 22-51 10Z','#9da891',1.5,'#d1c9a6')}${line(713,578,713,596,'#a2a88e',2)}${tree(137,249,.92,'#b2c2a0')}${pine(209,148,.84)}${pine(451,114,.65)}${tree(738,186,.77)}${tree(765,480,.72)}${pond(459,201,.5)}${lamp(528,299)}${flowers(177,526,.85)}${stones(99,435)}${grass(573,410)}${grass(442,542)}${pennants(213,108,124)}`+
      place(330,208,'声音剪辑室','desk',studio())+
      place(638,202,'声音与课程','courses',shelf('records'))+
      place(224,396,'节奏练习台','practice',table('edit'),{labelY:76})+
      place(687,380,'片段放映台','watch',screen(true),{labelY:69})+
      place(393,478,'作品小展架','traces',traces(count),{labelY:63})+
      place(599,513,'港湾歇脚处','rest',bench(),{labelY:61})+
      catPlace(427,308)+flowers(303,325,.85)+grass(560,129)+
      `<text class="scene-caption" x="98" y="625">SOUND HARBOR · 让画面与声音，慢慢找到节奏</text>`;
  }
  const views = {home,story,visual,post};
  const names = {home:'主岛家园',story:'故事花园',visual:'影像采光工坊',post:'剪辑声音港湾'};
  // 与终端首页共用已选定的四张原图，不生成第二套岛屿或小猫。
  const cats = {
    home: {name:'英短蓝猫', crop:'518 268 88 86', center:[558,309]},
    story: {name:'三花田园猫', crop:'294 220 86 88', center:[333,265]},
    visual: {name:'暹罗猫', crop:'491 250 88 84', center:[536,294]},
    post: {name:'缅因猫', crop:'382 236 99 98', center:[432,287]}
  };
  const paintingUrl = island => `/terminal/assets/${Object.hasOwn(views,island)?island:'home'}.png`;
  function useSelectedPainting(host,island) {
    const svg=host.querySelector('svg'),title=svg.querySelector('title');
    const painting=document.createElementNS('http://www.w3.org/2000/svg','image');
    for(const [key,value] of Object.entries({href:paintingUrl(island),width:'900',height:'650',preserveAspectRatio:'xMidYMid meet',class:'island-painting','aria-hidden':'true'}))painting.setAttribute(key,value);
    const places=[...svg.querySelectorAll('.scene-place')];
    for(const place of places){
      place.querySelector('.scene-prop')?.remove();
      if(island==='home'&&place.dataset.place==='traces'){
        place.dataset.place='journey';place.setAttribute('aria-label','每日旅程 · 领航室');
        place.querySelector('title').textContent='每日旅程，进入领航室';
        place.querySelector('.scene-label').textContent='每日旅程';
      }
      if(place.dataset.place==='cat'){
        const cat=cats[island];place.setAttribute('aria-label',`和${cat.name}待一会儿`);place.querySelector('title').textContent=`和${cat.name}待一会儿`;
        place.setAttribute('transform',`translate(${cat.center.join(' ')})`);
        const hit=place.querySelector('.scene-hit');for(const [key,value] of Object.entries({x:'-50',y:'-51',width:'100',height:'101'}))hit.setAttribute(key,value);
      }
    }
    svg.replaceChildren(title,painting,...places);
    painting.addEventListener('error',()=>{if(host.querySelector('.scene-image-error'))return;const warning=document.createElement('p');warning.className='scene-image-error';warning.textContent='岛屿画面暂未加载，文字入口仍可使用。';warning.setAttribute('role','status');host.append(warning);});
  }
  function catPortrait(island='home') {
    const key=Object.hasOwn(cats,island)?island:'home',cat=cats[key];
    return `<svg class="island-cat-portrait" viewBox="${cat.crop}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${cat.name}"><title>岛上的${cat.name}</title><image href="${paintingUrl(key)}" width="900" height="650" preserveAspectRatio="xMidYMid meet"/></svg>`;
  }
  function mount(container, options = {}) {
    if (!container || typeof container.appendChild !== 'function') throw new TypeError('IslandScenes.mount requires a DOM container');
    const island = Object.hasOwn(views, options.island) ? options.island : 'home';
    const count = Number.isFinite(Number(options.memories)) ? Math.max(0,Math.floor(Number(options.memories))) : 0;
    const host = document.createElement('div');
    host.className = `island-scenes scene-${island}`;
    const titleId = `island-scene-title-${++serial}`;
    host.innerHTML = `<svg viewBox="0 0 900 650" preserveAspectRatio="xMidYMid meet" role="group" aria-labelledby="${titleId}"><title id="${titleId}">${names[island]}，六处可探索的地点与一只小猫</title>${waves()}${views[island](count)}</svg>`;
    useSelectedPainting(host,island);
    function activate(event) {
      const target = event.target.closest('[data-place]');
      if (!target || !host.contains(target)) return;
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (typeof options.onPlace === 'function') options.onPlace(target.getAttribute('data-place'));
    }
    host.addEventListener('click',activate);
    host.addEventListener('keydown',activate);
    container.appendChild(host);
    return { destroy() { host.removeEventListener('click',activate);host.removeEventListener('keydown',activate);host.remove(); } };
  }
  window.IslandScenes = Object.freeze({mount,catPortrait,paintingUrl});
}());
