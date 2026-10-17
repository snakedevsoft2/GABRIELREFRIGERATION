/**
 * Gabriel Refrigeration — interacciones del sitio.
 * JavaScript sin dependencias. Para cambiar el número de WhatsApp edita CONFIG.whatsapp.
 */
(() => {
  'use strict';

  const CONFIG = {
    // Número de WhatsApp con indicativo de país, solo dígitos (sin "+", espacios ni guiones).
    whatsapp: '19392029114',
    defaultMessage: 'Hola Gabriel Refrigeration, quiero información sobre el mantenimiento y la limpieza de mi aire acondicionado.',
    // Milisegundos antes de mostrar el mensaje junto al botón de WhatsApp.
    teaserDelay: 8000,
    // true = no reproducir los videos automáticamente si el sistema pide "reducir movimiento".
    // Por defecto se reproducen siempre y el botón de pausa queda visible.
    pauseVideoOnReducedMotion: false,
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const supportsObserver = 'IntersectionObserver' in window;

  const whatsappUrl = (message) =>
    `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(message || CONFIG.defaultMessage)}`;

  const session = {
    get(key) {
      try { return window.sessionStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { window.sessionStorage.setItem(key, value); } catch { /* almacenamiento no disponible */ }
    },
  };

  /* Intro: la tarjeta de presentación y el aire acondicionado. La animación es CSS y
     termina sola; aquí se permite saltarla (clic, toque, tecla o rueda) y se retira al terminar. */
  function initIntro() {
    // Ojo: <html> lleva data-intro (configuración); la capa de la intro usa data-intro-screen.
    const intro = $('[data-intro-screen]');
    if (!intro) return;
    if (getComputedStyle(intro).display === 'none') {
      intro.remove();
      return;
    }

    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      events.forEach((type) => window.removeEventListener(type, skip, true));
      intro.remove();
    };

    function skip() {
      events.forEach((type) => window.removeEventListener(type, skip, true));
      // Si el título del inicio todavía no se animó, se anima de inmediato.
      if (performance.now() < 2300) {
        const hero = $('.hero');
        if (hero) hero.classList.add('is-replay');
      }
      intro.classList.add('is-leaving');
      setTimeout(finish, 400);
    }

    intro.addEventListener('animationend', (event) => {
      if (event.target === intro && event.animationName === 'intro-done') finish();
    });
    events.forEach((type) => window.addEventListener(type, skip, { capture: true, passive: true }));
  }

  /* Enlaces de WhatsApp con mensaje prellenado (data-wa="mensaje") */
  function initWhatsappLinks() {
    $$('[data-wa]').forEach((link) => {
      link.href = whatsappUrl(link.dataset.wa);
    });
  }

  /* Menú lateral: en móvil y tablet se abre como panel desde la derecha */
  function initMenu() {
    const toggle = $('[data-menu-toggle]');
    const nav = $('[data-nav]');
    const backdrop = $('[data-nav-backdrop]');
    if (!toggle || !nav) return;

    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
    const setOpen = (open, { returnFocus = true } = {}) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      nav.classList.toggle('is-open', open);
      if (backdrop) backdrop.classList.toggle('is-open', open);
      document.documentElement.classList.toggle('nav-open', open);

      if (open) {
        const first = $('.dock__link', nav);
        if (first) first.focus({ preventScroll: true });
      } else if (returnFocus) {
        toggle.focus({ preventScroll: true });
      }
    };

    toggle.addEventListener('click', () => setOpen(!isOpen()));
    if (backdrop) backdrop.addEventListener('click', () => setOpen(false));
    nav.addEventListener('click', (event) => {
      if (isOpen() && event.target.closest('a')) setOpen(false, { returnFocus: false });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) setOpen(false);
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
      if (event.matches && isOpen()) setOpen(false, { returnFocus: false });
    });
  }

  /* Resalta en la barra lateral la sección visible */
  function initScrollSpy() {
    if (!supportsObserver) return;
    const links = $$('[data-nav] .dock__list:not(.dock__list--social) .dock__link');
    const linkFor = (id) => links.find((link) => link.getAttribute('href') === `#${id}`);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const active = linkFor(entry.target.id);
        links.forEach((link) => link.classList.toggle('is-active', link === active));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    $$('main section[id]').forEach((section) => observer.observe(section));
  }

  /* Videos POV: se reproducen al estar visibles, con botón de pausa accesible */
  function initVideos() {
    $$('[data-video]').forEach((wrapper) => {
      const video = $('video', wrapper);
      const toggle = $('[data-video-toggle]', wrapper);
      const timecode = $('[data-timecode]', wrapper);
      if (!video) return;

      video.muted = true;
      // No se reproduce en modo de ahorro de datos (queda el póster y el botón de reproducir).
      let wantsPlay = !saveData && !(CONFIG.pauseVideoOnReducedMotion && prefersReducedMotion);
      let inView = !supportsObserver;

      const render = () => {
        wrapper.classList.toggle('is-paused', !wantsPlay);
        if (toggle) toggle.setAttribute('aria-label', wantsPlay ? 'Pausar video' : 'Reproducir video');
      };

      const play = () => {
        const attempt = video.play();
        if (attempt && typeof attempt.catch === 'function') {
          attempt.catch(() => {
            // El navegador bloqueó la reproducción automática: queda el póster.
            wantsPlay = false;
            render();
          });
        }
      };

      const sync = () => {
        if (wantsPlay && inView) play();
        else if (!video.paused) video.pause();
      };

      video.addEventListener('playing', () => video.classList.add('is-ready'));

      if (timecode) {
        const pad = (n) => String(Math.floor(n)).padStart(2, '0');
        video.addEventListener('timeupdate', () => {
          const t = video.currentTime;
          timecode.textContent = `00:${pad(t / 60)}:${pad(t % 60)}`;
        });
      }

      if (toggle) {
        toggle.addEventListener('click', () => {
          wantsPlay = !wantsPlay;
          inView = true;
          render();
          sync();
        });
      }

      if (supportsObserver) {
        new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          sync();
        }, { threshold: 0.25 }).observe(wrapper);
      }

      render();
      sync();
    });
  }

  /* Aparición suave de bloques al hacer scroll */
  function initReveal() {
    const items = $$('[data-reveal]');
    if (!items.length) return;

    // Al terminar la animación se retira el atributo para no interferir con los efectos hover.
    const finish = (el) => {
      el.removeAttribute('data-reveal');
      el.classList.remove('is-visible');
    };

    if (!supportsObserver) {
      items.forEach(finish);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        observer.unobserve(el);
        el.classList.add('is-visible');

        const onEnd = (event) => {
          if (event.target !== el || event.propertyName !== 'opacity') return;
          el.removeEventListener('transitionend', onEnd);
          finish(el);
        };
        el.addEventListener('transitionend', onEnd);
        // Respaldo por si el navegador no emite transitionend (p. ej. pestaña en segundo plano).
        setTimeout(() => finish(el), 2000);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach((el) => observer.observe(el));
  }

  /* Footer: entrada escalonada de columnas */
  function initFooter() {
    const footer = $('[data-footer]');
    if (!footer) return;

    $$('[data-footer-item]', footer).forEach((el, index) => el.style.setProperty('--i', index));

    if (!supportsObserver) {
      footer.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      footer.classList.add('is-visible');
      observer.disconnect();
    }, { threshold: 0.15 });
    observer.observe(footer);
  }

  /* Ventana flotante de WhatsApp */
  function initWhatsappWidget() {
    const widget = $('[data-wa-widget]');
    if (!widget) return;

    const fab = $('[data-wa-fab]', widget);
    const panel = $('[data-wa-panel]', widget);
    const closeButton = $('[data-wa-close]', widget);
    const teaser = $('[data-wa-teaser]', widget);
    const badge = $('[data-wa-badge]', widget);
    let teaserTimer = 0;

    const isOpen = () => widget.classList.contains('is-open');

    const fadeTeaser = () => {
      if (!teaser || teaser.hidden) return;
      teaser.classList.remove('is-visible');
      setTimeout(() => { teaser.hidden = true; }, 350);
    };

    const hideTeaser = () => {
      clearTimeout(teaserTimer);
      session.set('wa-teaser-visto', '1');
      if (badge) badge.hidden = true;
      fadeTeaser();
    };

    const setOpen = (open, { returnFocus = true } = {}) => {
      widget.classList.toggle('is-open', open);
      fab.setAttribute('aria-expanded', String(open));
      fab.setAttribute('aria-label', open ? 'Cerrar chat de WhatsApp' : 'Abrir chat de WhatsApp');
      panel.inert = !open;

      if (open) {
        hideTeaser();
        const firstOption = $('.wa-option', panel);
        if (firstOption) firstOption.focus({ preventScroll: true });
      } else if (returnFocus) {
        fab.focus({ preventScroll: true });
      }
    };

    panel.inert = true;

    fab.addEventListener('click', () => setOpen(!isOpen()));
    if (closeButton) closeButton.addEventListener('click', () => setOpen(false));

    // Al elegir una opción se abre WhatsApp en otra pestaña y se cierra el panel.
    $$('a', panel).forEach((link) => {
      link.addEventListener('click', () => setOpen(false, { returnFocus: false }));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) setOpen(false);
    });

    document.addEventListener('pointerdown', (event) => {
      if (isOpen() && !widget.contains(event.target)) setOpen(false, { returnFocus: false });
    });

    if (teaser) {
      $('[data-wa-teaser-open]', teaser).addEventListener('click', () => setOpen(true));
      $('[data-wa-teaser-close]', teaser).addEventListener('click', hideTeaser);

      if (!session.get('wa-teaser-visto')) {
        teaserTimer = setTimeout(() => {
          if (isOpen()) return;
          session.set('wa-teaser-visto', '1');
          teaser.hidden = false;
          void teaser.offsetWidth; // fuerza el reflow para animar la entrada
          teaser.classList.add('is-visible');
          if (badge) badge.hidden = false;
          // El mensaje se retira solo; el indicador "1" se mantiene en el botón.
          teaserTimer = setTimeout(fadeTeaser, 12000);
        }, CONFIG.teaserDelay);
      }
    }
  }

  /* Eleva el botón flotante mientras la barra inferior del footer está en pantalla */
  function initFloatingLift() {
    const widget = $('[data-wa-widget]');
    const bar = $('[data-footer-bottom]');
    if (!widget || !bar || !supportsObserver) return;

    const steps = Array.from({ length: 21 }, (_, i) => i / 20);
    new IntersectionObserver(([entry]) => {
      const lift = entry.isIntersecting ? Math.round(entry.intersectionRect.height) : 0;
      widget.style.setProperty('--wa-lift', `${lift}px`);
    }, { threshold: steps }).observe(bar);
  }

  /* Contacto: el aire acondicionado empieza con falla y se "repara" a medida que
     se llena el formulario; con los datos obligatorios completos sopla aire frío
     y el formulario se congela. */
  function initContactLab() {
    const lab = $('[data-ac-lab]');
    const form = $('[data-wa-form]');
    if (!lab || !form) return;

    const title = $('[data-ac-title]', lab);
    const text = $('[data-ac-text]', lab);
    const display = $('[data-ac-display]', lab);
    const meter = $('[data-ac-meter]', lab);
    const { nombre, servicio, equipo, mensaje } = form.elements;

    const STATES = {
      broken: ['Tu aire está fallando', 'Completa el formulario y lo dejamos como nuevo.', 'E1'],
      repairing: ['Reparando…', 'Completa tu nombre y el servicio para que vuelva a enfriar.', '- -'],
      working: ['¡Aire funcionando!', 'Tu solicitud está lista. Envíala por WhatsApp.', '18°'],
    };

    const isFilled = (field) => Boolean(field && String(field.value).trim());
    let current = '';

    const update = () => {
      const filled = [nombre, servicio, equipo, mensaje].filter(isFilled).length;
      const ready = isFilled(nombre) && isFilled(servicio);
      const state = ready ? 'working' : filled > 0 ? 'repairing' : 'broken';
      const progress = ready ? 1 : (filled / 4) * 0.75;

      form.style.setProperty('--frost', (ready ? 1 : progress * 0.6).toFixed(2));
      form.classList.toggle('is-frozen', ready);
      if (meter) meter.style.setProperty('--progress', progress.toFixed(2));

      if (state === current) return;
      current = state;
      lab.dataset.acState = state;
      const [heading, detail, screen] = STATES[state];
      if (title) title.textContent = heading;
      if (text) text.textContent = detail;
      if (display) display.textContent = screen;
    };

    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();
  }

  /* Formulario: arma el mensaje y lo abre en WhatsApp (sin servidor) */
  function initForm() {
    const form = $('[data-wa-form]');
    if (!form) return;
    const status = $('[data-form-status]', form);

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const data = new FormData(form);
      const field = (name) => String(data.get(name) || '').trim();

      const lines = [
        'Hola Gabriel Refrigeration, quiero agendar un servicio.',
        '',
        `*Nombre:* ${field('nombre')}`,
        `*Servicio:* ${field('servicio')}`,
        `*Tipo de equipo:* ${field('equipo') || 'No estoy seguro'}`,
      ];
      if (field('mensaje')) lines.push(`*Detalles:* ${field('mensaje')}`);

      const url = whatsappUrl(lines.join('\n'));
      const win = window.open(url, '_blank');
      if (win) win.opener = null;
      else window.location.href = url;

      if (status) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Ábrelo aquí';
        status.replaceChildren('Abrimos WhatsApp con tu solicitud. ¿No se abrió? ', link, '.');
        status.hidden = false;
      }
    });
  }

  function initYear() {
    const year = String(new Date().getFullYear());
    $$('[data-year]').forEach((el) => { el.textContent = year; });
  }

  initIntro();
  initWhatsappLinks();
  initMenu();
  initScrollSpy();
  initVideos();
  initReveal();
  initFooter();
  initWhatsappWidget();
  initFloatingLift();
  initContactLab();
  initForm();
  initYear();
})();
