const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Procedural 8-Bit Audio System using Web Audio API
class AudioFX {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playClick() {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    playShoot(type = 'standard') {
        this.init();
        if (!this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        if (type === 'nuke') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(350, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.6);

            gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.6);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.6);
        } else if (type === 'crazydave') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.1);
            osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.3);

            gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.3);
        } else if (type === 'medium') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(500, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.35);

            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.35);
        } else if (type === 'bubble') {
            this.playShield();
        } else {
            // Standard / Double / Ricochet
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(700, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.2);

            gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.2);
        }
    }

    playExplosion(type = 'standard') {
        this.init();
        if (!this.ctx) return;

        const duration = type === 'nuke' ? 1.6 : (type === 'medium' ? 0.7 : 0.45);
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        
        const startFreq = type === 'nuke' ? 350 : (type === 'medium' ? 600 : 750);
        const endFreq = type === 'nuke' ? 30 : (type === 'medium' ? 60 : 80);
        
        filter.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration * 0.85);

        const gain = this.ctx.createGain();
        const startGain = type === 'nuke' ? 0.35 : (type === 'medium' ? 0.25 : 0.18);
        gain.gain.setValueAtTime(startGain, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start();
    }

    playShield() {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25]; // C major arpeggio
        notes.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + index * 0.07);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.6, now + index * 0.07 + 0.12);
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.06, now + index * 0.07 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.005, now + index * 0.07 + 0.22);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + index * 0.07);
            osc.stop(now + index * 0.07 + 0.25);
        });
    }

    playVictory() {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const melody = [
            { f: 523.25, d: 0.12 }, // C5
            { f: 523.25, d: 0.12 }, // C5
            { f: 523.25, d: 0.12 }, // C5
            { f: 523.25, d: 0.30 }, // C5
            { f: 415.30, d: 0.30 }, // G#4
            { f: 466.16, d: 0.30 }, // A#4
            { f: 523.25, d: 0.12 }, // C5
            { f: 466.16, d: 0.12 }, // A#4
            { f: 523.25, d: 0.65 }, // C5
        ];

        let timeOffset = 0;
        melody.forEach(note => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(note.f, now + timeOffset);
            
            gain.gain.setValueAtTime(0, now + timeOffset);
            gain.gain.linearRampToValueAtTime(0.07, now + timeOffset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.005, now + timeOffset + note.d - 0.02);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + timeOffset);
            osc.stop(now + timeOffset + note.d);

            timeOffset += note.d + 0.03;
        });
    }
}
const sfx = new AudioFX();

// Particle Debris System
class DebrisParticle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() * 2 - 1) * 3.5;
        this.vy = (Math.random() * 2.5 - 2) * 3.5;
        this.size = Math.floor(Math.random() * 3) + 2; // 2px to 4px
        this.color = color;
        this.gravity = 0.18;
        this.alpha = 1;
        this.decay = 0.015 + Math.random() * 0.02;
    }

    update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
        return this.alpha > 0;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}
let activeParticles = [];

// Scrolling Pixel Clouds
class ScrollCloud {
    constructor(x, y, speed, width) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.width = width;
        this.height = width * 0.38;
    }

    update() {
        this.x -= this.speed;
        if (this.x + this.width < 0) {
            this.x = WORLD_WIDTH;
            this.y = 25 + Math.random() * 110;
        }
    }

    draw() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillRect(this.x + this.width * 0.15, this.y - this.height * 0.35, this.width * 0.7, this.height * 1.35);
        ctx.fillRect(this.x + this.width * 0.3, this.y - this.height * 0.6, this.width * 0.4, this.height * 1.6);
    }
}
let clouds = [];

function initClouds() {
    clouds = [];
    for (let i = 0; i < 7; i++) {
        clouds.push(new ScrollCloud(
            Math.random() * WORLD_WIDTH,
            25 + Math.random() * 110,
            0.08 + Math.random() * 0.18,
            65 + Math.random() * 70
        ));
    }
}

// Parallax Mountains
let mountainPeaks = [];
function initMountains() {
    mountainPeaks = [];
    let y = HEIGHT - 180;
    let slope = 0;
    for (let x = 0; x <= WORLD_WIDTH + 100; x += 35) {
        if (Math.random() > 0.55) {
            slope = Math.random() * 30 - 15;
        }
        y += slope;
        y = Math.max(HEIGHT - 260, Math.min(HEIGHT - 130, y));
        mountainPeaks.push({ x: x, y: y });
    }
}

// Screen Shake variables
let shakeDuration = 0;
let shakeIntensity = 0;
function startScreenShake(duration, intensity) {
    shakeDuration = duration;
    shakeIntensity = intensity;
}

// Game State
const GAME_STATE = {
    MENU: 'MENU',
    MODE_SELECT: 'MODE_SELECT',
    TERRAIN_SELECT: 'TERRAIN_SELECT',
    DIFFICULTY_SELECT: 'DIFFICULTY_SELECT',
    PLAYING: 'PLAYING',
    GAMEOVER: 'GAMEOVER'
};
let selectedModeIndex = 0; // 0 for Quick Play, 1 for Sandbox
let selectedTerrainIndex = 0; // 0 for Mountains, 1 for Flat
let selectedDifficultyIndex = 1; // 0: Easy, 1: Medium, 2: Hard
let cpuDifficulty = 'medium';
let selectedTerrainType = 'mountains';
let lastShotDamageDealt = 0;
let lastFallDamageDealt = 0;

// DEV CONFIG: Set to true to bypass title screen menu during development
const DEV_SKIP_MENU = false; 

const skipMenu = DEV_SKIP_MENU || new URLSearchParams(window.location.search).has('skipMenu');
let currentState = skipMenu ? GAME_STATE.PLAYING : GAME_STATE.MENU;

function setGameState(state) {
    currentState = state;
    const container = document.querySelector('.game-container');
    if (container) {
        container.className = `game-container state-${state.toLowerCase()}`;
    }
    if (state === GAME_STATE.GAMEOVER) {
        if (player && player.hp > 0) {
            sfx.playVictory();
        } else {
            sfx.playExplosion('nuke');
        }
    }
}

// Entities
let terrain = [];
const VIEW_WIDTH = canvas.width;
const WORLD_WIDTH = 2500;
const WIDTH = WORLD_WIDTH;
const HEIGHT = canvas.height;
const GRAVITY = 0.5;

// Camera
const camera = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0
};

// Last shot angle tracker
let playerLastShot = {
    x: 0,
    y: 0,
    angle: 0,
    active: false
};

let cpuLastShot = {
    x: 0,
    y: 0,
    angle: 0,
    active: false
};

// Players
let turn = 0; // 0 for Player, 1 for CPU

// Trajectory Lines
let playerLastTrajectory = [];
let cpuLastTrajectory = [];

let cameraFocusOverride = null;
let lastShotDistance = 0;
let bannerQueue = [];
let activeBanner = null;
let turnTransitionTimeout = null;
let hasFiredThisTurn = false;
let currentShotIsCrazyDave = false;

class Tank {
    constructor(x, color, isPlayer) {
        this.x = x;
        this.width = 30;
        this.height = 15;
        // Place tank on terrain
        this.y = HEIGHT - this.height;
        for (let i = 0; i < terrain.length; i++) {
            if (terrain[i].x >= this.x) {
                this.y = terrain[i].y - this.height;
                break;
            }
        }
        
        this.color = color;
        this.isPlayer = isPlayer;
        this.hp = 100;
        
        // Firing parameters
        this.angle = isPlayer ? 45 : 135;
        this.power = isPlayer ? 22 : 0; // Default static power
        this.maxPower = 45; // max velocity
        this.isCharging = false;
        
        // AI memory
        this.lastShotTooShort = null;
        this.lastPower = 0;
        this.lastAngle = 135;

        // Falling animation properties
        this.targetY = this.y;
        this.isFalling = false;
        this.hoverTimer = 0;

        // Weapon inventory
        this.selectedWeapon = 'standard';
        this.mediumShots = 2;
        this.doubleShots = 3;
        this.ricochetShots = 3;
        this.bubbleShots = 1;
        this.nukeShots = 1;
        this.crazyDaveShots = 2;
        this.shieldHp = 0;
        this.isDestroyed = false;
    }

    reduceHp(amount) {
        if (this.isDestroyed || this.hp <= 0) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.explodeTank();
        }
    }

    explodeTank() {
        this.isDestroyed = true;
        
        // Spawn 65 tank-colored particles
        const numParticles = 65;
        for (let i = 0; i < numParticles; i++) {
            const p = new DebrisParticle(this.x, this.y + 7, this.color);
            p.vx = (Math.random() * 2 - 1) * 6.5;
            p.vy = (Math.random() * 2.5 - 3) * 6.5; // shoot upwards
            p.size = Math.floor(Math.random() * 4) + 3; // larger 3px to 6px
            p.gravity = 0.16;
            p.decay = 0.01 + Math.random() * 0.012;
            activeParticles.push(p);
        }
        
        // Play explosion audio
        sfx.playExplosion('nuke');
        
        // Screen shake
        startScreenShake(35, 14);
    }

    update() {
        if (this.isDestroyed) return;
        if (this.isFalling) {
            if (this.hoverTimer > 0) {
                this.hoverTimer--;
            } else {
                this.y += 2; // Simple 2px per frame fall
                if (this.y >= this.targetY) {
                    this.y = this.targetY;
                    this.isFalling = false;
                    
                    // Calculate and apply fall damage (0.4 HP per pixel fallen, absorbed by shield first)
                    const fallDistance = this.targetY - this.fallStartY;
                    if (fallDistance > 10) {
                        let damage = Math.floor(fallDistance * 0.4);
                        const oldHp = this.hp + this.shieldHp;
                        if (this.shieldHp > 0) {
                            if (this.shieldHp >= damage) {
                                this.shieldHp -= damage;
                                damage = 0;
                            } else {
                                damage -= this.shieldHp;
                                this.shieldHp = 0;
                            }
                        }
                        if (damage > 0) {
                            this.reduceHp(damage);
                        }
                        const newHp = this.hp + this.shieldHp;
                        const actualDmg = oldHp - newHp;
                        
                        const fellIsOpponent = (turn === 0 && !this.isPlayer) || (turn === 1 && this.isPlayer);
                        if (fellIsOpponent) {
                            lastFallDamageDealt += actualDmg;
                        }
                        updateHUD();

                        if (actualDmg > 0) {
                            bannerQueue.push({
                                type: 'fall',
                                tankName: this.isPlayer ? "PLAYER 1" : `CPU (${cpuDifficulty.toUpperCase()})`,
                                damage: actualDmg,
                                timer: 70
                            });
                        }
                    }
                    checkTurnTransition();
                }
            }
        }
    }

    draw() {
        if (this.isDestroyed) return;
        // Draw barrel starting from center of triangle (drawn first so base is hidden behind body)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + 7);
        const rad = this.angle * Math.PI / 180;
        ctx.lineTo(this.x + Math.cos(rad) * 20, this.y + 7 - Math.sin(rad) * 20);
        ctx.stroke();

        // Draw triangular body (8-bit style)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x - this.width/2, this.y + this.height); // bottom-left
        ctx.lineTo(this.x + this.width/2, this.y + this.height); // bottom-right
        ctx.lineTo(this.x, this.y - 10); // top peak
        ctx.closePath();
        ctx.fill();

        // Draw Health Bar above
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - 20, this.y - 25, 40, 5);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x - 20, this.y - 25, (this.hp / 100) * 40, 5);

        // Draw shield if active
        if (this.shieldHp > 0) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
            ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
            ctx.lineWidth = 3;
            ctx.setLineDash([4, 4]); // 8-bit style dash
            ctx.beginPath();
            ctx.arc(this.x, this.y + 7, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]); // Reset dash

            // Draw shield HP above health bar
            ctx.fillStyle = '#00ffff';
            ctx.font = '8px "Press Start 2P", cursive';
            ctx.textAlign = 'center';
            ctx.fillText(`SHIELD:${this.shieldHp}`, this.x, this.y - 32);
        }
    }
}

class Projectile {
    constructor(x, y, angle, power, ownerIsPlayer, type = 'standard') {
        this.x = x;
        this.y = y;
        const rad = angle * Math.PI / 180;
        this.vx = Math.cos(rad) * power;
        this.vy = -Math.sin(rad) * power;
        this.radius = type === 'medium' ? 6 : (type === 'double' ? 5 : (type === 'ricochet' ? 5 : 4));
        this.active = true;
        this.ownerIsPlayer = ownerIsPlayer;
        this.type = type;
        this.path = []; // Store path for trajectory drawing
        this.hasSplit = false;
        this.ricochetCount = 0;
        this.splitCount = 0;
        this.splitTimer = 15;
        this.isCrazyDave = (type === 'crazydave');
    }

    update() {
        if (!this.active) return;
        
        this.path.push({x: this.x, y: this.y});
        
        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;

        // Double splits into 2 when dropping (vy > 0)
        if (this.type === 'double' && this.vy > 0 && !this.hasSplit) {
            this.hasSplit = true;
            this.active = false;
            
            // Spawn 2 child standard shells
            const child1 = new Projectile(this.x, this.y, 0, 0, this.ownerIsPlayer, 'standard');
            child1.vx = this.vx + 1.5;
            child1.vy = this.vy;
            child1.path = [...this.path];
            
            const child2 = new Projectile(this.x, this.y, 0, 0, this.ownerIsPlayer, 'standard');
            child2.vx = this.vx - 1.5;
            child2.vy = this.vy;
            child2.path = [...this.path];
            
            activeProjectiles.push(child1, child2);
            return;
        }

        // Crazy Dave mitosis splitting logic
        if (this.type === 'crazydave' && this.vy > 0) {
            if (this.splitCount < 3) {
                if (this.splitTimer > 0) {
                    this.splitTimer--;
                } else {
                    this.splitTimer = 15;
                    const nextSplitCount = this.splitCount + 1;
                    const nextType = nextSplitCount === 3 ? 'ricochet' : 'crazydave';
                    
                    const child1 = new Projectile(this.x, this.y, 0, 0, this.ownerIsPlayer, nextType);
                    child1.vx = this.vx + 1.2;
                    child1.vy = this.vy;
                    child1.splitCount = nextSplitCount;
                    child1.splitTimer = 15;
                    child1.path = [...this.path];
                    child1.isCrazyDave = this.isCrazyDave;
                    
                    const child2 = new Projectile(this.x, this.y, 0, 0, this.ownerIsPlayer, nextType);
                    child2.vx = this.vx - 1.2;
                    child2.vy = this.vy;
                    child2.splitCount = nextSplitCount;
                    child2.splitTimer = 15;
                    child2.path = [...this.path];
                    child2.isCrazyDave = this.isCrazyDave;
                    
                    activeProjectiles.push(child1, child2);
                    this.active = false;
                    return;
                }
            }
        }

        // Bounce off left/right walls
        if (this.x < 0) {
            this.x = 0;
            this.vx = -this.vx;
        } else if (this.x > WIDTH) {
            this.x = WIDTH;
            this.vx = -this.vx;
        }

        // Collision with bottom boundary
        if (this.y > HEIGHT) {
            this.explode();
        }

        // Collision with terrain
        if (this.active) {
            for (let i = 0; i < terrain.length; i++) {
                if (Math.abs(this.x - terrain[i].x) < 5 && this.y >= terrain[i].y) {
                    if (this.type === 'ricochet' && this.ricochetCount < 3) {
                        this.ricochetCount++;
                        destroyTerrain(this.x, this.y, 20); // smaller impact on bounce
                        
                        const randAngle = 45 + Math.random() * 90; // 45 to 135 deg
                        const rad = randAngle * Math.PI / 180;
                        const bouncePower = 5 + Math.random() * 8; // Random power between 5 and 13
                        this.vx = Math.cos(rad) * bouncePower;
                        this.vy = -Math.sin(rad) * bouncePower;
                        this.y = terrain[i].y - 8; // Adjust upward to avoid stuck
                    } else {
                        this.explode();
                    }
                    break;
                }
            }
        }

        // Collision with tanks
        if (this.active) {
            let target = this.ownerIsPlayer ? cpu : player;
            
            // Check shield collision first if active!
            if (target.shieldHp > 0) {
                const dx = this.x - target.x;
                const dy = this.y - (target.y + 7);
                const distance = Math.sqrt(dx * dx + dy * dy);
                const shieldRadius = 25;
                if (distance < shieldRadius + this.radius) {
                    let damage = 30;
                    if (this.type === 'nuke') {
                        damage = 80;
                    } else if (this.type === 'medium') {
                        damage = 50;
                    }
                    
                    if (this.type === 'ricochet' && this.ricochetCount < 3) {
                        this.ricochetCount++;
                        const oldTargetHp = target.hp + target.shieldHp;
                        target.shieldHp -= 15;
                        if (target.shieldHp < 0) target.shieldHp = 0;
                        const newTargetHp = target.hp + target.shieldHp;
                        const targetIsOpponent = (this.ownerIsPlayer && target === cpu) || (!this.ownerIsPlayer && target === player);
                        if (targetIsOpponent) {
                            lastShotDamageDealt += (oldTargetHp - newTargetHp);
                        }
                        destroyTerrain(this.x, this.y, 20);
                        
                        const randAngle = 45 + Math.random() * 90;
                        const rad = randAngle * Math.PI / 180;
                        const bouncePower = 5 + Math.random() * 8;
                        this.vx = Math.cos(rad) * bouncePower;
                        this.vy = -Math.sin(rad) * bouncePower;
                        this.y = (target.y + 7) - 33;
                    } else {
                        const oldTargetHp = target.hp + target.shieldHp;
                        target.shieldHp -= damage;
                        if (target.shieldHp < 0) target.shieldHp = 0;
                        const newTargetHp = target.hp + target.shieldHp;
                        const targetIsOpponent = (this.ownerIsPlayer && target === cpu) || (!this.ownerIsPlayer && target === player);
                        if (targetIsOpponent) {
                            lastShotDamageDealt += (oldTargetHp - newTargetHp);
                        }
                        this.explode(target);
                    }
                    updateHUD();
                    return; // Handled by shield
                }
            }

            if (this.x > target.x - target.width/2 && this.x < target.x + target.width/2 &&
                this.y > target.y - target.height && this.y < target.y + target.height) {
                
                if (this.type === 'ricochet' && this.ricochetCount < 3) {
                    this.ricochetCount++;
                    const oldTargetHp = target.hp + target.shieldHp;
                    target.reduceHp(15); // Lower damage for intermediate ricochet hits
                    const newTargetHp = target.hp + target.shieldHp;
                    const targetIsOpponent = (this.ownerIsPlayer && target === cpu) || (!this.ownerIsPlayer && target === player);
                    if (targetIsOpponent) {
                        lastShotDamageDealt += (oldTargetHp - newTargetHp);
                    }
                    destroyTerrain(this.x, this.y, 20);
                    
                    const randAngle = 45 + Math.random() * 90;
                    const rad = randAngle * Math.PI / 180;
                    const bouncePower = 5 + Math.random() * 8; // Random power between 5 and 13
                    this.vx = Math.cos(rad) * bouncePower;
                    this.vy = -Math.sin(rad) * bouncePower;
                    this.y = target.y - target.height - 8;
                } else {
                    let damage = 30;
                    if (this.type === 'nuke') {
                        damage = 80;
                    } else if (this.type === 'medium') {
                        damage = 50;
                    }
                    const oldTargetHp = target.hp + target.shieldHp;
                    target.reduceHp(damage);
                    const newTargetHp = target.hp + target.shieldHp;
                    const targetIsOpponent = (this.ownerIsPlayer && target === cpu) || (!this.ownerIsPlayer && target === player);
                    if (targetIsOpponent) {
                        lastShotDamageDealt += (oldTargetHp - newTargetHp);
                    }
                    this.explode(target);
                }
            }
        }
    }

    explode(directHitTank = null) {
        this.active = false;
        if (this.ownerIsPlayer) {
            playerLastTrajectory = [...this.path];
        } else {
            cpuLastTrajectory = [...this.path];
        }
        
        // Spawn active explosion instead of destroying terrain immediately
        const craterRadius = this.type === 'nuke' ? 90 : (this.type === 'medium' ? 45 : 25);
        const expl = new Explosion(this.x, this.y, craterRadius, this.type, this.ownerIsPlayer, directHitTank);
        expl.isCrazyDave = this.isCrazyDave;
        activeExplosions.push(expl);

        // Distance feedback calculation
        const target = this.ownerIsPlayer ? cpu : player;
        const dx = this.x - target.x;
        const dy = this.y - (target.y + 7);
        const distance = Math.round(Math.sqrt(dx * dx + dy * dy));

        // Duration of feedback should account for the explosion animation time
        const explosionDuration = this.type === 'nuke' ? 60 : 20;
        lastShotDistance = distance;

        cameraFocusOverride = {
            x: this.x,
            y: this.y,
            duration: 120 + explosionDuration
        };
    }

    draw() {
        if (!this.active) return;
        
        if (this.type === 'nuke') {
            ctx.save();
            ctx.translate(this.x, this.y);
            // Rotate based on the velocity vector to align with path
            const angle = Math.atan2(this.vy, this.vx);
            ctx.rotate(angle);
            
            // Draw a retro mini-nuke (fat yellow/green bomb with black fins)
            // Fins (tail)
            ctx.fillStyle = '#111111';
            ctx.fillRect(-10, -6, 3, 12); // vertical tail fin
            ctx.fillRect(-10, -2, 6, 4);  // tail connector
            
            // Bomb body (fat oval shape)
            ctx.fillStyle = '#8b9bb4'; // metal gray/blue
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Yellow stripe/band
            ctx.fillStyle = '#eab308'; // retro yellow
            ctx.fillRect(0, -5, 3, 10);
            
            // Nose cone tip (pointed/rounded front)
            ctx.fillStyle = '#ef4444'; // red tip
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(5, -4);
            ctx.lineTo(5, 4);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        } else if (this.type === 'crazydave') {
            ctx.fillStyle = Math.floor(Date.now() / 80) % 2 === 0 ? '#eab308' : '#ef4444'; // fast flashing yellow/red
            ctx.beginPath();
            ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw a small outline to make it stand out
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else {
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class Explosion {
    constructor(x, y, radius, type, ownerIsPlayer, directHitTank = null) {
        this.x = x;
        this.y = y;
        this.maxRadius = radius;
        this.currentRadius = 0;
        this.type = type;
        this.ownerIsPlayer = ownerIsPlayer;
        this.duration = type === 'nuke' ? 60 : 20; // Nuke is a longer explosion
        this.elapsed = 0;
        this.done = false;
        this.directHitTank = directHitTank;
        this.isCrazyDave = false;

        // Trigger procedural audio
        sfx.playExplosion(type);

        // Trigger screen shake
        const shakeD = type === 'nuke' ? 30 : (type === 'medium' ? 15 : 8);
        const shakeI = type === 'nuke' ? 12 : (type === 'medium' ? 6 : 3);
        startScreenShake(shakeD, shakeI);

        // Spawn explosion particles
        const colors = type === 'nuke' 
            ? ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#ffffff', '#a855f7'] 
            : ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#ffffff'];
        const numParticles = type === 'nuke' ? 45 : (type === 'medium' ? 22 : 12);
        for (let i = 0; i < numParticles; i++) {
            activeParticles.push(new DebrisParticle(this.x, this.y, colors[Math.floor(Math.random() * colors.length)]));
        }
    }

    update() {
        this.elapsed++;
        // Ease out quadratic
        const t = this.elapsed / this.duration;
        this.currentRadius = this.maxRadius * (1 - (1 - t) * (1 - t));
        
        if (this.elapsed >= this.duration) {
            this.done = true;
            
            // Actually destroy terrain at the end of the animation!
            destroyTerrain(this.x, this.y, this.maxRadius);
            
            // Proximity damage to other tanks (for all weapons, scaled by distance to center)
            [player, cpu].forEach(tank => {
                if (this.directHitTank === tank) return; // Prevent double damage for direct hit

                const dx = this.x - tank.x;
                const dy = this.y - (tank.y + 7);
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.maxRadius) {
                    const pct = 1 - (dist / this.maxRadius);
                    let maxDmg = 30;
                    if (this.type === 'nuke') {
                        maxDmg = 80;
                    } else if (this.type === 'medium') {
                        maxDmg = 50;
                    }
                    const dmg = Math.floor(maxDmg * pct);
                    if (dmg > 0) {
                        const oldTargetHp = tank.hp + tank.shieldHp;
                        if (tank.shieldHp > 0) {
                            if (tank.shieldHp >= dmg) {
                                tank.shieldHp -= dmg;
                            } else {
                                tank.reduceHp(dmg - tank.shieldHp);
                                tank.shieldHp = 0;
                            }
                        } else {
                            tank.reduceHp(dmg);
                        }
                        const newTargetHp = tank.hp + tank.shieldHp;
                        
                        const targetIsOpponent = (this.ownerIsPlayer && tank === cpu) || (!this.ownerIsPlayer && tank === player);
                        if (targetIsOpponent) {
                            lastShotDamageDealt += (oldTargetHp - newTargetHp);
                        }
                    }
                }
            });
            updateHUD();
            
            // Queue hit/miss feedback banner
            if (!this.isCrazyDave) {
                bannerQueue.push({
                    type: 'hit',
                    distance: lastShotDistance,
                    damage: lastShotDamageDealt,
                    timer: 70
                });
            }

            checkTurnTransition();
        }
    }

    draw() {
        const t = this.elapsed / this.duration;
        const opacity = 1 - t;
        
        ctx.save();
        
        if (this.type === 'nuke') {
            // Draw a growing pixelated mushroom cloud / plasma sphere
            // Outer cloud outline
            ctx.fillStyle = `rgba(255, 60, 0, ${opacity * 0.75})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.currentRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Middle fire layer
            ctx.fillStyle = `rgba(255, 150, 0, ${opacity * 0.85})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.currentRadius * 0.7, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner nuclear core
            ctx.fillStyle = `rgba(255, 255, 200, ${opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.currentRadius * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Draw some shockwave debris/lines
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.currentRadius * 0.85, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Standard / Medium explosion
            ctx.fillStyle = `rgba(255, ${Math.floor(100 + 155 * (1-t))}, 0, ${opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.currentRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

function checkTurnTransition(delayMs = 0) {
    if (currentState !== GAME_STATE.PLAYING) return;
    const anyActive = activeProjectiles.some(p => p.active) || activeExplosions.some(e => !e.done);
    
    // Process falling positions only after all projectiles and explosions have settled
    if (!anyActive) {
        if (currentShotIsCrazyDave) {
            currentShotIsCrazyDave = false;
            bannerQueue.push({
                type: 'hit',
                distance: lastShotDistance,
                damage: lastShotDamageDealt,
                timer: 55,
                isCrazyDave: true
            });
        }
        updateTankPositions();
    }

    const anyFalling = player.isFalling || cpu.isFalling;
    const showingBanners = bannerQueue.length > 0 || activeBanner !== null;
    
    if (!anyActive && !anyFalling && !showingBanners) {
        if (player.hp <= 0 || cpu.hp <= 0) {
            if (turnTransitionTimeout) clearTimeout(turnTransitionTimeout);
            setGameState(GAME_STATE.GAMEOVER);
            updateHUD();
            return;
        }

        if (delayMs > 0) {
            if (turnTransitionTimeout) clearTimeout(turnTransitionTimeout);
            turnTransitionTimeout = setTimeout(() => {
                if (currentState !== GAME_STATE.PLAYING) return;
                const stillActive = activeProjectiles.some(p => p.active) || activeExplosions.some(e => !e.done);
                const stillFalling = player.isFalling || cpu.isFalling;
                const stillBanners = bannerQueue.length > 0 || activeBanner !== null;
                if (!stillActive && !stillFalling && !stillBanners) {
                    performTurnTransition();
                }
            }, delayMs);
        } else {
            if (turnTransitionTimeout) clearTimeout(turnTransitionTimeout);
            performTurnTransition();
        }
    }
}

function performTurnTransition() {
    cameraFocusOverride = null; // Clear the camera focus override to pan to the new active player
    turn = turn === 0 ? 1 : 0;
    hasFiredThisTurn = false;
    if (turn === 1) {
        setTimeout(cpuTurn, 1000);
    }
    updateHUD();
}

function destroyTerrain(impactX, impactY, radius) {
    for (let i = 0; i < terrain.length; i++) {
        const dist = Math.abs(terrain[i].x - impactX);
        if (dist < radius) {
            // Semi-circular crater math
            const depth = Math.sqrt(radius * radius - dist * dist);
            const craterBottomY = impactY + depth;
            if (terrain[i].y < craterBottomY) {
                terrain[i].y = craterBottomY;
                if (terrain[i].y > HEIGHT) terrain[i].y = HEIGHT;
            }
        }
    }
}

function updateTankPositions() {
    if (!player || !cpu) return;
    
    // Player
    if (!player.isDestroyed) {
        for (let i = 0; i < terrain.length; i++) {
            if (terrain[i].x >= player.x) {
                const nextTargetY = terrain[i].y - player.height;
                if (nextTargetY > player.y) {
                    if (!player.isFalling) {
                        player.targetY = nextTargetY;
                        player.fallStartY = player.y; // Record start of fall
                        player.isFalling = true;
                        player.hoverTimer = 60; // 60 frames = 1 second at 60fps
                    }
                } else {
                    player.y = nextTargetY;
                    player.targetY = nextTargetY;
                    player.isFalling = false;
                }
                break;
            }
        }
    }
    
    // CPU
    if (!cpu.isDestroyed) {
        for (let i = 0; i < terrain.length; i++) {
            if (terrain[i].x >= cpu.x) {
                const nextTargetY = terrain[i].y - cpu.height;
                if (nextTargetY > cpu.y) {
                    if (!cpu.isFalling) {
                        cpu.targetY = nextTargetY;
                        cpu.fallStartY = cpu.y; // Record start of fall
                        cpu.isFalling = true;
                        cpu.hoverTimer = 60; // 60 frames = 1 second at 60fps
                    }
                } else {
                    cpu.y = nextTargetY;
                    cpu.targetY = nextTargetY;
                    cpu.isFalling = false;
                }
                break;
            }
        }
    }
}

let player, cpu;
let activeProjectiles = [];
let activeExplosions = [];

// Generate 8-bit style terrain
// Generate 8-bit style terrain (either Mountains or Flat)
function generateTerrain(type = 'mountains') {
    terrain = [];
    let startY = HEIGHT - 120;
    
    if (type === 'flat') {
        // Flat: very minor shifts, low ground level
        startY = HEIGHT - 100;
        for (let x = 0; x <= WIDTH; x += 5) {
            terrain.push({x: x, y: startY});
            if (Math.random() > 0.95) {
                startY += (Math.random() * 4 - 2); // very small bumps
                if (startY > HEIGHT - 80) startY = HEIGHT - 80;
                if (startY < HEIGHT - 120) startY = HEIGHT - 120;
            }
        }
    } else {
        // Mountains: steep slopes and high peaks
        startY = HEIGHT - 150;
        let slope = 0;
        for (let x = 0; x <= WIDTH; x += 5) {
            terrain.push({x: x, y: startY});
            if (Math.random() > 0.8) {
                slope += (Math.random() * 12 - 6);
                slope = Math.max(-15, Math.min(15, slope));
            }
            startY += slope;
            if (startY > HEIGHT - 60) {
                startY = HEIGHT - 60;
                slope = -Math.abs(slope) * 0.5;
            }
            if (startY < HEIGHT - 350) {
                startY = HEIGHT - 350;
                slope = Math.abs(slope) * 0.5;
            }
        }
    }
}

function startGamePlay(terrainType) {
    generateTerrain(terrainType);
    initClouds();
    initMountains();
    activeParticles = [];
    player = new Tank(100, '#3b82f6', true);
    cpu = new Tank(WIDTH - 100, '#ef4444', false);
    cpu.lastShotTooShort = null;
    cpu.lastShotShortLongSwitched = false;
    cpu.hardStep = 4;
    turn = 0;
    playerLastTrajectory = [];
    cpuLastTrajectory = [];
    playerLastShot.active = false;
    cpuLastShot.active = false;
    camera.x = Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, player.x - VIEW_WIDTH / 2));
    camera.y = Math.min(0, player.y - HEIGHT / 2);
    camera.targetX = camera.x;
    camera.targetY = camera.y;
    cameraFocusOverride = null;
    activeProjectiles = [];
    activeExplosions = [];
    bannerQueue = [];
    activeBanner = null;
    hasFiredThisTurn = false;
    currentShotIsCrazyDave = false;
    setGameState(GAME_STATE.PLAYING);
    updateHUD();
}

function initGame() {
    // Generate standard mountains initially as a placeholder before mode/terrain selects
    generateTerrain('mountains');
    initClouds();
    initMountains();
    activeParticles = [];
    player = new Tank(100, '#3b82f6', true);
    cpu = new Tank(WIDTH - 100, '#ef4444', false);
    turn = 0;
    
    // Check whether to start directly in gameplay or menu
    const skipMenu = DEV_SKIP_MENU || new URLSearchParams(window.location.search).has('skipMenu');
    setGameState(skipMenu ? GAME_STATE.PLAYING : GAME_STATE.MENU);

    playerLastTrajectory = [];
    cpuLastTrajectory = [];
    playerLastShot.active = false;
    cpuLastShot.active = false;
    camera.x = Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, player.x - VIEW_WIDTH / 2));
    camera.y = Math.min(0, player.y - HEIGHT / 2);
    camera.targetX = camera.x;
    camera.targetY = camera.y;
    cameraFocusOverride = null;
    activeProjectiles = [];
    activeExplosions = [];
    bannerQueue = [];
    activeBanner = null;
    currentShotIsCrazyDave = false;
    updateHUD();
    gameLoop();
}

// Input Handling
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

const touchKeys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

window.addEventListener('keydown', (e) => {
    sfx.init();
    
    // Play a menu selection sound on any key during menu navigation
    if (currentState === GAME_STATE.MENU || currentState === GAME_STATE.MODE_SELECT || 
        currentState === GAME_STATE.TERRAIN_SELECT || currentState === GAME_STATE.DIFFICULTY_SELECT || 
        currentState === GAME_STATE.GAMEOVER) {
        sfx.playClick();
    }

    if (currentState === GAME_STATE.MENU) {
        setGameState(GAME_STATE.MODE_SELECT);
        updateHUD();
        return;
    }
    if (currentState === GAME_STATE.MODE_SELECT) {
        if (e.code === 'ArrowUp') {
            selectedModeIndex = 0;
        }
        if (e.code === 'ArrowDown') {
            selectedModeIndex = 1;
        }
        if (e.code === 'Space' || e.code === 'Enter') {
            if (selectedModeIndex === 0) {
                cpuDifficulty = 'medium';
                const randomTerrain = Math.random() < 0.5 ? 'mountains' : 'flat';
                startGamePlay(randomTerrain);
            } else {
                setGameState(GAME_STATE.TERRAIN_SELECT);
                updateHUD();
            }
        }
        return;
    }
    if (currentState === GAME_STATE.TERRAIN_SELECT) {
        if (e.code === 'ArrowUp') {
            selectedTerrainIndex = 0;
        }
        if (e.code === 'ArrowDown') {
            selectedTerrainIndex = 1;
        }
        if (e.code === 'Space' || e.code === 'Enter') {
            selectedTerrainType = selectedTerrainIndex === 0 ? 'mountains' : 'flat';
            setGameState(GAME_STATE.DIFFICULTY_SELECT);
            updateHUD();
        }
        return;
    }
    if (currentState === GAME_STATE.DIFFICULTY_SELECT) {
        if (e.code === 'ArrowUp') {
            selectedDifficultyIndex = (selectedDifficultyIndex - 1 + 3) % 3;
        }
        if (e.code === 'ArrowDown') {
            selectedDifficultyIndex = (selectedDifficultyIndex + 1) % 3;
        }
        if (e.code === 'Space' || e.code === 'Enter') {
            cpuDifficulty = selectedDifficultyIndex === 0 ? 'easy' : (selectedDifficultyIndex === 1 ? 'medium' : 'hard');
            startGamePlay(selectedTerrainType);
        }
        return;
    }
    if (currentState === GAME_STATE.GAMEOVER) {
        if (e.code === 'Space' || e.code === 'Enter') {
            setGameState(GAME_STATE.MODE_SELECT);
            updateHUD();
        }
        return;
    }
    if (currentState !== GAME_STATE.PLAYING || turn !== 0 || activeProjectiles.some(p => p.active)) return;
    
    if (e.code === 'ArrowUp') keys.ArrowUp = true;
    if (e.code === 'ArrowDown') keys.ArrowDown = true;
    if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
    if (e.code === 'ArrowRight') keys.ArrowRight = true;
    if (e.code === 'Space' && !keys.Space) {
        keys.Space = true;
        fireProjectile(player);
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp') keys.ArrowUp = false;
    if (e.code === 'ArrowDown') keys.ArrowDown = false;
    if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
    if (e.code === 'ArrowRight') keys.ArrowRight = false;
    if (e.code === 'Space') keys.Space = false;
});

function handleInput() {
    if (currentState !== GAME_STATE.PLAYING || turn !== 0 || activeProjectiles.some(p => p.active)) return;

    // Angle adjustment: Left/Right keys or touch buttons
    if ((keys.ArrowLeft || touchKeys.ArrowLeft) && player.angle < 180) {
        player.angle += 1;
        updateHUD();
    }
    if ((keys.ArrowRight || touchKeys.ArrowRight) && player.angle > 0) {
        player.angle -= 1;
        updateHUD();
    }

    // Power adjustment: Up/Down keys or touch buttons
    if ((keys.ArrowUp || touchKeys.ArrowUp) && player.power < player.maxPower) {
        player.power += 0.1;
        if (player.power > player.maxPower) player.power = player.maxPower;
        updateHUD();
    }
    if ((keys.ArrowDown || touchKeys.ArrowDown) && player.power > 0) {
        player.power -= 0.1;
        if (player.power < 0) player.power = 0;
        updateHUD();
    }
}

function fireProjectile(tank) {
    if (tank.isPlayer) {
        if (hasFiredThisTurn) return;
        hasFiredThisTurn = true;
    }
    let weaponType = tank.selectedWeapon || 'standard';
    lastShotDamageDealt = 0;
    lastFallDamageDealt = 0;
    currentShotIsCrazyDave = (weaponType === 'crazydave');
    const rad = tank.angle * Math.PI / 180;
    const spawnX = tank.x + Math.cos(rad) * 20;
    const spawnY = tank.y + 7 - Math.sin(rad) * 20;
    
    // Deduct shot count and play shooting sounds
    if (weaponType === 'medium') {
        tank.mediumShots--;
        if (tank.mediumShots <= 0) tank.selectedWeapon = 'standard';
    } else if (weaponType === 'double') {
        tank.doubleShots--;
        if (tank.doubleShots <= 0) tank.selectedWeapon = 'standard';
    } else if (weaponType === 'ricochet') {
        tank.ricochetShots--;
        if (tank.ricochetShots <= 0) tank.selectedWeapon = 'standard';
    } else if (weaponType === 'nuke') {
        tank.nukeShots--;
        if (tank.nukeShots <= 0) tank.selectedWeapon = 'standard';
    } else if (weaponType === 'crazydave') {
        tank.crazyDaveShots--;
        if (tank.crazyDaveShots <= 0) tank.selectedWeapon = 'standard';
    } else if (weaponType === 'bubble') {
        tank.bubbleShots--;
        tank.shieldHp = 50;
        tank.selectedWeapon = 'standard';
        updateHUD();
        
        // Visual feedback banner for shield activation
        bannerQueue.push({
            type: 'shield',
            tankName: tank.isPlayer ? "PLAYER 1" : `CPU (${cpuDifficulty.toUpperCase()})`,
            timer: 70
        });
        sfx.playShield();
        
        updateHUD();
        checkTurnTransition();
        return;
    }
    
    // Play shoot sound
    sfx.playShoot(weaponType);

    if (tank.isPlayer) {
        playerLastShot = {
            x: spawnX,
            y: spawnY,
            angle: tank.angle,
            active: true
        };
    } else {
        cpuLastShot = {
            x: spawnX,
            y: spawnY,
            angle: tank.angle,
            active: true
        };
    }
    activeProjectiles.push(new Projectile(spawnX, spawnY, tank.angle, tank.power, tank.isPlayer, weaponType));
    updateHUD();
}

function cpuTurn() {
    if (currentState !== GAME_STATE.PLAYING) return;
    
    // Intelligent Weapon/Shield selection for CPU
    if (cpu.shieldHp <= 0 && cpu.bubbleShots > 0 && (cpu.hp < 40 || Math.random() < 0.25)) {
        cpu.selectedWeapon = 'bubble';
    } else {
        const options = ['standard'];
        if (cpu.nukeShots > 0) options.push('nuke');
        if (cpu.crazyDaveShots > 0) options.push('crazydave');
        if (cpu.mediumShots > 0) options.push('medium');
        if (cpu.doubleShots > 0) options.push('double');
        if (cpu.ricochetShots > 0) options.push('ricochet');

        const selectChance = cpuDifficulty === 'hard' ? 0.65 : (cpuDifficulty === 'medium' ? 0.35 : 0.1);
        if (options.length > 1 && Math.random() < selectChance) {
            cpu.selectedWeapon = options[Math.floor(Math.random() * (options.length - 1)) + 1];
        } else {
            cpu.selectedWeapon = 'standard';
        }
    }
    
    let baseAngle = 135;
    let basePower = 27;
    
    if (cpu.lastShotTooShort === null) {
        cpu.angle = baseAngle;
        cpu.power = basePower;
        cpu.hardStep = 4;
    } else {
        let adjustment = 3;
        if (cpuDifficulty === 'easy') {
            adjustment = 5;
        } else if (cpuDifficulty === 'hard') {
            if (cpu.lastShotShortLongSwitched) {
                cpu.hardStep = Math.max(1, (cpu.hardStep || 4) * 0.5);
            } else {
                cpu.hardStep = cpu.hardStep || 4;
            }
            adjustment = cpu.hardStep;
        }
        
        if (cpu.lastShotTooShort) {
            cpu.power += adjustment;
        } else {
            cpu.power -= adjustment;
        }
    }
    
    let angleNoise = 0;
    let powerNoise = 0;
    if (cpuDifficulty === 'easy') {
        angleNoise = (Math.random() * 12 - 6);
        powerNoise = (Math.random() * 6 - 3);
    } else if (cpuDifficulty === 'medium') {
        angleNoise = (Math.random() * 4 - 2);
        powerNoise = (Math.random() * 2 - 1);
    }
    
    cpu.angle = 135 + angleNoise;
    cpu.angle = Math.max(90, Math.min(180, cpu.angle));
    
    cpu.power += powerNoise;
    cpu.power = Math.max(9, Math.min(cpu.maxPower, cpu.power));
    
    cpu.lastAngle = cpu.angle;
    cpu.lastPower = cpu.power;
    
    setTimeout(() => {
        fireProjectile(cpu);
    }, 1000);
}

// Intercept explode to update CPU AI logic
const originalExplode = Projectile.prototype.explode;
Projectile.prototype.explode = function(directHitTank) {
    if (!this.ownerIsPlayer) {
        const wasTooShort = cpu.lastShotTooShort;
        // CPU shot landed at this.x
        // Player is at player.x
        // CPU shoots left. If this.x > player.x, it fell short. If this.x < player.x, it went too far.
        if (this.x > player.x) {
            cpu.lastShotTooShort = true;
        } else {
            cpu.lastShotTooShort = false;
        }
        if (wasTooShort !== null && wasTooShort !== cpu.lastShotTooShort) {
            cpu.lastShotShortLongSwitched = true;
        } else {
            cpu.lastShotShortLongSwitched = false;
        }
    }
    originalExplode.call(this, directHitTank);
};

function updateHUD() {
    document.getElementById('player-hp').innerText = player.hp;
    document.getElementById('cpu-hp').innerText = cpu.hp;
    
    const cpuName = document.querySelector('#cpu-hud p');
    if (cpuName) {
        cpuName.innerText = `CPU (${cpuDifficulty.toUpperCase()})`;
    }

    const playerShieldSpan = document.getElementById('player-shield');
    if (playerShieldSpan) playerShieldSpan.innerText = player.shieldHp;
    const cpuShieldSpan = document.getElementById('cpu-shield');
    if (cpuShieldSpan) cpuShieldSpan.innerText = cpu.shieldHp;

    const playerHpBar = document.getElementById('player-hp-bar');
    if (playerHpBar) {
        playerHpBar.style.width = player.hp + '%';
        if (player.hp < 30) playerHpBar.style.backgroundColor = 'var(--cpu-color)';
        else if (player.hp < 60) playerHpBar.style.backgroundColor = 'var(--primary-color)';
        else playerHpBar.style.backgroundColor = '#22c55e';
    }
    const cpuHpBar = document.getElementById('cpu-hp-bar');
    if (cpuHpBar) {
        cpuHpBar.style.width = cpu.hp + '%';
        if (cpu.hp < 30) cpuHpBar.style.backgroundColor = 'var(--cpu-color)';
        else if (cpu.hp < 60) cpuHpBar.style.backgroundColor = 'var(--primary-color)';
        else cpuHpBar.style.backgroundColor = '#22c55e';
    }

    const playerShieldBar = document.getElementById('player-shield-bar');
    if (playerShieldBar) {
        playerShieldBar.style.width = (player.shieldHp / 50 * 100) + '%';
    }
    const cpuShieldBar = document.getElementById('cpu-shield-bar');
    if (cpuShieldBar) {
        cpuShieldBar.style.width = (cpu.shieldHp / 50 * 100) + '%';
    }
    
    let turnIndicator = document.getElementById('turn-indicator');
    const leftArrow = document.getElementById('turn-arrow-left');
    const rightArrow = document.getElementById('turn-arrow-right');
    const isProjectileActive = activeProjectiles.some(p => p.active);

    // Update SVG turn arrows in the header
    if (currentState !== GAME_STATE.PLAYING) {
        if (leftArrow) leftArrow.style.visibility = 'hidden';
        if (rightArrow) rightArrow.style.visibility = 'hidden';
    } else {
        if (turn === 0) {
            if (leftArrow) {
                leftArrow.style.visibility = 'visible';
                leftArrow.style.animation = isProjectileActive ? 'none' : 'blink 1.2s infinite';
            }
            if (rightArrow) rightArrow.style.visibility = 'hidden';
        } else {
            if (leftArrow) leftArrow.style.visibility = 'hidden';
            if (rightArrow) {
                rightArrow.style.visibility = 'visible';
                rightArrow.style.animation = isProjectileActive ? 'none' : 'blink 1.2s infinite';
            }
        }
    }

    if (currentState === GAME_STATE.GAMEOVER) {
        if (turnIndicator) {
            turnIndicator.innerHTML = player.hp > 0 ? "PLAYER 1<br>WINS!" : "CPU<br>WINS!";
            turnIndicator.style.animation = "none";
            turnIndicator.style.color = player.hp > 0 ? "var(--player-color)" : "var(--cpu-color)";
        }
    } else {
        if (turnIndicator) {
            if (isProjectileActive) {
                turnIndicator.innerHTML = "FIRING...";
                turnIndicator.style.color = "var(--primary-color)";
                turnIndicator.style.animation = "none";
            } else {
                turnIndicator.innerHTML = turn === 0 ? "READY" : "WAITING";
                turnIndicator.style.color = turn === 0 ? "var(--player-color)" : "var(--cpu-color)";
                turnIndicator.style.animation = "blink 1.5s infinite";
            }
        }
    }

    if (turn === 0) {
        document.getElementById('angle-display').innerText = player.angle;
        document.getElementById('power-display').innerText = Math.floor((player.power / player.maxPower) * 100);
        
        const needle = document.getElementById('angle-needle');
        if (needle) {
            const rad = player.angle * Math.PI / 180;
            const x2 = 12 + Math.cos(rad) * 9;
            const y2 = 18 - Math.sin(rad) * 9;
            needle.setAttribute('x2', x2);
            needle.setAttribute('y2', y2);
        }

        const powerFill = document.getElementById('power-fill');
        if (powerFill) {
            const pct = Math.floor((player.power / player.maxPower) * 100);
            const width = (pct / 100) * 20;
            powerFill.setAttribute('width', width);
            powerFill.setAttribute('y', 5);
            powerFill.setAttribute('height', 6);
            if (pct < 40) {
                powerFill.setAttribute('fill', '#4ade80');
            } else if (pct < 75) {
                powerFill.setAttribute('fill', '#ffcc00');
            } else {
                powerFill.setAttribute('fill', '#ef4444');
            }
        }
    } else {
        document.getElementById('angle-display').innerText = '???';
        document.getElementById('power-display').innerText = '???';
        
        const needle = document.getElementById('angle-needle');
        if (needle) {
            needle.setAttribute('x2', 12);
            needle.setAttribute('y2', 9);
        }
        const powerFill = document.getElementById('power-fill');
        if (powerFill) {
            powerFill.setAttribute('width', 0);
        }
    }
    // Update Weapon Selector Button States
    // Update Weapon Selector Button States
    const standardBtn = document.getElementById('weapon-standard');
    const mediumBtn = document.getElementById('weapon-medium');
    const doubleBtn = document.getElementById('weapon-double');
    const ricochetBtn = document.getElementById('weapon-ricochet');
    const bubbleBtn = document.getElementById('weapon-bubble');
    const nukeBtn = document.getElementById('weapon-nuke');
    
    if (standardBtn && mediumBtn && doubleBtn && ricochetBtn && bubbleBtn && nukeBtn && player) {
        // Medium button
        mediumBtn.innerText = `Medium (${player.mediumShots})`;
        if (player.mediumShots <= 0) {
            mediumBtn.disabled = true;
            mediumBtn.style.opacity = 0.5;
            mediumBtn.style.cursor = 'not-allowed';
        } else {
            mediumBtn.disabled = false;
            mediumBtn.style.opacity = 1;
            mediumBtn.style.cursor = 'pointer';
        }

        // Double button
        doubleBtn.innerText = `Double (${player.doubleShots})`;
        if (player.doubleShots <= 0) {
            doubleBtn.disabled = true;
            doubleBtn.style.opacity = 0.5;
            doubleBtn.style.cursor = 'not-allowed';
        } else {
            doubleBtn.disabled = false;
            doubleBtn.style.opacity = 1;
            doubleBtn.style.cursor = 'pointer';
        }

        // Ricochet button
        ricochetBtn.innerText = `Ricochet (${player.ricochetShots})`;
        if (player.ricochetShots <= 0) {
            ricochetBtn.disabled = true;
            ricochetBtn.style.opacity = 0.5;
            ricochetBtn.style.cursor = 'not-allowed';
        } else {
            ricochetBtn.disabled = false;
            ricochetBtn.style.opacity = 1;
            ricochetBtn.style.cursor = 'pointer';
        }

        // Bubble button
        bubbleBtn.innerText = `Bubble (${player.bubbleShots})`;
        if (player.bubbleShots <= 0) {
            bubbleBtn.disabled = true;
            bubbleBtn.style.opacity = 0.5;
            bubbleBtn.style.cursor = 'not-allowed';
        } else {
            bubbleBtn.disabled = false;
            bubbleBtn.style.opacity = 1;
            bubbleBtn.style.cursor = 'pointer';
        }

        // Nuke button
        nukeBtn.innerText = `Nuke (${player.nukeShots})`;
        if (player.nukeShots <= 0) {
            nukeBtn.disabled = true;
            nukeBtn.style.opacity = 0.5;
            nukeBtn.style.cursor = 'not-allowed';
        } else {
            nukeBtn.disabled = false;
            nukeBtn.style.opacity = 1;
            nukeBtn.style.cursor = 'pointer';
        }

        // Crazy Dave button
        const crazyDaveBtn = document.getElementById('weapon-crazydave');
        if (crazyDaveBtn) {
            crazyDaveBtn.innerText = `Crazy Dave (${player.crazyDaveShots})`;
            if (player.crazyDaveShots <= 0) {
                crazyDaveBtn.disabled = true;
                crazyDaveBtn.style.opacity = 0.5;
                crazyDaveBtn.style.cursor = 'not-allowed';
            } else {
                crazyDaveBtn.disabled = false;
                crazyDaveBtn.style.opacity = 1;
                crazyDaveBtn.style.cursor = 'pointer';
            }
        }
        
        // Handle active classes
        standardBtn.classList.remove('active');
        mediumBtn.classList.remove('active');
        doubleBtn.classList.remove('active');
        ricochetBtn.classList.remove('active');
        bubbleBtn.classList.remove('active');
        nukeBtn.classList.remove('active');
        if (crazyDaveBtn) crazyDaveBtn.classList.remove('active');

        if (player.selectedWeapon === 'standard') {
            standardBtn.classList.add('active');
        } else if (player.selectedWeapon === 'medium') {
            mediumBtn.classList.add('active');
        } else if (player.selectedWeapon === 'double') {
            doubleBtn.classList.add('active');
        } else if (player.selectedWeapon === 'ricochet') {
            ricochetBtn.classList.add('active');
        } else if (player.selectedWeapon === 'bubble') {
            bubbleBtn.classList.add('active');
        } else if (player.selectedWeapon === 'nuke') {
            nukeBtn.classList.add('active');
        } else if (player.selectedWeapon === 'crazydave' && crazyDaveBtn) {
            crazyDaveBtn.classList.add('active');
        }
    }
}

function drawSky() {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, '#7dd3fc'); // Light sky blue (Sky 300)
    gradient.addColorStop(0.6, '#bae6fd'); // Soft pale blue (Sky 200)
    gradient.addColorStop(1, '#f0f9ff'); // Soft horizon white/blue (Sky 50)
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_WIDTH, HEIGHT);
}

function drawMountains() {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)'; // Semitransparent sky mountain color
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let i = 0; i < mountainPeaks.length; i++) {
        const px = mountainPeaks[i].x - camera.x * 0.3;
        const py = mountainPeaks[i].y - camera.y * 0.3;
        ctx.lineTo(px, py);
    }
    ctx.lineTo(WORLD_WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
}

function drawTerrain() {
    ctx.fillStyle = '#4ade80'; // 8-bit green grass
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let i = 0; i < terrain.length; i++) {
        ctx.lineTo(terrain[i].x, terrain[i].y);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
    
    // Draw dirt
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let i = 0; i < terrain.length; i++) {
        ctx.lineTo(terrain[i].x, terrain[i].y + 10);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
}

function drawTrajectory() {
    // Draw player's last shot trajectory
    if (playerLastTrajectory && playerLastTrajectory.length >= 2) {
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playerLastTrajectory[0].x, playerLastTrajectory[0].y);
        for(let i=1; i<playerLastTrajectory.length; i+=2) {
            ctx.lineTo(playerLastTrajectory[i].x, playerLastTrajectory[i].y);
        }
        ctx.stroke();
    }
    // Draw CPU's last shot trajectory
    if (cpuLastTrajectory && cpuLastTrajectory.length >= 2) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cpuLastTrajectory[0].x, cpuLastTrajectory[0].y);
        for(let i=1; i<cpuLastTrajectory.length; i+=2) {
            ctx.lineTo(cpuLastTrajectory[i].x, cpuLastTrajectory[i].y);
        }
        ctx.stroke();
    }
    ctx.setLineDash([]); // Reset dash
}

function updateCamera() {
    if (currentState !== GAME_STATE.PLAYING && currentState !== GAME_STATE.GAMEOVER) {
        camera.targetX = 0;
        camera.x = 0;
        camera.targetY = 0;
        camera.y = 0;
        return;
    }

    let targetX = 0;
    let targetY = 0;
    let lerpFactor = 0.025; // Default slow turn transition panning speed

    if (cameraFocusOverride) {
        targetX = cameraFocusOverride.x - VIEW_WIDTH / 2;
        targetY = cameraFocusOverride.y - HEIGHT / 2;
        targetY = Math.min(0, targetY);
        lerpFactor = 0.08; // Normal speed to focus on impact
    } else {
        const activeProj = activeProjectiles.find(p => p.active);
        if (activeProj) {
            targetX = activeProj.x - VIEW_WIDTH / 2;
            targetY = activeProj.y - HEIGHT / 2;
            targetY = Math.min(0, targetY);
            lerpFactor = 0.12; // Fast tracking speed so camera doesn't lag behind the mortar
        } else {
            const activeTank = (turn === 0) ? player : cpu;
            if (activeTank) {
                targetX = activeTank.x - VIEW_WIDTH / 2;
                targetY = activeTank.y - HEIGHT / 2;
                targetY = Math.min(0, targetY);
            }
        }
    }

    targetX = Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, targetX));
    camera.x += (targetX - camera.x) * lerpFactor;
    if (Math.abs(camera.x - targetX) < 0.1) {
        camera.x = targetX;
    }

    // Y-axis panning
    camera.y += (targetY - camera.y) * lerpFactor;
    if (Math.abs(camera.y - targetY) < 0.1) {
        camera.y = targetY;
    }
}

function drawMinimap() {
    if (currentState !== GAME_STATE.PLAYING && currentState !== GAME_STATE.GAMEOVER) return;

    const minimapW = 240;
    const minimapH = 75;
    const minimapX = (VIEW_WIDTH - minimapW) / 2;
    const minimapY = 15;

    // Draw background
    ctx.fillStyle = 'rgba(11, 29, 40, 0.85)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.fillRect(minimapX, minimapY, minimapW, minimapH);
    ctx.strokeRect(minimapX, minimapY, minimapW, minimapH);

    // Scale helpers
    const scaleX = minimapW / WORLD_WIDTH;
    const scaleY = minimapH / HEIGHT;

    // Draw topography (terrain)
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < terrain.length; i++) {
        const tx = minimapX + terrain[i].x * scaleX;
        const ty = minimapY + (terrain[i].y / HEIGHT) * minimapH;
        if (i === 0) {
            ctx.moveTo(tx, ty);
        } else {
            ctx.lineTo(tx, ty);
        }
    }
    ctx.stroke();

    // Draw players
    if (player) {
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(minimapX + player.x * scaleX - 3, minimapY + (player.y / HEIGHT) * minimapH - 3, 6, 6);
    }
    if (cpu) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(minimapX + cpu.x * scaleX - 3, minimapY + (cpu.y / HEIGHT) * minimapH - 3, 6, 6);
    }

    // Helper function to draw a trajectory on minimap
    const drawMinimapTrajectory = (trajectory, isPlayer) => {
        if (!trajectory || trajectory.length < 2) return;
        ctx.strokeStyle = isPlayer ? 'rgba(59, 130, 246, 0.6)' : 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        
        const startX = minimapX + trajectory[0].x * scaleX;
        const startY = minimapY + (trajectory[0].y / HEIGHT) * minimapH;
        ctx.moveTo(startX, startY);
        
        for (let i = 1; i < trajectory.length; i++) {
            const tx = minimapX + trajectory[i].x * scaleX;
            const ty = minimapY + (trajectory[i].y / HEIGHT) * minimapH;
            ctx.lineTo(tx, ty);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw hit spot (last point in trajectory)
        const lastPoint = trajectory[trajectory.length - 1];
        const hx = minimapX + lastPoint.x * scaleX;
        const hy = minimapY + (lastPoint.y / HEIGHT) * minimapH;
        
        // Fill core
        ctx.fillStyle = isPlayer ? '#3b82f6' : '#ef4444';
        ctx.beginPath();
        ctx.arc(hx, hy, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Crosshair / circle outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hx, hy, 5, 0, Math.PI * 2);
        ctx.stroke();
    };

    drawMinimapTrajectory(playerLastTrajectory, true);
    drawMinimapTrajectory(cpuLastTrajectory, false);

    // Draw active projectile
    const activeProj = activeProjectiles.find(p => p.active);
    if (activeProj) {
        ctx.fillStyle = '#ffffff';
        if (Math.floor(Date.now() / 150) % 2 === 0) {
            ctx.beginPath();
            ctx.arc(minimapX + activeProj.x * scaleX, minimapY + (activeProj.y / HEIGHT) * minimapH, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

let menuFrameCount = 0;
function drawMenuOverlay() {
    menuFrameCount++;
    
    // Dim background slightly
    ctx.fillStyle = 'rgba(11, 29, 40, 0.6)';
    ctx.fillRect(0, 0, VIEW_WIDTH, HEIGHT);
    
    // Draw central retro menu box
    const boxW = 500;
    const boxH = 260;
    const boxX = (VIEW_WIDTH - boxW) / 2;
    const boxY = (HEIGHT - boxH) / 2;
    
    ctx.fillStyle = '#112233';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    
    // Title "CANNON CHAOS"
    ctx.font = '32px "Press Start 2P", cursive';
    ctx.fillStyle = 'var(--primary-color)';
    ctx.textAlign = 'center';
    ctx.fillText('CANNON CHAOS', VIEW_WIDTH / 2, boxY + 70);
    
    // Subtitle / tagline
    ctx.font = '14px "Press Start 2P", cursive';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('8-BIT TANK WARFARE', VIEW_WIDTH / 2, boxY + 120);
    
    // Pulsing "PRESS ANY KEY TO PLAY"
    const pulse = Math.floor(menuFrameCount / 30) % 2 === 0;
    if (pulse) {
        ctx.font = '16px "Press Start 2P", cursive';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('PRESS ANY KEY TO PLAY', VIEW_WIDTH / 2, boxY + 190);
    }
    
    // Footer / Touch notice
    ctx.font = '10px "Press Start 2P", cursive';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('(OR TAP / CLICK SCREEN)', VIEW_WIDTH / 2, boxY + 225);
}

function gameLoop() {
    // Draw sky gradient (static screen background)
    drawSky();

    handleInput();
    updateCamera();

    ctx.save();
    
    // Apply camera shake if active
    let dx = 0;
    let dy = 0;
    if (shakeDuration > 0) {
        dx = (Math.random() * 2 - 1) * shakeIntensity;
        dy = (Math.random() * 2 - 1) * shakeIntensity;
        shakeDuration--;
    }
    ctx.translate(-Math.round(camera.x) + dx, -Math.round(camera.y) + dy);

    // Draw background parallax layers
    drawMountains();
    
    // Update and draw clouds (scroll slowly across world)
    clouds.forEach(c => {
        c.update();
        c.draw();
    });

    drawTerrain();
    drawTrajectory();
    
    if (player) {
        player.update();
        player.draw();
    }
    if (cpu) {
        cpu.update();
        cpu.draw();
    }

    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const proj = activeProjectiles[i];
        if (proj.active) {
            proj.update();
            proj.draw();
        } else {
            activeProjectiles.splice(i, 1);
        }
    }

    for (let i = activeExplosions.length - 1; i >= 0; i--) {
        const exp = activeExplosions[i];
        exp.update();
        exp.draw();
        if (exp.done) {
            activeExplosions.splice(i, 1);
        }
    }

    // Update and draw active explosion particles
    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        if (p.update()) {
            p.draw();
        } else {
            activeParticles.splice(i, 1);
        }
    }

    ctx.restore();

    // Draw center screen flash banner (outside camera transform so it stays fixed on screen)
    if (!activeBanner && bannerQueue.length > 0) {
        activeBanner = bannerQueue.shift();
    }

    if (activeBanner) {
        const bannerH = 110;
        const bannerY = HEIGHT / 2 - bannerH / 2;
        
        ctx.fillStyle = 'rgba(11, 29, 40, 0.85)';
        ctx.fillRect(0, bannerY, VIEW_WIDTH, bannerH);
        
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, bannerY);
        ctx.lineTo(VIEW_WIDTH, bannerY);
        ctx.moveTo(0, bannerY + bannerH);
        ctx.lineTo(VIEW_WIDTH, bannerY + bannerH);
        ctx.stroke();
        
        ctx.textAlign = 'center';
        const pulse = Math.floor(activeBanner.timer / 10) % 2 === 0;
        
        if (activeBanner.type === 'shield') {
            // Shield Activation Banner
            ctx.font = '16px "Press Start 2P", cursive';
            ctx.fillStyle = '#00ffff';
            ctx.fillText(`${activeBanner.tankName} SHIELDED!`, VIEW_WIDTH / 2, bannerY + 45);
            
            ctx.font = '10px "Press Start 2P", cursive';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('+50 SHIELD HP ACTIVATED', VIEW_WIDTH / 2, bannerY + 75);
        } else if (activeBanner.type === 'fall') {
            // Fall Damage Banner
            ctx.font = '16px "Press Start 2P", cursive';
            ctx.fillStyle = '#ef4444';
            ctx.fillText(`${activeBanner.tankName} FELL!`, VIEW_WIDTH / 2, bannerY + 45);
            
            ctx.font = '11px "Press Start 2P", cursive';
            ctx.fillStyle = '#ffcc00';
            ctx.fillText(`FALL DAMAGE: -${activeBanner.damage} HP`, VIEW_WIDTH / 2, bannerY + 75);
        } else {
            // Firing/Damage Banner
            ctx.font = '16px "Press Start 2P", cursive';
            let distText = '';
            if (activeBanner.isCrazyDave) {
                distText = 'CRAZY DAVE IMPACT';
                ctx.fillStyle = '#ffcc00';
            } else if (activeBanner.distance <= 15) { // within 15px is direct hit
                distText = 'DIRECT HIT!';
                ctx.fillStyle = pulse ? '#ffcc00' : '#ffffff';
            } else {
                distText = `MISSED BY ${activeBanner.distance}px`;
                ctx.fillStyle = '#ffffff';
            }
            ctx.fillText(distText, VIEW_WIDTH / 2, bannerY + 45);
            
            ctx.font = '11px "Press Start 2P", cursive';
            let hitDmgText = `HIT DAMAGE: ${activeBanner.damage > 0 ? '-' + activeBanner.damage : '0'} HP`;
            ctx.fillStyle = activeBanner.damage > 0 ? '#ef4444' : '#aaaaaa';
            ctx.fillText(hitDmgText, VIEW_WIDTH / 2, bannerY + 75);
        }
        
        activeBanner.timer--;
        if (activeBanner.timer <= 0) {
            activeBanner = null;
            if (bannerQueue.length === 0) {
                // All banners finished, trigger turn transition check!
                checkTurnTransition(800);
            }
        }
    }

    drawMinimap();

    if (currentState === GAME_STATE.MENU) {
        drawMenuOverlay();
    } else if (currentState === GAME_STATE.MODE_SELECT) {
        drawModeSelectOverlay();
    } else if (currentState === GAME_STATE.TERRAIN_SELECT) {
        drawTerrainSelectOverlay();
    } else if (currentState === GAME_STATE.DIFFICULTY_SELECT) {
        drawDifficultySelectOverlay();
    } else if (currentState === GAME_STATE.GAMEOVER) {
        drawGameOverOverlay();
    }

    if (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.MENU || currentState === GAME_STATE.MODE_SELECT || currentState === GAME_STATE.TERRAIN_SELECT || currentState === GAME_STATE.DIFFICULTY_SELECT || currentState === GAME_STATE.GAMEOVER || activeProjectiles.some(p => p.active)) {
        requestAnimationFrame(gameLoop);
    }
}

function drawTerrainSelectOverlay() {
    // Dim background slightly
    ctx.fillStyle = 'rgba(11, 29, 40, 0.6)';
    ctx.fillRect(0, 0, VIEW_WIDTH, HEIGHT);
    
    // Draw central retro menu box
    const boxW = 500;
    const boxH = 260;
    const boxX = (VIEW_WIDTH - boxW) / 2;
    const boxY = (HEIGHT - boxH) / 2;
    
    ctx.fillStyle = '#112233';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    
    // Header
    ctx.font = '24px "Press Start 2P", cursive';
    ctx.fillStyle = 'var(--primary-color)';
    ctx.textAlign = 'center';
    ctx.fillText('SELECT TERRAIN', VIEW_WIDTH / 2, boxY + 50);
    
    // Options
    ctx.font = '16px "Press Start 2P", cursive';
    
    // Option 1: Mountains
    ctx.fillStyle = selectedTerrainIndex === 0 ? '#00ffcc' : '#ffffff';
    let opt1Text = 'MOUNTAINS';
    if (selectedTerrainIndex === 0) {
        opt1Text = '▶ MOUNTAINS';
    }
    ctx.fillText(opt1Text, VIEW_WIDTH / 2, boxY + 110);
    
    // Option 2: Flat
    ctx.fillStyle = selectedTerrainIndex === 1 ? '#00ffcc' : '#ffffff';
    let opt2Text = 'FLAT';
    if (selectedTerrainIndex === 1) {
        opt2Text = '▶ FLAT';
    }
    ctx.fillText(opt2Text, VIEW_WIDTH / 2, boxY + 170);
    
    // Navigation info
    ctx.font = '10px "Press Start 2P", cursive';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('USE ARROWS TO SELECT, SPACE / CLICK TO PLAY', VIEW_WIDTH / 2, boxY + 230);
}

let gameOverFrameCount = 0;
function drawGameOverOverlay() {
    gameOverFrameCount++;
    
    // Dim background slightly
    ctx.fillStyle = 'rgba(11, 29, 40, 0.7)';
    ctx.fillRect(0, 0, VIEW_WIDTH, HEIGHT);
    
    // Draw central retro box
    const boxW = 550;
    const boxH = 260;
    const boxX = (VIEW_WIDTH - boxW) / 2;
    const boxY = (HEIGHT - boxH) / 2;
    
    ctx.fillStyle = '#112233';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    
    // Winner Text
    const playerWon = player.hp > 0;
    ctx.font = '28px "Press Start 2P", cursive';
    
    // Flashing effect
    const flash = Math.floor(gameOverFrameCount / 20) % 2 === 0;
    if (flash) {
        ctx.fillStyle = playerWon ? '#3b82f6' : '#ef4444';
    } else {
        ctx.fillStyle = '#ffffff';
    }
    
    ctx.textAlign = 'center';
    const winText = playerWon ? 'PLAYER 1 WINS!' : 'CPU WINS!';
    ctx.fillText(winText, VIEW_WIDTH / 2, boxY + 80);
    
    // Sub-text
    ctx.font = '14px "Press Start 2P", cursive';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('THANKS FOR PLAYING', VIEW_WIDTH / 2, boxY + 140);
    
    // Press Space / Tap to Restart
    const pulse = Math.floor(gameOverFrameCount / 30) % 2 === 0;
    if (pulse) {
        ctx.font = '12px "Press Start 2P", cursive';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('PRESS ENTER / CLICK TO PLAY AGAIN', VIEW_WIDTH / 2, boxY + 200);
    }
}

function drawModeSelectOverlay() {
    // Dim background slightly
    ctx.fillStyle = 'rgba(11, 29, 40, 0.6)';
    ctx.fillRect(0, 0, VIEW_WIDTH, HEIGHT);
    
    // Draw central retro menu box
    const boxW = 500;
    const boxH = 260;
    const boxX = (VIEW_WIDTH - boxW) / 2;
    const boxY = (HEIGHT - boxH) / 2;
    
    ctx.fillStyle = '#112233';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    
    // Header
    ctx.font = '24px "Press Start 2P", cursive';
    ctx.fillStyle = 'var(--primary-color)';
    ctx.textAlign = 'center';
    ctx.fillText('SELECT MODE', VIEW_WIDTH / 2, boxY + 50);
    
    // Options
    ctx.font = '16px "Press Start 2P", cursive';
    
    // Option 1: Quick Play
    ctx.fillStyle = selectedModeIndex === 0 ? '#00ffcc' : '#ffffff';
    let opt1Text = 'QUICK PLAY';
    if (selectedModeIndex === 0) {
        opt1Text = '▶ QUICK PLAY';
    }
    ctx.fillText(opt1Text, VIEW_WIDTH / 2, boxY + 110);
    
    // Option 2: Sandbox
    ctx.fillStyle = selectedModeIndex === 1 ? '#00ffcc' : '#ffffff';
    let opt2Text = selectedModeIndex === 1 ? '▶ SANDBOX' : 'SANDBOX';
    ctx.fillText(opt2Text, VIEW_WIDTH / 2, boxY + 170);
    
    // Navigation info
    ctx.font = '10px "Press Start 2P", cursive';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('USE ARROWS TO SELECT, SPACE / CLICK TO PLAY', VIEW_WIDTH / 2, boxY + 230);
}

function drawDifficultySelectOverlay() {
    // Dim background slightly
    ctx.fillStyle = 'rgba(11, 29, 40, 0.6)';
    ctx.fillRect(0, 0, VIEW_WIDTH, HEIGHT);
    
    // Draw central retro menu box
    const boxW = 500;
    const boxH = 280;
    const boxX = (VIEW_WIDTH - boxW) / 2;
    const boxY = (HEIGHT - boxH) / 2;
    
    ctx.fillStyle = '#112233';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    
    // Header
    ctx.font = '24px "Press Start 2P", cursive';
    ctx.fillStyle = 'var(--primary-color)';
    ctx.textAlign = 'center';
    ctx.fillText('SELECT DIFFICULTY', VIEW_WIDTH / 2, boxY + 50);
    
    // Options
    ctx.font = '16px "Press Start 2P", cursive';
    
    // Option 1: Easy
    ctx.fillStyle = selectedDifficultyIndex === 0 ? '#00ffcc' : '#ffffff';
    let opt1Text = selectedDifficultyIndex === 0 ? '▶ EASY' : 'EASY';
    ctx.fillText(opt1Text, VIEW_WIDTH / 2, boxY + 110);
    
    // Option 2: Medium
    ctx.fillStyle = selectedDifficultyIndex === 1 ? '#00ffcc' : '#ffffff';
    let opt2Text = selectedDifficultyIndex === 1 ? '▶ MEDIUM' : 'MEDIUM';
    ctx.fillText(opt2Text, VIEW_WIDTH / 2, boxY + 160);

    // Option 3: Hard
    ctx.fillStyle = selectedDifficultyIndex === 2 ? '#00ffcc' : '#ffffff';
    let opt3Text = selectedDifficultyIndex === 2 ? '▶ HARD' : 'HARD';
    ctx.fillText(opt3Text, VIEW_WIDTH / 2, boxY + 210);
    
    // Navigation info
    ctx.font = '10px "Press Start 2P", cursive';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('USE ARROWS TO SELECT, SPACE / CLICK TO PLAY', VIEW_WIDTH / 2, boxY + 260);
}

function setupMobileControls() {
    const bindTouchKey = (btnId, keyName) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        const startPress = (e) => {
            e.preventDefault();
            touchKeys[keyName] = true;
        };
        const endPress = (e) => {
            e.preventDefault();
            touchKeys[keyName] = false;
        };
        
        btn.addEventListener('mousedown', startPress);
        btn.addEventListener('mouseup', endPress);
        btn.addEventListener('mouseleave', endPress);
        
        btn.addEventListener('touchstart', startPress, { passive: false });
        btn.addEventListener('touchend', endPress, { passive: false });
        btn.addEventListener('touchcancel', endPress, { passive: false });
    };

    bindTouchKey('btn-power-up', 'ArrowUp');
    bindTouchKey('btn-power-down', 'ArrowDown');
    bindTouchKey('btn-angle-left', 'ArrowLeft');
    bindTouchKey('btn-angle-right', 'ArrowRight');

    const fireBtn = document.getElementById('btn-fire');
    if (fireBtn) {
        const handleFire = (e) => {
            e.preventDefault();
            if (currentState !== GAME_STATE.PLAYING || turn !== 0 || activeProjectiles.some(p => p.active)) return;
            fireProjectile(player);
        };
        fireBtn.addEventListener('click', handleFire);
        fireBtn.addEventListener('touchstart', handleFire, { passive: false });
    }

    const standardBtn = document.getElementById('weapon-standard');
    const mediumBtn = document.getElementById('weapon-medium');
    const doubleBtn = document.getElementById('weapon-double');
    const ricochetBtn = document.getElementById('weapon-ricochet');

    if (standardBtn) {
        standardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentState !== GAME_STATE.PLAYING || turn !== 0 || activeProjectiles.some(p => p.active)) return;
            player.selectedWeapon = 'standard';
            updateHUD();
        });
    }
    if (mediumBtn) {
        mediumBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentState !== GAME_STATE.PLAYING || turn !== 0 || activeProjectiles.some(p => p.active)) return;
            if (player.mediumShots > 0) {
                player.selectedWeapon = 'medium';
                updateHUD();
            }
        });
    }
    if (doubleBtn) {
        doubleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentState !== GAME_STATE.PLAYING || turn !== 0 || activeProjectiles.some(p => p.active)) return;
            if (player.doubleShots > 0) {
                player.selectedWeapon = 'double';
                updateHUD();
            }
        });
    }
    if (ricochetBtn) {
        ricochetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentState !== GAME_STATE.PLAYING || turn !== 0 || activeProjectiles.some(p => p.active)) return;
            if (player.ricochetShots > 0) {
                player.selectedWeapon = 'ricochet';
                updateHUD();
            }
        });
    }
    const bubbleBtn = document.getElementById('weapon-bubble');
    if (bubbleBtn) {
        bubbleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentState !== GAME_STATE.PLAYING || turn !== 0 || activeProjectiles.some(p => p.active)) return;
            if (player.bubbleShots > 0) {
                player.selectedWeapon = 'bubble';
                updateHUD();
            }
        });
    }
    const nukeBtn = document.getElementById('weapon-nuke');
    if (nukeBtn) {
        nukeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentState !== GAME_STATE.PLAYING || turn !== 0 || activeProjectiles.some(p => p.active)) return;
            if (player.nukeShots > 0) {
                player.selectedWeapon = 'nuke';
                updateHUD();
            }
        });
    }
    const crazyDaveBtn = document.getElementById('weapon-crazydave');
    if (crazyDaveBtn) {
        crazyDaveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentState !== GAME_STATE.PLAYING || turn !== 0 || activeProjectiles.some(p => p.active)) return;
            if (player.crazyDaveShots > 0) {
                player.selectedWeapon = 'crazydave';
                updateHUD();
            }
        });
    }

    // Play UI click sounds on all buttons
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => sfx.playClick());
    });
}

// Start
setupMobileControls();

// Allow clicking or tapping the canvas to navigate the menus
canvas.addEventListener('click', (e) => {
    sfx.init();
    sfx.playClick();

    if (currentState === GAME_STATE.MENU) {
        setGameState(GAME_STATE.MODE_SELECT);
        updateHUD();
        return;
    }
    
    if (currentState === GAME_STATE.GAMEOVER) {
        setGameState(GAME_STATE.MODE_SELECT);
        updateHUD();
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    
    const boxW = 500;
    const boxH = 260;
    const boxX = (VIEW_WIDTH - boxW) / 2;
    const boxY = (HEIGHT - boxH) / 2;
    
    if (currentState === GAME_STATE.MODE_SELECT) {
        if (clickX >= boxX && clickX <= boxX + boxW) {
            // Quick Play boundary
            if (clickY >= boxY + 80 && clickY <= boxY + 130) {
                selectedModeIndex = 0;
                cpuDifficulty = 'medium';
                const randomTerrain = Math.random() < 0.5 ? 'mountains' : 'flat';
                startGamePlay(randomTerrain);
            }
            // Sandbox boundary
            else if (clickY >= boxY + 140 && clickY <= boxY + 200) {
                selectedModeIndex = 1;
                setGameState(GAME_STATE.TERRAIN_SELECT);
                updateHUD();
            }
        }
    } else if (currentState === GAME_STATE.TERRAIN_SELECT) {
        if (clickX >= boxX && clickX <= boxX + boxW) {
            // Mountains boundary
            if (clickY >= boxY + 80 && clickY <= boxY + 130) {
                selectedTerrainIndex = 0;
                selectedTerrainType = 'mountains';
                setGameState(GAME_STATE.DIFFICULTY_SELECT);
                updateHUD();
            }
            // Flat boundary
            else if (clickY >= boxY + 140 && clickY <= boxY + 200) {
                selectedTerrainIndex = 1;
                selectedTerrainType = 'flat';
                setGameState(GAME_STATE.DIFFICULTY_SELECT);
                updateHUD();
            }
        }
    } else if (currentState === GAME_STATE.DIFFICULTY_SELECT) {
        if (clickX >= boxX && clickX <= boxX + boxW) {
            // Easy boundary
            if (clickY >= boxY + 90 && clickY <= boxY + 130) {
                selectedDifficultyIndex = 0;
                cpuDifficulty = 'easy';
                startGamePlay(selectedTerrainType);
            }
            // Medium boundary
            else if (clickY >= boxY + 140 && clickY <= boxY + 180) {
                selectedDifficultyIndex = 1;
                cpuDifficulty = 'medium';
                startGamePlay(selectedTerrainType);
            }
            // Hard boundary
            else if (clickY >= boxY + 190 && clickY <= boxY + 230) {
                selectedDifficultyIndex = 2;
                cpuDifficulty = 'hard';
                startGamePlay(selectedTerrainType);
            }
        }
    }
});

// Windows 95 Theme Switcher Logic
function applyTheme(theme) {
    const classes = Array.from(document.body.classList).filter(c => c.startsWith('theme-'));
    classes.forEach(c => document.body.classList.remove(c));
    
    // Correct for the legacy 'classic', 'dark', 'vapor' values
    const fullThemeName = (theme === 'classic' || theme === 'dark' || theme === 'vapor') 
        ? `win95-${theme}` 
        : theme;
    document.body.classList.add(`theme-${fullThemeName}`);
}

const themeSelect = document.getElementById('win95-theme-select');
if (themeSelect) {
    const savedTheme = localStorage.getItem('win95-theme') || 'classic';
    themeSelect.value = savedTheme;
    applyTheme(savedTheme);

    themeSelect.addEventListener('change', (e) => {
        const selected = e.target.value;
        localStorage.setItem('win95-theme', selected);
        applyTheme(selected);
    });
}

initGame();
