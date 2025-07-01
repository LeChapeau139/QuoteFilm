const API_KEY = "fd846ff36eb8355715e4264b7eb28912";
let films = JSON.parse(localStorage.getItem("films") || "[]");
let currentRating = 0;
let galleryFilter = 'all';
let carouselInterval;

// === THEME SWITCHING ===
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

function setTheme(theme) {
  if (theme === 'dark') {
    body.classList.add('dark-theme');
    body.classList.remove('light-theme');
    themeToggle.textContent = '🌙';
  } else {
    body.classList.remove('dark-theme');
    body.classList.add('light-theme');
    themeToggle.textContent = '☀️';
  }
  localStorage.setItem('theme', theme);
}

function getPreferredTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function toggleTheme() {
  const current = body.classList.contains('dark-theme') ? 'dark' : 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
  setTheme(getPreferredTheme());
}

function showAddForm() {
  document.getElementById("addForm").style.display = "flex";
}

// Gestion des étoiles
document.querySelectorAll(".star").forEach(star => {
  star.addEventListener("click", () => {
    currentRating = parseInt(star.getAttribute("data-value"));
    updateStars();
  });
});

function updateStars() {
  document.querySelectorAll(".star").forEach(star => {
    const value = parseInt(star.getAttribute("data-value"));
    star.classList.toggle("selected", value <= currentRating);
  });
}

// === SUPABASE FILMS ===
async function fetchFilms() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  let { data, error } = await supabase
    .from('films')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return alert(error.message);
  films = data || [];
  renderGallery();
}

async function addFilm() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return alert('Connecte-toi !');
  const title = document.getElementById("titleInput").value;
  const type = document.getElementById("typeInput").value;
  if (!title || currentRating === 0) return alert("Titre et note requis");

  // Recherche TMDB comme avant
  const searchRes = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(title)}`);
  const searchData = await searchRes.json();
  const result = searchData.results[0];
  if (!result) return alert("Aucun résultat");
  const poster = result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : "";
  const fullUrl = `https://api.themoviedb.org/3/${type}/${result.id}?api_key=${API_KEY}`;
  const translationsUrl = `https://api.themoviedb.org/3/${type}/${result.id}/translations?api_key=${API_KEY}`;
  const [details, translations] = await Promise.all([
    fetch(fullUrl).then(res2 => res2.json()),
    fetch(translationsUrl).then(res3 => res3.json())
  ]);
  const genres = details.genres.map(g => g.name).join(", ");
  let frenchTitle = result.title || result.name;
  if (translations && translations.translations) {
    const fr = translations.translations.find(t => t.iso_639_1 === 'fr');
    if (fr && fr.data && fr.data.title) {
      frenchTitle = fr.data.title;
    }
  }
  const newFilm = {
    title: frenchTitle,
    poster,
    type,
    genre: genres.toLowerCase(),
    rating: currentRating,
    user_id: user.id
  };
  let { error } = await supabase.from('films').insert([newFilm]);
  if (error) return alert(error.message);
  currentRating = 0;
  updateStars();
  fetchFilms();
}

async function deleteFilm(id) {
  await supabase.from('films').delete().eq('id', id);
  fetchFilms();
}

function setGalleryFilter(filter, btn) {
  galleryFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderGallery();
}

function renderGallery() {
  const gallery = document.getElementById("gallery");
  const topList = document.getElementById("topList");

  gallery.innerHTML = "";
  topList.innerHTML = "";

  // Always show all 5-star films/series in topList
  films.filter(film => film.rating === 5).forEach(film => {
    const topImg = document.createElement("img");
    topImg.src = film.poster;
    topImg.alt = film.title;
    topList.appendChild(topImg);
  });

  films.forEach(film => {
    if (galleryFilter !== 'all' && film.type !== galleryFilter) return;
    const item = document.createElement("div");
    item.className = "gallery-item";
    item.innerHTML = `
      <button class="delete-film-btn" title="Supprimer" onclick="deleteFilm(${film.id})">×</button>
      <img src="${film.poster}" alt="${film.title}" />
      <div><strong>${film.title}</strong></div>
      <div>${film.genre}</div>
      <div class="stars">${"★".repeat(film.rating)}${"☆".repeat(5 - film.rating)}</div>
    `;
    gallery.appendChild(item);
  });

  startCarouselAutoScroll();
}

function scrollTopList(direction) {
  const topList = document.getElementById('topList');
  const scrollAmount = 180 + 16; // image width + gap
  topList.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

function startCarouselAutoScroll() {
  stopCarouselAutoScroll();
  const topList = document.getElementById('topList');
  if (!topList) return;
  carouselInterval = setInterval(() => {
    const scrollAmount = topList.querySelector('img') ? topList.querySelector('img').offsetWidth + 16 : 166;
    if (topList.scrollLeft + topList.offsetWidth >= topList.scrollWidth - 1) {
      // Loop back to start
      topList.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      topList.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }, 2500);
}

function stopCarouselAutoScroll() {
  if (carouselInterval) clearInterval(carouselInterval);
}

document.addEventListener('DOMContentLoaded', () => {
  const topList = document.getElementById('topList');
  if (topList) {
    topList.addEventListener('mouseenter', stopCarouselAutoScroll);
    topList.addEventListener('mouseleave', startCarouselAutoScroll);
    startCarouselAutoScroll();
  }
});

// Also restart auto-scroll after renderGallery
const originalRenderGallery = renderGallery;
renderGallery = function() {
  originalRenderGallery.apply(this, arguments);
  startCarouselAutoScroll();
};

renderGallery();

// === AUTOCOMPLETE ===
const titleInput = document.getElementById('titleInput');
const autocompleteList = document.getElementById('autocomplete-list');
let autocompleteResults = [];
let autocompleteActive = -1;

if (titleInput && autocompleteList) {
  titleInput.addEventListener('input', async function() {
    const query = this.value.trim();
    // Determine type from active button
    let type = 'movie';
    const btnMovie = document.getElementById('btn-movie');
    if (btnMovie && !btnMovie.classList.contains('active')) type = 'tv';
    if (query.length < 2) {
      autocompleteList.style.display = 'none';
      return;
    }
    const url = `https://api.themoviedb.org/3/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();
    autocompleteResults = (data.results || []).slice(0, 8);
    if (autocompleteResults.length === 0) {
      autocompleteList.style.display = 'none';
      return;
    }
    autocompleteList.innerHTML = autocompleteResults.map((item, i) =>
      `<div class="autocomplete-item${i === 0 ? ' active' : ''}" data-index="${i}">${item.title || item.name}</div>`
    ).join('');
    autocompleteList.style.display = 'block';
    autocompleteActive = 0;
  });

  autocompleteList.addEventListener('mousedown', function(e) {
    if (e.target.classList.contains('autocomplete-item')) {
      const idx = +e.target.getAttribute('data-index');
      if (autocompleteResults[idx]) {
        titleInput.value = autocompleteResults[idx].title || autocompleteResults[idx].name;
        autocompleteList.style.display = 'none';
      }
    }
  });

  titleInput.addEventListener('keydown', function(e) {
    if (!autocompleteResults.length || autocompleteList.style.display === 'none') return;
    if (e.key === 'ArrowDown') {
      autocompleteActive = (autocompleteActive + 1) % autocompleteResults.length;
      updateAutocompleteActive();
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      autocompleteActive = (autocompleteActive - 1 + autocompleteResults.length) % autocompleteResults.length;
      updateAutocompleteActive();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (autocompleteActive >= 0 && autocompleteResults[autocompleteActive]) {
        titleInput.value = autocompleteResults[autocompleteActive].title || autocompleteResults[autocompleteActive].name;
        autocompleteList.style.display = 'none';
        e.preventDefault();
      }
    }
  });

  document.addEventListener('click', function(e) {
    if (!autocompleteList.contains(e.target) && e.target !== titleInput) {
      autocompleteList.style.display = 'none';
    }
  });

  function updateAutocompleteActive() {
    Array.from(autocompleteList.children).forEach((el, i) => {
      el.classList.toggle('active', i === autocompleteActive);
    });
  }
}

// === SUPABASE AUTH ===
async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    document.getElementById('login-error').textContent = error.message;
  } else {
    showMainApp();
  }
}

async function signup() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    document.getElementById('login-error').textContent = error.message;
  } else {
    showMainApp();
  }
}

async function logout() {
  await supabase.auth.signOut();
  showMainApp();
}

async function showMainApp() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    fetchFilms();
  } else {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', showMainApp);
