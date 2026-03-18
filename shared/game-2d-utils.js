/**
 * Game 2D Utilities - Otimizações de performance e efeitos visuais para jogos 2D
 * Inclui: ParticlePool, ScreenShake, Trail, FloatingText
 */

// ============================================
// PARTICLE POOL - Sistema de partículas otimizado
// ============================================
export class ParticlePool {
    constructor(maxParticles = 100) {
        this.maxParticles = maxParticles;
        this.particles = [];
        this.activeParticles = [];
        this.pool = [];

        // Pre-allocate particles
        for (let i = 0; i < maxParticles; i++) {
            this.pool.push({
                x: 0, y: 0,
                vx: 0, vy: 0,
                life: 0, maxLife: 0,
                size: 0,
                color: '',
                alpha: 1,
                active: false
            });
        }
    }

    spawn(x, y, options = {}) {
        const particle = this.pool.find(p => !p.active);
        if (!particle) return null;

        particle.x = x;
        particle.y = y;
        particle.vx = options.vx || (Math.random() - 0.5) * 4;
        particle.vy = options.vy || (Math.random() - 0.5) * 4;
        particle.life = options.life || 30;
        particle.maxLife = particle.life;
        particle.size = options.size || 3;
        particle.color = options.color || '#fff';
        particle.alpha = options.alpha || 1;
        particle.active = true;
        particle.gravity = options.gravity || 0;
        particle.decay = options.decay || 0.98;

        this.activeParticles.push(particle);
        return particle;
    }

    spawnBurst(x, y, count, options = {}) {
        const colors = options.colors || [options.color || '#fff'];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.5);
            const speed = options.speed || 3;
            this.spawn(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: colors[Math.floor(Math.random() * colors.length)],
                ...options
            });
        }
    }

    update() {
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= p.decay;
            p.vy *= p.decay;
            p.life--;
            p.alpha = p.life / p.maxLife;

            if (p.life <= 0) {
                p.active = false;
                this.activeParticles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        for (const p of this.activeParticles) {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    clear() {
        for (const p of this.activeParticles) {
            p.active = false;
        }
        this.activeParticles.length = 0;
    }
}

// ============================================
// SCREEN SHAKE - Efeito de tremor de tela
// ============================================
export class ScreenShake {
    constructor() {
        this.intensity = 0;
        this.decay = 0.9;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    shake(intensity = 10, decay = 0.9) {
        this.intensity = Math.max(this.intensity, intensity);
        this.decay = decay;
    }

    update() {
        if (this.intensity > 0.5) {
            this.offsetX = (Math.random() - 0.5) * this.intensity;
            this.offsetY = (Math.random() - 0.5) * this.intensity;
            this.intensity *= this.decay;
        } else {
            this.intensity = 0;
            this.offsetX = 0;
            this.offsetY = 0;
        }
    }

    apply(ctx) {
        if (this.intensity > 0) {
            ctx.translate(this.offsetX, this.offsetY);
        }
    }

    reset() {
        this.intensity = 0;
        this.offsetX = 0;
        this.offsetY = 0;
    }
}

// ============================================
// TRAIL - Rastro de movimento
// ============================================
export class Trail {
    constructor(maxPoints = 10) {
        this.points = [];
        this.maxPoints = maxPoints;
    }

    addPoint(x, y, options = {}) {
        this.points.push({
            x, y,
            size: options.size || 5,
            color: options.color || '#fff',
            alpha: options.alpha || 0.5,
            life: options.life || 10
        });

        if (this.points.length > this.maxPoints) {
            this.points.shift();
        }
    }

    update() {
        for (let i = this.points.length - 1; i >= 0; i--) {
            this.points[i].life--;
            if (this.points[i].life <= 0) {
                this.points.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        if (this.points.length < 2) return;

        ctx.save();
        for (let i = 0; i < this.points.length - 1; i++) {
            const p = this.points[i];
            const alpha = (p.life / 10) * p.alpha;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (p.life / 10), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    clear() {
        this.points.length = 0;
    }
}

// ============================================
// FLOATING TEXT - Texto flutuante
// ============================================
export class FloatingText {
    constructor() {
        this.texts = [];
    }

    add(x, y, text, options = {}) {
        this.texts.push({
            x, y,
            text,
            vy: options.vy || -1,
            life: options.life || 40,
            maxLife: options.life || 40,
            color: options.color || '#fff',
            font: options.font || 'bold 16px Arial',
            size: options.size || 16
        });
    }

    update() {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.y += t.vy;
            t.life--;
            if (t.life <= 0) {
                this.texts.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        for (const t of this.texts) {
            const alpha = t.life / t.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = t.color;
            ctx.font = t.font;
            ctx.textAlign = 'center';
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
    }

    clear() {
        this.texts.length = 0;
    }
}

// ============================================
// HIGHLIGHT ANIMATION - Animação de highlight
// ============================================
export class HighlightAnimation {
    constructor() {
        this.highlights = [];
    }

    add(x, y, width, height, options = {}) {
        this.highlights.push({
            x, y, width, height,
            life: options.life || 30,
            maxLife: options.life || 30,
            color: options.color || '#FFD700',
            width_line: options.width_line || 3
        });
    }

    update() {
        for (let i = this.highlights.length - 1; i >= 0; i--) {
            this.highlights[i].life--;
            if (this.highlights[i].life <= 0) {
                this.highlights.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        for (const h of this.highlights) {
            const alpha = h.life / h.maxLife;
            const pulse = 1 + Math.sin((1 - alpha) * Math.PI) * 0.2;

            ctx.globalAlpha = alpha;
            ctx.strokeStyle = h.color;
            ctx.lineWidth = h.width_line * pulse;
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = -alpha * 20;

            ctx.strokeRect(h.x, h.y, h.width, h.height);
        }
        ctx.restore();
    }

    clear() {
        this.highlights.length = 0;
    }
}
