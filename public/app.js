(() => {
  'use strict';

  // angle = where the animal sits on the wheel, clockwise from the window (see --a in index.html)
  const FORTUNES = [
    {
      id: 'krill', num: '01', name: 'the krill.', angle: 180,
      title: 'This is your year to shine. It’s “one in a krillion.”',
      body: 'Big things are coming your way, even if they start small. An opportunity you almost overlook could turn into your biggest accomplishment yet. Keep showing up, trust your abilities, and remember: even the smallest creatures can make the biggest waves.',
      tags: ['Growth', 'Ambition'],
      textWidth: 730, // line length of the body copy on the poster
      img: { src: 'assets/krill.png', w: 383.672, h: 268.466, dx: -10, dy: 14.6, r: 30 },
    },
    {
      id: 'squid', num: '02', name: 'the squid.', angle: 270,
      title: 'Get ready to ink-ounter someone special!',
      body: 'Love is swimming in your direction! Whether it’s a new crush, a rekindled spark, or a friendship that turns into something more, your heart is in for a little adventure. Let your guard down and don’t be afraid to show your true colors. Looks like someone might just be hooked on you!',
      tags: ['Connection', 'Love'],
      textWidth: 810, // line length of the body copy on the poster
      img: { src: 'assets/squid.png', w: 285.669, h: 157.118, dx: -12.7, dy: 12.2, r: 24.55 },
    },
    {
      id: 'seastar', num: '03', name: 'the seastar.', angle: 90,
      title: 'The stars are aligned, & you’re the catch of the sea!',
      body: 'It’s time to stop waiting for permission to shine. This year is all about recognizing your worth, embracing what makes you different, and putting yourself first. You don’t need to be the brightest in the ocean to be extraordinary. Remember, you’re already a star!',
      tags: ['Self-Love', 'Confidence'],
      textWidth: 730, // line length of the body copy on the poster
      img: { src: 'assets/seastar.png', w: 208.251, h: 187.568, dx: 0.2, dy: 0, r: -2.09 },
    },
    {
      id: 'fish', num: '04', name: 'the fish.', angle: 0,
      title: 'There’s a whole ocean to explore!',
      body: 'Say yes to the unexpected, take the scenic route, and don’t be afraid to swim against the current. A change of scenery could lead to an unforgettable experience or a surprising new friendship. Your next big chapter is waiting just beyond the reef!',
      tags: ['Adventure', 'Friendship'],
      textWidth: 705, // line length of the body copy on the poster
      img: { src: 'assets/fish.png', w: 262, h: 145, dx: -0.3, dy: 14.6, r: 0 },
    },
  ];
  const byId = (id) => FORTUNES.find((f) => f.id === id);

  const STORE_KEY = 'fortune-2027';
  const SPIN_MS = 6000;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);
  const startBtn = $('start');
  const stage = $('stage');
  const wheel = $('wheel');
  const status = $('status');
  const result = $('result');
  const resultRow = $('result-row');
  const resultKicker = $('result-kicker');
  const resultNote = $('result-note');
  const viewAllBtn = $('view-all');
  const saveBtn = $('save-photo');
  const shareBtn = $('share');
  const all = $('all');
  const allRows = $('all-rows');

  let saved = null; // { fortune, at } once this visitor has a fortune
  let limitBy = 'ip';
  let busy = false;
  let rotation = 0;

  /* ---------- rendering ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function fortuneTile(f) {
    const tile = el('figure', 'tile');
    const sq = el('div', 'tile-sq');
    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      const cross = el('img', 'tile-cross ' + corner);
      cross.src = `assets/cross-${corner}.svg`;
      cross.alt = '';
      sq.append(cross);
    }
    const animal = el('img', 'tile-animal');
    animal.src = f.img.src;
    animal.alt = f.name.replace('.', '');
    for (const k of ['w', 'h', 'dx', 'dy', 'r']) animal.style.setProperty('--' + k, f.img[k]);
    sq.append(animal);
    const caption = el('figcaption');
    caption.append(el('span', 'num', f.num), el('span', '', f.name));
    tile.append(sq, caption);
    return tile;
  }

  function fortuneRow(f, flip) {
    const row = el('article', 'fortune' + (flip ? ' flip' : ''));

    const tile = fortuneTile(f);

    const text = el('div', 'fortune-text');
    const tags = el('ul', 'tags');
    for (const t of f.tags) tags.append(el('li', '', t));
    const body = el('p', '', f.body);
    body.style.setProperty('--tw', f.textWidth);
    text.append(el('h3', '', f.title), body, tags);

    row.append(tile, text);
    return row;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}.${d.getFullYear()}`;
  }

  function showResult(returning) {
    const f = byId(saved.fortune);
    resultRow.replaceChildren(fortuneRow(f, false));
    const date = formatDate(saved.at);
    if (returning) {
      resultKicker.textContent = `welcome back. you already spun the wheel${date ? ' on ' + date : ''}, and this is your 2027 fortune.`;
      resultNote.textContent = 'the wheel only spins once. come back in 2028 for a new fortune.';
    } else {
      resultKicker.textContent = `your 2027 fortune is ${f.name}`;
      resultNote.textContent = 'one fortune per person. come back in 2028 for your next one.';
    }
    result.hidden = false;
  }

  /* ---------- scrolling ---------- */

  function scrollToY(target, ms = 1000) {
    target = Math.max(0, Math.min(target, document.documentElement.scrollHeight - innerHeight));
    if (reducedMotion || ms <= 0) {
      scrollTo(0, target);
      return Promise.resolve();
    }
    const from = scrollY;
    const start = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    return new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        scrollTo(0, from + (target - from) * ease(t));
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  // Centre the wheel card (plus the bit of wheel that hangs below it) in the window.
  function stageY() {
    const machine = stage.querySelector('.machine').getBoundingClientRect();
    const visible = machine.height * 1.09;
    return machine.top + scrollY - Math.max(0, (innerHeight - visible) / 2);
  }

  const sectionY = (node) => node.getBoundingClientRect().top + scrollY;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- wheel ---------- */

  function setWheel(deg, animate) {
    wheel.classList.toggle('spinning', animate);
    rotation = deg;
    wheel.style.setProperty('--rot', deg + 'deg');
  }

  function spinTo(f) {
    // several full turns, then stop with this fortune's animal in the window
    const turns = 5 + Math.floor(Math.random() * 3);
    const target = Math.ceil(rotation / 360) * 360 + turns * 360 - f.angle;
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        wheel.removeEventListener('transitionend', onEnd);
        resolve();
      };
      const onEnd = (e) => e.target === wheel && finish();
      wheel.addEventListener('transitionend', onEnd);
      setTimeout(finish, (reducedMotion ? 600 : SPIN_MS) + 300);
      wheel.getBoundingClientRect(); // flush so the transition starts from the current angle
      setWheel(target, true);
    });
  }

  /* ---------- once-per-visitor ---------- */

  const readLocal = () => {
    try {
      const v = JSON.parse(localStorage.getItem(STORE_KEY));
      return v && byId(v.fortune) ? v : null;
    } catch {
      return null;
    }
  };
  const writeLocal = (v) => {
    try {
      if (v) localStorage.setItem(STORE_KEY, JSON.stringify(v));
      else localStorage.removeItem(STORE_KEY);
    } catch { /* private mode */ }
  };

  async function api(path, method) {
    const res = await fetch(path, { method, headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!res.ok && res.status !== 409) throw new Error('api ' + res.status);
    return data;
  }

  // Has this visitor already spun? The server (by IP) decides; the browser's own
  // memory is only used when the server limits per browser or can't be reached.
  async function loadSaved() {
    try {
      const data = await api('/api/fortune', 'GET');
      limitBy = data.mode;
      if (data.mode === 'ip') {
        const v = data.fortune && byId(data.fortune) ? { fortune: data.fortune, at: data.at } : null;
        writeLocal(v);
        return v;
      }
    } catch {
      limitBy = 'browser';
    }
    return readLocal();
  }

  async function requestSpin() {
    try {
      const data = await api('/api/spin', 'POST');
      if (byId(data.fortune)) return { fortune: data.fortune, at: data.at, already: !!data.already };
    } catch { /* no server: fall through to a local spin */ }
    const pick = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    return { fortune: pick.id, at: new Date().toISOString(), already: false };
  }

  /* ---------- save photo / share ---------- */

  const STORY_W = 1080;
  const STORY_H = 1920; // instagram story, 9:16
  const INK = '#877956';
  const BLUE = '#90cbff';
  const storyCache = {};

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  function wrapLines(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function setType(ctx, weight, size) {
    ctx.font = `${weight} ${size}px Trap, "Helvetica Neue", Arial, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${-0.05 * size}px`;
  }

  // Draws the fortune as a 1080x1920 poster in the same style as the site.
  async function renderStory(f) {
    await Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(`${w} 40px Trap`)));
    const [star, animal, flower, burst] = await Promise.all(
      ['assets/hero-star-1.svg', f.img.src, 'assets/flower.png', 'assets/burst.svg'].map(loadImage)
    );

    const canvas = document.createElement('canvas');
    canvas.width = STORY_W;
    canvas.height = STORY_H;
    const ctx = canvas.getContext('2d');
    const k = STORY_W / 1728; // hero frame -> story
    const M = 90; // side margin

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, STORY_W, STORY_H);

    // header band, same lockup as the hero
    const bandH = 587 * k;
    ctx.fillStyle = BLUE;
    ctx.fillRect(0, 0, STORY_W, bandH);
    ctx.fillStyle = INK;
    ctx.textBaseline = 'alphabetic';
    setType(ctx, 500, 406.879 * k);
    ctx.fillText('2027', -30.65 * k, 292 * k);
    setType(ctx, 500, 382.879 * k);
    ctx.fillText('fortune', 459.43 * k, 579 * k);
    for (const x of [1438.65, 1152.45, 867.2]) ctx.drawImage(star, x * k, 4.64 * k, 289.553 * k, 289.553 * k);

    // flower, top right under the band
    ctx.save();
    ctx.beginPath();
    ctx.rect(STORY_W - 300, bandH, 300, 280);
    ctx.clip();
    ctx.globalAlpha = 0.79;
    ctx.drawImage(flower, STORY_W - 300, bandH - 316, 446, 595);
    ctx.restore();
    ctx.save();
    ctx.translate(STORY_W - 46, bandH + 70);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(burst, -28, -24, 56, 48);
    ctx.drawImage(burst, -82, -24, 56, 48);
    ctx.restore();

    setType(ctx, 500, 34);
    ctx.fillStyle = INK;
    ctx.fillText('my 2027 fortune', M, bandH + 96);

    // tile
    const T = 440;
    const tx = M + 20;
    const ty = bandH + 170;
    const sc = T / 301.012;
    ctx.fillStyle = BLUE;
    ctx.fillRect(tx, ty, T, T);
    ctx.save();
    ctx.translate(tx + T / 2 + f.img.dx * sc, ty + T / 2 + f.img.dy * sc);
    ctx.rotate((f.img.r * Math.PI) / 180);
    ctx.globalCompositeOperation = 'lighten';
    ctx.drawImage(animal, (-f.img.w * sc) / 2, (-f.img.h * sc) / 2, f.img.w * sc, f.img.h * sc);
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.337 * sc;
    const arm = (39.379 * sc) / 2;
    for (const [cx, cy] of [[tx, ty], [tx + T, ty], [tx, ty + T], [tx + T, ty + T]]) {
      ctx.beginPath();
      ctx.moveTo(cx - arm, cy);
      ctx.lineTo(cx + arm, cy);
      ctx.moveTo(cx, cy - arm);
      ctx.lineTo(cx, cy + arm);
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    setType(ctx, 500, 36);
    const capY = ty + T + 62;
    ctx.fillText(f.num, tx + 28, capY);
    const numW = ctx.measureText(f.num).width;
    setType(ctx, 400, 36);
    ctx.fillText(f.name, tx + 28 + numW + 14, capY);

    // copy
    const textW = STORY_W - M * 2;
    let y = capY + 110;
    setType(ctx, 700, 52);
    for (const line of wrapLines(ctx, f.title, textW)) {
      ctx.fillText(line, M, y);
      y += 71;
    }
    setType(ctx, 500, 40);
    for (const line of wrapLines(ctx, f.body, textW)) {
      ctx.fillText(line, M, y);
      y += 55;
    }

    // tags
    y += 4;
    let x = M;
    setType(ctx, 600, 26);
    ctx.lineWidth = 2.5;
    f.tags.forEach((tag, i) => {
      const w = ctx.measureText(tag).width + 28;
      ctx.beginPath();
      ctx.roundRect(x, y, w, 58, i === 0 ? 17 : 29);
      ctx.stroke();
      ctx.fillText(tag, x + 15, y + 38);
      x += w - 2.5;
    });

    // footer: gold stair + credit
    const base = STORY_H;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(0, base - 150);
    ctx.lineTo(300, base - 150);
    ctx.lineTo(300, base - 75);
    ctx.lineTo(400, base - 75);
    ctx.lineTo(400, base);
    ctx.lineTo(0, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = BLUE;
    setType(ctx, 500, 24);
    ctx.fillText('designed by sophie manalo', 30, base - 28);
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    ctx.fillText('spin yours at ' + location.host, STORY_W - M, base - 28);
    ctx.textAlign = 'left';

    return canvas;
  }

  function storyBlob(f) {
    if (!storyCache[f.id]) {
      storyCache[f.id] = renderStory(f).then(
        (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'))
      );
      storyCache[f.id].catch(() => delete storyCache[f.id]);
    }
    return storyCache[f.id];
  }

  const storyName = (f) => `2027-fortune-${f.id}.png`;

  async function flash(button, message, work) {
    const label = button.textContent;
    button.disabled = true;
    try {
      const done = await work();
      button.textContent = done || label;
    } catch (err) {
      button.textContent = err && err.name === 'AbortError' ? label : 'try again';
    }
    button.disabled = false;
    if (button.textContent !== label) setTimeout(() => (button.textContent = label), 2000);
  }

  function savePhoto() {
    const f = byId(saved.fortune);
    return flash(saveBtn, 'saving', async () => {
      const url = URL.createObjectURL(await storyBlob(f));
      const a = document.createElement('a');
      a.href = url;
      a.download = storyName(f);
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return 'saved';
    });
  }

  function shareResult() {
    const f = byId(saved.fortune);
    return flash(shareBtn, 'sharing', async () => {
      const text = `my 2027 fortune is ${f.name} ${f.title}`;
      const data = { title: '2027 fortune', text, url: location.origin + location.pathname };
      if (navigator.share) {
        const file = new File([await storyBlob(f)], storyName(f), { type: 'image/png' });
        const withPhoto = { ...data, files: [file] };
        await navigator.share(navigator.canShare && navigator.canShare(withPhoto) ? withPhoto : data);
        return '';
      }
      await navigator.clipboard.writeText(`${text} ${data.url}`);
      return 'link copied';
    });
  }

  /* ---------- cursor ---------- */

  function initCursor() {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const TRAIL = reducedMotion ? 0 : 16;
    const squares = [];
    for (let i = 0; i <= TRAIL; i++) {
      const sq = el('div', 'cursor-sq' + (i ? ' trail' : ''));
      sq.setAttribute('aria-hidden', 'true');
      document.body.append(sq);
      squares.push({ node: sq, x: 0, y: 0 });
    }
    document.documentElement.classList.add('has-cursor');

    let mx = 0, my = 0, visible = false, hovering = false, running = false;

    const frame = () => {
      let moving = false;
      squares.forEach((sq, i) => {
        const tx = i ? squares[i - 1].x : mx;
        const ty = i ? squares[i - 1].y : my;
        const ease = i ? 0.3 : 1;
        sq.x += (tx - sq.x) * ease;
        sq.y += (ty - sq.y) * ease;
        if (Math.abs(tx - sq.x) + Math.abs(ty - sq.y) > 0.2) moving = true;
        const scale = i ? 0.9 * (1 - (0.8 * i) / (TRAIL + 1)) : hovering ? 1.8 : 1;
        const turn = !i && hovering ? ' rotate(45deg)' : '';
        sq.node.style.transform = `translate3d(${sq.x}px, ${sq.y}px, 0) scale(${scale})${turn}`;
        sq.node.style.opacity = visible ? (i ? 0.85 * (1 - i / (TRAIL + 1)) : 1) : 0;
      });
      running = moving;
      if (moving) requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    };

    addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (!visible) {
        visible = true;
        squares.forEach((sq) => { sq.x = mx; sq.y = my; });
      }
      hovering = !!(e.target.closest && e.target.closest('a, button'));
      kick();
    });
    document.documentElement.addEventListener('mouseleave', () => { visible = false; kick(); });
  }

  /* ---------- "you got ..." reveal ---------- */

  // Full-screen pop-out once the wheel stops. Resolves when the visitor moves on.
  function celebrate(f) {
    return new Promise((resolve) => {
      const overlay = el('div', 'reveal');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', `You got ${f.name}`);

      // a burst of stars and little squares from behind the card
      const COUNT = reducedMotion ? 0 : 26;
      for (let i = 0; i < COUNT; i++) {
        const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 20 + Math.random() * 28; // in vmax: scattered around the card, out to the edges
        const isStar = i % 3 === 0;
        const bit = el(isStar ? 'img' : 'span', isStar ? 'reveal-star' : 'reveal-bit');
        if (isStar) {
          bit.src = i % 2 ? 'assets/burst.svg' : 'assets/hero-star-1.svg';
          bit.alt = '';
          bit.style.setProperty('--size', 50 + Math.random() * 70);
        } else {
          bit.style.setProperty('--c', i % 2 ? '#877956' : '#fff');
        }
        bit.style.setProperty('--dx', `${Math.cos(angle) * dist}vmax`);
        bit.style.setProperty('--dy', `${Math.sin(angle) * dist}vmax`);
        bit.style.setProperty('--spin', `${(Math.random() - 0.5) * 540}deg`);
        bit.style.animationDelay = `${0.55 + Math.random() * 0.25}s`;
        overlay.append(bit);
      }

      const card = el('div', 'reveal-card');
      card.append(fortuneTile(f));
      const button = el('button', 'btn btn-sm reveal-btn', 'read your fortune');
      button.type = 'button';
      overlay.append(
        el('p', 'reveal-kicker', 'you got'),
        card,
        el('p', 'reveal-name', f.name.replace('.', '!')),
        button
      );
      document.body.append(overlay);
      button.focus({ preventScroll: true });

      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        removeEventListener('keydown', onKey);
        overlay.classList.add('leaving');
        setTimeout(() => overlay.remove(), reducedMotion ? 0 : 450);
        resolve();
      };
      const onKey = (e) => e.key === 'Escape' && close();
      addEventListener('keydown', onKey);
      button.addEventListener('click', close);
    });
  }

  /* ---------- flow ---------- */

  async function reveal(returning) {
    showResult(returning);
    document.body.classList.remove('locked');
    await wait(returning ? 900 : 100);
    await scrollToY(sectionY(result) - innerHeight * 0.12, returning ? 1100 : 0);
    busy = false;
    startBtn.disabled = false;
  }

  async function start() {
    if (busy) return;
    busy = true;
    startBtn.disabled = true;

    if (saved) {
      // already has a fortune: no second spin, just take them to it
      await scrollToY(stageY());
      return reveal(true);
    }

    status.textContent = 'The wheel is spinning.';
    const [spin] = await Promise.all([requestSpin(), scrollToY(stageY())]);
    saved = { fortune: spin.fortune, at: spin.at };
    writeLocal(saved);
    const f = byId(spin.fortune);

    if (spin.already) {
      setWheel(-f.angle, false);
    } else {
      await wait(250);
      await spinTo(f);
    }
    status.textContent = `You got ${f.name}`;
    startBtn.textContent = 'see your fortune';
    if (!spin.already) {
      await wait(600);
      await celebrate(f);
    }
    await reveal(spin.already);
  }

  async function init() {
    FORTUNES.forEach((f, i) => allRows.append(fortuneRow(f, i % 2 === 1)));

    // before the first spin the wheel rests with the krill on top, as in the design
    setWheel(-byId('krill').angle, false);

    startBtn.addEventListener('click', start);
    viewAllBtn.addEventListener('click', async () => {
      all.hidden = false;
      await scrollToY(sectionY(all), 1000);
    });

    saveBtn.addEventListener('click', savePhoto);
    shareBtn.addEventListener('click', shareResult);
    initCursor();

    // keep the locked views lined up if the window is resized
    addEventListener('resize', () => {
      if (!document.body.classList.contains('locked') || !matchMedia('(max-aspect-ratio: 2/1)').matches) return;
      scrollTo(0, busy ? stageY() : 0);
    });

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    scrollTo(0, 0);

    saved = await loadSaved();
    if (saved) {
      setWheel(-byId(saved.fortune).angle, false);
      startBtn.textContent = 'see your fortune';
      showResult(true);
    }
  }

  window.fortuneStory = (id) => renderStory(byId(id)); // handy for previewing the story image
  init();
})();
