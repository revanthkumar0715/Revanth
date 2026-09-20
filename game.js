/**
 * Snake Color Ball Game Engine
 * Features: Pure White Canvas, Sound Synth, Multi-ball spawner, Particle System
 */

// Global Game Configuration & Constants
const GRID_SIZE = 20; // 20px per tile
const INITIAL_LENGTH = 10; // Base starting size (10 segments)
const BALL_TYPES = {
  BLACK: { color: '#1e293b', border: '#475569', label: 'BLACK', weight: 0.20 },
  RED: { color: '#ef4444', border: '#fca5a5', label: 'RED', weight: 0.35 },
  GREEN: { color: '#10b981', border: '#6ee7b7', label: 'GREEN', weight: 0.25 },
  YELLOW: { color: '#f59e0b', border: '#fde047', label: 'YELLOW', weight: 0.20 }
};

class ColorSnakeGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    // UI Elements
    this.scoreValEl = document.getElementById('scoreVal');
    this.highScoreValEl = document.getElementById('highScoreVal');
    this.lengthValEl = document.getElementById('lengthVal');
    this.toastMsgEl = document.getElementById('toastMsg');
    
    // Controls & Modals
    this.btnPause = document.getElementById('btnPause');
    this.btnSound = document.getElementById('btnSound');
    this.btnRestart = document.getElementById('btnRestart');
    this.gameModal = document.getElementById('gameModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalSubtitle = document.getElementById('modalSubtitle');
    this.modalIcon = document.getElementById('modalIcon');
    this.recapScore = document.getElementById('recapScore');
    this.recapLength = document.getElementById('recapLength');
    this.btnModalAction = document.getElementById('btnModalAction');
    
    // Touch D-Pad
    this.btnUp = document.getElementById('btnUp');
    this.btnDown = document.getElementById('btnDown');
    this.btnLeft = document.getElementById('btnLeft');
    this.btnRight = document.getElementById('btnRight');
    
    // Audio Context & State
    this.audioEnabled = true;
    this.audioCtx = null;
    
    // Game State
    this.tileCountX = Math.floor(this.canvas.width / GRID_SIZE);
    this.tileCountY = Math.floor(this.canvas.height / GRID_SIZE);
    
    this.snake = [];
    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this.targetLength = INITIAL_LENGTH;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('snake_color_highscore') || '0', 10);
    this.isPaused = false;
    this.isGameOver = false;
    this.gameSpeed = 100; // ms per tick (Normal)
    this.gameLoopTimer = null;
    
    // Active entities
    this.balls = [];
    this.particles = [];
    
    this.init();
  }

  init() {
    this.highScoreValEl.textContent = this.highScore;
    this.bindEvents();
    this.resetGame();
    this.resizeCanvas();
  }

  bindEvents() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // UI Buttons
    this.btnPause.addEventListener('click', () => this.togglePause());
    this.btnSound.addEventListener('click', () => this.toggleSound());
    this.btnRestart.addEventListener('click', () => this.resetGame());
    this.btnModalAction.addEventListener('click', () => {
      this.hideModal();
      this.resetGame();
    });

    // Speed options
    document.querySelectorAll('.btn-speed').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speedMode = btn.dataset.speed;
        if (speedMode === 'slow') this.gameSpeed = 140;
        else if (speedMode === 'normal') this.gameSpeed = 95;
        else if (speedMode === 'fast') this.gameSpeed = 65;

        if (!this.isPaused && !this.isGameOver) {
          this.startLoop();
        }
      });
    });

    // D-Pad Touch events
    if (this.btnUp) this.btnUp.addEventListener('click', () => this.setDirection(0, -1));
    if (this.btnDown) this.btnDown.addEventListener('click', () => this.setDirection(0, 1));
    if (this.btnLeft) this.btnLeft.addEventListener('click', () => this.setDirection(-1, 0));
    if (this.btnRight) this.btnRight.addEventListener('click', () => this.setDirection(1, 0));

    // Handle Window Resize
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const container = document.getElementById('canvasWrapper');
    const maxWidth = Math.min(680, container.clientWidth - 16);
    const scale = maxWidth / 600;
    this.canvas.style.width = `${maxWidth}px`;
    this.canvas.style.height = `${480 * scale}px`;
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
  }

  playSound(type) {
    if (!this.audioEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'red') {
      // Small eat sound (high chirp)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'green') {
      // Big growth chord
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'yellow') {
      // Shrink pitch slide down
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.25);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'black') {
      // Game Over Crash Sound
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  }

  toggleSound() {
    this.audioEnabled = !this.audioEnabled;
    const icon = this.btnSound.querySelector('i');
    if (this.audioEnabled) {
      icon.className = 'fa-solid fa-volume-high';
      this.showToast('Sound Enabled 🔊');
    } else {
      icon.className = 'fa-solid fa-volume-xmark';
      this.showToast('Sound Muted 🔇');
    }
  }

  togglePause() {
    if (this.isGameOver) return;
    this.isPaused = !this.isPaused;
    const icon = this.btnPause.querySelector('i');
    
    if (this.isPaused) {
      icon.className = 'fa-solid fa-play';
      this.stopLoop();
      this.showModal('Game Paused', 'Take a breather!', 'fa-circle-pause', '#3b82f6', '#dbeafe', 'Resume Game');
    } else {
      icon.className = 'fa-solid fa-pause';
      this.hideModal();
      this.startLoop();
    }
  }

  resetGame() {
    this.stopLoop();
    this.isGameOver = false;
    this.isPaused = false;
    this.score = 0;
    this.targetLength = INITIAL_LENGTH;
    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };

    // Initial snake head position
    const startX = Math.floor(this.tileCountX / 3);
    const startY = Math.floor(this.tileCountY / 2);
    this.snake = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      this.snake.push({ x: startX - i, y: startY });
    }

    this.balls = [];
    this.particles = [];
    this.spawnBalls(5); // Maintain 5 balls on screen

    this.updateStats();
    this.btnPause.querySelector('i').className = 'fa-solid fa-pause';
    this.hideModal();
    this.showToast('Game Started! Dodge Black, Eat Colors!');

    this.startLoop();
  }

  startLoop() {
    this.stopLoop();
    this.gameLoopTimer = setInterval(() => this.update(), this.gameSpeed);
  }

  stopLoop() {
    if (this.gameLoopTimer) {
      clearInterval(this.gameLoopTimer);
      this.gameLoopTimer = null;
    }
  }

  handleKeyDown(e) {
    if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
      this.togglePause();
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      this.resetGame();
      return;
    }

    if (this.isPaused || this.isGameOver) return;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.setDirection(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.setDirection(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.setDirection(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.setDirection(1, 0);
        break;
    }
  }

  setDirection(x, y) {
    // Prevent immediate reverse direction turning
    if (x !== 0 && this.dir.x === -x) return;
    if (y !== 0 && this.dir.y === -y) return;
    this.nextDir = { x, y };
  }

  spawnBalls(targetCount = 5) {
    while (this.balls.length < targetCount) {
      let candidateX, candidateY;
      let valid = false;
      let attempts = 0;

      while (!valid && attempts < 100) {
        attempts++;
        candidateX = Math.floor(Math.random() * this.tileCountX);
        candidateY = Math.floor(Math.random() * this.tileCountY);

        // Don't spawn on snake body
        const isOnSnake = this.snake.some(seg => seg.x === candidateX && seg.y === candidateY);
        // Don't spawn on existing ball
        const isOnBall = this.balls.some(b => b.x === candidateX && b.y === candidateY);

        if (!isOnSnake && !isOnBall) {
          valid = true;
        }
      }

      if (valid) {
        const typeKey = this.getRandomBallType();
        this.balls.push({
          x: candidateX,
          y: candidateY,
          type: typeKey,
          pulse: Math.random() * Math.PI * 2
        });
      }
    }
  }

  getRandomBallType() {
    const rand = Math.random();
    let cumulative = 0;
    for (const [key, obj] of Object.entries(BALL_TYPES)) {
      cumulative += obj.weight;
      if (rand <= cumulative) {
        return key;
      }
    }
    return 'RED';
  }

  update() {
    if (this.isPaused || this.isGameOver) return;

    // Apply queued direction
    this.dir = { ...this.nextDir };

    // New head position
    const head = {
      x: this.snake[0].x + this.dir.x,
      y: this.snake[0].y + this.dir.y
    };

    // 1. Wall collision check
    if (head.x < 0 || head.x >= this.tileCountX || head.y < 0 || head.y >= this.tileCountY) {
      this.triggerGameOver('Border Collision! You hit the wall.');
      return;
    }

    // 2. Self collision check
    for (let i = 0; i < this.snake.length; i++) {
      if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
        this.triggerGameOver('Self Collision! You ran into yourself.');
        return;
      }
    }

    // Move head forward
    this.snake.unshift(head);

    // 3. Ball collision check
    let eatenIndex = -1;
    for (let i = 0; i < this.balls.length; i++) {
      if (this.balls[i].x === head.x && this.balls[i].y === head.y) {
        eatenIndex = i;
        break;
      }
    }

    if (eatenIndex !== -1) {
      const eatenBall = this.balls[eatenIndex];
      this.balls.splice(eatenIndex, 1);
      this.handleBallEaten(eatenBall);
      this.spawnBalls(5); // Replenish eaten ball
    }

    // Adjust snake length based on targetLength
    while (this.snake.length > this.targetLength) {
      this.snake.pop();
    }

    // Update Particles
    this.updateParticles();

    this.updateStats();
    this.render();
  }

  handleBallEaten(ball) {
    const px = ball.x * GRID_SIZE + GRID_SIZE / 2;
    const py = ball.y * GRID_SIZE + GRID_SIZE / 2;
    const ballConfig = BALL_TYPES[ball.type];

    // Spawn dynamic particle burst
    this.createParticles(px, py, ballConfig.color);

    if (ball.type === 'BLACK') {
      // Black Ball -> Instant Death!
      this.playSound('black');
      this.triggerGameOver('Ate a Black Ball! Instant Game Over!');
      return;
    }

    if (ball.type === 'RED') {
      // Red Ball -> Grow 10% of starting size (+1 seg)
      const inc = Math.max(1, Math.round(INITIAL_LENGTH * 0.1));
      this.targetLength += inc;
      this.score += 10;
      this.playSound('red');
      this.showToast(`Eaten Red Ball! +10% Size (+${inc} seg)`);
    } else if (ball.type === 'GREEN') {
      // Green Ball -> Grow 50% of starting size (+5 segs)
      const inc = Math.max(1, Math.round(INITIAL_LENGTH * 0.5));
      this.targetLength += inc;
      this.score += 50;
      this.playSound('green');
      this.showToast(`Eaten Green Ball! +50% Size (+${inc} segs) 🎉`);
    } else if (ball.type === 'YELLOW') {
      // Yellow Ball -> Reduced to 20% of PRESENT size!
      const currentLen = this.snake.length;
      const newLen = Math.max(1, Math.round(currentLen * 0.2));
      this.targetLength = newLen;
      
      // Trim snake array immediately
      while (this.snake.length > newLen) {
        this.snake.pop();
      }

      this.score += 20;
      this.playSound('yellow');
      this.showToast(`Touched Yellow Ball! Reduced to 20% size (${currentLen} → ${newLen} segs) ⚡`);
    }
  }

  triggerGameOver(reason) {
    this.isGameOver = true;
    this.stopLoop();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('snake_color_highscore', this.highScore.toString());
      this.highScoreValEl.textContent = this.highScore;
    }

    // Explode head on death
    const head = this.snake[0];
    if (head) {
      this.createParticles(head.x * GRID_SIZE + GRID_SIZE / 2, head.y * GRID_SIZE + GRID_SIZE / 2, '#ef4444', 30);
    }

    this.recapScore.textContent = this.score;
    this.recapLength.textContent = this.snake.length;

    this.showModal('Game Over!', reason, 'fa-skull-crossbones', '#ef4444', '#fee2e2', 'Play Again');
    this.render();
  }

  updateStats() {
    this.scoreValEl.textContent = this.score;
    this.lengthValEl.textContent = this.snake.length;
  }

  showToast(msg) {
    this.toastMsgEl.textContent = msg;
    this.toastMsgEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMsgEl.classList.remove('show');
    }, 2400);
  }

  showModal(title, subtitle, iconClass, iconColor, iconBg, btnText) {
    this.modalTitle.textContent = title;
    this.modalSubtitle.textContent = subtitle;
    this.modalIcon.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
    this.modalIcon.style.color = iconColor;
    this.modalIcon.style.background = iconBg;
    this.btnModalAction.innerHTML = `<i class="fa-solid fa-rotate-right me-2"></i> ${btnText}`;
    this.gameModal.classList.add('active');
  }

  hideModal() {
    this.gameModal.classList.remove('active');
  }

  // Particle explosion effects
  createParticles(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        radius: Math.random() * 3 + 2,
        alpha: 1,
        life: 1
      });
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.04;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render() {
    // 1. Clear background strictly to pure white as requested
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. Draw subtle white canvas grid
    this.ctx.strokeStyle = '#f1f5f9';
    this.ctx.lineWidth = 1;
    for (let x = 0; x <= this.canvas.width; x += GRID_SIZE) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y <= this.canvas.height; y += GRID_SIZE) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    // 3. Render Color Balls
    this.balls.forEach(ball => {
      const config = BALL_TYPES[ball.type];
      ball.pulse += 0.08;
      const pulseSize = Math.sin(ball.pulse) * 1.5;

      const cx = ball.x * GRID_SIZE + GRID_SIZE / 2;
      const cy = ball.y * GRID_SIZE + GRID_SIZE / 2;
      const radius = (GRID_SIZE / 2 - 2) + pulseSize;

      // Drop shadow for ball
      this.ctx.save();
      this.ctx.shadowColor = 'rgba(0,0,0,0.15)';
      this.ctx.shadowBlur = 6;
      this.ctx.shadowOffsetY = 2;

      this.ctx.beginPath();
      this.ctx.arc(cx, cy, Math.max(3, radius), 0, Math.PI * 2);
      this.ctx.fillStyle = config.color;
      this.ctx.fill();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = config.border;
      this.ctx.stroke();
      this.ctx.restore();

      // Highlight inner shine spot on color balls
      if (ball.type !== 'BLACK') {
        this.ctx.beginPath();
        this.ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.25, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.fill();
      }
    });

    // 4. Render Snake
    for (let i = this.snake.length - 1; i >= 0; i--) {
      const seg = this.snake[i];
      const cx = seg.x * GRID_SIZE;
      const cy = seg.y * GRID_SIZE;
      const isHead = i === 0;

      this.ctx.save();
      if (isHead) {
        // Snake Head - Vibrant Blue
        this.ctx.fillStyle = '#2563eb';
        this.ctx.beginPath();
        this.ctx.roundRect(cx + 1, cy + 1, GRID_SIZE - 2, GRID_SIZE - 2, 6);
        this.ctx.fill();

        // Eyes on Head based on direction
        this.ctx.fillStyle = '#ffffff';
        const eyeSize = 3;
        let eye1X = cx + 5, eye1Y = cy + 5;
        let eye2X = cx + 13, eye2Y = cy + 5;

        if (this.dir.x === 1) { // Facing Right
          eye1X = cx + 13; eye1Y = cy + 5;
          eye2X = cx + 13; eye2Y = cy + 13;
        } else if (this.dir.x === -1) { // Facing Left
          eye1X = cx + 4; eye1Y = cy + 5;
          eye2X = cx + 4; eye2Y = cy + 13;
        } else if (this.dir.y === 1) { // Facing Down
          eye1X = cx + 5; eye1Y = cy + 13;
          eye2X = cx + 13; eye2Y = cy + 13;
        }

        this.ctx.beginPath();
        this.ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
        this.ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#0f172a';
        this.ctx.beginPath();
        this.ctx.arc(eye1X, eye1Y, 1.5, 0, Math.PI * 2);
        this.ctx.arc(eye2X, eye2Y, 1.5, 0, Math.PI * 2);
        this.ctx.fill();

      } else {
        // Body segment - Gradient alpha from head to tail
        const ratio = i / this.snake.length;
        this.ctx.fillStyle = `hsl(217, 91%, ${55 + ratio * 15}%)`;
        this.ctx.beginPath();
        this.ctx.roundRect(cx + 2, cy + 2, GRID_SIZE - 4, GRID_SIZE - 4, 4);
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    // 5. Render Particle FX
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }
}

// Start Game on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new ColorSnakeGame();
});
