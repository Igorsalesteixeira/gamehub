// =============================================
// 2D Games Utilities - Canvas Optimizations
// Performance, particles, screen shake, trail effects
// =============================================

// ---- Object Pooling for Particles ----
export class ParticlePool {
  constructor(maxSize = 100) {
    this.particles = [];
    this.active = [];
    this.maxSize = maxSize;
  }

  get(x, y, vx, vy, life, color, size) {
    let p = this.particles.find(p => !p.active);
    if (!p) {
      if (this.active.length >= this.maxSize) return null;
      p = {};
      this.particles.push(p);
    }
    p.x = x; p.y = y;
    p.vx = vx; p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.color = color;
    p.size = size;
    p.active = true;
    this.active.push(p);
    return p;
  }

  update() {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        p.active = false;
        this.active.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const p of this.active) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.active.length = 0;
    this.particles.forEach(p => p.active = false);
  }
}

// ---- Screen Shake Effect ----
export class ScreenShake {
  constructor() {
    this.intensity = 0;
    this.decay = 0.9;
  }

  shake(intensity = 10) {
    this.intensity = intensity;
  }

  apply(ctx) {
    if (this.intensity > 0.5) {
      const dx = (Math.random() - 0.5) * this.intensity;
      const dy = (Math.random() - 0.5) * this.intensity;
      ctx.translate(dx, dy);
      this.intensity *= this.decay;
    }
  }

  reset(ctx) {
    if (this.intensity > 0.5) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }
}

// ---- Trail Effect ----
export class Trail {
  constructor(maxLength = 10) {
    this.points = [];
    this.maxLength = maxLength;
  }

  add(x, y) {
    this.points.push({ x, y, age: 0 });
    if (this.points.length > this.maxLength) {
      this.points.shift();
    }
  }

  update() {
    for (const p of this.points) {
      p.age++;
    }
    this.points = this.points.filter(p => p.age < this.maxLength);
  }

  draw(ctx, color = '#fff', width = 2) {
    if (this.points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const alpha = 1 - (p1.age / this.maxLength);
      ctx.globalAlpha = alpha * 0.5;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.points.length = 0;
  }
}

// ---- RequestAnimationFrame Loop with Delta Time ----
export class GameLoop {
  constructor(updateFn, renderFn, targetFPS = 60) {
    this.update = updateFn;
    this.render = renderFn;
    this.targetFPS = targetFPS;
    this.interval = 1000 / targetFPS;
    this.lastTime = 0;
    this.accumulator = 0;
    this.running = false;
    this.rafId = null;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  tick() {
    if (!this.running) return;
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;
    this.accumulator += delta;

    while (this.accumulator >= this.interval) {
      this.update(this.interval / 1000);
      this.accumulator -= this.interval;
    }

    this.render();
    this.rafId = requestAnimationFrame(() => this.tick());
  }
}

// ---- Sprite Animation ----
export class Sprite {
  constructor(frames, frameRate = 10) {
    this.frames = frames; // Array of canvas/image elements
    this.frameRate = frameRate;
    this.currentFrame = 0;
    this.accumulator = 0;
    this.playing = false;
  }

  play() {
    this.playing = true;
  }

  stop() {
    this.playing = false;
    this.currentFrame = 0;
  }

  pause() {
    this.playing = false;
  }

  update(dt) {
    if (!this.playing) return;
    this.accumulator += dt;
    if (this.accumulator >= 1 / this.frameRate) {
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
      this.accumulator = 0;
    }
  }

  draw(ctx, x, y, width, height) {
    const frame = this.frames[this.currentFrame];
    if (frame) {
      ctx.drawImage(frame, x, y, width, height);
    }
  }
}

// ---- Floating Text ----
export class FloatingText {
  constructor() {
    this.texts = [];
  }

  add(text, x, y, color = '#fff', size = 16, life = 60) {
    this.texts.push({
      text, x, y,
      vx: (Math.random() - 0.5) * 2,
      vy: -1 - Math.random(),
      color, size, life, maxLife: life,
      alpha: 1
    });
  }

  update() {
    for (const t of this.texts) {
      t.x += t.vx;
      t.y += t.vy;
      t.life--;
      t.alpha = t.life / t.maxLife;
    }
    this.texts = this.texts.filter(t => t.life > 0);
  }

  draw(ctx) {
    for (const t of this.texts) {
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = t.color;
      ctx.font = `bold ${t.size}px Nunito`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

// ---- Canvas Resize Helper ----
export function resizeCanvas(canvas, container, aspectRatio = 1) {
  const rect = container.getBoundingClientRect();
  const maxWidth = rect.width - 16;
  const maxHeight = rect.height - 16;
  let width = maxWidth;
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    return true; // Resized
  }
  return false;
}

// ---- Offscreen Canvas for Caching ----
export function createOffscreenCanvas(width, height) {
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  return offscreen;
}

// ---- Batch Drawing Helper ----
export function batchDraw(ctx, drawFn) {
  ctx.save();
  drawFn();
  ctx.restore();
}

// ---- Performance Monitor ----
export class FPSCounter {
  constructor() {
    this.frames = 0;
    this.lastTime = performance.now();
    this.fps = 60;
  }

  update() {
    this.frames++;
    const now = performance.now();
    if (now - this.lastTime >= 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.lastTime = now;
    }
  }

  draw(ctx, x = 10, y = 20) {
    ctx.fillStyle = '#0f0';
    ctx.font = '12px monospace';
    ctx.fillText(`${this.fps} FPS`, x, y);
  }
}
