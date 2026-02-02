/* ============================================
   THE TANGS — 11 Years of Us
   Main JavaScript
   ============================================
   MODIFIED: init() is now exposed as window.initApp()
   and called by auth.js after successful login.
   Added: loadSiteConfig() fetches photo paths from
   Supabase site_config table (with hardcoded fallbacks).
   ============================================ */

(function () {
  'use strict';

  // ── Gallery photo list ──────────────────────
  // Exclude timeline photos so they only appear in the gallery
  const TIMELINE_PHOTOS = [
    'IMG_0133.JPG', 'IMG_2063.JPG', 'IMG_3265.JPG',
    'IMG_4570.JPG', 'IMG_5503.JPG', 'IMG_6489.JPG', 'IMG_7814.jpg'
  ];

  const ALL_PHOTOS = [
    '1348AF94-839F-4A01-AA33-FF69AA7E411B-4344-0000035EAE61E1F0_tmp.JPG',
    '250A8DE1-9FF7-414D-BBE8-367A9D5B6EAC-942-000000C4493DF60A_tmp.JPG',
    'IMG_0379.JPG','IMG_0386.JPG','IMG_0750.jpg','IMG_0757.jpg',
    'IMG_1195.JPG','IMG_1205.JPG','IMG_1254.jpg','IMG_1299.JPG',
    'IMG_1374.JPG','IMG_1553.JPG','IMG_1683.JPG','IMG_1717.JPG',
    'IMG_1768.JPG','IMG_1776.JPG','IMG_1779.JPG','IMG_1819.JPG',
    'IMG_1834_2.JPG','IMG_1834.JPG','IMG_1836.JPG','IMG_1837.JPG',
    'IMG_1911.JPG','IMG_1912.JPG','IMG_1935.JPG','IMG_2014.jpg',
    'IMG_2064.JPG','IMG_2093.JPG','IMG_2187.JPG',
    'IMG_2240.JPG','IMG_2241.JPG','IMG_2248.JPG','IMG_2289.JPG',
    'IMG_2292.JPG','IMG_2333_2.JPG','IMG_2361.JPG','IMG_2425.JPG',
    'IMG_2600.JPG','IMG_2639.JPG','IMG_2641.JPG','IMG_2813.JPG',
    'IMG_2821_2.JPG','IMG_2957.JPG','IMG_2958.JPG','IMG_3009.JPG',
    'IMG_3121.JPG','IMG_3151.JPG','IMG_3168.JPG','IMG_3185_2.JPG',
    'IMG_3206_2.JPG','IMG_3236.JPG','IMG_3266.jpg','IMG_3273.jpg',
    'IMG_3276.JPG','IMG_3287.JPG','IMG_3313.jpg','IMG_3350.JPG',
    'IMG_3357.JPG','IMG_3377.jpg','IMG_3394_2.JPG','IMG_3436.JPG',
    'IMG_3448.JPG','IMG_3468.JPG','IMG_3470.JPG','IMG_3478.JPG',
    'IMG_3611.JPG','IMG_3665.JPG','IMG_3701_2.JPG','IMG_3726.JPG',
    'IMG_3756_2.JPG','IMG_3788.JPG','IMG_3818.JPG','IMG_3837.jpg',
    'IMG_3854.jpg','IMG_3855.jpg','IMG_3867.JPG','IMG_3868.jpg',
    'IMG_3921.JPG','IMG_3929.jpg','IMG_3949.JPG','IMG_4027.JPG',
    'IMG_4128.JPG','IMG_4129.JPG','IMG_4146.JPG','IMG_4154.jpg',
    'IMG_4198.JPG','IMG_4357.JPG','IMG_4781.JPG',
    'IMG_4818.jpg','IMG_4910_2.JPG','IMG_5018.JPG','IMG_5067.JPG',
    'IMG_5080.jpg','IMG_5202_2.JPG','IMG_5225.JPG','IMG_5410.jpg',
    'IMG_5414.jpg','IMG_5427.jpg','IMG_5453.jpg','IMG_5467.JPG',
    'IMG_5476.jpg','IMG_5497.jpg','IMG_5536.jpg',
    'IMG_5596.jpg','IMG_5601.JPG','IMG_5628.JPG','IMG_5629.jpg',
    'IMG_5668.JPG','IMG_5684.JPG','IMG_5703.jpg','IMG_5718.jpg',
    'IMG_5723.jpg','IMG_5738.jpg','IMG_5739.JPG','IMG_5746.jpg',
    'IMG_5772.JPG','IMG_5777.jpg','IMG_5832.jpg','IMG_5845.jpg',
    'IMG_5884.JPG','IMG_5886.jpg','IMG_5889.JPG','IMG_6026.jpg',
    'IMG_6041.JPG','IMG_6048.jpg','IMG_6143.jpg','IMG_6195.JPG',
    'IMG_6207.jpg','IMG_6219.jpg','IMG_6239.JPG','IMG_6240.JPG',
    'IMG_6302.jpg','IMG_6307.jpg','IMG_6397.JPG','IMG_6412.JPG',
    'IMG_6432.jpg','IMG_6433.jpg','IMG_6436.jpg','IMG_6437.jpg',
    'IMG_6490.JPG','IMG_6541.jpg','IMG_6568.jpg',
    'IMG_6664.JPG','IMG_6665.JPG','IMG_6724.jpg','IMG_6758.jpg',
    'IMG_6808.JPG','IMG_6818.JPG','IMG_6825.jpg','IMG_6866.JPG',
    'IMG_6889.jpg','IMG_6900_2.JPG','IMG_6999.jpg','IMG_7009.JPG',
    'IMG_7083.jpg','IMG_7144.jpg','IMG_7155.jpg','IMG_7162_2.jpg',
    'IMG_7177_2.jpg','IMG_7268.jpg','IMG_7291_2.jpg','IMG_7387.JPG',
    'IMG_7391.jpg','IMG_7435.jpg','IMG_7439.jpg','IMG_7458.jpg',
    'IMG_7470.jpg','IMG_7478.jpg','IMG_7481.jpg','IMG_7561.jpg',
    'IMG_7687.jpg','IMG_7694.jpg','IMG_7708.jpg','IMG_7735.jpg',
    'IMG_7746.jpg','IMG_7764.jpg','IMG_7788.jpg',
    'IMG_7821.jpg','IMG_7824.jpg','IMG_7868.jpg','IMG_7891.jpg',
    'IMG_7940.jpg','IMG_7943.jpg','IMG_7949.jpg','IMG_8078.jpg',
    'IMG_9357.jpg','IMG_9599.jpg','LRG_DSC09362.JPG'
  ];

  // Shuffle photos for variety
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const PHOTOS = shuffle(ALL_PHOTOS);
  const PHOTOS_PER_PAGE = 12;
  let photosLoaded = 0;
  let appInitialized = false;

  // ── Expose init as window.initApp ─────────
  // Called by auth.js after successful authentication.
  // Prevents running gallery/animations when content is hidden.
  window.initApp = function () {
    if (appInitialized) return;
    appInitialized = true;

    // Load site config from Supabase, then initialize UI
    loadSiteConfig().then(function () {
      init();
    });
  };

  function init() {
    initNav();
    initHeroAnimations();
    initFloatingHearts();
    initScrollReveal();
    initCounterAnimation();
    initGallery();
    initLightbox();
    initSmoothScroll();
  }

  // ── Load site config from Supabase ────────
  // Fetches photo paths for timeline/hero/message from the
  // site_config table. Falls back to hardcoded defaults if
  // Supabase is unavailable or not configured.
  function loadSiteConfig() {
    var sb = window.supabaseClient;
    if (!sb) return Promise.resolve();

    return sb.from('site_config')
      .select('config_key, config_value')
      .then(function (result) {
        if (result.error || !result.data) return;

        var config = {};
        result.data.forEach(function (row) {
          config[row.config_key] = row.config_value;
        });

        // Apply timeline image overrides
        var configImages = document.querySelectorAll('[data-config-key]');
        configImages.forEach(function (img) {
          var key = img.getAttribute('data-config-key');
          if (config[key]) {
            img.src = config[key];
          }
        });

        // Apply hero background override
        if (config.hero_bg_photo) {
          var heroEl = document.querySelector('#app-content .hero');
          if (heroEl) {
            heroEl.style.backgroundImage =
              'linear-gradient(135deg, rgba(44,36,32,0.7) 0%, rgba(200,144,126,0.4) 100%), url(' + config.hero_bg_photo + ')';
          }
        }

        // Apply message background override
        if (config.message_bg_photo) {
          var msgEl = document.querySelector('#app-content .message-section');
          if (msgEl) {
            msgEl.style.backgroundImage =
              'linear-gradient(135deg, rgba(44,36,32,0.85) 0%, rgba(200,144,126,0.5) 100%), url(' + config.message_bg_photo + ')';
          }
        }
      })
      .catch(function () {
        // Silently fall back to hardcoded defaults
      });
  }

  // ── Navigation ──────────────────────────────
  function initNav() {
    const nav = document.getElementById('nav');
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');

    if (!nav || !toggle || !links) return;

    // Scroll state
    let lastScroll = 0;
    window.addEventListener('scroll', function () {
      const current = window.scrollY;

      if (current > 80) {
        nav.classList.add('nav-scrolled');
      } else {
        nav.classList.remove('nav-scrolled');
      }

      // Hide/show on scroll direction
      if (current > lastScroll && current > 300) {
        nav.classList.add('nav-hidden');
      } else {
        nav.classList.remove('nav-hidden');
      }
      lastScroll = current;
    });

    // Mobile toggle
    toggle.addEventListener('click', function () {
      toggle.classList.toggle('active');
      links.classList.toggle('active');
      document.body.classList.toggle('nav-open');
    });

    // Close menu on link click
    links.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        toggle.classList.remove('active');
        links.classList.remove('active');
        document.body.classList.remove('nav-open');
      });
    });

    // Active link tracking
    const sections = document.querySelectorAll('section[id]');
    window.addEventListener('scroll', function () {
      const scrollPos = window.scrollY + 200;
      sections.forEach(function (section) {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');
        const link = links.querySelector('a[href="#' + id + '"]');
        if (link) {
          if (scrollPos >= top && scrollPos < top + height) {
            links.querySelectorAll('a').forEach(function (a) { a.classList.remove('active'); });
            link.classList.add('active');
          }
        }
      });
    });
  }

  // ── Hero entrance animations ────────────────
  function initHeroAnimations() {
    var elements = document.querySelectorAll('.animate-on-load');
    elements.forEach(function (el) {
      var delay = parseInt(el.getAttribute('data-delay') || '0', 10);
      setTimeout(function () {
        el.classList.add('visible');
      }, delay);
    });
  }

  // ── Floating hearts in hero ─────────────────
  function initFloatingHearts() {
    var container = document.getElementById('heroParticles');
    if (!container) return;

    var heartSymbols = ['\u2665', '\u2764', '\u2661'];

    function createHeart() {
      var heart = document.createElement('span');
      heart.className = 'floating-heart';
      heart.textContent = heartSymbols[Math.floor(Math.random() * heartSymbols.length)];

      // Random properties
      var size = Math.random() * 20 + 10;
      var left = Math.random() * 100;
      var duration = Math.random() * 8 + 6;
      var delay = Math.random() * 4;
      var opacity = Math.random() * 0.3 + 0.1;

      heart.style.cssText =
        'position:absolute;' +
        'bottom:-20px;' +
        'left:' + left + '%;' +
        'font-size:' + size + 'px;' +
        'opacity:' + opacity + ';' +
        'animation:floatHeart ' + duration + 's ease-in-out ' + delay + 's infinite;' +
        'pointer-events:none;' +
        'color:var(--color-rose, #e8a0a0);';

      container.appendChild(heart);
    }

    // Create initial batch
    for (var i = 0; i < 15; i++) {
      createHeart();
    }
  }

  // ── Scroll Reveal (IntersectionObserver) ────
  function initScrollReveal() {
    var reveals = document.querySelectorAll('.scroll-reveal');

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var delay = parseInt(entry.target.getAttribute('data-delay') || '0', 10);
            setTimeout(function () {
              entry.target.classList.add('revealed');
            }, delay);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

      reveals.forEach(function (el) {
        observer.observe(el);
      });
    } else {
      // Fallback: show everything
      reveals.forEach(function (el) { el.classList.add('revealed'); });
    }
  }

  // ── Counter animation ───────────────────────
  function initCounterAnimation() {
    var counters = document.querySelectorAll('.counter-number');

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });

      counters.forEach(function (c) { observer.observe(c); });
    } else {
      counters.forEach(animateCounter);
    }
  }

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-target'), 10);
    var duration = 2000;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target.toLocaleString();
      }
    }

    requestAnimationFrame(step);
  }

  // ── Photo Gallery ───────────────────────────
  function initGallery() {
    loadMorePhotos();

    var btn = document.getElementById('loadMoreBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        loadMorePhotos();
        if (photosLoaded >= PHOTOS.length) {
          btn.style.display = 'none';
        }
      });
    }
  }

  function loadMorePhotos() {
    var grid = document.getElementById('galleryGrid');
    if (!grid) return;

    var end = Math.min(photosLoaded + PHOTOS_PER_PAGE, PHOTOS.length);

    for (var i = photosLoaded; i < end; i++) {
      var item = createGalleryItem(PHOTOS[i], i);
      grid.appendChild(item);
    }

    photosLoaded = end;

    // Hide button if all loaded
    if (photosLoaded >= PHOTOS.length) {
      var btn = document.getElementById('loadMoreBtn');
      if (btn) btn.style.display = 'none';
    }

    // Re-init scroll-reveal for new items
    initScrollReveal();
  }

  function createGalleryItem(filename, index) {
    var item = document.createElement('div');
    item.className = 'gallery-item scroll-reveal';

    var img = document.createElement('img');
    img.src = 'photos/' + filename;
    img.alt = 'Family photo';
    img.className = 'gallery-image';
    img.loading = 'lazy';
    img.setAttribute('data-index', index);

    // Handle load errors gracefully
    img.onerror = function () {
      item.style.display = 'none';
    };

    var overlay = document.createElement('div');
    overlay.className = 'gallery-overlay';

    var icon = document.createElement('span');
    icon.className = 'gallery-icon';
    icon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';

    overlay.appendChild(icon);
    item.appendChild(img);
    item.appendChild(overlay);

    // Click to open lightbox
    item.addEventListener('click', function () {
      openLightbox(index);
    });

    return item;
  }

  // ── Lightbox ────────────────────────────────
  var currentLightboxIndex = 0;

  function initLightbox() {
    var lightbox = document.getElementById('lightbox');
    var closeBtn = document.getElementById('lightboxClose');
    var prevBtn = document.getElementById('lightboxPrev');
    var nextBtn = document.getElementById('lightboxNext');

    if (!lightbox) return;

    closeBtn.addEventListener('click', closeLightbox);
    prevBtn.addEventListener('click', function () { navigateLightbox(-1); });
    nextBtn.addEventListener('click', function () { navigateLightbox(1); });

    // Click backdrop to close
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
        closeLightbox();
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('active')) return;

      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    });

    // Touch/swipe support
    var touchStartX = 0;
    var touchEndX = 0;

    lightbox.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', function (e) {
      touchEndX = e.changedTouches[0].screenX;
      var diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) navigateLightbox(1);    // swipe left → next
        else navigateLightbox(-1);             // swipe right → prev
      }
    }, { passive: true });
  }

  function openLightbox(index) {
    var lightbox = document.getElementById('lightbox');
    var img = document.getElementById('lightboxImg');

    currentLightboxIndex = index;
    img.src = 'photos/' + PHOTOS[index];
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    var lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function navigateLightbox(direction) {
    var total = Math.min(photosLoaded, PHOTOS.length);
    currentLightboxIndex = (currentLightboxIndex + direction + total) % total;
    var img = document.getElementById('lightboxImg');
    img.style.opacity = '0';
    setTimeout(function () {
      img.src = 'photos/' + PHOTOS[currentLightboxIndex];
      img.style.opacity = '1';
    }, 200);
  }

  // ── Smooth scroll ───────────────────────────
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        var targetId = this.getAttribute('href');
        var target = document.querySelector(targetId);
        if (target) {
          var offset = 70; // nav height
          var top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
    });
  }

})();
