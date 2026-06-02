const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
const GAME_STATE = {
    PLAYING: 'PLAYING',
    GAMEOVER: 'GAMEOVER'
};
let currentState = GAME_STATE.PLAYING;

// Entities
let terrain = [];
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GRAVITY = 0.5;

// Players
let turn = 0; // 0 for Player, 1 for CPU

// Trajectory Line
let previousTrajectory = [];

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
        this.power = isPlayer ? 12 : 0; // Default static power
        this.maxPower = 25; // max velocity
        this.isCharging = false;
        
        // AI memory
        this.lastShotTooShort = null;
        this.lastPower = 0;
        this.lastAngle = 135;

        // Falling animation properties
        this.targetY = this.y;
        this.isFalling = false;
        this.hoverTimer = 0;
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
                    
                    // Calculate and apply fall damage (0.15 HP per pixel fallen)
                    const fallDistance = this.targetY - this.fallStartY;
                    if (fallDistance > 10) {
                        const damage = Math.floor(fallDistance * 0.15);
                        this.hp -= damage;
                        if (this.hp < 0) this.hp = 0;
                        updateHUD();
                        
                        if (this.hp <= 0) {
                            currentState = GAME_STATE.GAMEOVER;
                            updateHUD();
                        }
                    }
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
    }
}

class Projectile {
    constructor(x, y, angle, power, ownerIsPlayer) {
        this.x = x;
        this.y = y;
        const rad = angle * Math.PI / 180;
        this.vx = Math.cos(rad) * power;
        this.vy = -Math.sin(rad) * power;
        this.radius = 4;
        this.active = true;
        this.ownerIsPlayer = ownerIsPlayer;
        this.path = []; // Store path for trajectory drawing
    }

    update() {
        if (!this.active) return;
        
        this.path.push({x: this.x, y: this.y});
        
        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;

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
                    this.explode();
                    break;
                }
            }
        }

        // Collision with tanks
        if (this.active) {
            let target = this.ownerIsPlayer ? cpu : player;
            if (this.x > target.x - target.width/2 && this.x < target.x + target.width/2 &&
                this.y > target.y - target.height && this.y < target.y + target.height) {
                target.hp -= 25; // Fixed damage for now
                if (target.hp < 0) target.hp = 0;
                this.explode();
            }
        }
    }

    explode() {
        this.active = false;
        previousTrajectory = [...this.path]; // Save trajectory
        
        // Destroy terrain at impact point (small crater radius of 25)
        destroyTerrain(this.x, this.y, 25);

        if (player.hp <= 0 || cpu.hp <= 0) {
            currentState = GAME_STATE.GAMEOVER;
            updateHUD();
        } else {
            // Next Turn
            turn = turn === 0 ? 1 : 0;
            if (turn === 1) {
                setTimeout(cpuTurn, 1000);
            }
            updateHUD();
        }
    }

    draw() {
        if (!this.active) return;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
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

let player, cpu, currentProjectile;

// Generate 8-bit style terrain
function generateTerrain() {
    terrain = [];
    let startY = HEIGHT - 100;
    for (let x = 0; x <= WIDTH; x += 5) { // 5px blocks
        terrain.push({x: x, y: startY});
        if (Math.random() > 0.8) {
            startY += (Math.random() * 20 - 10);
            if (startY > HEIGHT - 50) startY = HEIGHT - 50;
            if (startY < HEIGHT - 200) startY = HEIGHT - 200;
        }
    }
}

function initGame() {
    generateTerrain();
    player = new Tank(100, '#3b82f6', true);
    cpu = new Tank(WIDTH - 100, '#ef4444', false);
    turn = 0;
    currentState = GAME_STATE.PLAYING;
    previousTrajectory = [];
    currentProjectile = null;
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
    if (currentState !== GAME_STATE.PLAYING || turn !== 0 || currentProjectile?.active) return;
    
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
    if (currentState !== GAME_STATE.PLAYING || turn !== 0 || currentProjectile?.active) return;

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
        player.power += 0.2;
        if (player.power > player.maxPower) player.power = player.maxPower;
        updateHUD();
    }
    if ((keys.ArrowDown || touchKeys.ArrowDown) && player.power > 0) {
        player.power -= 0.2;
        if (player.power < 0) player.power = 0;
        updateHUD();
    }
}

function fireProjectile(tank) {
    const rad = tank.angle * Math.PI / 180;
    const spawnX = tank.x + Math.cos(rad) * 20;
    const spawnY = tank.y + 7 - Math.sin(rad) * 20;
    currentProjectile = new Projectile(spawnX, spawnY, tank.angle, tank.power, tank.isPlayer);
    updateHUD();
}

function cpuTurn() {
    if (currentState !== GAME_STATE.PLAYING) return;
    
    // Very Basic AI
    if (cpu.lastShotTooShort === null) {
        cpu.angle = 135; // Aim left (180 - 45)
        cpu.power = 15;
    } else {
        // Adjust power based on previous shot
        if (cpu.lastShotTooShort) {
            cpu.power += 2;
        } else {
            cpu.power -= 2;
        }
        // Clamp
        if (cpu.power > cpu.maxPower) cpu.power = cpu.maxPower;
        if (cpu.power < 5) cpu.power = 5;
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
    
    let turnIndicator = document.getElementById('turn-indicator');
    if (currentState === GAME_STATE.GAMEOVER) {
        turnIndicator.innerText = player.hp > 0 ? "PLAYER WINS!" : "CPU WINS!";
        turnIndicator.style.animation = "none";
        turnIndicator.style.color = player.hp > 0 ? "var(--player-color)" : "var(--cpu-color)";
    } else {
        turnIndicator.innerText = turn === 0 ? "Player's Turn" : "Computer's Turn";
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
    if (previousTrajectory.length < 2) return;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.setLineDash([5, 5]); // Dashed line
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(previousTrajectory[0].x, previousTrajectory[0].y);
    for(let i=1; i<previousTrajectory.length; i+=2) { // Skip some points for performance/style
        ctx.lineTo(previousTrajectory[i].x, previousTrajectory[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash
}

function gameLoop() {
    // Clear canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    handleInput();

    drawTerrain();
    drawTrajectory();
    
    player.update();
    cpu.update();
    player.draw();
    cpu.draw();

    if (currentProjectile && currentProjectile.active) {
        currentProjectile.update();
        currentProjectile.draw();
    }

    if (currentState === GAME_STATE.PLAYING || currentProjectile?.active) {
        requestAnimationFrame(gameLoop);
    } else {
        // Draw one last frame to show game over state
        drawTerrain();
        player.draw();
        cpu.draw();
    }
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
            if (currentState !== GAME_STATE.PLAYING || turn !== 0 || currentProjectile?.active) return;
            fireProjectile(player);
        };
        fireBtn.addEventListener('click', handleFire);
        fireBtn.addEventListener('touchstart', handleFire, { passive: false });
    }
}

// Start
setupMobileControls();
initGame();
