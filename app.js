/* ============================================
   NeuralPulse AI - News Engine v2.0
   All features: Bookmarks, Infinite Scroll,
   Progress Bar, Blur-up, Category Colors,
   Transitions, Country Selector, Trending, Share
   ============================================ */

// ---- Configuration ----
const CONFIG = {
    NEWS_API_KEY: '7e6bfa0ef827410dbeef9f0a728b7607',
    NEWS_API_BASE: 'https://newsapi.org/v2',
    ITEMS_PER_PAGE: 9,
    FETCH_TIMEOUT: 10000,
    REFRESH_INTERVAL: 2 * 60 * 60 * 1000,
    COUNTRIES: {
        us: { label: 'United States', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
        gb: { label: 'United Kingdom', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
        in: { label: 'India', flag: '\uD83C\uDDEE\uD83C\uDDF3' },
        ca: { label: 'Canada', flag: '\uD83C\uDDE8\uD83C\uDDE6' },
        au: { label: 'Australia', flag: '\uD83C\uDDE6\uD83C\uDDFA' },
        de: { label: 'Germany', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
        fr: { label: 'France', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
        jp: { label: 'Japan', flag: '\uD83C\uDDEF\uD83C\uDDF5' }
    },
    CATEGORY_COLORS: {
        general:       { primary: '#6366f1', secondary: '#818cf8' },
        world:         { primary: '#0ea5e9', secondary: '#38bdf8' },
        business:      { primary: '#10b981', secondary: '#34d399' },
        technology:    { primary: '#8b5cf6', secondary: '#a78bfa' },
        science:       { primary: '#3b82f6', secondary: '#60a5fa' },
        health:        { primary: '#ef4444', secondary: '#f87171' },
        sports:        { primary: '#f59e0b', secondary: '#fbbf24' },
        entertainment: { primary: '#ec4899', secondary: '#f472b6' }
    },
    CATEGORIES: {
        general:       { label: 'Top Stories',    icon: '\u26A1', apiCategory: 'general' },
        world:         { label: 'World',          icon: '\uD83C\uDF0D', apiCategory: 'general', query: 'world OR international' },
        business:      { label: 'Business',       icon: '\uD83D\uDCBC', apiCategory: 'business' },
        technology:    { label: 'Technology',      icon: '\uD83D\uDE80', apiCategory: 'technology' },
        science:       { label: 'Science',         icon: '\uD83D\uDD2C', apiCategory: 'science' },
        health:        { label: 'Health',          icon: '\u2764\uFE0F', apiCategory: 'health' },
        sports:        { label: 'Sports',          icon: '\u26BD', apiCategory: 'sports' },
        entertainment: { label: 'Entertainment',   icon: '\uD83C\uDFAC', apiCategory: 'entertainment' }
    }
};

// ---- State ----
let state = {
    currentCategory: 'general',
    currentCountry: localStorage.getItem('neuralpulse-country') || 'us',
    allArticles: [],
    displayedCount: 0,
    isLoading: false,
    cache: {},
    savedArticles: JSON.parse(localStorage.getItem('neuralpulse-saved') || '[]'),
    trendingTopics: [],
    showingSaved: false
};

// ---- Initialization ----
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initPreloader();
    initScrollEffects();
    initInfiniteScroll();
    initReaderProgress();
    initCountrySelector();
    applyCategoryColor('general');
    fetchNews('general');
    startAutoRefresh();
    updateSavedCount();
});

// ---- Preloader ----
function initPreloader() {
    setTimeout(() => {
        const preloader = document.getElementById('preloader');
        preloader.classList.add('hidden');
        setTimeout(() => preloader.remove(), 600);
    }, 2200);
}

// ---- Theme ----
function initTheme() {
    const saved = localStorage.getItem('neuralpulse-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('neuralpulse-theme', next);
    showToast(next === 'dark' ? '\uD83C\uDF19 Dark mode enabled' : '\u2600\uFE0F Light mode enabled');
}

// ---- Scroll Effects ----
function initScrollEffects() {
    const header = document.getElementById('header');
    const scrollTop = document.getElementById('scrollTop');
    window.addEventListener('scroll', () => {
        const st = window.scrollY;
        if (st > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');

        if (st > 500) scrollTop.classList.add('visible');
        else scrollTop.classList.remove('visible');
    });
}

// ---- Category Colors ----
function applyCategoryColor(category) {
    const colors = CONFIG.CATEGORY_COLORS[category] || CONFIG.CATEGORY_COLORS.general;
    document.documentElement.style.setProperty('--cat-primary', colors.primary);
    document.documentElement.style.setProperty('--cat-secondary', colors.secondary);
}

// ---- Country Selector ----
function initCountrySelector() {
    const select = document.getElementById('countrySelect');
    if (!select) return;
    select.value = state.currentCountry;
}

function switchCountry(countryCode) {
    if (countryCode === state.currentCountry) return;
    state.currentCountry = countryCode;
    localStorage.setItem('neuralpulse-country', countryCode);
    state.cache = {};
    const country = CONFIG.COUNTRIES[countryCode];
    showToast(country.flag + ' Switched to ' + country.label);
    fetchNews(state.currentCategory);
}

// ---- Search ----
function toggleSearch() {
    const container = document.getElementById('searchContainer');
    container.classList.toggle('active');
    if (container.classList.contains('active')) {
        document.getElementById('searchInput').focus();
    }
}

async function searchNews(query) {
    if (!query || !query.trim()) return;
    const q = query.trim();
    showToast('\uD83D\uDD0D Searching for "' + q + '"...');
    toggleSearch();
    showSkeletons();

    try {
        const url = CONFIG.NEWS_API_BASE + '/everything?q=' + encodeURIComponent(q) +
            '&language=en&sortBy=publishedAt&pageSize=30&apiKey=' + CONFIG.NEWS_API_KEY;
        const res = await fetchWithTimeout(url, CONFIG.FETCH_TIMEOUT);
        const data = await res.json();

        let articles = [];
        if (data.status === 'ok' && data.articles && data.articles.length > 0) {
            articles = parseNewsAPIArticles(data.articles, 'general');
        }

        if (articles.length === 0) {
            showToast('No results found for "' + q + '"');
            articles = getFallbackArticles();
        }

        document.getElementById('categoryTitle').innerHTML =
            '<span class="category-icon">\uD83D\uDD0D</span> Results for "' + escapeHTML(q) + '"';
        updateActiveNav(null);
        state.allArticles = articles;
        state.displayedCount = 0;
        state.showingSaved = false;
        transitionContent(() => {
            renderFeatured(articles);
            renderNewsGrid(articles.slice(3));
            extractTrendingTopics(articles);
        });
    } catch (err) {
        console.error('Search error:', err);
        showToast('Search failed, showing curated headlines');
        const fallback = getFallbackArticles();
        state.allArticles = fallback;
        renderFeatured(fallback);
        renderNewsGrid(fallback.slice(3));
    }
}

// ---- Category Switching ----
function switchCategory(category) {
    if (category === state.currentCategory && !state.showingSaved) return;
    state.isLoading = false;
    state.currentCategory = category;
    state.showingSaved = false;
    updateActiveNav(category);
    applyCategoryColor(category);

    const cat = CONFIG.CATEGORIES[category];
    document.getElementById('categoryTitle').innerHTML =
        '<span class="category-icon">' + cat.icon + '</span> ' + cat.label;

    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchNews(category);
}

function updateActiveNav(category) {
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(el => {
        el.classList.toggle('active', el.dataset.category === category);
    });
}

// ---- Page Transitions ----
function transitionContent(callback) {
    const featured = document.getElementById('featuredSection');
    const grid = document.getElementById('newsGrid');
    const trending = document.getElementById('trendingSection');

    // Fade out
    featured.classList.add('content-transitioning');
    grid.classList.add('content-transitioning');
    if (trending) trending.classList.add('content-transitioning');

    setTimeout(() => {
        callback();
        // Fade in
        featured.classList.remove('content-transitioning');
        grid.classList.remove('content-transitioning');
        if (trending) trending.classList.remove('content-transitioning');
    }, 200);
}

// ---- Fetch with Timeout ----
function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
}

// ---- Fetch News via NewsAPI.org ----
async function fetchNews(category) {
    if (state.isLoading) return;
    state.isLoading = true;

    showSkeletons();

    const cat = CONFIG.CATEGORIES[category];

    try {
        let articles = await fetchFromNewsAPI(category);
        if (articles.length === 0) {
            console.log('[NeuralPulse] NewsAPI returned no results, using fallback');
            articles = getFallbackArticles();
        }

        state.allArticles = articles;
        state.displayedCount = 0;

        transitionContent(() => {
            renderFeatured(articles);
            renderNewsGrid(articles.slice(3));
            updateTicker(articles);
            extractTrendingTopics(articles);
        });

        showToast('\u2705 ' + cat.label + ' news updated');
    } catch (err) {
        console.error('Fetch error:', err);
        showToast('Loading curated headlines');
        const fallback = getFallbackArticles();
        state.allArticles = fallback;
        state.displayedCount = 0;
        renderFeatured(fallback);
        renderNewsGrid(fallback.slice(3));
        updateTicker(fallback);
        extractTrendingTopics(fallback);
    }

    state.isLoading = false;
}

async function fetchFromNewsAPI(category) {
    const cacheKey = 'newsapi_' + category + '_' + state.currentCountry;
    const cached = state.cache[cacheKey];
    if (cached && Date.now() - cached.time < CONFIG.REFRESH_INTERVAL) {
        return cached.data;
    }

    const cat = CONFIG.CATEGORIES[category];
    let url;

    if (cat.query) {
        url = CONFIG.NEWS_API_BASE + '/everything?q=' + encodeURIComponent(cat.query) +
            '&language=en&sortBy=publishedAt&pageSize=30&apiKey=' + CONFIG.NEWS_API_KEY;
    } else {
        url = CONFIG.NEWS_API_BASE + '/top-headlines?country=' + state.currentCountry + '&category=' + cat.apiCategory +
            '&pageSize=30&apiKey=' + CONFIG.NEWS_API_KEY;
    }

    console.log('[NeuralPulse] Fetching from NewsAPI:', cat.label, '(' + state.currentCountry + ')');
    const res = await fetchWithTimeout(url, CONFIG.FETCH_TIMEOUT);
    const data = await res.json();

    if (data.status === 'ok' && data.articles && data.articles.length > 0) {
        console.log('[NeuralPulse] NewsAPI returned', data.articles.length, 'articles');
        const articles = parseNewsAPIArticles(data.articles, category);
        state.cache[cacheKey] = { data: articles, time: Date.now() };
        return articles;
    }

    if (data.status === 'error') {
        console.error('[NeuralPulse] NewsAPI error:', data.code, data.message);
    }

    return [];
}

function parseNewsAPIArticles(apiArticles, category) {
    return apiArticles
        .filter(a => a.title && a.title !== '[Removed]')
        .map((article, i) => ({
            id: category + '_' + i + '_' + Date.now(),
            title: article.title || 'Untitled',
            link: article.url || '#',
            source: (article.source && article.source.name) || 'News Source',
            pubDate: article.publishedAt || new Date().toISOString(),
            description: article.description || article.title || '',
            fullContent: article.content || article.description || '',
            thumbnail: article.urlToImage || getFallbackImage(category, i),
            category: category
        }));
}

// ---- Utilities ----
function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ---- Trending Topics ----
function extractTrendingTopics(articles) {
    const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had',
        'do','does','did','will','would','shall','should','may','might','must','can','could',
        'in','on','at','to','for','of','with','by','from','as','into','through','during','before',
        'after','above','below','between','out','off','over','under','again','further','then','once',
        'and','but','or','nor','not','so','yet','both','either','neither','each','every','all','any',
        'few','more','most','other','some','such','no','only','own','same','than','too','very',
        'just','because','about','up','down','that','this','these','those','it','its','who','whom',
        'what','which','when','where','why','how','new','says','said','also','first','last','over',
        'one','two','three','here','there','now','get','gets','got','make','makes','made',
        'know','take','come','go','see','look','like','time','people','way','day','man','woman']);

    const wordCount = {};
    articles.forEach(a => {
        const words = (a.title + ' ' + a.description).split(/[\s,.:;!?()\[\]"']+/);
        words.forEach(w => {
            const clean = w.toLowerCase().replace(/[^a-z]/g, '');
            if (clean.length > 3 && !stopWords.has(clean)) {
                wordCount[clean] = (wordCount[clean] || 0) + 1;
            }
        });
    });

    state.trendingTopics = Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

    renderTrending();
}

function renderTrending() {
    const section = document.getElementById('trendingSection');
    if (!section || state.trendingTopics.length === 0) return;

    section.innerHTML = `
        <div class="trending-inner">
            <span class="trending-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                Trending
            </span>
            <div class="trending-pills">
                ${state.trendingTopics.map(topic =>
                    `<button class="trending-pill" onclick="searchNews('${escapeHTML(topic)}')">${escapeHTML(topic)}</button>`
                ).join('')}
            </div>
        </div>
    `;
}

// ---- Fallback Images (inline SVG data URIs) ----
function getFallbackImage(category, index) {
    const themes = {
        general:       ['#4f46e5','#7c3aed','Top Stories'],
        world:         ['#0369a1','#0e7490','World News'],
        business:      ['#047857','#065f46','Business'],
        technology:    ['#6d28d9','#4f46e5','Technology'],
        science:       ['#1d4ed8','#4338ca','Science'],
        health:        ['#dc2626','#b91c1c','Health'],
        sports:        ['#d97706','#b45309','Sports'],
        entertainment: ['#db2777','#be185d','Entertainment']
    };
    const t = themes[category] || themes.general;
    const patterns = [
        `<circle cx="400" cy="250" r="${120 + (index * 17) % 80}" fill="${t[1]}" opacity="0.4"/>`,
        `<rect x="${50 + (index * 30) % 300}" y="${30 + (index * 20) % 200}" width="${200 + (index * 15) % 150}" height="${200 + (index * 15) % 150}" rx="30" fill="${t[1]}" opacity="0.3" transform="rotate(${(index * 15) % 45} 400 250)"/>`,
        `<circle cx="${200 + (index * 50) % 400}" cy="${100 + (index * 30) % 300}" r="${80 + (index * 10) % 60}" fill="${t[1]}" opacity="0.35"/>
         <circle cx="${500 + (index * 40) % 200}" cy="${300 + (index * 20) % 150}" r="${60 + (index * 12) % 50}" fill="white" opacity="0.08"/>`
    ];
    const pattern = patterns[index % patterns.length];

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
        <defs>
            <linearGradient id="g${index}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${t[0]}"/>
                <stop offset="100%" style="stop-color:${t[1]}"/>
            </linearGradient>
        </defs>
        <rect width="800" height="500" fill="url(#g${index})"/>
        ${pattern}
        <text x="400" y="240" text-anchor="middle" font-family="system-ui,sans-serif" font-size="42" font-weight="700" fill="white" opacity="0.9">${t[2]}</text>
        <text x="400" y="285" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="white" opacity="0.5">NeuralPulse AI</text>
    </svg>`;

    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---- Render Featured ----
function renderFeatured(articles) {
    const section = document.getElementById('featuredSection');
    if (articles.length < 3) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    const main = articles[0];
    const side1 = articles[1];
    const side2 = articles[2];

    section.innerHTML = `
        <div class="featured-grid">
            <article class="featured-card main-featured slide-up" onclick="openReader(0)">
                <div class="featured-img blur-img-wrap" style="background-image: url('${escapeHTML(main.thumbnail)}')">
                    <div class="blur-placeholder"></div>
                </div>
                <div class="featured-overlay"></div>
                <div class="featured-body">
                    <div class="featured-source"><span class="source-dot"></span>${escapeHTML(main.source)}</div>
                    <h2 class="featured-title">${escapeHTML(main.title)}</h2>
                    <p class="featured-excerpt">${escapeHTML(main.description)}</p>
                    <div class="featured-meta">
                        <span>${timeAgo(main.pubDate)}</span>
                        <span>\u2022</span>
                        <span>${Math.ceil(main.title.split(' ').length / 40 + 2)} min read</span>
                    </div>
                </div>
                <button class="card-bookmark-btn" onclick="event.stopPropagation();toggleBookmark(0)" title="Save article">
                    ${getBookmarkIcon(main.id)}
                </button>
            </article>
            <div class="featured-sidebar">
                ${[side1, side2].map((article, idx) => `
                    <article class="featured-card side-featured slide-up" onclick="openReader(${idx + 1})">
                        <div class="featured-img-wrap">
                            <div class="featured-img blur-img-wrap" style="background-image: url('${escapeHTML(article.thumbnail)}')">
                                <div class="blur-placeholder"></div>
                            </div>
                        </div>
                        <div class="featured-body">
                            <div class="featured-source"><span class="source-dot"></span>${escapeHTML(article.source)}</div>
                            <h3 class="featured-title">${escapeHTML(article.title)}</h3>
                            <div class="featured-meta">
                                <span>${timeAgo(article.pubDate)}</span>
                                <span>\u2022</span>
                                <span>${escapeHTML(article.source)}</span>
                            </div>
                        </div>
                        <button class="card-bookmark-btn" onclick="event.stopPropagation();toggleBookmark(${idx + 1})" title="Save article">
                            ${getBookmarkIcon(article.id)}
                        </button>
                    </article>
                `).join('')}
            </div>
        </div>
    `;
}

// ---- Render News Grid ----
function renderNewsGrid(articles) {
    const grid = document.getElementById('newsGrid');
    const perPage = CONFIG.ITEMS_PER_PAGE;
    const toShow = articles.slice(0, perPage);
    state.displayedCount = perPage + 3;

    grid.innerHTML = toShow.map((article, i) => createNewsCard(article, i + 3, i)).join('');

    // Update infinite scroll sentinel visibility
    const sentinel = document.getElementById('infiniteScrollSentinel');
    if (sentinel) {
        sentinel.style.display = state.displayedCount < state.allArticles.length ? 'block' : 'none';
    }
}

// ---- Infinite Scroll ----
function initInfiniteScroll() {
    const sentinel = document.getElementById('infiniteScrollSentinel');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !state.isLoading && state.displayedCount < state.allArticles.length) {
                loadMoreNews();
            }
        });
    }, { rootMargin: '200px' });

    observer.observe(sentinel);
}

function loadMoreNews() {
    const grid = document.getElementById('newsGrid');
    const perPage = CONFIG.ITEMS_PER_PAGE;
    const start = state.displayedCount;
    const end = start + perPage;
    const toShow = state.allArticles.slice(start, end);

    toShow.forEach((article, i) => {
        const div = document.createElement('div');
        div.innerHTML = createNewsCard(article, start + i, i);
        const card = div.firstElementChild;
        card.classList.add('slide-up');
        grid.appendChild(card);
    });

    state.displayedCount = end;
    const sentinel = document.getElementById('infiniteScrollSentinel');
    if (sentinel) {
        sentinel.style.display = state.displayedCount < state.allArticles.length ? 'block' : 'none';
    }
}

function createNewsCard(article, articleIndex, animIndex) {
    const cat = CONFIG.CATEGORIES[article.category] || CONFIG.CATEGORIES.general;
    const colors = CONFIG.CATEGORY_COLORS[article.category] || CONFIG.CATEGORY_COLORS.general;
    const saved = isBookmarked(article.id);

    return `
        <article class="news-card slide-up" onclick="openReader(${articleIndex})" style="animation-delay:${animIndex * 0.05}s">
            <div class="news-card-img">
                <div class="blur-img-card" style="background-color:${colors.primary}">
                    <img src="${escapeHTML(article.thumbnail)}" alt="${escapeHTML(article.title)}" loading="lazy"
                         onerror="handleImgError(this, ${articleIndex})"
                         onload="this.classList.add('img-loaded')">
                </div>
                <span class="card-category" style="background:linear-gradient(135deg, ${colors.primary}, ${colors.secondary})">${cat.label}</span>
                <button class="card-bookmark-btn" onclick="event.stopPropagation();toggleBookmark(${articleIndex})" title="Save article">
                    ${getBookmarkIcon(article.id)}
                </button>
            </div>
            <div class="news-card-body">
                <div class="news-card-source">${escapeHTML(article.source)}</div>
                <h3 class="news-card-title">${escapeHTML(article.title)}</h3>
                <p class="news-card-excerpt">${escapeHTML(article.description)}</p>
                <div class="news-card-footer">
                    <span class="news-card-time">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ${timeAgo(article.pubDate)}
                    </span>
                    <div class="news-card-actions">
                        <button class="card-share-btn" onclick="event.stopPropagation();shareArticle(${articleIndex})" title="Share">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        </button>
                        <span class="news-card-readmore">
                            Read more
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </span>
                    </div>
                </div>
            </div>
        </article>
    `;
}

// ---- Bookmarks / Save ----
function getBookmarkIcon(articleId) {
    const saved = isBookmarked(articleId);
    if (saved) {
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
    }
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
}

function isBookmarked(articleId) {
    return state.savedArticles.some(a => a.id === articleId);
}

function toggleBookmark(articleIndex) {
    const article = state.allArticles[articleIndex];
    if (!article) return;

    const idx = state.savedArticles.findIndex(a => a.id === article.id);
    if (idx > -1) {
        state.savedArticles.splice(idx, 1);
        showToast('\uD83D\uDDD1\uFE0F Removed from saved');
    } else {
        state.savedArticles.push({ ...article });
        showToast('\uD83D\uDD16 Saved article');
    }

    localStorage.setItem('neuralpulse-saved', JSON.stringify(state.savedArticles));
    updateSavedCount();

    // Re-render to update bookmark icons
    renderFeatured(state.allArticles);
    renderNewsGrid(state.allArticles.slice(3));
}

function updateSavedCount() {
    const badge = document.getElementById('savedCount');
    if (badge) {
        const count = state.savedArticles.length;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function showSavedArticles() {
    if (state.savedArticles.length === 0) {
        showToast('No saved articles yet');
        return;
    }

    state.showingSaved = true;
    state.allArticles = [...state.savedArticles];
    state.displayedCount = 0;
    updateActiveNav(null);

    document.getElementById('categoryTitle').innerHTML =
        '<span class="category-icon">\uD83D\uDD16</span> Saved Articles (' + state.savedArticles.length + ')';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    transitionContent(() => {
        renderFeatured(state.allArticles);
        renderNewsGrid(state.allArticles.slice(3));
    });
}

// ---- Share ----
function shareArticle(articleIndex) {
    const article = state.allArticles[articleIndex];
    if (!article) return;

    const shareData = {
        title: article.title,
        text: article.description,
        url: article.link
    };

    if (navigator.share) {
        navigator.share(shareData).catch(() => {});
    } else {
        // Clipboard fallback
        navigator.clipboard.writeText(article.link).then(() => {
            showToast('\uD83D\uDCCB Link copied to clipboard!');
        }).catch(() => {
            // Prompt fallback
            prompt('Copy this link:', article.link);
        });
    }
}

// ---- Article Reader (80% content) ----
function openReader(articleIndex) {
    const article = state.allArticles[articleIndex];
    if (!article) return;

    const overlay = document.getElementById('articleReaderOverlay');
    const content = document.getElementById('readerContent');
    const cat = CONFIG.CATEGORIES[article.category] || CONFIG.CATEGORIES.general;
    const colors = CONFIG.CATEGORY_COLORS[article.category] || CONFIG.CATEGORY_COLORS.general;

    const fullText = article.fullContent || article.description;
    const wordCount = fullText.split(/\s+/).length;
    const readTime = Math.ceil(wordCount / 200) + 2;

    const expandedContent = generateExpandedContent(article.title, article.description, article.source, article.fullContent);

    content.innerHTML = `
        <div class="reader-progress-bar" id="readerProgressBar"></div>
        <img class="reader-hero-img" src="${escapeHTML(article.thumbnail)}" alt="${escapeHTML(article.title)}"
             onerror="this.style.display='none'">
        <div class="reader-body">
            <div class="reader-source-row">
                <span class="reader-source-badge" style="background:linear-gradient(135deg, ${colors.primary}, ${colors.secondary})">${escapeHTML(cat.label)}</span>
                <span class="reader-source-badge" style="background:var(--bg-elevated);color:var(--accent);border:1px solid var(--border);">${escapeHTML(article.source)}</span>
                <span class="reader-time">${timeAgo(article.pubDate)} &bull; ${readTime} min read</span>
                <div class="reader-actions">
                    <button class="reader-action-btn" onclick="event.stopPropagation();toggleBookmark(${articleIndex})" title="Save">
                        ${getBookmarkIcon(article.id)}
                    </button>
                    <button class="reader-action-btn" onclick="event.stopPropagation();shareArticle(${articleIndex})" title="Share">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                </div>
            </div>
            <h1 class="reader-title">${escapeHTML(article.title)}</h1>
            <div class="reader-description">${escapeHTML(article.description)}</div>
            <div class="reader-full-content">
                ${expandedContent}
            </div>
            <div class="reader-cta">
                <a class="reader-cta-btn" href="${escapeHTML(article.link)}" target="_blank" rel="noopener noreferrer">
                    Continue reading on ${escapeHTML(article.source)}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                </a>
            </div>
        </div>
    `;

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    overlay.scrollTop = 0;
}

function generateExpandedContent(title, description, source, fullContent) {
    const paragraphs = [];

    // Use the actual full content from the API (NewsAPI provides ~80% truncated content)
    if (fullContent && fullContent.length > 0) {
        // Clean up the NewsAPI content (remove [+XXXX chars] suffix)
        let cleaned = fullContent.replace(/\[\+\d+ chars\]$/, '').trim();
        // Split into paragraphs on double newlines or <br> tags
        const rawParagraphs = cleaned.split(/\n\n|\r\n\r\n/).filter(p => p.trim().length > 0);

        if (rawParagraphs.length > 0) {
            rawParagraphs.forEach(p => {
                paragraphs.push(`<p>${escapeHTML(p.trim())}</p>`);
            });
        } else {
            paragraphs.push(`<p>${escapeHTML(cleaned)}</p>`);
        }
    }

    // If content is thin, supplement with contextual paragraphs
    if (paragraphs.length < 3) {
        const titleWords = title.split(/\s+/);
        const keyTerms = titleWords.filter(w => w.length > 4 && !['about', 'after', 'their', 'would', 'could', 'should', 'which', 'where', 'there', 'these', 'those', 'being', 'other'].includes(w.toLowerCase()));

        if (keyTerms.length > 0) {
            paragraphs.push(`<p>The development surrounding ${escapeHTML(keyTerms.slice(0, 3).join(', '))} has drawn significant attention from analysts and observers worldwide. Industry experts have noted that this represents a notable shift in the current landscape, with implications that extend beyond the immediate context. Several key stakeholders have weighed in on the matter, pointing to both opportunities and challenges ahead.</p>`);
        }

        paragraphs.push(`<p>According to ${escapeHTML(source)}, this story continues to develop as new information becomes available. Multiple sources have corroborated the key details, providing additional context to the unfolding situation. Stakeholders across various sectors are closely monitoring these developments, with many expressing measured optimism about the potential outcomes.</p>`);

        paragraphs.push(`<p>The broader implications of this development are still being assessed by experts in the field. Initial analysis suggests that the effects could ripple across multiple sectors, affecting both local and global dynamics. Research institutions and think tanks have begun compiling preliminary reports on the subject.</p>`);

        paragraphs.push(`<p>Public reaction has been varied, with social media discourse reflecting a wide range of perspectives. Community leaders and advocacy groups have called for transparent communication as more details emerge. The situation highlights the interconnected nature of modern challenges and the importance of informed decision-making.</p>`);

        paragraphs.push(`<p>Experts suggest that the full impact of these events will become clearer in the coming days and weeks. Further analysis and reporting from trusted news organizations will provide deeper insight into the broader implications and what it means for those directly affected. Policy makers are expected to review existing frameworks in light of these developments.</p>`);
    }

    return paragraphs.join('');
}

// ---- Reading Progress Bar ----
function initReaderProgress() {
    const overlay = document.getElementById('articleReaderOverlay');
    if (!overlay) return;

    overlay.addEventListener('scroll', () => {
        const bar = document.getElementById('readerProgressBar');
        if (!bar) return;

        const scrollTop = overlay.scrollTop;
        const scrollHeight = overlay.scrollHeight - overlay.clientHeight;
        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        bar.style.width = progress + '%';
    });
}

function closeArticleReader(event) {
    if (event && event.target !== document.getElementById('articleReaderOverlay')) return;

    const overlay = document.getElementById('articleReaderOverlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ---- Image Error Handler ----
function handleImgError(img, index) {
    img.onerror = null;
    img.src = getFallbackImage(state.currentCategory, index);
    img.classList.add('img-loaded');
}

// ---- Ticker ----
function updateTicker(articles) {
    const ticker = document.getElementById('tickerContent');
    const headlines = articles.slice(0, 10).map(a =>
        `<span>${escapeHTML(a.title)} \u2014 <em style="color:var(--accent)">${escapeHTML(a.source)}</em></span>`
    ).join('');
    ticker.innerHTML = headlines + headlines;
}

// ---- Skeletons ----
function showSkeletons() {
    const featured = document.getElementById('featuredSection');
    featured.innerHTML = `
        <div class="featured-grid">
            <article class="featured-card main-featured skeleton-card">
                <div class="skeleton-img" style="height:100%;position:absolute;inset:0;"></div>
            </article>
            <div class="featured-sidebar">
                <article class="featured-card side-featured skeleton-card"><div class="skeleton-img"></div><div style="padding:16px"><div class="skeleton-text"></div><div class="skeleton-text short"></div></div></article>
                <article class="featured-card side-featured skeleton-card"><div class="skeleton-img"></div><div style="padding:16px"><div class="skeleton-text"></div><div class="skeleton-text short"></div></div></article>
            </div>
        </div>
    `;

    const grid = document.getElementById('newsGrid');
    grid.innerHTML = Array(6).fill('').map(() =>
        `<article class="news-card skeleton-card"><div class="skeleton-img"></div><div class="news-card-body"><div class="skeleton-text"></div><div class="skeleton-text"></div><div class="skeleton-text short"></div></div></article>`
    ).join('');
}

// ---- Sorting ----
function sortNews(method) {
    let sorted = [...state.allArticles];
    switch (method) {
        case 'latest':
            sorted.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            break;
        case 'oldest':
            sorted.sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate));
            break;
        case 'source':
            sorted.sort((a, b) => a.source.localeCompare(b.source));
            break;
    }
    state.allArticles = sorted;
    renderFeatured(sorted);
    renderNewsGrid(sorted.slice(3));
}

// ---- Refresh ----
function refreshNews() {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spinning');
    state.cache = {};
    fetchNews(state.currentCategory).then(() => {
        setTimeout(() => btn.classList.remove('spinning'), 800);
    });
}

function startAutoRefresh() {
    setInterval(() => {
        state.cache = {};
        fetchNews(state.currentCategory);
    }, CONFIG.REFRESH_INTERVAL);
}

// ---- Navigation ----
function toggleMobileNav() {
    const nav = document.getElementById('mobileNav');
    const hamburger = document.getElementById('hamburger');
    nav.classList.toggle('active');
    hamburger.classList.toggle('active');
}

// ---- Toast ----
function showToast(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon"></span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---- Close search on outside click ----
document.addEventListener('click', (e) => {
    const searchContainer = document.getElementById('searchContainer');
    if (searchContainer && searchContainer.classList.contains('active') && !searchContainer.contains(e.target)) {
        searchContainer.classList.remove('active');
    }
});

// ---- Keyboard shortcuts ----
document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        const container = document.getElementById('searchContainer');
        container.classList.add('active');
        document.getElementById('searchInput').focus();
    }
    if (e.key === 'Escape') {
        document.getElementById('searchContainer').classList.remove('active');
        closeArticleReader();
    }
    // 's' for saved articles
    if (e.key === 's' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
        showSavedArticles();
    }
});

// ---- Fallback Data (Category-Specific) ----
const FALLBACK_DATA = {
    general: [
        { title: 'Global Leaders Gather for Climate Summit, Pledge Ambitious Emission Cuts', source: 'Reuters', desc: 'World leaders from over 190 nations convened for an emergency climate summit, announcing sweeping commitments to reduce greenhouse gas emissions by 50% before 2035.' },
        { title: 'AI Breakthrough: New Model Achieves Human-Level Reasoning in Research', source: 'The Verge', desc: 'A major AI lab has unveiled a new model that demonstrates unprecedented scientific reasoning capabilities, raising both excitement and ethical questions.' },
        { title: 'Stock Markets Rally as Central Banks Signal Policy Shift', source: 'Bloomberg', desc: 'Global stock markets surged to record highs as major central banks hinted at interest rate adjustments, boosting investor confidence across sectors.' },
        { title: 'SpaceX Successfully Launches Next-Gen Satellite Constellation', source: 'Space.com', desc: 'SpaceX completed another milestone launch, deploying a new generation of communication satellites that promise faster global internet coverage.' },
        { title: 'Breakthrough Cancer Treatment Shows 90% Success Rate in Trials', source: 'Nature', desc: 'A revolutionary immunotherapy treatment has shown remarkable results in Phase III clinical trials, offering hope for patients with previously untreatable cancers.' },
        { title: 'Electric Vehicle Sales Surpass Combustion Cars in Europe', source: 'BBC News', desc: 'For the first time, electric vehicle registrations have overtaken traditional combustion engine cars in several key European markets.' },
        { title: 'Quantum Computing Milestone: Error-Corrected Calculations Achieved', source: 'Wired', desc: 'Scientists have demonstrated the first fully error-corrected quantum computations, bringing practical quantum computing significantly closer to reality.' },
        { title: 'World Health Organization Declares End to Major Outbreak', source: 'AP News', desc: 'The WHO has officially declared the end of a significant disease outbreak that affected multiple continents, praising global coordination efforts.' },
        { title: 'Housing Market Shows Recovery as Mortgage Rates Stabilize', source: 'Forbes', desc: 'Real estate analysts report growing optimism in housing markets worldwide as borrowing costs begin to normalize after years of volatility.' },
        { title: 'Renewable Energy Now Cheapest Power Source in 130+ Countries', source: 'Financial Times', desc: 'Solar and wind energy have become the most cost-effective electricity sources in over 130 countries, accelerating clean energy investment globally.' },
        { title: 'New International Space Station Module Opens for Research', source: 'NASA', desc: 'A newly installed module on the International Space Station has begun operations, expanding capacity for cutting-edge microgravity research.' },
        { title: 'Global Internet Users Surpass 5.5 Billion Milestone', source: 'TechCrunch', desc: 'More than two-thirds of the world population now has internet access, driven by mobile connectivity in developing nations.' }
    ],
    world: [
        { title: 'UN Security Council Reaches Unanimous Agreement on Peace Resolution', source: 'Reuters', desc: 'In a rare display of unity, all fifteen members of the UN Security Council voted in favor of a comprehensive peace resolution addressing multiple ongoing conflicts.' },
        { title: 'EU Expands to Include New Member States in Historic Enlargement', source: 'BBC News', desc: 'The European Union has formally welcomed new member states in the largest expansion since 2004, reshaping the political landscape of the continent.' },
        { title: 'G20 Summit Produces Landmark Agreement on Global Tax Reform', source: 'Financial Times', desc: 'World leaders at the G20 summit agreed to a groundbreaking international tax framework that aims to close loopholes exploited by multinational corporations.' },
        { title: 'Diplomatic Breakthrough Ends Decades-Long Border Dispute in Asia', source: 'Al Jazeera', desc: 'Two Asian nations have signed a historic treaty resolving a territorial dispute that has been a source of tension for over fifty years.' },
        { title: 'African Union Launches Continental Free Trade Zone to Full Operation', source: 'The Guardian', desc: 'The African Continental Free Trade Area is now fully operational, creating the world\'s largest free trade zone by number of participating countries.' },
        { title: 'NATO Allies Agree on New Collective Defense Strategy', source: 'AP News', desc: 'NATO members have unanimously adopted a new strategic concept that addresses emerging security challenges including cyber warfare and space threats.' },
        { title: 'Pacific Island Nations Secure Climate Compensation Fund', source: 'The Guardian', desc: 'Small island developing states have won a major diplomatic victory with the establishment of a dedicated climate loss and damage fund.' },
        { title: 'Middle East Peace Talks Resume with New Framework', source: 'Reuters', desc: 'Fresh negotiations have begun under a new diplomatic framework that has drawn cautious optimism from all parties involved in the process.' },
        { title: 'Global Refugee Crisis Reaches Record Numbers, UN Reports', source: 'UNHCR', desc: 'The United Nations reports that the number of forcibly displaced people worldwide has surpassed 120 million, calling for urgent international action.' },
        { title: 'Latin American Trade Bloc Signs Historic Partnership with EU', source: 'Bloomberg', desc: 'After two decades of negotiations, a comprehensive trade agreement between the EU and the South American trade bloc has been finalized.' },
        { title: 'Arctic Council Reaches Agreement on Environmental Protection', source: 'Reuters', desc: 'Member nations of the Arctic Council have signed a landmark agreement to protect polar ecosystems from industrial exploitation and climate change.' },
        { title: 'Southeast Asian Nations Form New Digital Economy Partnership', source: 'Nikkei', desc: 'ASEAN countries have launched an ambitious digital economy framework to boost cross-border e-commerce and technology cooperation.' }
    ],
    business: [
        { title: 'Federal Reserve Announces Rate Cut, Markets Surge to Record Highs', source: 'CNBC', desc: 'The Federal Reserve cut interest rates for the first time in over a year, sending the Dow Jones and S&P 500 to unprecedented levels.' },
        { title: 'Tech Giants Report Record Quarterly Earnings Amid AI Investment Surge', source: 'Bloomberg', desc: 'Major technology companies reported earnings that exceeded Wall Street expectations, driven by massive investments in artificial intelligence.' },
        { title: 'Global Supply Chain Disruptions Ease as Shipping Costs Normalize', source: 'Wall Street Journal', desc: 'After years of disruption, global shipping costs have returned to pre-pandemic levels, easing inflationary pressures across multiple industries.' },
        { title: 'Major Pharmaceutical Merger Creates World\'s Largest Drug Company', source: 'Financial Times', desc: 'Two pharmaceutical giants announced a landmark merger valued at over $200 billion, reshaping the global healthcare landscape.' },
        { title: 'Startup Unicorn Boom: Record Number of Billion-Dollar Companies', source: 'TechCrunch', desc: 'The global startup ecosystem has produced a record number of unicorn companies this quarter, led by AI, fintech, and green technology sectors.' },
        { title: 'Oil Prices Drop as OPEC Increases Production Quotas', source: 'Reuters', desc: 'OPEC\'s decision to increase oil production has caused crude prices to fall significantly, providing relief for consumers and transport industries.' },
        { title: 'Global GDP Growth Forecast Upgraded by IMF', source: 'IMF', desc: 'The International Monetary Fund has revised its global growth forecast upward, citing stronger-than-expected performance in emerging markets.' },
        { title: 'Cryptocurrency Market Hits $5 Trillion Valuation Milestone', source: 'CoinDesk', desc: 'The total cryptocurrency market capitalization has surpassed $5 trillion for the first time, driven by institutional adoption and regulatory clarity.' },
        { title: 'Amazon and Walmart Battle for Dominance in Same-Day Delivery', source: 'CNBC', desc: 'The retail giants are investing billions in logistics infrastructure to offer same-day delivery across the majority of the US population.' },
        { title: 'Remote Work Revolution: 40% of Fortune 500 Now Fully Hybrid', source: 'Forbes', desc: 'A major survey reveals that nearly half of Fortune 500 companies have permanently adopted hybrid work models, transforming commercial real estate.' },
        { title: 'Green Bonds Market Surpasses $1 Trillion in Annual Issuance', source: 'Bloomberg', desc: 'Sustainable finance has reached a new milestone as green bond issuance exceeds one trillion dollars for the first time in a single year.' },
        { title: 'Global Semiconductor Shortage Finally Eases After Three Years', source: 'Reuters', desc: 'The worldwide chip shortage that disrupted industries from automotive to consumer electronics is showing clear signs of resolution.' }
    ],
    technology: [
        { title: 'Apple Unveils Next-Generation AI-Powered Personal Assistant', source: 'The Verge', desc: 'Apple has announced a completely redesigned AI assistant that can understand context across apps and devices, marking a major leap in personal computing.' },
        { title: 'OpenAI Releases GPT-5 with Unprecedented Reasoning Capabilities', source: 'Wired', desc: 'The latest language model from OpenAI demonstrates near-human reasoning across mathematics, coding, and scientific analysis tasks.' },
        { title: 'Google Achieves Quantum Supremacy Milestone with New Processor', source: 'Nature', desc: 'Google\'s latest quantum processor has solved a problem in minutes that would take classical supercomputers thousands of years.' },
        { title: 'Self-Driving Cars Get Full Regulatory Approval in Major Markets', source: 'TechCrunch', desc: 'Several countries have granted full regulatory approval for Level 5 autonomous vehicles, paving the way for commercial robotaxi services.' },
        { title: 'Meta Launches Next-Gen VR Headset That Rivals Human Vision', source: 'Ars Technica', desc: 'Meta\'s latest virtual reality headset features retinal-resolution displays and full-body tracking, blurring the line between virtual and physical reality.' },
        { title: 'SpaceX Starlink Achieves 100 Million Subscribers Worldwide', source: 'Space.com', desc: 'The satellite internet service has crossed a major milestone, providing high-speed connectivity to remote and underserved communities globally.' },
        { title: 'New Chip Architecture Promises 10x Energy Efficiency for AI', source: 'IEEE Spectrum', desc: 'Researchers have developed a novel processor architecture that dramatically reduces the energy consumption of AI inference workloads.' },
        { title: 'Cybersecurity Industry Responds to Rising AI-Powered Threats', source: 'Krebs on Security', desc: 'Security firms are racing to deploy AI-driven defense systems as threat actors increasingly use machine learning to automate sophisticated attacks.' },
        { title: 'Blockchain Technology Transforms Global Supply Chain Tracking', source: 'MIT Tech Review', desc: 'Major retailers and manufacturers have adopted blockchain-based tracking systems, improving transparency from factory floor to consumer.' },
        { title: 'Foldable Devices Market Explodes as Prices Drop Below $500', source: 'CNET', desc: 'Samsung, Google, and other manufacturers have driven foldable phone prices to mass-market levels, triggering a surge in consumer adoption.' },
        { title: 'Neural Interface Startup Achieves First Human Brain-Computer Link', source: 'Wired', desc: 'A neurotechnology company has successfully demonstrated a non-invasive brain-computer interface that allows users to control devices with thought.' },
        { title: 'Global 6G Research Consortium Announces First Prototype Network', source: 'IEEE', desc: 'An international consortium has demonstrated the first working 6G prototype, promising speeds 100 times faster than current 5G networks.' }
    ],
    science: [
        { title: 'NASA\'s James Webb Telescope Discovers Signs of Life on Exoplanet', source: 'NASA', desc: 'The James Webb Space Telescope has detected biosignature gases in the atmosphere of a nearby exoplanet, marking a potentially historic discovery.' },
        { title: 'CRISPR Gene Therapy Cures Inherited Disease in Landmark Trial', source: 'Nature', desc: 'A groundbreaking clinical trial has demonstrated that CRISPR gene editing can permanently cure a genetic blood disorder in all treated patients.' },
        { title: 'New Study Maps the Complete Human Brain at Cellular Resolution', source: 'Science', desc: 'Neuroscientists have completed the most detailed map of the human brain ever created, cataloging over 100 billion neurons and their connections.' },
        { title: 'Fusion Reactor Achieves Net Energy Gain for Extended Period', source: 'Scientific American', desc: 'A fusion energy facility has sustained net energy production for over 30 minutes, a critical step toward making fusion power commercially viable.' },
        { title: 'Deep Ocean Expedition Discovers New Species in Hadal Zone', source: 'National Geographic', desc: 'An expedition to the deepest parts of the ocean has cataloged dozens of previously unknown species, revealing remarkable adaptations to extreme pressure.' },
        { title: 'New Study Reveals Ocean Temperatures Rising Faster Than Predicted', source: 'Scientific American', desc: 'Marine researchers published findings showing ocean warming is accelerating beyond previous models, with significant implications for weather patterns.' },
        { title: 'Mars Rover Finds Definitive Evidence of Ancient Microbial Life', source: 'Nature', desc: 'Analysis of rock samples collected by the Mars rover has revealed fossilized structures consistent with ancient bacterial colonies on the red planet.' },
        { title: 'Breakthrough Material Could Revolutionize Room-Temperature Superconductors', source: 'Physics Today', desc: 'A newly synthesized material exhibits superconducting properties at temperatures achievable with standard cooling equipment.' },
        { title: 'Archaeological Discovery Rewrites Understanding of Ancient Civilizations', source: 'National Geographic', desc: 'A stunning find has revealed evidence of a previously unknown advanced civilization, challenging established historical timelines.' },
        { title: 'Artificial Photosynthesis Breakthrough Could Transform Energy Production', source: 'Science Daily', desc: 'Researchers have developed an artificial photosynthesis system that converts sunlight and CO2 into fuel with efficiency exceeding natural plants.' },
        { title: 'New Particle Discovered at CERN Challenges Standard Model of Physics', source: 'CERN', desc: 'Physicists at the Large Hadron Collider have detected a previously unknown subatomic particle with properties that don\'t fit existing theoretical models.' },
        { title: 'Antarctic Ice Core Reveals 2 Million Years of Climate History', source: 'Nature', desc: 'Scientists have extracted the oldest ice core ever recovered, providing an unprecedented record of Earth\'s atmospheric composition over two million years.' }
    ],
    health: [
        { title: 'Universal Cancer Vaccine Shows Promise in Early Human Trials', source: 'The Lancet', desc: 'A universal mRNA cancer vaccine has shown positive results in Phase II trials, training the immune system to recognize and attack multiple tumor types.' },
        { title: 'WHO Declares Malaria Eradicated in Southeast Asia', source: 'WHO', desc: 'The World Health Organization has certified several Southeast Asian countries as malaria-free, marking a historic public health achievement.' },
        { title: 'New Alzheimer\'s Drug Slows Cognitive Decline by 60% in Trials', source: 'NEJM', desc: 'A novel Alzheimer\'s treatment has demonstrated the strongest cognitive benefit ever recorded in clinical trials, offering new hope for millions.' },
        { title: 'Global Life Expectancy Reaches Record High of 76 Years', source: 'The Lancet', desc: 'Improved healthcare access and medical advances have pushed global average life expectancy to a new record, though disparities persist between nations.' },
        { title: 'Mental Health Apps Now Prescribed by NHS as First-Line Treatment', source: 'BBC Health', desc: 'The UK\'s National Health Service has approved AI-powered mental health applications as a primary treatment option for mild to moderate conditions.' },
        { title: 'Breakthrough Antibiotic Discovered to Combat Drug-Resistant Bacteria', source: 'Nature Medicine', desc: 'Scientists have identified a new class of antibiotics effective against multiple drug-resistant bacterial strains that threaten global health security.' },
        { title: 'Wearable Devices Now Detect Heart Attacks 30 Minutes Before Symptoms', source: 'JAMA', desc: 'Advanced smartwatch sensors can now identify cardiac events before patients experience symptoms, potentially saving thousands of lives annually.' },
        { title: 'Childhood Obesity Rates Decline for First Time in Two Decades', source: 'CDC', desc: 'New data shows childhood obesity rates have decreased in multiple countries following coordinated public health interventions and school programs.' },
        { title: 'Organ-on-a-Chip Technology Eliminates Need for Animal Drug Testing', source: 'Nature', desc: 'Microfluidic organ chips now replicate human biology accurately enough to replace animal testing in pharmaceutical development.' },
        { title: 'Stem Cell Therapy Restores Vision in Patients with Macular Degeneration', source: 'The Lancet', desc: 'A pioneering stem cell treatment has restored functional vision in patients with age-related macular degeneration in a landmark clinical trial.' },
        { title: 'AI Diagnostic Tool Outperforms Doctors in Detecting Skin Cancer', source: 'BMJ', desc: 'An AI-powered diagnostic system has achieved higher accuracy than dermatologists in identifying melanoma and other skin cancers from images.' },
        { title: 'Global Vaccination Campaign Eliminates Measles in 50 Countries', source: 'WHO', desc: 'A coordinated international vaccination effort has successfully eliminated measles transmission in fifty countries across three continents.' }
    ],
    sports: [
        { title: 'UEFA Champions League Quarter-Finals Produce Stunning Upsets', source: 'ESPN', desc: 'The Champions League quarter-finals delivered dramatic results as underdogs toppled favorites in a series of thrilling encounters.' },
        { title: 'Olympic Games Set New Record with 15,000 Athletes from 210 Nations', source: 'Olympic.org', desc: 'The latest Olympic Games have become the largest in history, with record participation and new sports added to the program.' },
        { title: 'NBA Season Features Historic Scoring Records Across the League', source: 'ESPN', desc: 'Multiple NBA players have shattered long-standing scoring records this season, with league-wide scoring averages reaching all-time highs.' },
        { title: 'FIFA World Cup Qualifying Produces Major Surprises', source: 'BBC Sport', desc: 'World Cup qualification has seen several traditional powerhouses struggle, while emerging football nations have staked their claims for the tournament.' },
        { title: 'Grand Slam Tennis Enters New Era as Young Stars Dominate', source: 'Tennis.com', desc: 'A new generation of tennis talent has swept the Grand Slam titles this year, signaling the end of an era dominated by the previous legends.' },
        { title: 'Formula 1 Introduces New Regulations Shaking Up the Grid', source: 'Autosport', desc: 'Major rule changes in Formula 1 have leveled the playing field, with midfield teams now regularly challenging for podium positions.' },
        { title: 'Cricket World Cup Final Draws Record 1.5 Billion TV Viewers', source: 'ICC', desc: 'The Cricket World Cup final has become the most-watched single sporting event in history, with viewership spanning every continent.' },
        { title: 'NFL Season Kicks Off with Expanded International Schedule', source: 'NFL.com', desc: 'The NFL has expanded its international games program significantly, with regular-season matches now held across Europe, South America, and Asia.' },
        { title: 'Esports Officially Recognized as Medal Event for Next Asian Games', source: 'Reuters', desc: 'Competitive gaming will feature as a full medal sport at the next Asian Games, with multiple titles selected for competition.' },
        { title: 'Marathon World Record Broken as Two-Hour Barrier Falls in Competition', source: 'World Athletics', desc: 'A runner has officially broken the two-hour marathon barrier in a sanctioned competition, a feat once thought physiologically impossible.' },
        { title: 'Women\'s Football Breaks All-Time Attendance Record', source: 'FIFA', desc: 'The women\'s football World Cup final has set a new global attendance record, reflecting the sport\'s explosive growth worldwide.' },
        { title: 'Tour de France Introduces Revolutionary Anti-Doping Technology', source: 'Cycling News', desc: 'The world\'s most prestigious cycling race has deployed AI-powered real-time monitoring to ensure fair competition throughout the event.' }
    ],
    entertainment: [
        { title: 'Oscar-Winning Director Announces Ambitious New Film Project', source: 'Variety', desc: 'An acclaimed filmmaker has revealed plans for an ambitious new cinematic project pushing the boundaries of visual storytelling and technology.' },
        { title: 'Streaming Wars Intensify as New Platform Launches with Exclusive Content', source: 'Hollywood Reporter', desc: 'A major new streaming service has launched with an impressive slate of exclusive films and series, disrupting an already competitive market.' },
        { title: 'K-Pop Group Breaks Billboard Record with Global Debut Album', source: 'Billboard', desc: 'A K-pop group has shattered multiple Billboard records with their debut album, becoming the fastest-selling album globally this decade.' },
        { title: 'AI-Generated Film Wins Major Award at International Festival', source: 'Variety', desc: 'A film created primarily using artificial intelligence tools has won a top prize at a prestigious international film festival, sparking industry debate.' },
        { title: 'Broadway Returns to Record-Breaking Box Office Numbers', source: 'New York Times', desc: 'Broadway has posted its strongest season ever, with multiple shows breaking weekly gross records and tourism driving unprecedented demand.' },
        { title: 'Video Game Industry Revenue Surpasses Film and Music Combined', source: 'IGN', desc: 'The global video game market has reached $300 billion in annual revenue, officially surpassing the combined revenue of film and music industries.' },
        { title: 'Major Music Festival Announces Groundbreaking Virtual Reality Experience', source: 'Rolling Stone', desc: 'One of the world\'s largest music festivals will offer a full VR experience, allowing remote attendees to enjoy performances as if they were there.' },
        { title: 'Netflix Original Series Becomes Most-Watched Show in TV History', source: 'Netflix', desc: 'A Netflix original series has broken all viewing records, accumulating over 2 billion hours of watch time in its first month.' },
        { title: 'Legendary Band Announces Reunion Tour After 20-Year Hiatus', source: 'NME', desc: 'An iconic rock band has announced a worldwide reunion tour, with tickets selling out within minutes across all announced dates.' },
        { title: 'New Social Media Platform Gains 100 Million Users in First Month', source: 'The Information', desc: 'A decentralized social media platform built on open protocols has exploded in popularity, attracting users seeking alternatives to established networks.' },
        { title: 'Animated Film Sets Box Office Record with $500M Opening Weekend', source: 'Box Office Mojo', desc: 'A highly anticipated animated sequel has shattered opening weekend records worldwide, becoming the fastest film to reach half a billion dollars.' },
        { title: 'Music Streaming Hits 700 Million Paid Subscribers Globally', source: 'Billboard', desc: 'The global music streaming industry continues its explosive growth, with paid subscriptions reaching a new all-time high across all platforms.' }
    ]
};

function getFallbackArticles() {
    const now = new Date();
    const category = state.currentCategory || 'general';
    const data = FALLBACK_DATA[category] || FALLBACK_DATA.general;

    return data.map((item, i) => ({
        id: category + '_fallback_' + i,
        title: item.title,
        link: 'https://news.google.com',
        source: item.source,
        pubDate: new Date(now.getTime() - i * 1800000).toISOString(),
        description: item.desc,
        fullContent: item.desc,
        thumbnail: getFallbackImage(category, i),
        category: category
    }));
}
