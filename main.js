(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Setup & helpers
     ------------------------------------------------------------------ */

  var CONFIG = window.SITE_CONFIG || {};
  var DAY_MS = 86400000;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var previewMode = new URLSearchParams(window.location.search).has("preview");

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function resolvePath(object, path) {
    return path.split(".").reduce(function (value, key) {
      return value && value[key] != null ? value[key] : undefined;
    }, object);
  }

  function getTogetherDays() {
    var start = new Date(CONFIG.startDate || "2022-05-20T20:20:00+08:00").getTime();
    if (Number.isNaN(start)) return 1;
    return Math.max(1, Math.floor((Date.now() - start) / DAY_MS) + 1);
  }

  function interpolate(text) {
    if (typeof text !== "string") return text;
    return text.replace(/\{(\w+)\}/g, function (match, key) {
      if (key === "days") return String(getTogetherDays());
      if (CONFIG[key] != null) return String(CONFIG[key]);
      return match;
    });
  }

  function decodeHTML(value) {
    return String(value == null ? "" : value);
  }

  function safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      /* Private mode / file restrictions: the site still works, just without memory. */
    }
  }

  var state = {
    loaded: false,
    typingStarted: false,
    music: null,
    lightboxIndex: 0,
    toastTimer: 0,
    letterLastFocus: null,
    lightboxLastFocus: null
  };

  /* ------------------------------------------------------------------
     Content hydration
     ------------------------------------------------------------------ */

  function hydrateStaticContent() {
    $$("[data-config]").forEach(function (element) {
      var value = resolvePath(CONFIG, element.getAttribute("data-config"));
      if (typeof value === "string") element.textContent = interpolate(value);
    });

    var since = $(".hero-since strong");
    if (since && CONFIG.sinceLabel) since.textContent = CONFIG.sinceLabel;

    var today = new Date();
    var letterDate = $("#letterDate");
    if (letterDate) {
      letterDate.textContent = today.getFullYear() + " / " + pad(today.getMonth() + 1) + " / " + pad(today.getDate());
    }

    var year = $("#year");
    if (year) year.textContent = String(today.getFullYear());

    var days = getTogetherDays();
    $$("[data-days]").forEach(function (element) {
      element.textContent = String(days);
    });

    var total = $("#wishTotal");
    if (total) total.textContent = String((CONFIG.wishes || []).length);

    if (CONFIG.hero && CONFIG.hero.title1) {
      document.title = CONFIG.hero.title1 + " · " + (CONFIG.hero.title2 || "未完待续");
    }
  }

  function splitHeroTitle() {
    var title = $("#heroTitle");
    if (!title) return;

    var lines = $$(".title-line", title);
    var accessible = [];
    var index = 0;

    lines.forEach(function (line) {
      var target = $("[data-config]", line) || line;
      var text = target.textContent.trim();
      if (!text) return;

      accessible.push(text);
      target.textContent = "";
      Array.from(text).forEach(function (character) {
        var span = document.createElement("span");
        span.className = "char";
        span.textContent = character === " " ? "\u00A0" : character;
        span.style.setProperty("--i", String(index));
        index += 1;
        target.appendChild(span);
      });
      line.setAttribute("aria-hidden", "true");
    });

    title.setAttribute("aria-label", accessible.join(" "));
  }

  /* ------------------------------------------------------------------
     Preloader & typing
     ------------------------------------------------------------------ */

  function finishPreloader() {
    if (state.loaded) return;
    state.loaded = true;
    document.documentElement.classList.remove("is-loading");
    document.documentElement.classList.add("is-loaded");

    window.setTimeout(function () {
      var preloader = $("#preloader");
      if (preloader) preloader.setAttribute("aria-hidden", "true");
    }, 1100);

    window.setTimeout(startTyping, 1250);
  }

  function startTyping() {
    if (state.typingStarted) return;
    state.typingStarted = true;

    var typedElement = $("#typedText");
    if (!typedElement) return;

    var lines = (CONFIG.hero && CONFIG.hero.typed) || [];
    if (!lines.length) return;

    if (reduceMotion) {
      typedElement.textContent = lines[0];
      return;
    }

    var lineIndex = 0;
    var charIndex = 0;
    var deleting = false;

    function schedule(delay) {
      window.setTimeout(typeNext, delay);
    }

    function typeNext() {
      var current = lines[lineIndex] || "";
      if (!deleting) {
        charIndex += 1;
        typedElement.textContent = current.slice(0, charIndex);
        if (charIndex >= current.length) {
          deleting = true;
          schedule(2300);
        } else {
          schedule(random(55, 105));
        }
        return;
      }

      charIndex -= 1;
      typedElement.textContent = current.slice(0, Math.max(0, charIndex));
      if (charIndex <= 0) {
        deleting = false;
        lineIndex = (lineIndex + 1) % lines.length;
        schedule(650);
      } else {
        schedule(34);
      }
    }

    schedule(350);
  }

  /* ------------------------------------------------------------------
     Renderers
     ------------------------------------------------------------------ */

  function renderTimeline() {
    var list = $("#timelineItems");
    if (!list) return;
    var items = CONFIG.timeline || [];
    if (!items.length) return;

    list.innerHTML = items
      .map(function (item, index) {
        var number = pad(index + 1);
        return (
          '<article class="timeline-item reveal" data-delay="' + (index * 0.04).toFixed(2) + '">' +
            '<div class="timeline-content">' +
              '<span class="timeline-date">' + decodeHTML(item.date) + "</span>" +
              "<h3>" + decodeHTML(item.title) + "</h3>" +
              "<p>" + decodeHTML(item.text) + "</p>" +
              '<span class="timeline-tag">' + decodeHTML(item.tag) + "</span>" +
            "</div>" +
            '<div class="timeline-node" aria-hidden="true"><span class="node-no">' + number + "</span></div>" +
            '<figure class="timeline-photo">' +
              '<div class="timeline-photo-inner">' +
                '<img src="' + decodeHTML(item.image) + '" alt="' + decodeHTML(item.alt || item.title) + '" loading="lazy" decoding="async">' +
              "</div>" +
              "<figcaption><span>" + decodeHTML(item.caption || item.title) + "</span><span>" + decodeHTML(item.date) + "</span></figcaption>" +
            "</figure>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderReasons() {
    var grid = $("#reasonsGrid");
    if (!grid) return;
    var items = CONFIG.reasons || [];
    var allowedIcons = ["sun", "sparkles", "heart", "cloud", "compass", "music", "coffee", "star"];

    grid.innerHTML = items
      .map(function (item, index) {
        var icon = allowedIcons.indexOf(item.icon) !== -1 ? item.icon : "star";
        return (
          '<article class="reason-card reveal" data-delay="' + (index * 0.055).toFixed(2) + '">' +
            '<span class="reason-number" aria-hidden="true">' + pad(index + 1) + "</span>" +
            '<span class="reason-icon"><svg class="icon" aria-hidden="true"><use href="#i-' + icon + '"></use></svg></span>' +
            "<h3>" + decodeHTML(item.title) + "</h3>" +
            "<p>" + decodeHTML(item.text) + "</p>" +
            '<span class="reason-heart" aria-hidden="true">♥</span>' +
          "</article>"
        );
      })
      .join("");
  }

  function renderGallery() {
    var wall = $("#galleryWall");
    if (!wall) return;
    var items = CONFIG.gallery || [];

    wall.innerHTML = items
      .map(function (item, index) {
        return (
          '<button class="polaroid reveal" type="button" data-index="' + index + '" data-delay="' + (index * 0.05).toFixed(2) + '" ' +
            'style="--rot:' + decodeHTML(item.rotate || "0deg") + '" aria-label="查看照片：' + decodeHTML(item.caption) + '">' +
            '<span class="polaroid-photo"><img src="' + decodeHTML(item.src) + '" alt="' + decodeHTML(item.alt || item.caption) + '" loading="lazy" decoding="async"></span>' +
            '<span class="polaroid-caption">' + decodeHTML(item.caption) + "</span>" +
            '<span class="polaroid-meta"><span>' + decodeHTML(item.date) + '</span><svg class="icon" aria-hidden="true"><use href="#i-camera"></use></svg></span>' +
          "</button>"
        );
      })
      .join("");

    var total = $("#lightboxTotal");
    if (total) total.textContent = String(items.length);
  }

  function renderLetter() {
    var body = $("#letterBody");
    if (!body) return;
    var letter = CONFIG.letter || {};
    var paragraphs = letter.paragraphs || [];
    body.innerHTML =
      '<p class="letter-greeting">' + decodeHTML(interpolate(letter.greeting || "亲爱的你：")) + "</p>" +
      paragraphs.map(function (paragraph) {
        return "<p>" + decodeHTML(interpolate(paragraph)) + "</p>";
      }).join("");
  }

  /* ------------------------------------------------------------------
     Reveal on scroll & counters
     ------------------------------------------------------------------ */

  var revealObserver = null;

  function initReveal() {
    var elements = $$(".reveal");
    elements.forEach(function (element) {
      var delay = element.getAttribute("data-delay");
      if (delay) element.style.setProperty("--delay", delay + "s");
    });

    if (!("IntersectionObserver" in window)) {
      elements.forEach(function (element) {
        element.classList.add("is-visible");
      });
      $$("[data-counter]").forEach(function (element) {
        element.textContent = String(getTogetherDays());
      });
      return;
    }

    if (previewMode) {
      elements.forEach(function (element) {
        element.classList.add("is-visible");
      });
      $$("[data-counter]").forEach(function (element) {
        element.textContent = String(getTogetherDays());
      });
      return;
    }

    if (revealObserver) revealObserver.disconnect();
    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    elements.forEach(function (element) {
      revealObserver.observe(element);
    });

    if (!reduceMotion) {
      $$("[data-counter]").forEach(function (element) {
        var counterObserver = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              animateCounter(entry.target, getTogetherDays());
              counterObserver.unobserve(entry.target);
            });
          },
          { threshold: 0.6 }
        );
        counterObserver.observe(element);
      });
    }
  }

  function animateCounter(element, target) {
    var start = performance.now();
    var duration = 1700;

    function tick(now) {
      var progress = clamp((now - start) / duration, 0, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------
     Header, scroll progress, nav
     ------------------------------------------------------------------ */

  function initScrollUI() {
    var header = $("#siteHeader");
    var progress = $(".scroll-progress span");
    var navLinks = $$(".nav-link");
    var sections = $$("main section[id]");
    var timeline = $("#timelineList");
    var timelineProgress = $("#timelineProgress");
    var ticking = false;

    function update() {
      var scrollY = window.scrollY || window.pageYOffset;
      var height = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var ratio = clamp(scrollY / height, 0, 1);

      if (header) header.classList.toggle("is-scrolled", scrollY > 30);
      if (progress) progress.style.width = (ratio * 100).toFixed(2) + "%";

      var activeId = "";
      var threshold = scrollY + window.innerHeight * 0.34;
      sections.forEach(function (section) {
        if (section.offsetTop <= threshold) activeId = "#" + section.id;
      });
      navLinks.forEach(function (link) {
        link.classList.toggle("is-active", activeId !== "" && link.getAttribute("href") === activeId);
      });

      if (timeline && timelineProgress) {
        var rect = timeline.getBoundingClientRect();
        var startPoint = window.innerHeight * 0.8;
        var distance = rect.height + window.innerHeight * 0.2;
        var timelineRatio = clamp((startPoint - rect.top) / Math.max(1, distance), 0, 1);
        timelineProgress.style.transform = "scaleY(" + timelineRatio.toFixed(4) + ")";
      }

      ticking = false;
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    update();
  }

  /* ------------------------------------------------------------------
     Starfield
     ------------------------------------------------------------------ */

  function initStarfield() {
    var canvas = $("#starfield");
    if (!canvas) return;
    var context = canvas.getContext("2d");
    if (!context) return;

    var stars = [];
    var width = 0;
    var height = 0;
    var dpr = 1;
    var scrollOffset = 0;
    var lastFrame = 0;

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      draw(performance.now());
    }

    function build() {
      var count = Math.min(190, Math.max(70, Math.round((width * height) / 11500)));
      stars = [];
      for (var i = 0; i < count; i += 1) {
        var big = Math.random() > 0.9;
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: big ? random(1.1, 1.8) : random(0.25, 1.05),
          baseAlpha: random(0.18, big ? 0.9 : 0.65),
          phase: Math.random() * Math.PI * 2,
          speed: random(0.0004, 0.0013),
          drift: random(0.006, 0.02),
          tint: Math.random() > 0.82 ? "rose" : Math.random() > 0.72 ? "gold" : "blue",
          big: big
        });
      }
    }

    function draw(now) {
      context.clearRect(0, 0, width, height);
      scrollOffset = window.scrollY * 0.035;

      for (var i = 0; i < stars.length; i += 1) {
        var star = stars[i];
        var twinkle = 0.55 + 0.45 * Math.sin(now * star.speed + star.phase);
        var y = (star.y - scrollOffset * star.drift * 18 + height * 10) % height;
        var alpha = star.baseAlpha * twinkle;

        context.beginPath();
        context.arc(star.x, y, star.radius, 0, Math.PI * 2);
        context.fillStyle =
          star.tint === "rose"
            ? "rgba(255, 196, 205, " + alpha + ")"
            : star.tint === "gold"
            ? "rgba(255, 230, 184, " + alpha + ")"
            : "rgba(220, 228, 255, " + alpha + ")";
        context.fill();

        if (star.big) {
          context.strokeStyle = "rgba(255, 244, 221, " + alpha * 0.35 + ")";
          context.lineWidth = 0.6;
          context.beginPath();
          context.moveTo(star.x - star.radius * 3.5, y);
          context.lineTo(star.x + star.radius * 3.5, y);
          context.moveTo(star.x, y - star.radius * 3.5);
          context.lineTo(star.x, y + star.radius * 3.5);
          context.stroke();
        }
      }
    }

    function frame(now) {
      if (now - lastFrame > 42) {
        draw(now);
        lastFrame = now;
      }
      requestAnimationFrame(frame);
    }

    resize();
    if (!reduceMotion) {
      requestAnimationFrame(frame);
    }

    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 180);
    });

    document.addEventListener("visibilitychange", function () {
      lastFrame = performance.now();
    });
  }

  /* ------------------------------------------------------------------
     Heart / sparkle particle canvas
     ------------------------------------------------------------------ */

  function initFX() {
    var canvas = $("#fx-canvas");
    if (!canvas) return;
    var context = canvas.getContext("2d");
    if (!context) return;

    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var width = window.innerWidth;
    var height = window.innerHeight;
    var particles = [];
    var running = false;
    var lastTime = 0;
    var palette = ["#ff9eb6", "#ffd2a8", "#f1c992", "#c9b7ff", "#fff1de"];

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function heartPath(size) {
      context.beginPath();
      context.moveTo(0, size * 0.38);
      context.bezierCurveTo(-size * 0.96, -size * 0.22, -size * 0.55, -size * 0.95, 0, -size * 0.35);
      context.bezierCurveTo(size * 0.55, -size * 0.95, size * 0.96, -size * 0.22, 0, size * 0.38);
      context.closePath();
    }

    function spawnHearts(x, y, count, options) {
      if (reduceMotion) return;
      options = options || {};
      var power = options.power || 1;
      for (var i = 0; i < count; i += 1) {
        var angle = random(-Math.PI * 0.92, -Math.PI * 0.08);
        var speed = random(2.4, 7.8) * power;
        particles.push({
          kind: Math.random() > 0.78 ? "spark" : "heart",
          x: x + random(-12, 12),
          y: y + random(-10, 10),
          vx: Math.cos(angle) * speed + random(-1.4, 1.4),
          vy: Math.sin(angle) * speed + random(-1.2, 0.4),
          gravity: random(0.045, 0.12),
          drag: 0.992,
          size: random(4, 11) * (options.scale || 1),
          rotation: random(0, Math.PI * 2),
          spin: random(-0.08, 0.08),
          life: random(75, 150),
          maxLife: 0,
          color: palette[Math.floor(Math.random() * palette.length)]
        });
        particles[particles.length - 1].maxLife = particles[particles.length - 1].life;
      }
      start();
    }

    function start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(frame);
    }

    function frame(now) {
      var delta = clamp((now - lastTime) / 16.6667, 0.4, 2.2);
      lastTime = now;
      context.clearRect(0, 0, width, height);

      for (var i = particles.length - 1; i >= 0; i -= 1) {
        var particle = particles[i];
        particle.life -= delta;
        if (particle.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        particle.vx *= Math.pow(particle.drag, delta);
        particle.vy = particle.vy * Math.pow(particle.drag, delta) + particle.gravity * delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.rotation += particle.spin * delta;

        var alpha = clamp(particle.life / Math.min(45, particle.maxLife), 0, 1);
        context.save();
        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);

        if (particle.kind === "heart") {
          heartPath(particle.size);
          context.fill();
        } else {
          var size = particle.size * 0.7;
          context.beginPath();
          for (var point = 0; point < 4; point += 1) {
            var angle = point * Math.PI * 0.5;
            var outerX = Math.cos(angle) * size;
            var outerY = Math.sin(angle) * size;
            var innerAngle = angle + Math.PI * 0.25;
            var innerX = Math.cos(innerAngle) * size * 0.28;
            var innerY = Math.sin(innerAngle) * size * 0.28;
            if (point === 0) context.moveTo(outerX, outerY);
            else context.lineTo(outerX, outerY);
            context.lineTo(innerX, innerY);
          }
          context.closePath();
          context.fill();
        }
        context.restore();
      }

      if (particles.length > 0) {
        requestAnimationFrame(frame);
      } else {
        running = false;
        context.clearRect(0, 0, width, height);
      }
    }

    function burstFrom(element, count, options) {
      if (!element) return;
      var rect = element.getBoundingClientRect();
      spawnHearts(rect.left + rect.width / 2, rect.top + rect.height / 2, count, options);
    }

    resize();
    window.addEventListener("resize", resize);

    window.LoveFX = {
      burstAt: spawnHearts,
      burstFrom: burstFrom
    };
  }

  /* ------------------------------------------------------------------
     Custom cursor & hero tilt
     ------------------------------------------------------------------ */

  function initCursor() {
    if (!finePointer || reduceMotion) return;
    var dot = $(".cursor-dot");
    var ring = $(".cursor-ring");
    if (!dot || !ring) return;

    var targetX = window.innerWidth / 2;
    var targetY = window.innerHeight / 2;
    var dotX = targetX;
    var dotY = targetY;
    var ringX = targetX;
    var ringY = targetY;
    var visible = false;

    document.addEventListener("pointermove", function (event) {
      targetX = event.clientX;
      targetY = event.clientY;
      if (!visible) {
        visible = true;
        document.body.classList.add("has-cursor");
      }
    });

    document.addEventListener("pointerleave", function () {
      visible = false;
      document.body.classList.remove("has-cursor");
    });

    var hoverSelector = "a, button, .polaroid, .wish-item, .envelope, .heart-cta";
    document.addEventListener("pointerover", function (event) {
      if (event.target.closest && event.target.closest(hoverSelector)) {
        ring.classList.add("is-hover");
      }
    });
    document.addEventListener("pointerout", function (event) {
      if (event.target.closest && event.target.closest(hoverSelector)) {
        ring.classList.remove("is-hover");
      }
    });

    function loop() {
      dotX += (targetX - dotX) * 0.42;
      dotY += (targetY - dotY) * 0.42;
      ringX += (targetX - ringX) * 0.14;
      ringY += (targetY - ringY) * 0.14;
      dot.style.transform = "translate3d(" + dotX + "px," + dotY + "px,0) translate(-50%,-50%)";
      ring.style.transform = "translate3d(" + ringX + "px," + ringY + "px,0) translate(-50%,-50%)";
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function initHeroTilt() {
    if (!finePointer || reduceMotion) return;
    var hero = $(".hero");
    var stage = $("#orbitStage");
    if (!hero || !stage) return;

    hero.addEventListener("pointermove", function (event) {
      var rect = stage.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;
      stage.style.setProperty("--ry", (x * 9).toFixed(2) + "deg");
      stage.style.setProperty("--rx", (-y * 7).toFixed(2) + "deg");
    });

    hero.addEventListener("pointerleave", function () {
      stage.style.setProperty("--ry", "0deg");
      stage.style.setProperty("--rx", "0deg");
    });
  }

  /* ------------------------------------------------------------------
     Sound: an original, generative night piece
     ------------------------------------------------------------------ */

  function NightMusic() {
    this.ctx = null;
    this.master = null;
    this.dry = null;
    this.wet = null;
    this.playing = false;
    this.chordIndex = 0;
    this.chordTimer = 0;
    this.noteTimer = 0;
    this.chords = [
      [110.0, 220.0, 261.63, 329.63, 493.88],
      [87.31, 174.61, 220.0, 261.63, 329.63],
      [130.81, 196.0, 246.94, 329.63, 392.0],
      [98.0, 196.0, 246.94, 293.66, 329.63]
    ];
    this.scale = [440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  }

  NightMusic.prototype.setup = function () {
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("AudioContext unavailable");

    var ctx = new AudioContextClass();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(ctx.destination);

    this.dry = ctx.createGain();
    this.dry.gain.value = 0.72;
    this.dry.connect(this.master);

    var convolver = ctx.createConvolver();
    convolver.buffer = this.makeImpulse(3.4, 2.7);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.34;
    this.wet.connect(convolver);
    convolver.connect(this.master);
  };

  NightMusic.prototype.makeImpulse = function (seconds, decay) {
    var ctx = this.ctx;
    var rate = ctx.sampleRate;
    var length = Math.floor(rate * seconds);
    var buffer = ctx.createBuffer(2, length, rate);
    for (var channel = 0; channel < 2; channel += 1) {
      var data = buffer.getChannelData(channel);
      for (var i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  };

  NightMusic.prototype.route = function (node) {
    node.connect(this.dry);
    node.connect(this.wet);
  };

  NightMusic.prototype.playPad = function (frequency, when, duration, volume) {
    var ctx = this.ctx;
    var oscillator = ctx.createOscillator();
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, when);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(760, when);
    filter.Q.value = 0.55;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 1.45);
    gain.gain.setValueAtTime(volume, when + duration - 1.9);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    this.route(gain);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.1);
  };

  NightMusic.prototype.playBell = function (frequency, when, duration, volume) {
    var ctx = this.ctx;
    var gain = ctx.createGain();
    var first = ctx.createOscillator();
    var second = ctx.createOscillator();
    var secondGain = ctx.createGain();
    first.type = "sine";
    second.type = "sine";
    first.frequency.setValueAtTime(frequency, when);
    second.frequency.setValueAtTime(frequency * 2.01, when);
    secondGain.gain.value = 0.18;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    first.connect(gain);
    second.connect(secondGain);
    secondGain.connect(gain);
    this.route(gain);
    first.start(when);
    second.start(when);
    first.stop(when + duration + 0.05);
    second.stop(when + duration + 0.05);
  };

  NightMusic.prototype.scheduleChord = function () {
    if (!this.playing || !this.ctx) return;
    var when = this.ctx.currentTime + 0.06;
    var chord = this.chords[this.chordIndex % this.chords.length];
    for (var i = 0; i < chord.length; i += 1) {
      this.playPad(chord[i], when + i * 0.055, 6.9, i === 0 ? 0.028 : 0.016);
    }
    this.chordIndex += 1;
  };

  NightMusic.prototype.scheduleNote = function () {
    if (!this.playing || !this.ctx) return;
    if (Math.random() > 0.56) return;
    var when = this.ctx.currentTime + 0.03;
    var frequency = this.scale[Math.floor(Math.random() * this.scale.length)];
    this.playBell(frequency, when, 2.8, 0.024);
    if (Math.random() > 0.78) {
      this.playBell(frequency * 1.5, when + 0.34, 2.2, 0.011);
    }
  };

  NightMusic.prototype.start = async function () {
    if (!this.ctx) this.setup();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (this.playing) return;
    this.playing = true;

    var now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
    this.master.gain.exponentialRampToValueAtTime(0.72, now + 2.4);

    this.scheduleChord();
    this.scheduleNote();
    this.chordTimer = window.setInterval(this.scheduleChord.bind(this), 5600);
    this.noteTimer = window.setInterval(this.scheduleNote.bind(this), 680);
  };

  NightMusic.prototype.stop = function () {
    if (!this.playing) return;
    this.playing = false;
    window.clearInterval(this.chordTimer);
    window.clearInterval(this.noteTimer);

    if (this.ctx && this.master) {
      var now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
      this.master.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    }
  };

  NightMusic.prototype.chime = function () {
    if (!this.playing || !this.ctx) return;
    var notes = [659.25, 783.99, 987.77, 1318.51];
    var now = this.ctx.currentTime + 0.02;
    for (var i = 0; i < notes.length; i += 1) {
      this.playBell(notes[i], now + i * 0.085, 1.7, 0.018);
    }
  };

  var music = new NightMusic();

  function updateMusicUI(playing) {
    var toggle = $("#soundToggle");
    if (toggle) {
      toggle.classList.toggle("is-playing", playing);
      toggle.setAttribute("aria-pressed", String(playing));
      toggle.setAttribute("aria-label", playing ? "暂停背景音乐" : "播放背景音乐");
    }

    var heroMusic = $("#heroMusic");
    if (heroMusic) {
      var label = heroMusic.lastElementChild;
      if (label && label.tagName === "SPAN") {
        label.textContent = playing ? "正在播放 · 夜曲" : "听一首给你的歌";
      }
      var icon = heroMusic.querySelector("use");
      if (icon) icon.setAttribute("href", playing ? "#i-pause" : "#i-play");
    }
  }

  function toggleMusic() {
    if (!music.ctx) {
      music.start().then(function () {
        updateMusicUI(true);
        showToast("正在播放：" + interpolate(CONFIG.musicTitle || "写给宝贝的夜曲"));
      }).catch(function () {
        showToast("这个浏览器暂时不能播放音乐");
      });
      return;
    }

    if (music.playing) {
      music.stop();
      updateMusicUI(false);
      showToast("音乐已暂停，想听的时候再点我");
    } else {
      music.start().then(function () {
        updateMusicUI(true);
        showToast("正在播放：" + interpolate(CONFIG.musicTitle || "写给宝贝的夜曲"));
      }).catch(function () {
        showToast("这个浏览器暂时不能播放音乐");
      });
    }
  }

  function initSound() {
    var toggle = $("#soundToggle");
    var heroMusic = $("#heroMusic");
    if (toggle) toggle.addEventListener("click", toggleMusic);
    if (heroMusic) heroMusic.addEventListener("click", toggleMusic);
  }

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */

  function showToast(message, duration) {
    var toast = $("#toast");
    var text = $("#toastText");
    if (!toast || !text) return;
    text.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, duration || 3000);
  }

  /* ------------------------------------------------------------------
     Lightbox
     ------------------------------------------------------------------ */

  function initLightbox() {
    var lightbox = $("#lightbox");
    var closeButton = $("#lightboxClose");
    var prevButton = $("#lightboxPrev");
    var nextButton = $("#lightboxNext");
    var image = $("#lightboxImg");
    var caption = $("#lightboxCaption");
    var date = $("#lightboxDate");
    var current = $("#lightboxCurrent");
    var items = CONFIG.gallery || [];
    if (!lightbox || !image || !items.length) return;

    function show(index) {
      state.lightboxIndex = (index + items.length) % items.length;
      var item = items[state.lightboxIndex];
      image.style.opacity = "0";
      image.src = item.src;
      image.alt = item.alt || item.caption;
      caption.textContent = item.caption;
      date.textContent = item.date;
      if (current) current.textContent = String(state.lightboxIndex + 1);
      var reveal = function () {
        image.style.transition = "opacity .35s ease";
        image.style.opacity = "1";
      };
      if (image.complete) reveal();
      else image.onload = reveal;

      var next = items[(state.lightboxIndex + 1) % items.length];
      var prev = items[(state.lightboxIndex - 1 + items.length) % items.length];
      [next, prev].forEach(function (entry) {
        if (!entry) return;
        var preload = new Image();
        preload.src = entry.src;
      });
    }

    function open(index) {
      state.lightboxLastFocus = document.activeElement;
      show(index);
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-locked");
      window.setTimeout(function () {
        if (closeButton) closeButton.focus({ preventScroll: true });
      }, 100);
    }

    function close() {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      if (!document.querySelector(".letter-stage.is-open")) {
        document.body.classList.remove("is-locked");
      }
      if (state.lightboxLastFocus && typeof state.lightboxLastFocus.focus === "function") {
        state.lightboxLastFocus.focus({ preventScroll: true });
      }
    }

    $$(".polaroid").forEach(function (button) {
      button.addEventListener("click", function () {
        open(Number(button.getAttribute("data-index")) || 0);
      });
    });

    if (closeButton) closeButton.addEventListener("click", close);
    if (prevButton) prevButton.addEventListener("click", function () { show(state.lightboxIndex - 1); });
    if (nextButton) nextButton.addEventListener("click", function () { show(state.lightboxIndex + 1); });

    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) close();
    });

    document.addEventListener("keydown", function (event) {
      if (!lightbox.classList.contains("is-open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        show(state.lightboxIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        show(state.lightboxIndex + 1);
      } else if (event.key === "Tab") {
        trapFocus(lightbox, event);
      }
    });

    lightbox._close = close;
  }

  function trapFocus(container, event) {
    var focusable = $$("a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])", container).filter(
      function (element) {
        return element.offsetParent !== null;
      }
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------------------------------------------
     Letter
     ------------------------------------------------------------------ */

  function initLetter() {
    var stage = $("#letterStage");
    var envelope = $("#envelope");
    var paper = $("#letterPaper");
    var closeButton = $("#letterClose");
    if (!stage || !envelope || !paper) return;

    function open() {
      state.letterLastFocus = document.activeElement;
      stage.classList.add("is-open");
      envelope.setAttribute("aria-expanded", "true");
      paper.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-locked", "letter-open");
      paper.scrollTop = 0;
      if (window.LoveFX) window.LoveFX.burstFrom(envelope, 32, { power: 0.75 });
      music.chime();
      window.setTimeout(function () {
        if (closeButton) closeButton.focus({ preventScroll: true });
      }, 750);
    }

    function close() {
      stage.classList.remove("is-open");
      envelope.setAttribute("aria-expanded", "false");
      paper.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-locked", "letter-open");
      if (state.letterLastFocus && typeof state.letterLastFocus.focus === "function") {
        state.letterLastFocus.focus({ preventScroll: true });
      }
    }

    envelope.addEventListener("click", open);
    if (closeButton) closeButton.addEventListener("click", close);

    stage.addEventListener("click", function (event) {
      if (event.target === stage && stage.classList.contains("is-open")) close();
    });

    document.addEventListener("keydown", function (event) {
      if (!stage.classList.contains("is-open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab") {
        trapFocus(paper, event);
      }
    });
  }

  /* ------------------------------------------------------------------
     Wishes
     ------------------------------------------------------------------ */

  function initWishes() {
    var list = $("#wishList");
    var doneLabel = $("#wishDone");
    var totalLabel = $("#wishTotal");
    var bar = $("#wishBar");
    var note = $("#wishNote");
    var panel = $(".wish-panel");
    var items = CONFIG.wishes || [];
    if (!list || !items.length) return;

    var storageKey = "our-story-wishes-v1";
    var savedRaw = safeStorageGet(storageKey);
    var completed;

    if (savedRaw) {
      try {
        var parsed = JSON.parse(savedRaw);
        completed = new Set(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        completed = new Set(items.filter(function (item) { return item.done; }).map(function (item) { return item.text; }));
      }
    } else {
      completed = new Set(items.filter(function (item) { return item.done; }).map(function (item) { return item.text; }));
    }

    list.innerHTML = items
      .map(function (item, index) {
        var done = completed.has(item.text);
        return (
          '<li><button class="wish-item' + (done ? " is-done" : "") + '" type="button" data-index="' + index + '" aria-pressed="' + done + '">' +
            '<span class="wish-check" aria-hidden="true"><svg class="icon"><use href="#i-check"></use></svg></span>' +
            '<span class="wish-text">' + decodeHTML(item.text) + "</span>" +
            '<span class="wish-spark" aria-hidden="true">✦</span>' +
          "</button></li>"
        );
      })
      .join("");

    if (totalLabel) totalLabel.textContent = String(items.length);

    function update(announce) {
      var done = list.querySelectorAll(".wish-item.is-done").length;
      if (doneLabel) doneLabel.textContent = String(done);
      if (bar) bar.style.width = (done / items.length) * 100 + "%";
      if (note) {
        note.textContent =
          done === items.length
            ? CONFIG.wishComplete || "所有愿望都实现的那天，我们就结婚吧。"
            : "点一点，把完成的愿望点亮。";
      }
      if (panel) panel.classList.toggle("is-complete", done === items.length);
      if (announce && done === items.length) {
        showToast(CONFIG.wishComplete || "所有愿望都实现的那天，我们就结婚吧。", 4200);
        var rect = list.getBoundingClientRect();
        if (window.LoveFX) {
          window.LoveFX.burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 48, { power: 1.15, scale: 1.1 });
        }
      }
    }

    list.addEventListener("click", function (event) {
      var button = event.target.closest(".wish-item");
      if (!button) return;
      var index = Number(button.getAttribute("data-index"));
      var item = items[index];
      if (!item) return;

      var isDone = completed.has(item.text);
      if (isDone) {
        completed.delete(item.text);
        button.classList.remove("is-done");
        button.setAttribute("aria-pressed", "false");
      } else {
        completed.add(item.text);
        button.classList.add("is-done");
        button.setAttribute("aria-pressed", "true");
        music.chime();
        if (window.LoveFX) window.LoveFX.burstAt(event.clientX, event.clientY, 18, { power: 0.7 });
      }

      safeStorageSet(storageKey, JSON.stringify(Array.from(completed)));
      update(true);
    });

    update(false);
  }

  /* ------------------------------------------------------------------
     Constellation
     ------------------------------------------------------------------ */

  function initConstellation() {
    var art = $(".constellation-art");
    var svg = $("#constellationSvg");
    var linesGroup = $("#constellationLines");
    var starsGroup = $("#constellationStars");
    var labelsGroup = $("#constellationLabels");
    if (!art || !svg || !linesGroup || !starsGroup) return;

    var points = [
      [400, 610], [325, 552], [250, 480], [186, 392], [148, 300],
      [140, 210], [172, 132], [238, 96], [310, 110], [360, 164],
      [400, 232], [440, 164], [490, 110], [562, 96], [628, 132],
      [660, 210], [652, 300], [614, 392], [550, 480], [475, 552]
    ];
    var pathData = points.map(function (point, index) {
      return (index === 0 ? "M" : "L") + point[0] + " " + point[1];
    }).join(" ") + " Z";

    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("class", "const-line");
    linesGroup.appendChild(path);

    var length = 0;
    try {
      length = path.getTotalLength();
    } catch (error) {
      length = 2400;
    }
    path.style.setProperty("--len", String(length));

    points.forEach(function (point, index) {
      var group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", "const-star");
      group.style.setProperty("--delay", (0.12 + index * 0.045).toFixed(2) + "s");
      group.style.setProperty("--twinkle-delay", ((index % 6) * 0.55).toFixed(2) + "s");

      var halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      halo.setAttribute("cx", point[0]);
      halo.setAttribute("cy", point[1]);
      halo.setAttribute("r", index % 4 === 0 ? "23" : "16");
      halo.setAttribute("class", "star-halo");
      group.appendChild(halo);

      var core = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      core.setAttribute("cx", point[0]);
      core.setAttribute("cy", point[1]);
      core.setAttribute("r", index % 4 === 0 ? "3.4" : "2.2");
      core.setAttribute("class", "star-core");
      group.appendChild(core);

      starsGroup.appendChild(group);
    });

    var english = ["YOU", "ME", "HOME", "ALWAYS"];
    var labels = (CONFIG.constellation && CONFIG.constellation.labels) || [];
    labels.forEach(function (label, index) {
      var point = points[Number(label.point)];
      if (!point || !labelsGroup) return;
      var offsetX = 0;
      var offsetY = -26;
      if (Number(label.point) === 4) { offsetX = -34; offsetY = -2; }
      if (Number(label.point) === 10) { offsetX = 0; offsetY = -30; }
      if (Number(label.point) === 16) { offsetX = 36; offsetY = -2; }
      if (Number(label.point) === 19) { offsetX = 44; offsetY = 30; }

      var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", point[0] + offsetX);
      text.setAttribute("y", point[1] + offsetY);
      text.setAttribute("class", "const-label");
      text.textContent = label.text;
      labelsGroup.appendChild(text);

      var sub = document.createElementNS("http://www.w3.org/2000/svg", "text");
      sub.setAttribute("x", point[0] + offsetX);
      sub.setAttribute("y", point[1] + offsetY + 14);
      sub.setAttribute("class", "const-label-en");
      sub.textContent = english[index] || "";
      labelsGroup.appendChild(sub);
    });

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              art.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.25 }
      );
      observer.observe(art);
    } else {
      art.classList.add("is-visible");
    }
  }

  /* ------------------------------------------------------------------
     Reasons tilt
     ------------------------------------------------------------------ */

  function initReasonTilt() {
    if (!finePointer || reduceMotion) return;
    $$(".reason-card").forEach(function (card) {
      card.addEventListener("pointermove", function (event) {
        if (event.pointerType === "touch") return;
        var rect = card.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width;
        var y = (event.clientY - rect.top) / rect.height;
        card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
        card.style.setProperty("--ry", ((x - 0.5) * 8).toFixed(2) + "deg");
        card.style.setProperty("--rx", ((0.5 - y) * 7).toFixed(2) + "deg");
      });

      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ------------------------------------------------------------------
     Button hearts & finale
     ------------------------------------------------------------------ */

  function initHeartButton() {
    var button = $("#heartCta");
    if (!button) return;
    var notes = (CONFIG.finale && CONFIG.finale.notes) || [
      "谢谢你，愿意成为我的例外和偏爱。"
    ];
    var noteIndex = 0;

    button.addEventListener("click", function (event) {
      if (window.LoveFX) {
        var rect = button.getBoundingClientRect();
        window.LoveFX.burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 70, { power: 1.35, scale: 1.2 });
        window.LoveFX.burstAt(event.clientX, event.clientY, 22, { power: 0.8 });
      }
      music.chime();
      showToast(notes[noteIndex % notes.length], 3800);
      noteIndex += 1;
    });
  }

  /* ------------------------------------------------------------------
     Image fallback
     ------------------------------------------------------------------ */

  function initImageFallback() {
    document.addEventListener(
      "error",
      function (event) {
        var image = event.target;
        if (!image || image.tagName !== "IMG" || image.dataset.fallbackApplied) return;
        image.dataset.fallbackApplied = "true";
        image.src = "assets/memory-01.svg";
      },
      true
    );
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */

  function boot() {
    hydrateStaticContent();
    splitHeroTitle();
    renderTimeline();
    renderReasons();
    renderGallery();
    renderLetter();
    initImageFallback();
    initStarfield();
    initFX();
    initCursor();
    initHeroTilt();
    initScrollUI();
    initSound();
    initLightbox();
    initLetter();
    initWishes();
    initConstellation();
    initReasonTilt();
    initHeartButton();
    initReveal();

    if (previewMode) {
      state.loaded = true;
      document.documentElement.classList.remove("is-loading");
      document.documentElement.classList.add("is-loaded");
      var typedPreview = $("#typedText");
      if (typedPreview && CONFIG.hero && CONFIG.hero.typed && CONFIG.hero.typed[0]) {
        typedPreview.textContent = CONFIG.hero.typed[0];
      }
    }

    var days = getTogetherDays();
    $$("[data-days]").forEach(function (element) {
      element.textContent = String(days);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("load", function () {
    window.setTimeout(finishPreloader, Math.max(0, 850 - performance.now()));
  });
  window.setTimeout(finishPreloader, 3600);

  window.setInterval(function () {
    var days = getTogetherDays();
    $$("[data-days]").forEach(function (element) {
      element.textContent = String(days);
    });
  }, 60000);
})();
