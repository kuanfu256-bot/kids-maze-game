'use strict';
// ============================================================
// SECTION 1 ─ THEMES
// ============================================================
const THEMES = {
  forest: { name:'🌲 森林冒險', wall:'#15803d', wallBg:'#052e16', pathVisit:'#bbf7d0',
            player:'🐿️', collect:'🌰', goal:'🏡', cssClass:'theme-forest' },
  ice:    { name:'❄️ 冰雪宮殿', wall:'#1d4ed8', wallBg:'#172554', pathVisit:'#bae6fd',
            player:'🐧', collect:'❄️', goal:'🏔️', cssClass:'theme-ice' },
  fire:   { name:'🔥 熔岩地城', wall:'#c2410c', wallBg:'#431407', pathVisit:'#fed7aa',
            player:'🦊', collect:'💎', goal:'🏰', cssClass:'theme-fire' },
  ocean:  { name:'🌊 深海探險', wall:'#0e7490', wallBg:'#083344', pathVisit:'#a5f3fc',
            player:'🐠', collect:'🐚', goal:'🪸', cssClass:'theme-ocean' },
  space:  { name:'🚀 星際迷航', wall:'#7c3aed', wallBg:'#09090b', pathVisit:'#312e81',
            player:'🚀', collect:'⭐', goal:'🪐', cssClass:'theme-space' },
};

const PORTAL_COLORS = ['#a855f7','#06b6d4','#f59e0b'];

// ============================================================
// SECTION 2 ─ LEVEL DEFINITIONS
// ============================================================
// shape: 'square' | 'circle' | 'diamond' | 'cross' | 'star'
const LEVELS = [
  { n:1,  name:'林間小徑',  shape:'square',  cols:8,  rows:8,  theme:'forest', portals:0, acorns:2, tGold:20,  tSilv:40  },
  { n:2,  name:'花圃圓圈',  shape:'circle',  cols:12, rows:12, theme:'forest', portals:1, acorns:3, tGold:35,  tSilv:60  },
  { n:3,  name:'鑽石迷陣',  shape:'diamond', cols:13, rows:13, theme:'forest', portals:1, acorns:3, tGold:40,  tSilv:65  },
  { n:4,  name:'冰雪城堡',  shape:'square',  cols:12, rows:12, theme:'ice',    portals:1, acorns:4, tGold:35,  tSilv:60  },
  { n:5,  name:'冰晶圓陣',  shape:'circle',  cols:15, rows:15, theme:'ice',    portals:2, acorns:4, tGold:45,  tSilv:75  },
  { n:6,  name:'熔岩十字',  shape:'cross',   cols:15, rows:15, theme:'fire',   portals:1, acorns:5, tGold:50,  tSilv:85  },
  { n:7,  name:'火焰鑽石',  shape:'diamond', cols:17, rows:17, theme:'fire',   portals:2, acorns:5, tGold:55,  tSilv:90  },
  { n:8,  name:'深海漩渦',  shape:'circle',  cols:16, rows:16, theme:'ocean',  portals:2, acorns:6, tGold:60,  tSilv:100 },
  { n:9,  name:'星際飛行',  shape:'star',    cols:17, rows:17, theme:'space',  portals:2, acorns:7, tGold:70,  tSilv:115 },
  { n:10, name:'宇宙終局',  shape:'square',  cols:20, rows:20, theme:'space',  portals:3, acorns:8, tGold:80,  tSilv:130 },
];

const SHAPE_LABELS = {
  square:'⬜ 方形', circle:'⭕ 圓形', diamond:'💠 鑽石',
  cross:'✚ 十字', star:'⭐ 星形'
};

// ============================================================
// SECTION 3 ─ GAME STATE
// ============================================================
let canvas, ctx;
let currentLevelIdx = 0;
let highestUnlocked  = 0;
let levelStars       = new Array(10).fill(0);

// maze grid
let cols = 8, rows = 8;
const PAD = 14;           // canvas padding in px
let cellSize = 0;
let activeMap = [];       // [r][c] → boolean
let grid      = [];       // [r][c] → Cell

// entities
let player = { x:0, y:0 };
let goal   = { x:0, y:0 };
let acorns  = [];         // [{x,y,collected}]
let portals = [];         // [{a:{x,y}, b:{x,y}, color}]
let totalAcorns = 0, collectedCount = 0;

// player animation (pixel coords inside translated ctx)
let pxX = 0, pxY = 0;          // current draw position
let animFromX = 0, animFromY = 0;
let animToX   = 0, animToY   = 0;
let animTarget = { x:0, y:0 };
let isAnimating  = false;
let animStart    = 0;
const ANIM_MS    = 90;

// portal flash
let flashCell = null;
let flashFrames = 0;

// canvas shake (wall bump)
let shakeLeft = 0, shakeAmp = 0;

// path trail
let trail = [];           // [{x,y}]

// game state
let gameActive = false;
let soundMuted = false;
let secondsElapsed = 0;
let timerHandle = null;
let audioCtx = null;
let currentThemeName = 'forest';

// render loop
let loopId = null;
let portalAngle = 0;      // driven by rAF timestamp

// confetti
let confetti    = [];
let showConfetti = false;

// star polygon cache
let starPoly = null;

// ============================================================
// SECTION 4 ─ PERSISTENCE
// ============================================================
function loadProgress() {
  try {
    const s = JSON.parse(localStorage.getItem('kidsMaze2') || '{}');
    levelStars      = s.levelStars      || new Array(10).fill(0);
    highestUnlocked = s.highestUnlocked || 0;
  } catch(e) {
    levelStars = new Array(10).fill(0);
    highestUnlocked = 0;
  }
}

function saveProgress() {
  try { localStorage.setItem('kidsMaze2', JSON.stringify({ levelStars, highestUnlocked })); }
  catch(e) {}
}

function totalStars() { return levelStars.reduce((a,b) => a+b, 0); }

// ============================================================
// SECTION 5 ─ AUDIO (Web Audio API)
// ============================================================
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function tone(freq, type, gain, start, end) {
  const osc = audioCtx.createOscillator();
  const g   = audioCtx.createGain();
  osc.connect(g); g.connect(audioCtx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(gain, start);
  g.gain.linearRampToValueAtTime(0.001, end);
  osc.start(start); osc.stop(end);
}

function playSound(type) {
  if (soundMuted) return;
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;
  switch(type) {
    case 'move':
      tone(160, 'triangle', 0.1, t, t+0.07);
      break;
    case 'wall':
      tone(90,  'sawtooth', 0.1, t, t+0.06);
      break;
    case 'collect':
      tone(523, 'sine', 0.15, t,       t+0.09);
      tone(660, 'sine', 0.15, t+0.08,  t+0.20);
      break;
    case 'portal':
      tone(880, 'sine', 0.18, t,       t+0.06);
      tone(660, 'sine', 0.18, t+0.06,  t+0.13);
      tone(440, 'sine', 0.18, t+0.13,  t+0.22);
      break;
    case 'win':
      [261.6,329.6,392,523.2,659.2,784].forEach((f,i)=>
        tone(f,'sine',0.16, t+i*0.09, t+i*0.09+0.32));
      break;
  }
}

function toggleMute() {
  soundMuted = !soundMuted;
  document.getElementById('muteBtn').textContent = soundMuted ? '🔇' : '🔊';
}

// ============================================================
// SECTION 6 ─ SHAPE HELPERS
// ============================================================
function buildStarPolygon(rows, cols) {
  const cx = cols/2, cy = rows/2;
  const R  = Math.min(rows, cols)*0.46;
  const r  = R * 0.42;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i*Math.PI)/5 - Math.PI/2;
    const rad = i%2===0 ? R : r;
    pts.push({ x: cx + rad*Math.cos(a), y: cy + rad*Math.sin(a) });
  }
  return pts;
}

function ptInPoly(px, py, poly) {
  let inside = false;
  for (let i=0, j=poly.length-1; i<poly.length; j=i++) {
    const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y;
    if (((yi>py)!==(yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}

function isActive(shape, r, c) {
  const pr = r+0.5, pc = c+0.5;
  const cr = rows/2, cc = cols/2;
  switch(shape) {
    case 'square':  return true;
    case 'circle': {
      const R = (Math.min(rows,cols)-1)/2;
      return Math.hypot(pr-cr, pc-cc) <= R;
    }
    case 'diamond': {
      const R = (Math.min(rows,cols)-1)/2;
      return Math.abs(pr-cr)+Math.abs(pc-cc) <= R;
    }
    case 'cross': {
      const bH = Math.max(3, Math.floor(rows/3));
      const bW = Math.max(3, Math.floor(cols/3));
      const rMid = Math.floor(rows/2), cMid = Math.floor(cols/2);
      const inH = r >= rMid-Math.floor(bH/2) && r < rMid-Math.floor(bH/2)+bH;
      const inV = c >= cMid-Math.floor(bW/2) && c < cMid-Math.floor(bW/2)+bW;
      return inH || inV;
    }
    case 'star':
      if (!starPoly) starPoly = buildStarPolygon(rows, cols);
      return ptInPoly(pc, pr, starPoly);
    default: return true;
  }
}

function buildActiveMap() {
  const shape = LEVELS[currentLevelIdx].shape;
  activeMap = [];
  for (let r=0; r<rows; r++) {
    activeMap.push([]);
    for (let c=0; c<cols; c++) activeMap[r].push(isActive(shape, r, c));
  }
}

function getActiveCells() {
  const list = [];
  for (let r=0; r<rows; r++)
    for (let c=0; c<cols; c++)
      if (activeMap[r][c]) list.push({r,c});
  return list;
}

// ============================================================
// SECTION 7 ─ MAZE GENERATION (DFS)
// ============================================================
class Cell {
  constructor(r,c) {
    this.r = r; this.c = c;
    this.walls = { top:true, right:true, bottom:true, left:true };
    this.visited = false;
  }
}

function freeNeighbors(cell) {
  const {r,c}=cell, nbrs=[];
  if (r>0      && !grid[r-1][c].visited && activeMap[r-1][c]) nbrs.push(grid[r-1][c]);
  if (c<cols-1 && !grid[r][c+1].visited && activeMap[r][c+1]) nbrs.push(grid[r][c+1]);
  if (r<rows-1 && !grid[r+1][c].visited && activeMap[r+1][c]) nbrs.push(grid[r+1][c]);
  if (c>0      && !grid[r][c-1].visited && activeMap[r][c-1]) nbrs.push(grid[r][c-1]);
  return nbrs;
}

function breakWall(a, b) {
  const dr=a.r-b.r, dc=a.c-b.c;
  if (dr===1)  { a.walls.top=false;    b.walls.bottom=false; }
  else if(dr===-1){ a.walls.bottom=false; b.walls.top=false; }
  if (dc===1)  { a.walls.left=false;   b.walls.right=false; }
  else if(dc===-1){ a.walls.right=false;  b.walls.left=false; }
}

function generateMaze() {
  grid = [];
  for (let r=0; r<rows; r++) {
    const row=[];
    for (let c=0; c<cols; c++) row.push(new Cell(r,c));
    grid.push(row);
  }
  const start = grid[player.y][player.x];
  start.visited = true;
  const stack = [start];
  while (stack.length>0) {
    const cur  = stack[stack.length-1];
    const nbrs = freeNeighbors(cur);
    if (nbrs.length>0) {
      const next = nbrs[Math.floor(Math.random()*nbrs.length)];
      breakWall(cur, next);
      next.visited = true;
      stack.push(next);
    } else { stack.pop(); }
  }
}

// ============================================================
// SECTION 8 ─ ENTITY PLACEMENT
// ============================================================
function findStartGoal() {
  // Sort active cells by (r*cols+c); first → start, last → goal
  const list = getActiveCells().sort((a,b)=>a.r*cols+a.c-(b.r*cols+b.c));
  const s=list[0], g=list[list.length-1];
  return { start:{x:s.c,y:s.r}, end:{x:g.c,y:g.r} };
}

function shuffle(arr) {
  for (let i=arr.length-1; i>0; i--) {
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function placePortals(count) {
  portals = [];
  const avoid = (x,y) => (x===player.x&&y===player.y)||(x===goal.x&&y===goal.y);
  const pool = shuffle(getActiveCells().filter(c=>!avoid(c.c,c.r)));

  for (let i=0; i<count && pool.length>=2; i++) {
    const a = pool.shift(), b = pool.shift();
    portals.push({ a:{x:a.c,y:a.r}, b:{x:b.c,y:b.r}, color:PORTAL_COLORS[i%PORTAL_COLORS.length] });
  }
}

function placeAcorns(count) {
  acorns = [];
  const onPortal = (x,y) => portals.some(p=>(p.a.x===x&&p.a.y===y)||(p.b.x===x&&p.b.y===y));
  const avoid    = (x,y) => (x===player.x&&y===player.y)||(x===goal.x&&y===goal.y)||onPortal(x,y);
  const pool = shuffle(getActiveCells().filter(c=>!avoid(c.c,c.r)));

  for (let i=0; i<count && pool.length>0; i++) {
    const cell=pool.shift();
    acorns.push({ x:cell.c, y:cell.r, collected:false });
  }
  totalAcorns = acorns.length;
}

// ============================================================
// SECTION 9 ─ GAME INIT
// ============================================================
function initLevel(idx) {
  currentLevelIdx = idx;
  const def = LEVELS[idx];

  // Stop loop & confetti
  stopLoop();
  showConfetti = false;
  confetti = [];
  starPoly = null;

  // Level params
  cols = def.cols;
  rows = def.rows;

  // Build active map
  buildActiveMap();

  // Find start / goal
  const {start,end} = findStartGoal();
  player.x=start.x; player.y=start.y;
  goal.x=end.x;     goal.y=end.y;

  // Place portals & acorns
  placePortals(def.portals);
  placeAcorns(def.acorns);

  // Generate maze
  generateMaze();

  // Reset state
  trail = [{x:player.x,y:player.y}];
  collectedCount = 0;
  isAnimating = false;
  flashCell = null; flashFrames = 0;
  shakeLeft = 0;
  gameActive = true;
  secondsElapsed = 0;

  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(()=>{
    if (gameActive) { secondsElapsed++; updateTimerDisplay(); }
  }, 1000);

  // Resize canvas, init draw coords
  resizeCanvas();
  pxX = getCellPX(player.x);
  pxY = getCellPY(player.y);

  // Apply theme & UI
  applyTheme(def.theme);
  updateHUD();
  buildLevelDots();

  // Show portal hint if portals exist
  const hint = document.getElementById('portalHint');
  hint.style.display = def.portals > 0 ? 'block' : 'none';

  // Start render loop
  startLoop();
}

// ============================================================
// SECTION 10 ─ CANVAS & CELL COORDS
// ============================================================
function resizeCanvas() {
  const cont = document.getElementById('canvasContainer');
  const sz = Math.min(cont.clientWidth - 2, 456);
  canvas.width  = sz;
  canvas.height = sz;
  cellSize = (sz - PAD*2) / Math.max(cols, rows);
  pxX = getCellPX(player.x);
  pxY = getCellPY(player.y);
}

function getCellPX(x) { return x*cellSize + cellSize/2; }
function getCellPY(y) { return y*cellSize + cellSize/2; }

// ============================================================
// SECTION 11 ─ RENDER
// ============================================================
function draw(ts) {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const th = THEMES[currentThemeName];
  const angle = ts ? ts*0.003 : 0;

  // Canvas shake on wall bump
  let shakeX=0, shakeY=0;
  if (shakeLeft>0) {
    shakeX = (Math.random()-0.5)*shakeAmp;
    shakeY = (Math.random()-0.5)*shakeAmp;
    shakeLeft--;
    shakeAmp *= 0.75;
  }

  ctx.save();
  ctx.translate(PAD + shakeX, PAD + shakeY);

  // ── 1. Inactive cells (solid blocks)
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
    if (!activeMap[r][c]) {
      ctx.fillStyle = th.wallBg;
      ctx.fillRect(c*cellSize, r*cellSize, cellSize, cellSize);
    }
  }

  // ── 2. Visited trail
  ctx.fillStyle = th.pathVisit;
  trail.forEach(p => {
    if (activeMap[p.y]&&activeMap[p.y][p.x])
      ctx.fillRect(p.x*cellSize+1, p.y*cellSize+1, cellSize-2, cellSize-2);
  });

  // ── 3. Portals
  portals.forEach(portal => {
    drawPortal(portal.a, portal.color, angle);
    drawPortal(portal.b, portal.color, angle+Math.PI);
  });

  const emoSz = Math.max(cellSize*0.68, 9);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${emoSz}px sans-serif`;

  // ── 4. Acorns
  acorns.forEach(a => {
    if (!a.collected) ctx.fillText(th.collect, a.x*cellSize+cellSize/2, a.y*cellSize+cellSize/2);
  });

  // ── 5. Goal
  ctx.fillText(th.goal, goal.x*cellSize+cellSize/2, goal.y*cellSize+cellSize/2);

  // ── 6. Maze walls
  ctx.strokeStyle = th.wall;
  ctx.lineWidth   = Math.max(2, cellSize*0.1);
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
    if (!activeMap[r][c]) continue;
    const cell=grid[r][c];
    const x1=c*cellSize, y1=r*cellSize, x2=x1+cellSize, y2=y1+cellSize;
    ctx.beginPath();
    if (cell.walls.top)    { ctx.moveTo(x1,y1); ctx.lineTo(x2,y1); }
    if (cell.walls.right)  { ctx.moveTo(x2,y1); ctx.lineTo(x2,y2); }
    if (cell.walls.bottom) { ctx.moveTo(x1,y2); ctx.lineTo(x2,y2); }
    if (cell.walls.left)   { ctx.moveTo(x1,y1); ctx.lineTo(x1,y2); }
    ctx.stroke();
  }

  // ── 7. Player (animated position)
  ctx.font = `${emoSz}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(th.player, pxX, pxY);

  // ── 8. Portal flash overlay
  if (flashFrames>0 && flashCell) {
    ctx.fillStyle = `rgba(168,85,247,${flashFrames/14})`;
    ctx.fillRect(flashCell.x*cellSize, flashCell.y*cellSize, cellSize, cellSize);
    flashFrames--;
  }

  ctx.restore();

  // ── 9. Confetti (screen-space)
  if (showConfetti && confetti.length>0) {
    confetti.forEach((p,i)=>{ p.update(); p.draw(ctx); });
    for (let i=confetti.length-1; i>=0; i--) { if (confetti[i].life<=0) confetti.splice(i,1); }
    if (confetti.length===0) showConfetti=false;
  }
}

function drawPortal(pos, color, angle) {
  const cx=pos.x*cellSize+cellSize/2, cy=pos.y*cellSize+cellSize/2;
  const r=cellSize*0.38;
  const pulse=0.85+0.15*Math.sin(angle*4);

  // Glow gradient
  const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,r*pulse*1.35);
  grad.addColorStop(0,   color+'dd');
  grad.addColorStop(0.55,color+'66');
  grad.addColorStop(1,   color+'00');
  ctx.save();
  ctx.globalAlpha=0.88;
  ctx.fillStyle=grad;
  ctx.beginPath(); ctx.arc(cx,cy,r*pulse*1.35,0,Math.PI*2); ctx.fill();

  // Orbiting dots
  ctx.globalAlpha=0.85;
  for (let i=0;i<5;i++) {
    const a=angle*1.6+(i*Math.PI*2)/5;
    ctx.fillStyle='white';
    ctx.beginPath();
    ctx.arc(cx+r*0.82*Math.cos(a), cy+r*0.82*Math.sin(a), Math.max(1.5,cellSize*0.05),0,Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha=1;

  // Emoji center
  const sz=Math.max(cellSize*0.52,8);
  ctx.font=`${sz}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🌀', cx, cy);
  ctx.restore();
}

// ============================================================
// SECTION 12 ─ RENDER LOOP
// ============================================================
function loop(ts) {
  portalAngle = ts*0.003;

  if (isAnimating) {
    const t = Math.min((ts-animStart)/ANIM_MS, 1);
    const e = 1-Math.pow(1-t,3);       // easeOutCubic
    pxX = animFromX + (animToX-animFromX)*e;
    pxY = animFromY + (animToY-animFromY)*e;
    if (t>=1) { pxX=animToX; pxY=animToY; isAnimating=false; onLanded(); }
  }

  draw(ts);
  loopId = requestAnimationFrame(loop);
}

function startLoop() { if (!loopId) loopId=requestAnimationFrame(loop); }
function stopLoop()  { if (loopId)  cancelAnimationFrame(loopId); loopId=null; }

// ============================================================
// SECTION 13 ─ PLAYER MOVEMENT
// ============================================================
function tryMove(dx, dy, wallDir) {
  if (!gameActive || isAnimating) return;
  const cell=grid[player.y][player.x];
  if (cell.walls[wallDir]) {
    playSound('wall');
    shakeLeft=6; shakeAmp=4;
    return;
  }
  const nx=player.x+dx, ny=player.y+dy;
  animFromX=pxX; animFromY=pxY;
  animToX=getCellPX(nx); animToY=getCellPY(ny);
  animTarget={x:nx,y:ny};
  animStart=performance.now();
  isAnimating=true;
  playSound('move');
}

function onLanded() {
  player.x=animTarget.x; player.y=animTarget.y;

  // Trail
  if (!trail.some(p=>p.x===player.x&&p.y===player.y))
    trail.push({x:player.x,y:player.y});

  // Acorn collection
  acorns.forEach(a=>{
    if (!a.collected&&a.x===player.x&&a.y===player.y) {
      a.collected=true; collectedCount++;
      document.getElementById('collectedAcorns').textContent=collectedCount;
      playSound('collect');
    }
  });

  // Portal check
  for (const portal of portals) {
    let dest=null;
    if (portal.a.x===player.x&&portal.a.y===player.y) dest=portal.b;
    else if (portal.b.x===player.x&&portal.b.y===player.y) dest=portal.a;
    if (dest) { teleportTo(dest); return; }
  }

  // Win check
  if (player.x===goal.x&&player.y===goal.y) winLevel();
}

function teleportTo(dest) {
  playSound('portal');
  player.x=dest.x; player.y=dest.y;
  pxX=getCellPX(dest.x); pxY=getCellPY(dest.y);
  flashCell=dest; flashFrames=14;

  if (!trail.some(p=>p.x===dest.x&&p.y===dest.y))
    trail.push({x:dest.x,y:dest.y});

  // Collect acorn at dest
  acorns.forEach(a=>{
    if (!a.collected&&a.x===dest.x&&a.y===dest.y) {
      a.collected=true; collectedCount++;
      document.getElementById('collectedAcorns').textContent=collectedCount;
      playSound('collect');
    }
  });

  if (dest.x===goal.x&&dest.y===goal.y) winLevel();
}

// ============================================================
// SECTION 14 ─ INPUT
// ============================================================
function handleKey(e) {
  if (!gameActive) return;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  switch(e.key) {
    case 'ArrowUp':    case 'w': case 'W': tryMove( 0,-1,'top');    break;
    case 'ArrowDown':  case 's': case 'S': tryMove( 0, 1,'bottom'); break;
    case 'ArrowLeft':  case 'a': case 'A': tryMove(-1, 0,'left');   break;
    case 'ArrowRight': case 'd': case 'D': tryMove( 1, 0,'right');  break;
  }
}

function setupDpad() {
  const map={btnUp:[0,-1,'top'],btnDown:[0,1,'bottom'],btnLeft:[-1,0,'left'],btnRight:[1,0,'right']};
  Object.entries(map).forEach(([id,[dx,dy,w]])=>{
    const btn=document.getElementById(id);
    const fn=(e)=>{ e.preventDefault(); tryMove(dx,dy,w); };
    btn.addEventListener('touchstart',fn,{passive:false});
    btn.addEventListener('mousedown',fn);
  });
}

// ============================================================
// SECTION 15 ─ WIN & PROGRESSION
// ============================================================
function winLevel() {
  gameActive=false;
  if (timerHandle) clearInterval(timerHandle);
  playSound('win');

  const def=LEVELS[currentLevelIdx];
  const all=collectedCount===totalAcorns;
  let stars;
  if   (all && secondsElapsed<=def.tGold) stars=3;
  else if (all || secondsElapsed<=def.tSilv) stars=2;
  else stars=1;

  if (stars>levelStars[currentLevelIdx]) levelStars[currentLevelIdx]=stars;
  if (currentLevelIdx+1 < LEVELS.length && currentLevelIdx+1 > highestUnlocked)
    highestUnlocked=currentLevelIdx+1;
  saveProgress();

  launchConfetti();
  setTimeout(()=>openWinModal(stars), 500);
}

function openWinModal(stars) {
  document.getElementById('levelClearNum').textContent  = LEVELS[currentLevelIdx].n;
  document.getElementById('levelClearName').textContent = LEVELS[currentLevelIdx].name;
  document.getElementById('winTime').textContent        = secondsElapsed;
  document.getElementById('totalStarsDisplay').textContent = totalStars();

  const tips=['加油！繼續挑戰更高的星星！','很厲害！再快一點可以拿 3 顆星！','完美通關！你是迷宮大師！'];
  document.getElementById('winTip').textContent = tips[stars-1];

  const starSpans=document.querySelectorAll('#starRating .star');
  starSpans.forEach((s,i)=>{
    s.classList.remove('active');
    if (i<stars) setTimeout(()=>s.classList.add('active'), 100+i*200);
  });

  const isLast = currentLevelIdx>=LEVELS.length-1;
  const nextBtn=document.getElementById('nextLevelBtn');
  nextBtn.style.display = isLast ? 'none' : 'inline-flex';

  buildLevelDots();
  document.getElementById('winModal').classList.add('show');
}

function closeWinModal() {
  document.getElementById('winModal').classList.remove('show');
}

function showAllDoneModal() {
  document.getElementById('finalStars').textContent=totalStars();
  document.getElementById('allDoneModal').classList.add('show');
}

// ============================================================
// SECTION 16 ─ THEME & HUD
// ============================================================
function applyTheme(name) {
  currentThemeName=name;
  const th=THEMES[name];
  // Remove old theme class, add new
  document.body.className=document.body.className.replace(/theme-\w+/g,'').trim();
  document.body.classList.add(th.cssClass);
  document.getElementById('gameTitle').textContent=th.name;
  document.getElementById('collectIcon').textContent=th.collect;
}

function updateHUD() {
  const def=LEVELS[currentLevelIdx];
  document.getElementById('levelBadge').textContent    = `第 ${def.n} 關`;
  document.getElementById('levelName').textContent     = def.name;
  document.getElementById('shapeBadge').textContent    = SHAPE_LABELS[def.shape];
  document.getElementById('timerVal').textContent      = '0';
  document.getElementById('collectedAcorns').textContent = '0';
  document.getElementById('totalAcorns').textContent   = totalAcorns;
  document.getElementById('totalStarsDisplay').textContent = totalStars();
  document.getElementById('collectIcon').textContent   = THEMES[currentThemeName].collect;
}

function updateTimerDisplay() {
  document.getElementById('timerVal').textContent=secondsElapsed;
}

function buildLevelDots() {
  const cont=document.getElementById('levelDots');
  cont.innerHTML='';
  LEVELS.forEach((def,idx)=>{
    const dot=document.createElement('div');
    dot.className='level-dot';
    dot.title=`第${def.n}關：${def.name}`;

    const stars=levelStars[idx];
    const completed=stars>0;
    const isCurrent=idx===currentLevelIdx;
    const isUnlocked=idx<=highestUnlocked;

    if (isCurrent) {
      dot.classList.add('current');
      dot.textContent=def.n;
    } else if (completed) {
      dot.classList.add('completed');
      dot.textContent='⭐'.repeat(stars);
      dot.style.fontSize='0.52rem';
      dot.style.cursor='pointer';
      dot.addEventListener('click',()=>{ closeWinModal(); initLevel(idx); });
    } else if (isUnlocked) {
      dot.classList.add('available');
      dot.textContent=def.n;
      dot.style.cursor='pointer';
      dot.addEventListener('click',()=>{ closeWinModal(); initLevel(idx); });
    } else {
      dot.classList.add('locked');
      dot.textContent='🔒';
      dot.style.fontSize='0.65rem';
    }
    cont.appendChild(dot);
  });
}

// ============================================================
// SECTION 17 ─ CONFETTI
// ============================================================
class Flake {
  constructor() {
    this.x=Math.random()*canvas.width;
    this.y=-12;
    this.sz=Math.random()*9+5;
    this.color=`hsl(${Math.random()*360},90%,62%)`;
    this.vx=Math.random()*4-2;
    this.vy=Math.random()*4+2.5;
    this.rot=Math.random()*360;
    this.rSpd=Math.random()*8-4;
    this.life=130+Math.floor(Math.random()*40);
  }
  update(){ this.x+=this.vx; this.y+=this.vy; this.rot+=this.rSpd; this.life--; }
  draw(ctx){
    ctx.save();
    ctx.translate(this.x,this.y);
    ctx.rotate(this.rot*Math.PI/180);
    ctx.globalAlpha=Math.min(1,this.life/25);
    ctx.fillStyle=this.color;
    ctx.fillRect(-this.sz/2,-this.sz/2,this.sz,this.sz);
    ctx.restore();
  }
}

function launchConfetti() {
  confetti=[];
  for (let i=0;i<90;i++) confetti.push(new Flake());
  showConfetti=true;
}

// ============================================================
// SECTION 18 ─ BOOTSTRAP
// ============================================================
window.addEventListener('DOMContentLoaded', ()=>{
  canvas=document.getElementById('gameCanvas');
  ctx=canvas.getContext('2d');

  loadProgress();
  currentLevelIdx=highestUnlocked; // resume from highest unlocked

  // Input
  window.addEventListener('keydown', handleKey);
  window.addEventListener('resize', ()=>{ resizeCanvas(); draw(0); });
  setupDpad();

  // Buttons
  document.getElementById('restartBtn').addEventListener('click', ()=>initLevel(currentLevelIdx));
  document.getElementById('muteBtn').addEventListener('click', toggleMute);

  document.getElementById('playAgainBtn').addEventListener('click', ()=>{
    closeWinModal();
    stopLoop(); showConfetti=false; confetti=[];
    initLevel(currentLevelIdx);
  });

  document.getElementById('nextLevelBtn').addEventListener('click', ()=>{
    const next=currentLevelIdx+1;
    closeWinModal();
    stopLoop(); showConfetti=false; confetti=[];
    if (next<LEVELS.length) initLevel(next);
    else showAllDoneModal();
  });

  document.getElementById('restartAllBtn').addEventListener('click', ()=>{
    document.getElementById('allDoneModal').classList.remove('show');
    levelStars=new Array(10).fill(0);
    highestUnlocked=0;
    saveProgress();
    initLevel(0);
  });

  // Start first playable level
  initLevel(currentLevelIdx);
});
