// Easter egg: the Press start button turns the skill rows into a Space
// Invaders wave. The rows march side to side, step down at each edge and drop
// bombs. Left and Right move the cannon, Space fires, Esc or the button quits
// and puts the chips back.

const gameKeys = ["arrowleft", "arrowright", " "];
let playing = false;
let landShip = null;

const skills = document.querySelector("#skills");
const playBtn = document.querySelector("#play-btn");
const playLabel = playBtn.querySelector(".play-label");

const setPlayButton = function (on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playLabel.textContent = on ? "Quit game" : "Press start";
  // Lets the CSS move the rows by the march offsets
  skills.classList.toggle("is-playing", on);
};

// The arcade cannon, one character per pixel
const cannonSprite = [
  "......#......",
  ".....###.....",
  ".....###.....",
  ".###########.",
  "#############",
  "#############",
  "#############",
  "#############",
];
const pixel = 2;
const hudH = 56;
const cannonW = cannonSprite[0].length * pixel;
const cannonH = cannonSprite.length * pixel;

const startGame = function () {
  playing = true;

  const rootStyle = getComputedStyle(document.documentElement);
  const color = (name) => rootStyle.getPropertyValue(name).trim();
  const ink = color("--text");
  const bg = color("--bg");
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

  const formation = skills.querySelector(".skill-groups");
  const groups = [...skills.querySelectorAll(".skill-group")];
  const chips = [...skills.querySelectorAll(".chips li")];
  const brickOf = (chip) => getComputedStyle(chip).getPropertyValue("--brick").trim() || accent;
  // Top rows are worth more, like the far invaders in the arcade
  const points = new Map(
    chips.map((chip) => [chip, (groups.length - groups.indexOf(chip.closest(".skill-group"))) * 10])
  );
  const alive = () => chips.filter((chip) => !chip.classList.contains("is-destroyed"));

  const held = new Set();
  const shots = [];
  const bombs = [];
  const sparks = [];
  const popups = [];
  // The stage spans the rows' width, with the ground line a set gap below
  // them, so it follows the page if it scrolls
  const navH = document.querySelector("#site-nav").offsetHeight;
  const rowsH = formation.offsetHeight;
  const gap = Math.min(Math.max(innerHeight - navH - 32 - rowsH - hudH, 110), 180);
  const stage = function () {
    const r = formation.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, ground: r.bottom + gap };
  };
  const cannonTop = () => stage().ground - 4 - cannonH;
  const cannon = { x: innerWidth / 2 };
  const march = { x: 0, y: 0, dir: 1, timer: 0.6 };
  let bombTimer = 1.5;
  let lives = 3;
  let hitTimer = 0;
  let score = 0;
  let cooldown = 0;
  let over = false;
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
    return alive().find((chip) => {
      const r = chip.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
  };

  const end = function (text) {
    if (over) return;
    over = true;
    message = text;
    endTimer = setTimeout(stopGame, 3500);
  };

  // One step of the march: sideways until a brick would leave its row's
  // column or the formation's right edge, then down a notch and back
  const stepFormation = function () {
    const bounds = formation.getBoundingClientRect();
    let minX = -Infinity;
    let maxX = Infinity;
    alive().forEach((chip) => {
      const r = chip.getBoundingClientRect();
      const row = chip.parentElement.getBoundingClientRect();
      minX = Math.max(minX, row.left - r.left);
      maxX = Math.min(maxX, march.x + bounds.right - r.right);
    });

    const next = march.x + march.dir * 8;
    if (next < minX || next > maxX) {
      march.dir *= -1;
      march.y += 10;
    } else {
      march.x = next;
    }
    skills.style.setProperty("--march-x", `${march.x}px`);
    skills.style.setProperty("--march-y", `${march.y}px`);
  };

  // Bombs fall from the front line, the lowest bricks still standing
  const dropBomb = function (left) {
    const rects = left.map((chip) => chip.getBoundingClientRect());
    const front = Math.max(...rects.map((r) => r.bottom));
    const shooters = left.filter((_, i) => rects[i].bottom > front - 4);
    const chip = shooters[Math.floor(Math.random() * shooters.length)];
    const r = chip.getBoundingClientRect();
    bombs.push({ x: r.left + r.width / 2, y: r.bottom, fill: brickOf(chip) });
  };

  const update = function (dt) {
    const top = cannonTop();
    hitTimer -= dt;

    if (!over) {
      if (held.has("arrowleft")) cannon.x -= 420 * dt;
      if (held.has("arrowright")) cannon.x += 420 * dt;
      const { left, right } = stage();
      cannon.x = Math.min(Math.max(cannon.x, left + cannonW / 2), right - cannonW / 2);

      cooldown -= dt;
      if (held.has(" ") && cooldown <= 0 && shots.length < 2) {
        cooldown = 0.25;
        shots.push({ x: cannon.x, y: top });
      }
    }

    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.y -= 900 * dt;

      const chip = chipAt(s.x, s.y);
      if (chip) {
        const r = chip.getBoundingClientRect();
        const value = points.get(chip);
        chip.classList.add("is-destroyed");
        explode(r.left + r.width / 2, r.top + r.height / 2, brickOf(chip));
        popups.push({ x: r.left + r.width / 2, y: r.top, life: 0.9, text: `+${value}` });
        score += value;
      }
      if (chip || s.y < 0) shots.splice(i, 1);
    }

    const left = alive();

    // The march speeds up as the rows thin out
    if (!over && left.length) {
      march.timer -= dt;
      if (march.timer <= 0) {
        stepFormation();
        march.timer = 0.06 + 0.5 * (left.length / chips.length);
      }

      bombTimer -= dt;
      if (bombTimer <= 0) {
        dropBomb(left);
        bombTimer = 0.4 + Math.random() * 1.4 * (left.length / chips.length + 0.3);
      }
    }

    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      b.y += 260 * dt;

      const hit =
        !over &&
        hitTimer <= 0 &&
        b.y >= top &&
        b.y <= top + cannonH &&
        Math.abs(b.x - cannon.x) <= cannonW / 2;
      if (hit) {
        lives -= 1;
        hitTimer = 1.5;
        explode(cannon.x, top + cannonH / 2, accent);
        if (!lives) end("GAME OVER. THE SKILLS WIN THIS ROUND.");
      }
      if (hit || b.y > top + cannonH + 4) bombs.splice(i, 1);
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

    if (!left.length) {
      end("ALL SKILLS DESTROYED. GOOD THING I CAN REBUILD THEM.");
    } else if (left.some((chip) => chip.getBoundingClientRect().bottom >= top)) {
      end("THE SKILLS HAVE LANDED. GAME OVER.");
    }
  };

  const draw = function () {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const top = cannonTop();
    const { left, right, top: stageTop, ground } = stage();

    // Everything under the ground line fades back, so the stage reads as one
    // space and the next section stays out of the way
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = bg;
    ctx.fillRect(0, ground, innerWidth, innerHeight - ground);
    ctx.globalAlpha = 1;
    ctx.fillStyle = border;
    ctx.fillRect(left, ground, right - left, 2);

    // The cannon blinks while it recovers from a hit
    const blinking = hitTimer > 0 && Math.floor(hitTimer * 10) % 2;
    if (lives && !blinking) drawCannon(Math.round(cannon.x - cannonW / 2), top);

    ctx.fillStyle = ink;
    shots.forEach((s) => ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y), 2, 10));

    // Bombs wiggle as they fall, like the arcade's zigzag shots
    bombs.forEach((b) => {
      ctx.fillStyle = b.fill;
      for (let k = 0; k < 4; k++) {
        const wiggle = (Math.floor(b.y / 6) + k) % 2 ? 2 : -2;
        ctx.fillRect(Math.round(b.x) - 1 + wiggle, Math.round(b.y) - 12 + k * 3, 3, 3);
      }
    });

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
      ctx.fillText(p.text, p.x, Math.round(p.y));
    });
    ctx.globalAlpha = 1;

    // The HUD sits under the ground line: score, controls, spare cannons
    const hudY = ground + 30;
    ctx.font = `12px ${font}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = ink;
    ctx.fillText(`SCORE ${String(score).padStart(4, "0")}`, left, hudY);
    ctx.textAlign = "center";
    ctx.fillStyle = muted;
    ctx.fillText("← → MOVE · SPACE FIRE · ESC QUIT", (left + right) / 2, hudY);
    ctx.textAlign = "right";
    ctx.fillText("LIVES", right - 3 * (cannonW + 8), hudY);
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i < lives ? 1 : 0.2;
      drawCannon(right - (3 - i) * (cannonW + 8) + 8, hudY - cannonH / 2);
    }
    ctx.globalAlpha = 1;

    if (message) {
      ctx.font = `14px ${font}`;
      const width = ctx.measureText(message).width + 32;
      panelText(message, (left + right - width) / 2, (stageTop + ground) / 2 - 21, 14, accent);
    }
  };

  const drawCannon = function (x0, y0) {
    ctx.fillStyle = accent;
    cannonSprite.forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell === "#") ctx.fillRect(x0 + x * pixel, y0 + y * pixel, pixel, pixel);
      });
    });
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
    // Clamp the step so a backgrounded tab doesn't skip the march ahead
    update(Math.min((now - last) / 1000, 0.05));
    last = now;
    draw();
    frame = requestAnimationFrame(tick);
  };

  const onKeyDown = function (e) {
    const key = e.key.toLowerCase();
    if (key === "escape") return stopGame();
    if (!gameKeys.includes(key) && key !== "arrowup" && key !== "arrowdown") return;
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
    skills.style.removeProperty("--march-x");
    skills.style.removeProperty("--march-y");
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
  // Center the whole stage, rows to HUD, in the space under the nav
  const stageH = rowsH + gap + hudH;
  const offset = navH + Math.max(16, (innerHeight - navH - stageH) / 2);
  scrollTo({ top: scrollY + formation.getBoundingClientRect().top - offset, behavior: "instant" });
  cannon.x = (stage().left + stage().right) / 2;
  frame = requestAnimationFrame(tick);
};

playBtn.addEventListener("click", function () {
  if (playing) return landShip();
  // Drop focus so Space fires the cannon, not this button
  playBtn.blur();
  startGame();
});
