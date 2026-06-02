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
    }

    draw() {
        // Draw body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
        // Draw top cabin
        ctx.fillRect(this.x - this.width/4, this.y - 10, this.width/2, 10);
        
        // Draw barrel
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - 5);
        const rad = this.angle * Math.PI / 180;
        ctx.lineTo(this.x + Math.cos(rad) * 20, this.y - 5 - Math.sin(rad) * 20);
        ctx.stroke();

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

        // Collision with bounds
        if (this.x < 0 || this.x > WIDTH || this.y > HEIGHT) {
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
    cpu = new Tank(700, '#ef4444', false);
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

    // Angle adjustment: Left/Right keys
    if (keys.ArrowLeft && player.angle < 90) {
        player.angle += 1;
        updateHUD();
    }
    if (keys.ArrowRight && player.angle > 0) {
        player.angle -= 1;
        updateHUD();
    }

    // Power adjustment: Up/Down keys (set statically)
    if (keys.ArrowUp && player.power < player.maxPower) {
        player.power += 0.2;
        if (player.power > player.maxPower) player.power = player.maxPower;
        updateHUD();
    }
    if (keys.ArrowDown && player.power > 0) {
        player.power -= 0.2;
        if (player.power < 0) player.power = 0;
        updateHUD();
    }
}

function fireProjectile(tank) {
    const rad = tank.angle * Math.PI / 180;
    const spawnX = tank.x + Math.cos(rad) * 20;
    const spawnY = tank.y - 5 - Math.sin(rad) * 20;
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
    } else {
        document.getElementById('angle-display').innerText = '???';
        document.getElementById('power-display').innerText = '???';
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

// Start
initGame();
