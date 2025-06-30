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

function addFilm() {
  const title = document.getElementById("titleInput").value;
  const type = document.getElementById("typeInput").value;

  if (!title || currentRating === 0) return alert("Titre et note requis");

  fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(title)}`)
    .then(res => res.json())
    .then(data => {
      const result = data.results[0];
      if (!result) return alert("Aucun résultat");

      const poster = result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : "";
      const fullUrl = `https://api.themoviedb.org/3/${type}/${result.id}?api_key=${API_KEY}`;

      fetch(fullUrl)
        .then(res2 => res2.json())
        .then(details => {
          const genres = details.genres.map(g => g.name).join(", ");
          const newFilm = {
            id: Date.now(),
            title: result.title || result.name,
            poster,
            type,
            genre: genres.toLowerCase(),
            rating: currentRating,
            top: currentRating === 5
          };
          films.push(newFilm);
          localStorage.setItem("films", JSON.stringify(films));
          currentRating = 0;
          updateStars();
          renderGallery();
        });
    });
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

function deleteFilm(id) {
  films = films.filter(film => film.id !== id);
  localStorage.setItem("films", JSON.stringify(films));
  renderGallery();
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
