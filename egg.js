// Easter egg: the Press start button launches an Asteroids-style ship that
// can shoot the skill chips. Arrows fly, Space fires, Esc or the button lands
// it and puts the chips back.

const gameKeys = ["arrowup", "arrowleft", "arrowright", " "];
let playing = false;
let landShip = null;

const playBtn = document.querySelector("#play-btn");
const playLabel = playBtn.querySelector(".play-label");

const setPlayButton = function (on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playLabel.textContent = on ? "Land ship" : "Press start";
};

const startGame = function () {
  playing = true;

  const rootStyle = getComputedStyle(document.documentElement);
  const color = (name) => rootStyle.getPropertyValue(name).trim();
  const ink = color("--text");
  const accent = color("--accent");
  const muted = color("--muted");
  const surface = color("--surface");
  const border = color("--border-strong");
  const font = color("--font-mono");

  const canvas = document.createElement("canvas");
  canvas.className = "game-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");

  const chips = [...document.querySelectorAll(".chips li")];
  const held = new Set();
  const bullets = [];
  const sparks = [];
  const popups = [];
  const ship = { x: innerWidth / 2, y: innerHeight * 0.8, vx: 0, vy: 0, angle: -Math.PI / 2 };
  let score = 0;
  let cooldown = 0;
  let thrusting = false;
  let message = "";
  let endTimer = null;
  let frame = null;
  let last = performance.now();

  const resize = function () {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const wrap = function (thing) {
    thing.x = (thing.x + innerWidth) % innerWidth;
    thing.y = (thing.y + innerHeight) % innerHeight;
  };

  // Bricks shatter into square pixels in their row's color, with a few white ones
  const explode = function (x, y, brick) {
    for (let i = 0; i < 26; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;
      const life = 0.5 + Math.random() * 0.5;
      const fill = Math.random() < 0.25 ? ink : brick;
      sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, fill });
    }
  };

  const chipAt = function (x, y) {
    return chips.find((chip) => {
      if (chip.classList.contains("is-destroyed")) return false;
      const r = chip.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
  };

  const update = function (dt) {
    if (held.has("arrowleft")) ship.angle -= 4.5 * dt;
    if (held.has("arrowright")) ship.angle += 4.5 * dt;

    const dirX = Math.cos(ship.angle);
    const dirY = Math.sin(ship.angle);
    thrusting = held.has("arrowup");
    if (thrusting) {
      ship.vx += dirX * 520 * dt;
      ship.vy += dirY * 520 * dt;
    }

    // Space has a little drag here, so the ship is easier to park
    const drag = Math.pow(0.4, dt);
    ship.vx *= drag;
    ship.vy *= drag;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    wrap(ship);

    cooldown -= dt;
    if (held.has(" ") && cooldown <= 0) {
      cooldown = 0.16;
      bullets.push({
        x: ship.x + dirX * 14,
        y: ship.y + dirY * 14,
        vx: ship.vx + dirX * 700,
        vy: ship.vy + dirY * 700,
        life: 0.9,
      });
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      wrap(b);

      const chip = chipAt(b.x, b.y);
      if (chip) {
        const r = chip.getBoundingClientRect();
        chip.classList.add("is-destroyed");
        explode(r.left + r.width / 2, r.top + r.height / 2, getComputedStyle(chip).getPropertyValue("--brick").trim() || accent);
        popups.push({ x: r.left + r.width / 2, y: r.top, life: 0.9 });
        score += 100;
      }
      if (chip || b.life <= 0) bullets.splice(i, 1);
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.96;
      s.vy = s.vy * 0.96 + 400 * dt;
      s.life -= dt;
      if (s.life <= 0) sparks.splice(i, 1);
    }

    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].y -= 40 * dt;
      popups[i].life -= dt;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }

    if (!endTimer && chips.every((chip) => chip.classList.contains("is-destroyed"))) {
      message = "ALL SKILLS DESTROYED. GOOD THING I CAN REBUILD THEM.";
      endTimer = setTimeout(stopGame, 3500);
    }
  };

  const draw = function () {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -9);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.fillStyle = color("--bg");
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.stroke();
    if (thrusting && Math.random() > 0.25) {
      ctx.beginPath();
      ctx.moveTo(-7, -4);
      ctx.lineTo(-14 - Math.random() * 7, 0);
      ctx.lineTo(-7, 4);
      ctx.strokeStyle = accent;
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = ink;
    bullets.forEach((b) => ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3));

    // Whole-pixel positions keep the debris crisp and blocky
    sparks.forEach((s) => {
      ctx.globalAlpha = s.life / s.maxLife;
      ctx.fillStyle = s.fill;
      ctx.fillRect(Math.round(s.x) - 2, Math.round(s.y) - 2, 4, 4);
    });

    ctx.font = `bold 12px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = accent;
    popups.forEach((p) => {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillText("+100", p.x, Math.round(p.y));
    });
    ctx.globalAlpha = 1;

    panelText(
      `SCORE ${String(score).padStart(4, "0")}   ← ↑ → FLY · SPACE FIRE · ESC LAND`,
      20,
      innerHeight - 40,
      12,
      muted
    );

    if (message) {
      ctx.font = `14px ${font}`;
      const width = ctx.measureText(message).width + 32;
      panelText(message, (innerWidth - width) / 2, innerHeight / 2 - 20, 14, accent);
    }
  };

  // Text on a translucent panel, so it stays readable over the page.
  // x and y are the panel's top-left corner.
  const panelText = function (text, x, y, size, fill) {
    const padX = 16;
    const height = size * 3;
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    ctx.beginPath();
    ctx.roundRect(x, y, ctx.measureText(text).width + padX * 2, height, height / 2);
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = surface;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = fill;
    ctx.fillText(text, x + padX, y + height / 2);
  };

  const tick = function (now) {
    // Clamp the step so a backgrounded tab doesn't fling the ship on return
    update(Math.min((now - last) / 1000, 0.05));
    last = now;
    draw();
    frame = requestAnimationFrame(tick);
  };

  const onKeyDown = function (e) {
    const key = e.key.toLowerCase();
    if (key === "escape") return stopGame();
    if (!gameKeys.includes(key) && key !== "arrowdown") return;
    e.preventDefault();
    held.add(key);
  };

  const onKeyUp = function (e) {
    const key = e.key.toLowerCase();
    // Space would otherwise click whatever button has focus
    if (gameKeys.includes(key)) e.preventDefault();
    held.delete(key);
  };

  const stopGame = function () {
    cancelAnimationFrame(frame);
    clearTimeout(endTimer);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    removeEventListener("resize", resize);
    canvas.remove();
    chips.forEach((chip) => chip.classList.remove("is-destroyed"));
    playing = false;
    landShip = null;
    setPlayButton(false);
  };

  landShip = stopGame;
  setPlayButton(true);

  resize();
  addEventListener("resize", resize);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  document.querySelector("#skills").scrollIntoView({ block: "center" });
  frame = requestAnimationFrame(tick);
};

playBtn.addEventListener("click", function () {
  if (playing) return landShip();
  // Drop focus so Space fires the ship's gun, not this button
  playBtn.blur();
  startGame();
});
