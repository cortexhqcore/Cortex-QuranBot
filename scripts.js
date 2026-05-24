document.addEventListener('DOMContentLoaded', function () {
    const scrollTopBtn = document.querySelector('.scroll-top-btn');

    function toggleScrollButton() {
        if (window.scrollY > 400) {
            scrollTopBtn.classList.add('visible');
        } else {
            scrollTopBtn.classList.remove('visible');
        }
    }

    window.addEventListener('scroll', toggleScrollButton);

    scrollTopBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const Nav = document.querySelector('.header-nav');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', function () {
            Nav.classList.toggle('active');
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const recitersGrid = document.getElementById('reciters-grid');
    const radiosGrid = document.getElementById('radios-grid');
    const surahsGrid = document.getElementById('surahs-grid');
    const rewayahGrid = document.getElementById('rewayah-grid');
    const showMoreRecitersBtn = document.getElementById('show-more-reciters');
    const showMoreRadiosBtn = document.getElementById('show-more-radios');
    const showMoreSurahsBtn = document.getElementById('show-more-surahs');
    const showMoreRewayahBtn = document.getElementById('show-more-rewayah');
    const filterButtons = document.querySelectorAll('.filter-btn');
    let allReciters = [];
    let allRadios = [];
    let allSurahs = [];
    let allRewayah = [];
    let displayedRecitersCount = 0;
    let displayedRadiosCount = 0;
    let displayedSurahsCount = 0;
    let displayedRewayahCount = 0;
    const ITEMS_PER_PAGE = 6;
    const SURAH_REWAYAH_PER_PAGE = 20;
    let currentSurahFilter = 'all';

    function getReciterTags(reciter) {
        const tags = [];
        const moshaf = reciter.moshaf?.[0];
        if (moshaf) {
            const surahCount = moshaf.surah_list?.split(',').filter((s) => s.trim()).length || 0;
            if (surahCount >= 114) tags.push('Complete');
            else if (surahCount > 50) tags.push('Partial');
            else tags.push('Limited');
            if (moshaf.name?.includes('مجتود') || moshaf.name?.toLowerCase().includes('mujawwad')) {
                tags.push('Mujawwad');
            } else {
                tags.push('Murattal');
            }
        }
        return tags;
    }

    function createReciterCard(reciter) {
        const name = reciter.name || 'Unknown Reciter';
        const moshaf = reciter.moshaf?.[0];
        const surahCount = moshaf?.surah_list?.split(',').filter((s) => s.trim()).length || 0;
        const style = moshaf?.name || 'Hafs';
        const tags = getReciterTags(reciter);
        const letter = reciter.letter && reciter.letter.trim().length > 0 ? reciter.letter.trim() : '';

        const card = document.createElement('div');
        card.className = 'reciter-card';
        card.innerHTML = `
         <div class="reciter-avatar">
         <i class="fas fa-user"></i>
         </div>
         <div class="reciter-info">
         <h3 class="reciter-name">${name}</h3>
         <p class="reciter-style">${style} • ${surahCount} Surahs</p>
         <div class="reciter-tags">
            ${tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
         </div>
         </div>
    `;
        return card;
    }

    function createRadioCard(radio) {
        const name = radio.name || 'Unknown Station';
        const url = radio.url || '#';
        const recentDate = radio.recent_date ? new Date(radio.recent_date).toLocaleDateString() : 'Unknown';

        const card = document.createElement('div');
        card.className = 'radio-card';
        card.innerHTML = `
         <div class="radio-icon">
         <i class="fas fa-broadcast-tower"></i>
         </div>
         <div class="radio-info">
         <h3 class="radio-name">${name}</h3>
         <a href="${url}" target="_blank" class="radio-link" title="Open Stream">
            <i class="fas fa-external-link-alt"></i>
         </a>
         </div>
    `;
        return card;
    }

    function createSurahCard(surah) {
        const name = surah.name || 'Unknown';
        const id = surah.id || 0;
        const type = surah.makkia === 1 ? 'Makki' : 'Madani';
        const pages = `Pages ${surah.start_page}-${surah.end_page}`;

        const card = document.createElement('div');
        card.className = `surah-card ${surah.makkia === 1 ? 'makkia' : 'madania'}`;
        card.setAttribute('data-type', surah.makkia === 1 ? 'makkia' : 'madania');
        card.innerHTML = `
         <div class="surah-number">${id}</div>
         <div class="surah-content">
         <h3 class="surah-name">${name}</h3>
         <p class="surah-meta">${type} • ${pages}</p>
         </div>
    `;
        return card;
    }

    function createRewayahCard(rewayah) {
        const name = rewayah.name || 'Unknown';
        const id = rewayah.id || 0;

        const card = document.createElement('div');
        card.className = 'rewayah-card';
        card.innerHTML = `
         <div class="rewayah-icon">
         <i class="fas fa-scroll"></i>
         </div>
         <div class="rewayah-info">
         <h3 class="rewayah-name">${name}</h3>
         <span class="rewayah-id">ID: ${id}</span>
         </div>
    `;
        return card;
    }

    function renderReciters(count) {
        const loadingPlaceholder = recitersGrid.querySelector('.loading-placeholder');
        if (loadingPlaceholder) {
            loadingPlaceholder.remove();
        }

        const items = allReciters.slice(displayedRecitersCount, displayedRecitersCount + count);
        items.forEach((reciter) => {
            const card = createReciterCard(reciter);
            recitersGrid.appendChild(card);
        });
        displayedRecitersCount += count;
    }

    function renderRadios(count) {
        const loadingPlaceholder = radiosGrid.querySelector('.loading-placeholder');
        if (loadingPlaceholder) {
            loadingPlaceholder.remove();
        }

        const items = allRadios.slice(displayedRadiosCount, displayedRadiosCount + count);
        items.forEach((radio) => {
            const card = createRadioCard(radio);
            radiosGrid.appendChild(card);
        });
        displayedRadiosCount += count;
    }

    function renderSurahs(surahs, append = false) {
        if (!append) {
            surahsGrid.innerHTML = '';
            displayedSurahsCount = 0;
        }
        const items = surahs.slice(displayedSurahsCount, displayedSurahsCount + SURAH_REWAYAH_PER_PAGE);
        items.forEach((surah) => {
            const card = createSurahCard(surah);
            surahsGrid.appendChild(card);
        });
        displayedSurahsCount += items.length;
    }

    function renderRewayah(rewayahList, append = false) {
        if (!append) {
            rewayahGrid.innerHTML = '';
            displayedRewayahCount = 0;
        }
        const items = rewayahList.slice(displayedRewayahCount, displayedRewayahCount + SURAH_REWAYAH_PER_PAGE);
        items.forEach((item) => {
            const card = createRewayahCard(item);
            rewayahGrid.appendChild(card);
        });
        displayedRewayahCount += items.length;
    }

    function updateRecitersButton() {
        if (displayedRecitersCount >= allReciters.length) {
            showMoreRecitersBtn.style.display = 'none';
        } else {
            showMoreRecitersBtn.style.display = 'inline-flex';
        }
    }

    function updateRadiosButton() {
        if (displayedRadiosCount >= allRadios.length) {
            showMoreRadiosBtn.style.display = 'none';
        } else {
            showMoreRadiosBtn.style.display = 'inline-flex';
        }
    }

    function updateSurahsButton() {
        const filteredSurahs =
            currentSurahFilter === 'all'
                ? allSurahs
                : allSurahs.filter((s) => (currentSurahFilter === 'makkia' ? s.makkia === 1 : s.makkia === 0));
        if (displayedSurahsCount >= filteredSurahs.length) {
            showMoreSurahsBtn.style.display = 'none';
        } else {
            showMoreSurahsBtn.style.display = 'inline-flex';
        }
    }

    function updaterewayah() {
        if (displayedRewayahCount >= allRewayah.length) {
            showMoreRewayahBtn.style.display = 'none';
        } else {
            showMoreRewayahBtn.style.display = 'inline-flex';
        }
    }

    async function data() {
        try {
            const response = await fetch('./src/json/reciters.json');
            if (!response.ok) throw new Error('Failed to load database');
            const data = await response.json();
            const cachedData = data.cached_data || data;
            const recitersArray = cachedData.reciters?.reciters || cachedData.reciters || [];
            allReciters = recitersArray
                .filter((r) => r.name && r.moshaf?.[0]?.server)
                .sort((a, b) => (a.letter || '').localeCompare(b.letter || '', 'ar'));
            const radiosArray = cachedData.radios?.radios || cachedData.radios || [];
            allRadios = radiosArray.filter((r) => r.name && r.url).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
            const surahsArray = cachedData.surah?.suwar || data.surah?.suwar || [];
            allSurahs = surahsArray.sort((a, b) => a.id - b.id);
            const rewayahArray = cachedData.rewayah?.riwayat || cachedData.rewayah || [];
            allRewayah = rewayahArray.sort((a, b) => a.id - b.id);
            document.getElementById('reciters-count').textContent = allReciters.length;
            document.getElementById('radios-count').textContent = allRadios.length;
            renderReciters(ITEMS_PER_PAGE);
            updateRecitersButton();
            renderRadios(ITEMS_PER_PAGE);
            updateRadiosButton();
            renderSurahs(allSurahs, false);
            updateSurahsButton();
            renderRewayah(allRewayah, false);
            updaterewayah();
        } catch (error) {
            console.error('Error loading database:', error);
            recitersGrid.innerHTML = `<div class="error-placeholder"><i class="fas fa-exclamation-triangle"></i> Unable to load data</div>`;
            radiosGrid.innerHTML = `<div class="error-placeholder"><i class="fas fa-exclamation-triangle"></i> Unable to load data</div>`;
            surahsGrid.innerHTML = `<div class="error-placeholder"><i class="fas fa-exclamation-triangle"></i> Unable to load data</div>`;
            rewayahGrid.innerHTML = `<div class="error-placeholder"><i class="fas fa-exclamation-triangle"></i> Unable to load data</div>`;
        }
    }

    showMoreRecitersBtn.addEventListener('click', () => {
        renderReciters(ITEMS_PER_PAGE);
        updateRecitersButton();
    });

    showMoreRadiosBtn.addEventListener('click', () => {
        renderRadios(ITEMS_PER_PAGE);
        updateRadiosButton();
    });

    showMoreSurahsBtn.addEventListener('click', () => {
        const filteredSurahs =
            currentSurahFilter === 'all'
                ? allSurahs
                : allSurahs.filter((s) => (currentSurahFilter === 'makkia' ? s.makkia === 1 : s.makkia === 0));
        renderSurahs(filteredSurahs, true);
        updateSurahsButton();
    });

    showMoreRewayahBtn.addEventListener('click', () => {
        renderRewayah(allRewayah, true);
        updaterewayah();
    });

    filterButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            filterButtons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentSurahFilter = btn.getAttribute('data-filter');
            const filtered =
                currentSurahFilter === 'all'
                    ? allSurahs
                    : allSurahs.filter((s) => (currentSurahFilter === 'makkia' ? s.makkia === 1 : s.makkia === 0));
            renderSurahs(filtered, false);
            updateSurahsButton();
        });
    });

    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach((item) => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isOpen = item.classList.contains('open');
            faqItems.forEach((i) => i.classList.remove('open'));
            if (!isOpen) {
                item.classList.add('open');
            }
        });
    });

    const scrollTopBtn = document.querySelector('.scroll-top-btn');
    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 400) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        });
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    const MenuToggle = document.querySelector('.mobile-menu-toggle');
    const Nav = document.querySelector('.header-nav');
    if (MenuToggle && Nav) {
        MenuToggle.addEventListener('click', () => {
            Nav.classList.toggle('active');
        });
    }
    data();
});
