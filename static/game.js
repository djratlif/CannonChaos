const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
const GAME_STATE = {
    MENU: 'MENU',
    MODE_SELECT: 'MODE_SELECT',
    TERRAIN_SELECT: 'TERRAIN_SELECT',
    PLAYING: 'PLAYING',
    GAMEOVER: 'GAMEOVER'
};
let selectedModeIndex = 0; // 0 for Quick Play, 1 for Sandbox
let selectedTerrainIndex = 0; // 0 for Mountains, 1 for Flat

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
let distanceFeedback = null;
let turnTransitionTimeout = null;

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
        this.shieldHp = 0;
    }

    update() {
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
                            this.hp -= damage;
                            if (this.hp < 0) this.hp = 0;
                        }
                        updateHUD();
                        
                        if (this.hp <= 0) {
                            setGameState(GAME_STATE.GAMEOVER);
                            updateHUD();
                        }
                    }
                    // Check if we should switch turn now that falling has finished
                    checkTurnTransition();
                }
            }
        }
    }

    draw() {
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
                    const damage = this.type === 'medium' ? 40 : 25;
                    
                    if (this.type === 'ricochet' && this.ricochetCount < 3) {
                        this.ricochetCount++;
                        target.shieldHp -= 15;
                        if (target.shieldHp < 0) target.shieldHp = 0;
                        destroyTerrain(this.x, this.y, 20);
                        
                        const randAngle = 45 + Math.random() * 90;
                        const rad = randAngle * Math.PI / 180;
                        const bouncePower = 5 + Math.random() * 8;
                        this.vx = Math.cos(rad) * bouncePower;
                        this.vy = -Math.sin(rad) * bouncePower;
                        this.y = (target.y + 7) - 33;
                    } else {
                        target.shieldHp -= damage;
                        if (target.shieldHp < 0) target.shieldHp = 0;
                        this.explode();
                    }
                    updateHUD();
                    return; // Handled by shield
                }
            }

            if (this.x > target.x - target.width/2 && this.x < target.x + target.width/2 &&
                this.y > target.y - target.height && this.y < target.y + target.height) {
                
                if (this.type === 'ricochet' && this.ricochetCount < 3) {
                    this.ricochetCount++;
                    target.hp -= 15; // Lower damage for intermediate ricochet hits
                    if (target.hp < 0) target.hp = 0;
                    destroyTerrain(this.x, this.y, 20);
                    
                    const randAngle = 45 + Math.random() * 90;
                    const rad = randAngle * Math.PI / 180;
                    const bouncePower = 5 + Math.random() * 8; // Random power between 5 and 13
                    this.vx = Math.cos(rad) * bouncePower;
                    this.vy = -Math.sin(rad) * bouncePower;
                    this.y = target.y - target.height - 8;
                } else {
                    const damage = this.type === 'medium' ? 40 : 25;
                    target.hp -= damage;
                    if (target.hp < 0) target.hp = 0;
                    this.explode();
                }
            }
        }
    }

    explode() {
        this.active = false;
        if (this.ownerIsPlayer) {
            playerLastTrajectory = [...this.path];
        } else {
            cpuLastTrajectory = [...this.path];
        }
        
        // Spawn active explosion instead of destroying terrain immediately
        const craterRadius = this.type === 'nuke' ? 90 : (this.type === 'medium' ? 45 : 25);
        activeExplosions.push(new Explosion(this.x, this.y, craterRadius, this.type, this.ownerIsPlayer));

        // Distance feedback calculation
        const target = this.ownerIsPlayer ? cpu : player;
        const dx = this.x - target.x;
        const dy = this.y - (target.y + 7);
        const distance = Math.round(Math.sqrt(dx * dx + dy * dy));

        // Duration of feedback should account for the explosion animation time
        const explosionDuration = this.type === 'nuke' ? 60 : 20;
        distanceFeedback = {
            x: this.x,
            y: this.y - 25,
            distance: distance,
            ownerIsPlayer: this.ownerIsPlayer,
            timer: 120 + explosionDuration
        };

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
        } else {
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class Explosion {
    constructor(x, y, radius, type, ownerIsPlayer) {
        this.x = x;
        this.y = y;
        this.maxRadius = radius;
        this.currentRadius = 0;
        this.type = type;
        this.ownerIsPlayer = ownerIsPlayer;
        this.duration = type === 'nuke' ? 60 : 20; // Nuke is a longer explosion
        this.elapsed = 0;
        this.done = false;
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
            
            // Proximity damage to other tanks (for Nuke)
            if (this.type === 'nuke') {
                [player, cpu].forEach(tank => {
                    const dx = this.x - tank.x;
                    const dy = this.y - (tank.y + 7);
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < this.maxRadius) {
                        const pct = 1 - (dist / this.maxRadius);
                        const dmg = Math.floor(45 * pct); // up to 45 splash damage
                        if (dmg > 0) {
                            if (tank.shieldHp > 0) {
                                if (tank.shieldHp >= dmg) {
                                    tank.shieldHp -= dmg;
                                } else {
                                    tank.hp -= (dmg - tank.shieldHp);
                                    tank.shieldHp = 0;
                                }
                            } else {
                                tank.hp -= dmg;
                            }
                            if (tank.hp < 0) tank.hp = 0;
                        }
                    }
                });
                updateHUD();
            }
            
            // Trigger the delayed turn switch after the explosion settles
            checkTurnTransition(2000);
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
    const anyActive = activeProjectiles.some(p => p.active) || activeExplosions.length > 0;
    const anyFalling = player.isFalling || cpu.isFalling;
    if (!anyActive && !anyFalling) {
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
                performTurnTransition();
            }, delayMs);
        } else {
            if (turnTransitionTimeout) clearTimeout(turnTransitionTimeout);
            performTurnTransition();
        }
    }
}

function performTurnTransition() {
    turn = turn === 0 ? 1 : 0;
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
    updateTankPositions();
}

function updateTankPositions() {
    if (!player || !cpu) return;
    
    // Player
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
    
    // CPU
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
    player = new Tank(100, '#3b82f6', true);
    cpu = new Tank(WIDTH - 100, '#ef4444', false);
    turn = 0;
    playerLastTrajectory = [];
    cpuLastTrajectory = [];
    playerLastShot.active = false;
    cpuLastShot.active = false;
    camera.x = 0;
    camera.y = 0;
    camera.targetX = 0;
    camera.targetY = 0;
    activeProjectiles = [];
    activeExplosions = [];
    setGameState(GAME_STATE.PLAYING);
    updateHUD();
}

function initGame() {
    // Generate standard mountains initially as a placeholder before mode/terrain selects
    generateTerrain('mountains');
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
    camera.x = 0;
    camera.y = 0;
    camera.targetX = 0;
    camera.targetY = 0;
    activeProjectiles = [];
    activeExplosions = [];
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
            startGamePlay(selectedTerrainIndex === 0 ? 'mountains' : 'flat');
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
    const rad = tank.angle * Math.PI / 180;
    const spawnX = tank.x + Math.cos(rad) * 20;
    const spawnY = tank.y + 7 - Math.sin(rad) * 20;
    
    let weaponType = 'standard';
    if (tank.isPlayer) {
        weaponType = tank.selectedWeapon;
        if (weaponType === 'medium') {
            tank.mediumShots--;
            if (tank.mediumShots <= 0) {
                tank.selectedWeapon = 'standard';
            }
        } else if (weaponType === 'double') {
            tank.doubleShots--;
            if (tank.doubleShots <= 0) {
                tank.selectedWeapon = 'standard';
            }
        } else if (weaponType === 'ricochet') {
            tank.ricochetShots--;
            if (tank.ricochetShots <= 0) {
                tank.selectedWeapon = 'standard';
            }
        } else if (weaponType === 'nuke') {
            tank.nukeShots--;
            if (tank.nukeShots <= 0) {
                tank.selectedWeapon = 'standard';
            }
        } else if (weaponType === 'bubble') {
            tank.bubbleShots--;
            tank.shieldHp = 50;
            tank.selectedWeapon = 'standard';
            updateHUD();
            
            // Advance turn since no projectile was fired
            turn = turn === 0 ? 1 : 0;
            if (turn === 1) {
                setTimeout(cpuTurn, 1000);
            }
            updateHUD();
            return;
        }
    }
    
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
    
    // Very Basic AI
    if (cpu.lastShotTooShort === null) {
        cpu.angle = 135; // Aim left (180 - 45)
        cpu.power = 27;
    } else {
        // Adjust power based on previous shot
        if (cpu.lastShotTooShort) {
            cpu.power += 3;
        } else {
            cpu.power -= 3;
        }
        // Clamp
        if (cpu.power > cpu.maxPower) cpu.power = cpu.maxPower;
        if (cpu.power < 9) cpu.power = 9;
    }
    
    cpu.lastAngle = cpu.angle;
    cpu.lastPower = cpu.power;
    
    // Simulate charging time
    setTimeout(() => {
        fireProjectile(cpu);
        // We evaluate too short/long when it lands, but for simplicity we estimate
        // If the bullet lands to the right of the player, it was too short (since CPU shoots left).
        // Actual evaluation should be done when projectile explodes.
    }, 1000);
}

// Intercept explode to update CPU AI logic
const originalExplode = Projectile.prototype.explode;
Projectile.prototype.explode = function() {
    if (!this.ownerIsPlayer) {
        // CPU shot landed at this.x
        // Player is at player.x
        // CPU shoots left. If this.x > player.x, it fell short. If this.x < player.x, it went too far.
        if (this.x > player.x) {
            cpu.lastShotTooShort = true;
        } else {
            cpu.lastShotTooShort = false;
        }
    }
    originalExplode.call(this);
};

function updateHUD() {
    document.getElementById('player-hp').innerText = player.hp;
    document.getElementById('cpu-hp').innerText = cpu.hp;

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
    if (currentState === GAME_STATE.GAMEOVER) {
        turnIndicator.innerText = player.hp > 0 ? "PLAYER 1 WINS!" : "CPU WINS!";
        turnIndicator.style.animation = "none";
        turnIndicator.style.color = player.hp > 0 ? "var(--player-color)" : "var(--cpu-color)";
    } else {
        turnIndicator.innerText = turn === 0 ? "Player's Turn" : "CPU's Turn";
        turnIndicator.style.color = turn === 0 ? "var(--player-color)" : "var(--cpu-color)";
        turnIndicator.style.animation = "blink 1.5s infinite";
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
            const height = (pct / 100) * 20;
            const y = 22 - height;
            powerFill.setAttribute('y', y);
            powerFill.setAttribute('height', height);
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
            powerFill.setAttribute('height', 0);
            powerFill.setAttribute('y', 22);
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
        
        // Handle active classes
        standardBtn.classList.remove('active');
        mediumBtn.classList.remove('active');
        doubleBtn.classList.remove('active');
        ricochetBtn.classList.remove('active');
        bubbleBtn.classList.remove('active');
        nukeBtn.classList.remove('active');

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
        }
    }
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

        cameraFocusOverride.duration--;
        if (cameraFocusOverride.duration <= 0) {
            cameraFocusOverride = null;
        }
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
    // Clear canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, VIEW_WIDTH, HEIGHT);

    handleInput();
    updateCamera();

    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

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

    // Draw distance feedback and line to target if active
    if (distanceFeedback && distanceFeedback.timer > 0) {
        const target = distanceFeedback.ownerIsPlayer ? cpu : player;
        
        // Draw dotted line between hit spot and target tank
        ctx.strokeStyle = distanceFeedback.ownerIsPlayer ? 'rgba(59, 130, 246, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(distanceFeedback.x, distanceFeedback.y + 25);
        ctx.lineTo(target.x, target.y + 7);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw retro styled floating text
        ctx.font = '10px "Press Start 2P", cursive';
        ctx.textAlign = 'center';
        
        const text = `${distanceFeedback.distance}px`;
        
        // Text Shadow/Outline
        ctx.fillStyle = '#000000';
        ctx.fillText(text, distanceFeedback.x - 1, distanceFeedback.y - 1);
        ctx.fillText(text, distanceFeedback.x + 1, distanceFeedback.y - 1);
        ctx.fillText(text, distanceFeedback.x - 1, distanceFeedback.y + 1);
        ctx.fillText(text, distanceFeedback.x + 1, distanceFeedback.y + 1);
        
        // Text Foreground
        ctx.fillStyle = distanceFeedback.ownerIsPlayer ? '#3b82f6' : '#ef4444';
        ctx.fillText(text, distanceFeedback.x, distanceFeedback.y);
        
        distanceFeedback.timer--;
        if (distanceFeedback.timer <= 0) {
            distanceFeedback = null;
        }
    }

    ctx.restore();

    drawMinimap();

    if (currentState === GAME_STATE.MENU) {
        drawMenuOverlay();
    } else if (currentState === GAME_STATE.MODE_SELECT) {
        drawModeSelectOverlay();
    } else if (currentState === GAME_STATE.TERRAIN_SELECT) {
        drawTerrainSelectOverlay();
    }

    if (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.MENU || currentState === GAME_STATE.MODE_SELECT || currentState === GAME_STATE.TERRAIN_SELECT || activeProjectiles.some(p => p.active)) {
        requestAnimationFrame(gameLoop);
    } else {
        // Draw one last frame to show game over state
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, VIEW_WIDTH, HEIGHT);
        ctx.save();
        ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
        drawTerrain();
        if (player) player.draw();
        if (cpu) cpu.draw();
        ctx.restore();
        drawMinimap();
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
    ctx.fillStyle = selectedModeIndex === 1 ? '#ef4444' : '#888888';
    let opt2Text = 'SANDBOX (COMING SOON)';
    if (selectedModeIndex === 1) {
        opt2Text = '▶ SANDBOX (COMING SOON)';
    }
    ctx.fillText(opt2Text, VIEW_WIDTH / 2, boxY + 170);
    
    // Navigation info
    ctx.font = '10px "Press Start 2P", cursive';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('USE ARROWS TO SELECT, SPACE / CLICK TO PLAY', VIEW_WIDTH / 2, boxY + 230);
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
}

// Start
setupMobileControls();

// Allow clicking or tapping the canvas to navigate the menus
canvas.addEventListener('click', (e) => {
    if (currentState === GAME_STATE.MENU) {
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
                setGameState(GAME_STATE.TERRAIN_SELECT);
                updateHUD();
            }
            // Sandbox boundary
            else if (clickY >= boxY + 140 && clickY <= boxY + 200) {
                selectedModeIndex = 1;
                // Coming soon
            }
        }
    } else if (currentState === GAME_STATE.TERRAIN_SELECT) {
        if (clickX >= boxX && clickX <= boxX + boxW) {
            // Mountains boundary
            if (clickY >= boxY + 80 && clickY <= boxY + 130) {
                selectedTerrainIndex = 0;
                startGamePlay('mountains');
            }
            // Flat boundary
            else if (clickY >= boxY + 140 && clickY <= boxY + 200) {
                selectedTerrainIndex = 1;
                startGamePlay('flat');
            }
        }
    }
});

initGame();
