// --- 遊戲狀態與變數 ---
let canvas, ctx;
let difficulty = 'medium';
let grid = [];
let cols = 15;
let rows = 15;
let cellSize = 0;
let padding = 10; // Canvas 邊界留白

let player = { x: 0, y: 0 };
let goal = { x: 14, y: 14 };
let acorns = []; // 格式：{ x, y, collected: false }
let totalAcorns = 0;
let collectedCount = 0;

let timerInterval = null;
let secondsElapsed = 0;
let gameActive = false;
let soundMuted = false;

// 軌跡記錄 (讓玩家知道自己走過哪裡)
let playerPath = [];

// 音效系統 (Web Audio API)
let audioCtx = null;

// 勝利煙火/拉炮粒子
let particles = [];
let animationFrameId = null;

// --- 難度設定對照表 ---
const DIFFICULTY_SETTINGS = {
  easy: { cols: 10, rows: 10, acorns: 3, timeGold: 15, timeSilver: 30 },
  medium: { cols: 15, rows: 15, acorns: 5, timeGold: 35, timeSilver: 60 },
  hard: { cols: 20, rows: 20, acorns: 8, timeGold: 60, timeSilver: 110 }
};

// --- 初始化設定 ---
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  
  // 綁定 UI 事件
  document.getElementById('difficultySelect').addEventListener('change', (e) => {
    difficulty = e.target.value;
    initGame();
  });
  
  document.getElementById('restartBtn').addEventListener('click', () => {
    initGame();
  });
  
  document.getElementById('muteBtn').addEventListener('click', toggleMute);
  document.getElementById('playAgainBtn').addEventListener('click', () => {
    closeModal();
    initGame();
  });

  // 鍵盤移動監聽
  window.addEventListener('keydown', handleKeyDown);

  // 虛擬搖桿移動監聽
  setupVirtualDpad();

  // 響應式調整大小
  window.addEventListener('resize', resizeCanvas);

  // 啟動遊戲
  initGame();
});

// 調整 Canvas 尺寸以適應不同螢幕，並保持正方形
function resizeCanvas() {
  const container = canvas.parentElement;
  const size = Math.min(container.clientWidth, 400); // 最大 400px
  canvas.width = size;
  canvas.height = size;
  calculateCellSize();
  draw();
}

function calculateCellSize() {
  const availableWidth = canvas.width - padding * 2;
  const availableHeight = canvas.height - padding * 2;
  cellSize = Math.min(availableWidth / cols, availableHeight / rows);
}

// --- 音效合成器 (Web Audio API) ---
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function toggleMute() {
  soundMuted = !soundMuted;
  const muteBtn = document.getElementById('muteBtn');
  if (soundMuted) {
    muteBtn.innerText = '音效：關 🔇';
    muteBtn.classList.add('muted');
  } else {
    muteBtn.innerText = '音效：開 🔊';
    muteBtn.classList.remove('muted');
  }
}

function playSound(type) {
  if (soundMuted) return;
  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'move') {
    // 短促輕微的腳步聲
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.linearRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'collect') {
    // 雙音符清脆叮噹聲
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.setValueAtTime(0.2, now + 0.08);
    gainNode.gain.linearRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (type === 'win') {
    // 歡樂的上升大三和弦
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const noteOsc = audioCtx.createOscillator();
      const noteGain = audioCtx.createGain();
      noteOsc.connect(noteGain);
      noteGain.connect(audioCtx.destination);
      
      noteOsc.type = 'sine';
      noteOsc.frequency.setValueAtTime(freq, now + idx * 0.08);
      noteGain.gain.setValueAtTime(0.2, now + idx * 0.08);
      noteGain.gain.linearRampToValueAtTime(0.01, now + idx * 0.08 + 0.3);
      
      noteOsc.start(now + idx * 0.08);
      noteOsc.stop(now + idx * 0.08 + 0.3);
    });
  }
}

// --- 迷宮儲存格類別 ---
class Cell {
  constructor(r, c) {
    this.r = r; // 列索引
    this.c = c; // 行索引
    this.walls = { top: true, right: true, bottom: true, left: true };
    this.visited = false;
  }
}

// --- 遊戲初始化與迷宮生成 ---
function initGame() {
  // 取消上一次的勝利動畫
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  particles = [];

  // 取得難度參數
  const settings = DIFFICULTY_SETTINGS[difficulty];
  cols = settings.cols;
  rows = settings.rows;
  totalAcorns = settings.acorns;
  
  // 設定起點終點
  player.x = 0;
  player.y = 0;
  goal.x = cols - 1;
  goal.y = rows - 1;
  
  playerPath = [{ x: 0, y: 0 }];
  collectedCount = 0;
  document.getElementById('collectedAcorns').innerText = '0';
  document.getElementById('totalAcorns').innerText = totalAcorns;

  // 生成迷宮
  generateMazeGrid();
  
  // 隨機放置松果 (排除起點與終點)
  placeAcorns();

  // 重設計時器
  secondsElapsed = 0;
  document.getElementById('timerVal').innerText = secondsElapsed;
  if (timerInterval) clearInterval(timerInterval);
  
  gameActive = true;
  timerInterval = setInterval(() => {
    if (gameActive) {
      secondsElapsed++;
      document.getElementById('timerVal').innerText = secondsElapsed;
    }
  }, 1000);

  // 渲染
  resizeCanvas();
}

function generateMazeGrid() {
  grid = [];
  for (let r = 0; r < rows; r++) {
    let row = [];
    for (let c = 0; c < cols; c++) {
      row.push(new Cell(r, c));
    }
    grid.push(row);
  }

  // 深度優先搜尋 (DFS) 演算法生成迷宮
  let stack = [];
  let current = grid[0][0];
  current.visited = true;

  while (true) {
    let neighbors = getUnvisitedNeighbors(current);
    if (neighbors.length > 0) {
      // 隨機選一個鄰近儲存格
      let next = neighbors[Math.floor(Math.random() * neighbors.length)];
      
      // 將當前儲存格推入堆疊
      stack.push(current);
      
      // 打通兩者之間的牆壁
      removeWallsBetween(current, next);
      
      // 標記為已訪問並移動
      next.visited = true;
      current = next;
    } else if (stack.length > 0) {
      current = stack.pop();
    } else {
      break;
    }
  }
}

function getUnvisitedNeighbors(cell) {
  let neighbors = [];
  let { r, c } = cell;

  if (r > 0 && !grid[r - 1][c].visited) neighbors.push(grid[r - 1][c]);
  if (c < cols - 1 && !grid[r][c + 1].visited) neighbors.push(grid[r][c + 1]);
  if (r < rows - 1 && !grid[r + 1][c].visited) neighbors.push(grid[r + 1][c]);
  if (c > 0 && !grid[r][c - 1].visited) neighbors.push(grid[r][c - 1]);

  return neighbors;
}

function removeWallsBetween(a, b) {
  let diffR = a.r - b.r;
  let diffC = a.c - b.c;

  if (diffR === 1) {
    a.walls.top = false;
    b.walls.bottom = false;
  } else if (diffR === -1) {
    a.walls.bottom = false;
    b.walls.top = false;
  }

  if (diffC === 1) {
    a.walls.left = false;
    b.walls.right = false;
  } else if (diffC === -1) {
    a.walls.right = false;
    b.walls.left = false;
  }
}

function placeAcorns() {
  acorns = [];
  let availableCells = [];
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // 排除起點 (0,0) 與終點 (cols-1, rows-1)
      if ((r === 0 && c === 0) || (r === rows - 1 && c === cols - 1)) {
        continue;
      }
      availableCells.push({ r, c });
    }
  }

  // 隨機選出指定數量的位置放置松果
  for (let i = 0; i < totalAcorns && availableCells.length > 0; i++) {
    let randIndex = Math.floor(Math.random() * availableCells.length);
    let chosen = availableCells.splice(randIndex, 1)[0];
    acorns.push({ x: chosen.c, y: chosen.r, collected: false });
  }
}

// --- 控制器監聽 ---
function handleKeyDown(e) {
  if (!gameActive) return;

  let moved = false;
  let nextX = player.x;
  let nextY = player.y;
  let currentCell = grid[player.y][player.x];

  // 防止捲動視窗
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }

  switch (e.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      if (!currentCell.walls.top) {
        nextY--;
        moved = true;
      }
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      if (!currentCell.walls.bottom) {
        nextY++;
        moved = true;
      }
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      if (!currentCell.walls.left) {
        nextX--;
        moved = true;
      }
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      if (!currentCell.walls.right) {
        nextX++;
        moved = true;
      }
      break;
  }

  if (moved) {
    movePlayer(nextX, nextY);
  }
}

function setupVirtualDpad() {
  const dpadButtons = {
    btnUp: { dx: 0, dy: -1, wallCheck: 'top' },
    btnDown: { dx: 0, dy: 1, wallCheck: 'bottom' },
    btnLeft: { dx: -1, dy: 0, wallCheck: 'left' },
    btnRight: { dx: 1, dy: 0, wallCheck: 'right' }
  };

  Object.entries(dpadButtons).forEach(([id, config]) => {
    const btn = document.getElementById(id);
    const triggerMove = (e) => {
      e.preventDefault(); // 防止雙擊縮放
      if (!gameActive) return;
      
      let currentCell = grid[player.y][player.x];
      if (!currentCell.walls[config.wallCheck]) {
        movePlayer(player.x + config.dx, player.y + config.dy);
      }
    };

    // 支援觸控與滑鼠點擊
    btn.addEventListener('touchstart', triggerMove, { passive: false });
    btn.addEventListener('mousedown', triggerMove);
  });
}

function movePlayer(nx, ny) {
  player.x = nx;
  player.y = ny;
  
  // 記錄軌跡 (如果還沒走過就加入)
  if (!playerPath.some(p => p.x === nx && p.y === ny)) {
    playerPath.push({ x: nx, y: ny });
  }

  playSound('move');

  // 檢查是否收集到松果
  acorns.forEach(acorn => {
    if (!acorn.collected && acorn.x === nx && acorn.y === ny) {
      acorn.collected = true;
      collectedCount++;
      document.getElementById('collectedAcorns').innerText = collectedCount;
      playSound('collect');
    }
  });

  draw();

  // 檢查是否抵達終點
  if (player.x === goal.x && player.y === goal.y) {
    winGame();
  }
}

// --- 繪製畫布內容 ---
function draw() {
  if (!canvas || !ctx) return;

  // 清空畫布
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 儲存狀態以進行偏移 (繪製置中)
  ctx.save();
  ctx.translate(padding, padding);

  // 1. 繪製走過的足跡 (淡綠色路徑)
  ctx.fillStyle = '#dcfce7'; // 很淡的粉綠色
  playerPath.forEach(path => {
    ctx.fillRect(path.x * cellSize + 2, path.y * cellSize + 2, cellSize - 4, cellSize - 4);
  });

  // 2. 繪製迷宮格子背景（未走過的地方）
  // 這裡省略以突顯足跡，背景色由 canvas CSS 設定

  // 3. 繪製松果 (起點/收集品) 與 終點樹屋
  const emoOffset = cellSize * 0.15;
  const emoSize = cellSize * 0.7;
  ctx.font = `${emoSize}px "Fredoka", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // 終點 (🏡 樹屋)
  ctx.fillText('🏡', goal.x * cellSize + emoOffset, goal.y * cellSize + emoOffset);

  // 松果 (🌰)
  acorns.forEach(acorn => {
    if (!acorn.collected) {
      ctx.fillText('🌰', acorn.x * cellSize + emoOffset, acorn.y * cellSize + emoOffset);
    }
  });

  // 4. 繪製玩家 (🐿️ 松鼠)
  ctx.fillText('🐿️', player.x * cellSize + emoOffset, player.y * cellSize + emoOffset);

  // 5. 繪製迷宮牆壁 (深森林綠)
  ctx.strokeStyle = '#15803d'; // 森林綠
  ctx.lineWidth = Math.max(3, cellSize * 0.12); // 牆壁厚度比例化，最少 3px
  ctx.lineCap = 'round'; // 圓角牆壁邊角，質感提升

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let cell = grid[r][c];
      let x1 = c * cellSize;
      let y1 = r * cellSize;
      let x2 = (c + 1) * cellSize;
      let y2 = (r + 1) * cellSize;

      ctx.beginPath();
      // 上邊牆
      if (cell.walls.top) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y1);
      }
      // 右邊牆
      if (cell.walls.right) {
        ctx.moveTo(x2, y1);
        ctx.lineTo(x2, y2);
      }
      // 下邊牆
      if (cell.walls.bottom) {
        ctx.moveTo(x1, y2);
        ctx.lineTo(x2, y2);
      }
      // 左邊牆
      if (cell.walls.left) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, y2);
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}

// --- 遊戲勝利處理 ---
function winGame() {
  gameActive = false;
  if (timerInterval) clearInterval(timerInterval);

  playSound('win');
  
  // 計算星星
  const settings = DIFFICULTY_SETTINGS[difficulty];
  let stars = 1;
  
  // 條件：收集完所有松果，且時間在金牌/銀牌範圍內
  const collectedAll = collectedCount === totalAcorns;
  
  if (collectedAll && secondsElapsed <= settings.timeGold) {
    stars = 3;
  } else if (collectedAll || secondsElapsed <= settings.timeSilver) {
    stars = 2;
  } else {
    stars = 1;
  }

  // 延遲一點點時間彈出 Modal，讓玩家看清楚抵達終點
  setTimeout(() => {
    showWinModal(stars, secondsElapsed);
    startConfetti();
  }, 300);
}

function showWinModal(stars, time) {
  document.getElementById('winTime').innerText = time;
  
  const starContainer = document.getElementById('starRating');
  const starSpans = starContainer.querySelectorAll('.star');
  
  starSpans.forEach((span, idx) => {
    if (idx < stars) {
      span.classList.add('active');
    } else {
      span.classList.remove('active');
    }
  });

  document.getElementById('winModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('winModal').style.display = 'none';
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// --- 勝利灑花 (Confetti) 動畫 ---
class ConfettiParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 8 + 6;
    this.color = `hsl(${Math.random() * 360}, 90%, 60%)`;
    this.speedX = Math.random() * 6 - 3;
    this.speedY = Math.random() * -6 - 4; // 向上噴射
    this.gravity = 0.2;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 10 - 5;
    this.opacity = 1;
  }

  update() {
    this.x += this.speedX;
    this.speedY += this.gravity;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
    this.opacity -= 0.01;
  }

  draw(cCtx) {
    cCtx.save();
    cCtx.translate(this.x, this.y);
    cCtx.rotate((this.rotation * Math.PI) / 180);
    cCtx.fillStyle = this.color;
    cCtx.globalAlpha = Math.max(0, this.opacity);
    cCtx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    cCtx.restore();
  }
}

function startConfetti() {
  // 生成初始粒子，從畫布中間/下方噴發
  particles = [];
  for (let i = 0; i < 120; i++) {
    particles.push(new ConfettiParticle(canvas.width / 2, canvas.height - 40));
  }
  
  animateConfetti();
}

function animateConfetti() {
  // 當 Modal 還在顯示時，我們在 Canvas 上持續播放煙火效果
  if (document.getElementById('winModal').style.display !== 'none') {
    // 渲染遊戲背景
    draw();

    // 渲染粒子
    particles.forEach((p, idx) => {
      p.update();
      p.draw(ctx);
      if (p.opacity <= 0 || p.y > canvas.height) {
        particles.splice(idx, 1);
      }
    });

    // 如果粒子快沒了，且依然開著 Modal，就再補充一些
    if (particles.length < 20 && Math.random() < 0.2) {
      for (let i = 0; i < 5; i++) {
        particles.push(new ConfettiParticle(Math.random() * canvas.width, 0)); // 從上方飄落
      }
    }

    animationFrameId = requestAnimationFrame(animateConfetti);
  }
}
