const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

// Nav: border/blur once the page scrolls, mobile menu toggle

const siteNav = document.querySelector("#site-nav");
const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector("#nav-menu");

const updateNavState = function () {
  siteNav.classList.toggle("is-scrolled", window.scrollY > 10);
};

const setMenuOpen = function (open) {
  navMenu.classList.toggle("is-open", open);
  navToggle.setAttribute("aria-expanded", String(open));
};

navToggle.addEventListener("click", function () {
  setMenuOpen(navToggle.getAttribute("aria-expanded") !== "true");
});

navMenu.addEventListener("click", function (e) {
  if (e.target.closest("a")) setMenuOpen(false);
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") setMenuOpen(false);
});

// Highlight the nav item for the section currently in view

const navItems = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll("main .section");

const highlightSection = function (entries) {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;

    navItems.forEach((item) => {
      item.classList.toggle(
        "is-active",
        item.getAttribute("href") === `#${entry.target.id}`
      );
    });
  });
};

const sectionObserver = new IntersectionObserver(highlightSection, {
  root: null,
  // A thin band across the middle of the viewport decides the active section
  rootMargin: "-45% 0px -50% 0px",
});

sections.forEach((section) => {
  sectionObserver.observe(section);
});

// Reveal elements as they scroll into view

const revealObserver = new IntersectionObserver(
  function (entries, observer) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  },
  { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
);

document.querySelectorAll(".reveal").forEach((el) => {
  revealObserver.observe(el);
});

// Hero: rotating, typed word

const rotatorWord = document.querySelector(".rotator-word");
const words = ["code", "design", "marketing"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const rotateWords = async function () {
  let index = 0;

  while (true) {
    await sleep(2400);
    const current = words[index];
    index = (index + 1) % words.length;
    const next = words[index];

    for (let i = current.length; i >= 0; i--) {
      rotatorWord.textContent = current.slice(0, i);
      await sleep(45);
    }
    await sleep(250);
    for (let i = 1; i <= next.length; i++) {
      rotatorWord.textContent = next.slice(0, i);
      await sleep(85);
    }
  }
};

if (!reduceMotion.matches) rotateWords();

// Pointer effects: hero spotlight and project card tilt

const hero = document.querySelector(".hero");
const projectCards = document.querySelectorAll(".project-card");

const trackPointer = function (el, onMove) {
  let frame = null;

  el.addEventListener("pointermove", function (e) {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
      onMove?.(x / rect.width, y / rect.height);
      frame = null;
    });
  });
};

if (finePointer.matches) {
  trackPointer(hero);

  projectCards.forEach((card) => {
    const maxTilt = 4;

    trackPointer(card, (px, py) => {
      if (reduceMotion.matches) return;
      card.style.setProperty("--ry", `${(px - 0.5) * maxTilt * 2}deg`);
      card.style.setProperty("--rx", `${(0.5 - py) * maxTilt * 2}deg`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });
}

// Resume timeline: fill the line as it scrolls past the middle of the screen

const timeline = document.querySelector("#timeline");
const timelineItems = timeline.querySelectorAll(".timeline-item");

const updateTimeline = function () {
  const rect = timeline.getBoundingClientRect();
  const marker = window.innerHeight * 0.6;
  const progress = Math.min(Math.max((marker - rect.top) / rect.height, 0), 1);
  timeline.style.setProperty("--progress", progress.toFixed(3));

  timelineItems.forEach((item) => {
    const top = item.getBoundingClientRect().top;
    item.classList.toggle("is-reached", top < marker);
  });
};

// Scroll handling, batched into one frame

let scrollFrame = null;

const onScroll = function () {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    updateNavState();
    updateTimeline();
    scrollFrame = null;
  });
};

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll);
onScroll();

// Contact: copy email address to the clipboard

const copyButton = document.querySelector("#copy-email");
const toast = document.querySelector("#toast");
let toastTimer = null;

const showToast = function (message) {
  toast.textContent = message;
  toast.classList.add("is-shown");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-shown"), 2200);
};

copyButton.addEventListener("click", async function () {
  try {
    await navigator.clipboard.writeText(copyButton.dataset.email);
    showToast("Email copied to clipboard");
  } catch {
    showToast(copyButton.dataset.email);
  }
});

document.querySelector("#year").textContent = new Date().getFullYear();
