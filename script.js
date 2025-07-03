const TMDB_API_KEY = 'fd846ff36eb8355715e4264b7eb28912';
let films = [];
let currentRating = 0;
let galleryFilter = 'all';
let carouselInterval;
let currentProfileId = null;
let myProfile = null;
let ratingFilter = null;
let searchQuery = '';
let selectedSuggestion = null;
let allUsersCache = [];
let ratingOverlay = null; // Overlay global pour la popup de note

const allAvatars = [
  'batman.svg',
  'c-3po.svg',
  'dark-vador.svg',
  'marge-simpson.svg',
  'rick-sanchez.svg',
  'schtroumpf.svg',
  'scooby-doo.svg',
  'shrek.svg',
  'sonic.svg',
  'spider-man.svg',
  'stitch.svg',
  'thor.svg',
  'totoro.svg'
];

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
    .from('film_collection')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return alert(error.message);
  films = data || [];
  renderGallery();
  if (myProfile && currentProfileId === myProfile.id) {
    showProfileSidebar(myProfile);
  }
}

function capitalizeWords(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function showToast(message) {
  let toast = document.getElementById('toast-message');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-message';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

async function addFilm() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return showToast('Connecte-toi !');
  if (!selectedSuggestion) return showToast('Sélectionne un film ou une série dans la liste.');
  const type = selectedSuggestion._type;
  const tmdbId = selectedSuggestion.id;
  // Récupère toutes les infos détaillées depuis TMDb
  let details, translations;
  if (type === 'movie') {
    [details, translations] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`).then(res => res.json()),
      fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/translations?api_key=${TMDB_API_KEY}`).then(res => res.json())
    ]);
  } else {
    [details, translations] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`).then(res => res.json()),
      fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/translations?api_key=${TMDB_API_KEY}`).then(res => res.json())
    ]);
  }
  // Titre FR officiel
  let titleFr = details.title || details.name;
  if (translations && translations.translations) {
    const fr = translations.translations.find(t => t.iso_639_1 === 'fr');
    if (fr && fr.data && fr.data.title) titleFr = fr.data.title;
    if (fr && fr.data && fr.data.name) titleFr = fr.data.name;
  }
  // Prépare les champs
  const poster = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '';
  const genres = (details.genres || []).map(g => g.name).join(', ');
  const overview = details.overview || '';
  const runtime = details.runtime || (details.episode_run_time ? details.episode_run_time[0] : null);
  const release_date = details.release_date || details.first_air_date || null;
  const casting = (details.credits && details.credits.cast)
    ? details.credits.cast.slice(0, 10).map(actor => ({
        name: actor.name,
        profile_path: actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null
      }))
    : [];
  const original_title = details.original_title || details.original_name || null;

  // Vérifie si le film existe déjà pour cet utilisateur
  const { data: existing } = await supabase
    .from('film_collection')
    .select('id')
    .eq('user_id', user.id)
    .eq('tmdb_id', tmdbId)
    .single();
  if (existing) {
    showToast('Ce film/série est déjà dans ta collection !');
    return;
  }

  const newFilm = {
    user_id: user.id,
    pseudo: myProfile ? myProfile.pseudo : null,
    tmdb_id: tmdbId,
    type,
    title: titleFr,
    original_title,
    poster,
    genre: genres,
    overview,
    casting,
    runtime,
    release_date,
    rating: currentRating,
    created_at: new Date().toISOString()
  };
  let { error } = await supabase.from('film_collection').insert([newFilm]);
  if (error) return showToast(error.message);
  currentRating = 0;
  updateStars();
  selectedSuggestion = null;
  fetchFilms();
}

async function deleteFilm(id) {
  // Empêche la suppression si on n'est pas sur son propre profil
  if (currentProfileId && myProfile && currentProfileId !== myProfile.id) {
    return;
  }
  await supabase.from('film_collection').delete().eq('id', id);
  fetchFilms();
}

function setRatingFilter(rating, btn) {
  if (ratingFilter === rating) {
    ratingFilter = null;
    btn.classList.remove('active');
    btn.blur();
  } else {
    ratingFilter = rating;
    document.querySelectorAll('.gallery-filters .filter-btn').forEach(b => {
      if (b.getAttribute('data-filter') == rating) b.classList.add('active');
      else if (!['all','movie','tv'].includes(b.getAttribute('data-filter'))) b.classList.remove('active');
    });
  }
  renderGallery();
}

function setGalleryFilter(filter, btn) {
  galleryFilter = filter;
  document.querySelectorAll('.gallery-filters .filter-btn').forEach(b => {
    if (b.getAttribute('data-filter') === filter) b.classList.add('active');
    else if (['all','movie','tv'].includes(b.getAttribute('data-filter'))) b.classList.remove('active');
  });
  renderGallery();
}

function searchGallery(e) {
  e.preventDefault();
  const input = document.getElementById('gallery-search-input');
  searchQuery = input.value.trim().toLowerCase();
  renderGallery();
}

function showMyViewDetail(film) {
  // Crée le popup
  const popup = document.createElement('div');
  popup.className = 'movie-detail-popup';
  popup.innerHTML = `
    <div class="movie-detail-content">
      <button class="movie-detail-close">&times;</button>
      <div class="movie-detail-header" style="background-image: url('${film.poster}')">
        <div class="movie-detail-header-content">
          <h1 class="movie-detail-title">${film.title}</h1>
          <div class="movie-detail-meta">
            <span>${film.type === 'movie' ? '🎬 Film' : '📺 Série'}</span>
            <span>•</span>
            <span>${film.release_date ? new Date(film.release_date).getFullYear() : ''}</span>
            <span>•</span>
            <span>${film.runtime ? (film.runtime + ' min') : ''}</span>
            <span>•</span>
            <span>${film.genre || ''}</span>
          </div>
        </div>
      </div>
      <div class="movie-detail-actions">
        <button class="movie-detail-btn" id="popup-edit-rating-btn">Modifier la note</button>
      </div>
      <div class="movie-detail-body">
        <div class="movie-detail-user-rating" style="text-align:center;margin-bottom:1.5em;">
          <span class="stars" style="font-size:1.7em;">${'★'.repeat(film.rating)}${'☆'.repeat(5-film.rating)}</span>
          <span class="real-rating" style="font-size:1.2em;">${film.rating}/5</span>
        </div>
        <p class="movie-detail-overview">${film.overview ? film.overview : 'Aucun résumé disponible.'}</p>
        ${film.casting && film.casting.length > 0 ? `
          <div class="movie-detail-cast">
            <h3>Distribution</h3>
            <div class="cast-grid">
              ${film.casting.map(actor => `
                <div class="cast-item">
                  <img class="cast-photo" src="${actor.profile_path || 'images/avatar.jpg'}" alt="${actor.name}" />
                  <div class="cast-name">${actor.name}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(popup);
  document.body.style.overflow = 'hidden';
  // Fermeture du popup
  const closeBtn = popup.querySelector('.movie-detail-close');
  closeBtn.onclick = () => { popup.remove(); document.body.style.overflow = ''; if (ratingOverlay) { ratingOverlay.remove(); ratingOverlay = null; } };
  popup.onclick = (e) => {
    if (e.target === popup) { popup.remove(); document.body.style.overflow = ''; if (ratingOverlay) { ratingOverlay.remove(); ratingOverlay = null; } }
  };
  // Fermeture avec Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      popup.remove();
      document.body.style.overflow = '';
      if (ratingOverlay) { ratingOverlay.remove(); ratingOverlay = null; }
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
  // Bouton modifier la note
  const editBtn = popup.querySelector('#popup-edit-rating-btn');
  if (editBtn) {
    editBtn.onclick = () => {
      // Ajoute un overlay pour griser la fiche
      ratingOverlay = document.createElement('div');
      ratingOverlay.style.position = 'fixed';
      ratingOverlay.style.top = 0;
      ratingOverlay.style.left = 0;
      ratingOverlay.style.width = '100vw';
      ratingOverlay.style.height = '100vh';
      ratingOverlay.style.background = 'rgba(0,0,0,0.45)';
      ratingOverlay.style.zIndex = 2001;
      document.body.appendChild(ratingOverlay);
      // Affiche la popup de note devant
      openEditRatingModal(film.id, film.rating);
      // Place la modale devant
      const modal = document.getElementById('edit-rating-modal');
      if (modal) {
        modal.style.zIndex = 2002;
      }
    };
  }
}

// Toast "Fait" générique
function showToastFait() {
  let toast = document.createElement('div');
  toast.className = 'fait-toast';
  toast.textContent = 'Fait ✔️';
  toast.style.position = 'fixed';
  toast.style.bottom = '40px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.background = '#181818';
  toast.style.color = '#fff';
  toast.style.fontWeight = 'bold';
  toast.style.fontSize = '1.2em';
  toast.style.padding = '0.8em 2em';
  toast.style.borderRadius = '999px';
  toast.style.boxShadow = '0 2px 16px rgba(0,0,0,0.18)';
  toast.style.zIndex = 3000;
  toast.style.opacity = 0;
  toast.style.transition = 'opacity 0.4s, bottom 0.4s';
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = 1; toast.style.bottom = '60px'; }, 10);
  setTimeout(() => { toast.style.opacity = 0; toast.style.bottom = '40px'; }, 2500);
  setTimeout(() => { if (toast) toast.remove(); }, 3000);
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
    topImg.alt = capitalizeWords(film.title);
    topList.appendChild(topImg);
  });

  films.forEach(film => {
    if (galleryFilter !== 'all' && film.type !== galleryFilter) return;
    if (ratingFilter && film.rating !== ratingFilter) return;
    if (searchQuery && !(
      (film.title && film.title.toLowerCase().includes(searchQuery)) ||
      (film.genre && film.genre.toLowerCase().includes(searchQuery))
    )) return;
    const item = document.createElement("div");
    item.className = "myviews-card";
    item.innerHTML = `
      <button class="delete-film-btn" title="Supprimer" onclick="deleteFilm('${film.id}')">×</button>
      <img src="${film.poster}" alt="${capitalizeWords(film.title)}" />
      <div><strong>${capitalizeWords(film.title)}</strong></div>
      <div>${capitalizeWords(film.genre)}</div>
      <div class="stars">${"★".repeat(film.rating)}${"☆".repeat(5 - film.rating)}</div>
    `;
    // Ajout du gestionnaire de clic pour ouvrir la popup détail (hors clic sur les boutons)
    item.addEventListener('click', function(e) {
      if (
        e.target.classList.contains('delete-film-btn')
      ) return;
      showMyViewDetail(film);
    });
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

  // Switch entre connexion et inscription
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const showSignupBtn = document.getElementById('show-signup');
  const showLoginBtn = document.getElementById('show-login');
  if (showSignupBtn) showSignupBtn.addEventListener('click', () => {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
  });
  if (showLoginBtn) showLoginBtn.addEventListener('click', () => {
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
  });

  // Gestion du submit connexion
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await login();
    });
  }
  // Gestion du submit inscription
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await signup();
    });
  }

  // Sélection d'avatar à l'inscription
  const avatarOptions = document.querySelectorAll('.avatar-option');
  const selectedAvatarInput = document.getElementById('selected-avatar');
  if (avatarOptions.length && selectedAvatarInput) {
    avatarOptions.forEach(img => {
      img.addEventListener('click', () => {
        avatarOptions.forEach(i => i.classList.remove('selected'));
        img.classList.add('selected');
        if (img.dataset.avatar) {
          selectedAvatarInput.value = img.getAttribute('data-avatar');
          // Si on clique sur un avatar rapide, on remet les 3 points si ce n'est pas l'avatar personnalisé
          const avatarMoreDiv = document.getElementById('avatar-more');
          if (avatarMoreDiv && img !== avatarMoreDiv) {
            avatarMoreDiv.innerHTML = '&#8230;';
            avatarMoreDiv.classList.remove('avatar-more-img');
            avatarMoreDiv.removeAttribute('data-avatar');
          }
        }
      });
      img.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          img.click();
        }
      });
    });
    // Sélectionne le premier par défaut
    avatarOptions[0].classList.add('selected');
  }

  // --- Gestion de la popup d'avatars ---
  const avatarMore = document.getElementById('avatar-more');
  const avatarModal = document.getElementById('avatar-modal');
  const avatarModalList = document.getElementById('avatar-modal-list');
  const avatarModalClose = document.getElementById('avatar-modal-close');

  if (avatarMore && avatarModal && avatarModalList) {
    function setAvatarMoreAs(imgSrc, avatarFile) {
      avatarMore.innerHTML = `<img src="images/avatars/${avatarFile}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Avatar choisi" />`;
      avatarMore.classList.add('avatar-more-img');
      avatarMore.setAttribute('data-avatar', avatarFile);
    }
    avatarMore.addEventListener('click', () => {
      avatarModalList.innerHTML = allAvatars.map(file =>
        `<img src="images/avatars/${file}" class="avatar-modal-avatar" data-avatar="${file}" tabindex="0" alt="Avatar" />`
      ).join('');
      avatarModal.style.display = 'flex';
      // Sélection visuelle de l'avatar courant
      const current = selectedAvatarInput.value;
      avatarModalList.querySelectorAll('.avatar-modal-avatar').forEach(img => {
        if (img.getAttribute('data-avatar') === current) {
          img.classList.add('selected');
        }
        img.addEventListener('click', () => {
          // Met à jour la sélection dans le formulaire principal
          selectedAvatarInput.value = img.getAttribute('data-avatar');
          // Met à jour la sélection rapide
          document.querySelectorAll('.avatar-option').forEach(opt => {
            opt.classList.remove('selected');
          });
          setAvatarMoreAs(img.src, img.getAttribute('data-avatar'));
          avatarMore.classList.add('selected');
          avatarModal.style.display = 'none';
        });
        img.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            img.click();
          }
        });
      });
    });
    // Permet de re-ouvrir la popup si on clique sur l'avatar personnalisé
    avatarMore.addEventListener('click', () => {
      if (avatarMore.classList.contains('avatar-more-img')) {
        avatarModal.style.display = 'flex';
      }
    });
    // Fermer la popup
    if (avatarModalClose) {
      avatarModalClose.addEventListener('click', () => {
        avatarModal.style.display = 'none';
      });
    }
    // Fermer la popup si on clique en dehors
    avatarModal.addEventListener('click', (e) => {
      if (e.target === avatarModal) avatarModal.style.display = 'none';
    });
  }

  // --- Gestion du changement d'avatar depuis le profil ---
  const editAvatarBtn = document.getElementById('edit-avatar-btn');
  if (editAvatarBtn && avatarModal && avatarModalList) {
    editAvatarBtn.addEventListener('click', () => {
      // Affiche tous les avatars dans le modal
      avatarModalList.innerHTML = allAvatars.map(file =>
        `<img src="images/avatars/${file}" class="avatar-modal-avatar" data-avatar="${file}" tabindex="0" alt="Avatar" />`
      ).join('');
      avatarModal.style.display = 'flex';
      // Sélection visuelle de l'avatar courant
      const avatarImg = document.querySelector('.avatar-img');
      let current = '';
      if (avatarImg && avatarImg.src) {
        const match = avatarImg.src.match(/avatars\/([^\/]+\.svg)/);
        if (match) current = match[1];
      }
      avatarModalList.querySelectorAll('.avatar-modal-avatar').forEach(img => {
        if (img.getAttribute('data-avatar') === current) {
          img.classList.add('selected');
        }
        img.addEventListener('click', async () => {
          // Met à jour l'avatar dans Supabase
          if (!myProfile) return;
          const newAvatar = img.getAttribute('data-avatar');
          const { error } = await supabase
            .from('profiles')
            .update({ avatar: newAvatar })
            .eq('id', myProfile.id);
          if (!error) {
            myProfile.avatar = newAvatar;
            showProfileSidebar(myProfile);
            // Met à jour l'avatar du bouton HOME
            const homeBtnAvatar = document.getElementById('homeBtnAvatar');
            if (homeBtnAvatar) homeBtnAvatar.src = `images/avatars/${newAvatar}`;
          } else {
            alert("Erreur lors de la mise à jour de l'avatar : " + error.message);
          }
          avatarModal.style.display = 'none';
        });
        img.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            img.click();
          }
        });
      });
    });
    // Fermer la popup
    if (avatarModalClose) {
      avatarModalClose.addEventListener('click', () => {
        avatarModal.style.display = 'none';
      });
    }
    avatarModal.addEventListener('click', (e) => {
      if (e.target === avatarModal) avatarModal.style.display = 'none';
    });
  }

  // === MODAL MODIFICATION DE NOTE ===
  let editingFilmId = null;
  let editingRating = 0;

  function openEditRatingModal(filmId, currentRating) {
    editingFilmId = filmId;
    editingRating = currentRating;
    const modal = document.getElementById('edit-rating-modal');
    modal.style.display = 'flex';
    updateModalStars();
  }

  function closeEditRatingModal() {
    document.getElementById('edit-rating-modal').style.display = 'none';
    editingFilmId = null;
    editingRating = 0;
  }

  function updateModalStars() {
    const stars = document.querySelectorAll('.modal-star');
    stars.forEach(star => {
      const value = parseInt(star.getAttribute('data-value'));
      if (value <= editingRating) {
        star.classList.add('selected');
        star.textContent = '★';
      } else {
        star.classList.remove('selected');
        star.textContent = '☆';
      }
    });
  }

  // Gestion sélection étoiles
  const modalStars = document.querySelectorAll('.modal-star');
  modalStars.forEach(star => {
    star.addEventListener('mouseenter', function() {
      const value = parseInt(this.getAttribute('data-value'));
      updateModalStarsHover(value);
    });
    star.addEventListener('mouseleave', function() {
      updateModalStars();
    });
    star.addEventListener('click', function() {
      editingRating = parseInt(this.getAttribute('data-value'));
      updateModalStars();
    });
  });

  function updateModalStarsHover(hoverValue) {
    document.querySelectorAll('.modal-star').forEach(star => {
      const value = parseInt(star.getAttribute('data-value'));
      if (value <= hoverValue) {
        star.classList.add('selected');
        star.textContent = '★';
      } else {
        star.classList.remove('selected');
        star.textContent = '☆';
      }
    });
  }

  // Gestion ouverture popup note
  document.getElementById('gallery').addEventListener('click', function(e) {
    if (e.target.classList.contains('edit-rating-btn')) {
      const filmId = e.target.getAttribute('data-film-id');
      const film = films.find(f => f.id == filmId);
      if (film) {
        openEditRatingModal(filmId, film.rating);
      }
    }
  });

  // Gestion bouton valider (mise à jour réelle de la note)
  document.getElementById('validate-rating-btn').onclick = async function() {
    if (!editingFilmId || !editingRating) return;
    // Met à jour la note dans Supabase
    const { error } = await supabase
      .from('film_collection')
      .update({ rating: editingRating })
      .eq('id', editingFilmId);
    if (error) {
      alert('Erreur lors de la mise à jour de la note : ' + error.message);
    } else {
      fetchFilms(); // Rafraîchit la liste
      closeEditRatingModal();
      if (ratingOverlay) { ratingOverlay.remove(); ratingOverlay = null; }
      showToastFait();
    }
  };

  window.openEditRatingModal = openEditRatingModal;
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
    autocompleteResults = [];
    const query = this.value.trim();
    if (query.length < 2) {
      autocompleteList.style.display = 'none';
      return;
    }
    // Recherche films et séries en parallèle sur TMDb
    const urlMovie = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR`;
    const urlTV = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR`;
    const [resMovie, resTV] = await Promise.all([
      fetch(urlMovie).then(r => r.json()),
      fetch(urlTV).then(r => r.json())
    ]);
    let results = [];
    if (resMovie.results) results = results.concat(resMovie.results.map(r => ({...r, _type: 'movie'})));
    if (resTV.results) results = results.concat(resTV.results.map(r => ({...r, _type: 'tv'})));
    // Trie par popularité décroissante
    results = results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    autocompleteResults = results.slice(0, 20);
    if (autocompleteResults.length === 0) {
      autocompleteList.style.display = 'none';
      return;
    }
    autocompleteList.innerHTML = autocompleteResults.map((item, i) => {
      const poster = item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : 'images/quotefilm-icon.png';
      const typeLabel = item._type === 'movie' ? '🎬 Film' : '📺 Série';
      return `<div class="autocomplete-item" data-index="${i}">
        <span class="autocomplete-title">${item.title || item.name}</span>
        <span class="autocomplete-type">${typeLabel}</span>
        <img class="autocomplete-poster" src="${poster}" alt="Affiche" />
      </div>`;
    }).join('');
    autocompleteList.style.display = 'block';
    autocompleteActive = -1;
  });

  autocompleteList.addEventListener('mousedown', function(e) {
    const item = e.target.closest('.autocomplete-item');
    if (item) {
      const idx = +item.getAttribute('data-index');
      if (autocompleteResults[idx]) {
        titleInput.value = autocompleteResults[idx].title || autocompleteResults[idx].name;
        selectedSuggestion = autocompleteResults[idx];
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
        selectedSuggestion = autocompleteResults[autocompleteActive];
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
  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value;
  let email = identifier;
  // Si ce n'est pas un email, on cherche l'email associé au pseudo dans profiles
  if (!identifier.includes('@')) {
    let { data: profiles, error } = await supabase
      .from('profiles')
      .select('email')
      .ilike('pseudo', identifier)
      .limit(1);
    if (error || !profiles || profiles.length === 0) {
      document.getElementById('login-error').textContent = "Pseudo inconnu.";
      return;
    }
    email = profiles[0].email;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    document.getElementById('login-error').textContent = error.message;
  } else {
    document.getElementById('login-error').textContent = '';
    showMainApp();
  }
}

async function signup() {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const pseudo = document.getElementById('signup-pseudo').value;
  let avatar = document.getElementById('selected-avatar').value;
  if (!pseudo) {
    document.getElementById('signup-error').textContent = "Le pseudo est requis.";
    return;
  }
  // Sécurise l'avatar par défaut
  if (!avatar || typeof avatar !== 'string' || !/\.(svg|jpg|jpeg|png|gif)$/i.test(avatar)) {
    avatar = 'avatar.jpg';
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    document.getElementById('signup-error').textContent = error.message;
  } else {
    // Ajoute l'avatar, le pseudo et l'email dans la table profiles
    const user = data.user;
    if (user) {
      let { error: profileError } = await supabase
        .from('profiles')
        .insert([{ id: user.id, pseudo, avatar, email }]);
      if (profileError) {
        document.getElementById('signup-error').textContent = profileError.message;
        return;
      }
    }
    document.getElementById('signup-error').textContent = '';
    showMainApp();
  }
}

async function logout() {
  await supabase.auth.signOut();
  showMainApp();
}

function updateEditAvatarBtnVisibility() {
  const editAvatarBtn = document.getElementById('edit-avatar-btn');
  if (
    editAvatarBtn &&
    typeof myProfile === 'object' && myProfile !== null &&
    typeof currentProfileId !== 'undefined' && currentProfileId !== null &&
    myProfile.id === currentProfileId
  ) {
    editAvatarBtn.style.display = 'flex';
  } else if (editAvatarBtn) {
    editAvatarBtn.style.display = 'none';
  }
}

// === HEADER AVATAR POPUP ===
function setupHeaderAvatarMenu(profile) {
  const headerAvatarMenu = document.getElementById('header-avatar-menu');
  const headerAvatarImg = document.getElementById('header-avatar-img');
  const headerUserPopup = document.getElementById('header-user-popup');
  const headerUserPopupClose = document.getElementById('header-user-popup-close');
  if (!headerAvatarMenu || !headerAvatarImg || !headerUserPopup || !headerUserPopupClose) return;
  // Affiche le menu
  headerAvatarMenu.style.display = 'flex';
  // Met à jour l'avatar
  headerAvatarImg.src = `images/avatars/${profile.avatar}`;
  // Ouvre la popup au clic sur l'avatar
  headerAvatarImg.onclick = (e) => {
    headerUserPopup.style.display = 'flex';
    document.body.classList.add('modal-open');
  };
  // Accessibilité clavier
  headerAvatarImg.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      headerAvatarImg.click();
    }
  };
  // Ferme la popup
  function closePopup() {
    headerUserPopup.style.display = 'none';
    document.body.classList.remove('modal-open');
  }
  headerUserPopupClose.onclick = closePopup;
  headerUserPopup.onclick = (e) => {
    if (e.target === headerUserPopup) closePopup();
  };
  // Actions du menu
  headerUserPopup.querySelectorAll('.header-user-popup-item').forEach(item => {
    item.onclick = async () => {
      const section = item.getAttribute('data-section');
      if (section === 'logout') {
        await logout();
        closePopup();
      } else if (section === 'decouvrir') {
        window.location.href = 'discover.html';
      } else if (section === 'vues') {
        window.location.href = 'index.html';
      } else {
        alert('Section : ' + section);
        closePopup();
      }
    };
  });
}

async function showMainApp() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    // Charge le profil utilisateur connecté et affiche l'avatar et le pseudo
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('pseudo, avatar, id')
      .eq('id', user.id)
      .single();
    if (!error && profile) {
      myProfile = profile;
      currentProfileId = user.id;
      showProfileSidebar(profile);
      setupEditAvatarBtn();
      // Sécurise l'affichage de l'avatar
      if (profile.avatar && /\.(svg|jpg|jpeg|png|gif)$/i.test(profile.avatar)) {
        setupHeaderAvatarMenu(profile);
        const homeBtnAvatar = document.getElementById('homeBtnAvatar');
        if (homeBtnAvatar) homeBtnAvatar.src = `images/avatars/${profile.avatar}`;
      } else {
        // Avatar absent ou incorrect, on met un avatar par défaut
        profile.avatar = 'avatar.jpg';
        setupHeaderAvatarMenu(profile);
        const homeBtnAvatar = document.getElementById('homeBtnAvatar');
        if (homeBtnAvatar) homeBtnAvatar.src = `images/avatar.jpg`;
      }
    }
    // Affiche le bouton HOME seulement si on consulte un autre profil
    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) homeBtn.style.display = 'none';
    loadUserCarousel(user.id);
    fetchFilms();
  } else {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    // Cache le menu avatar header
    const headerAvatarMenu = document.getElementById('header-avatar-menu');
    if (headerAvatarMenu) headerAvatarMenu.style.display = 'none';
  }
}

function setupEditAvatarBtn() {
  const editAvatarBtn = document.getElementById('edit-avatar-btn');
  const editAvatarModal = document.getElementById('edit-avatar-modal');
  const editAvatarModalList = document.getElementById('edit-avatar-modal-list');
  const editAvatarModalClose = document.getElementById('edit-avatar-modal-close');
  if (editAvatarBtn && editAvatarModal && editAvatarModalList) {
    editAvatarBtn.onclick = () => {
      console.log('Crayon cliqué');
      // Affiche tous les avatars dans la popup dédiée
      editAvatarModalList.innerHTML = allAvatars.map(file =>
        `<img src=\"images/avatars/${file}\" class=\"avatar-modal-avatar\" data-avatar=\"${file}\" tabindex=\"0\" alt=\"Avatar\" />`
      ).join('');
      editAvatarModal.style.display = 'flex';
      // Sélection visuelle de l'avatar courant
      const avatarImg = document.querySelector('.avatar-img');
      let current = '';
      if (avatarImg && avatarImg.src) {
        const match = avatarImg.src.match(/avatars\/([^\/]+\.svg)/);
        if (match) current = match[1];
      }
      editAvatarModalList.querySelectorAll('.avatar-modal-avatar').forEach(img => {
        if (img.getAttribute('data-avatar') === current) {
          img.classList.add('selected');
        }
        img.onclick = async () => {
          // Met à jour l'avatar dans Supabase
          if (!myProfile) return;
          const newAvatar = img.getAttribute('data-avatar');
          const { error } = await supabase
            .from('profiles')
            .update({ avatar: newAvatar })
            .eq('id', myProfile.id);
          if (!error) {
            myProfile.avatar = newAvatar;
            showProfileSidebar(myProfile);
            // Met à jour l'avatar du bouton HOME
            const homeBtnAvatar = document.getElementById('homeBtnAvatar');
            if (homeBtnAvatar) homeBtnAvatar.src = `images/avatars/${newAvatar}`;
          } else {
            alert("Erreur lors de la mise à jour de l'avatar : " + error.message);
          }
          editAvatarModal.style.display = 'none';
        };
        img.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            img.click();
          }
        };
      });
    };
  }
  // Fermer la popup (croix ou clic en dehors)
  if (editAvatarModalClose) {
    editAvatarModalClose.onclick = () => { editAvatarModal.style.display = 'none'; };
  }
  if (editAvatarModal) {
    editAvatarModal.onclick = (e) => {
      if (e.target === editAvatarModal) editAvatarModal.style.display = 'none';
    };
  }
}

function showProfileSidebar(profile) {
  const avatarImg = document.querySelector('.avatar-img');
  if (avatarImg) avatarImg.src = `images/avatars/${profile.avatar}`;
  const aboutMe = document.querySelector('.about-me');
  const avatarContainer = document.querySelector('.avatar-container');
  if (aboutMe) {
    // Compte films et séries
    const nbFilms = films.filter(f => f.type === 'movie').length;
    const nbSeries = films.filter(f => f.type === 'tv').length;
    aboutMe.innerHTML = `
      <span class="profile-pseudo">${profile.pseudo}</span>
      <span class="profile-counts">
        <span class="profile-count-movie">🎬 ${nbFilms} film${nbFilms > 1 ? 's' : ''}</span><br>
        <span class="profile-count-tv">📺 ${nbSeries} série${nbSeries > 1 ? 's' : ''}</span>
      </span>
    `;
  }
  if (avatarContainer) {
    if (myProfile && profile.id === myProfile.id) {
      avatarContainer.classList.add('my-profile');
    } else {
      avatarContainer.classList.remove('my-profile');
    }
  }
  updateEditAvatarBtnVisibility();
  setupEditAvatarBtn();
}

// Charge et affiche le carousel des autres utilisateurs
async function loadUserCarousel(currentUserId) {
  // Récupère tous les profils (y compris le tien)
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, pseudo, avatar')
    .order('pseudo', { ascending: true });
  const carousel = document.getElementById('user-carousel');
  if (!carousel) return;
  if (error || !users || users.length === 0) {
    carousel.innerHTML = '<div style="text-align:center;color:#888;">Aucun autre utilisateur</div>';
    return;
  }
  // Pour chaque utilisateur, récupère le nombre de films notés
  const userIds = users.map(u => u.id);
  let filmCounts = {};
  if (userIds.length > 0) {
    const { data: filmsData } = await supabase
      .from('film_collection')
      .select('user_id');
    if (filmsData) {
      filmsData.forEach(row => {
        if (userIds.includes(row.user_id)) {
          filmCounts[row.user_id] = (filmCounts[row.user_id] || 0) + 1;
        }
      });
    }
  }
  // Trie les utilisateurs par nombre de films desc, puis pseudo
  let sortedUsers = users.map(u => ({...u, count: filmCounts[u.id] || 0}));
  sortedUsers = sortedUsers.sort((a, b) => b.count - a.count || a.pseudo.localeCompare(b.pseudo));
  // Top contributeur
  const topCount = sortedUsers.length > 0 ? sortedUsers[0].count : 0;
  // Top 3
  const top3 = sortedUsers.slice(0, 3);
  // Affiche le top 3
  carousel.innerHTML = top3.map((user, i) => `
    <div class="user-carousel-profile${i === 0 ? ' top-contributor' : i === 1 ? ' second-contributor' : i === 2 ? ' third-contributor' : ''}" data-userid="${user.id}">
      <span class="user-carousel-avatar-wrapper"><img src="images/avatars/${user.avatar}" class="user-carousel-avatar" alt="Avatar de ${user.pseudo}" /></span>
      <span class="user-carousel-pseudo">${user.pseudo}</span>
    </div>
  `).join('') + `
    <div class="user-carousel-profile user-carousel-more" style="justify-content:center;font-weight:bold;color:#e50914;cursor:pointer;" tabindex="0">
      <span>Autres utilisateurs...</span>
    </div>`;
  // Clic sur top 3
  carousel.querySelectorAll('.user-carousel-profile').forEach(el => {
    if (el.classList.contains('user-carousel-more')) {
      el.onclick = openAllUsersModal;
      el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') openAllUsersModal(); };
    } else {
      el.onclick = () => showUserFilms(el.getAttribute('data-userid'));
    }
  });
  // Cache pour la popup
  allUsersCache = sortedUsers;
}

function openAllUsersModal() {
  const modal = document.getElementById('all-users-modal');
  const list = document.getElementById('all-users-list');
  const input = document.getElementById('user-search-input');
  if (!modal || !list || !input) return;
  renderAllUsersList('');
  modal.style.display = 'flex';
  input.value = '';
  input.focus();
  document.body.classList.add('modal-open');
  input.oninput = function() {
    renderAllUsersList(this.value);
  };
  document.getElementById('close-all-users-modal').onclick = () => {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  };
  modal.onclick = function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }
  };
}

function renderAllUsersList(query) {
  const list = document.getElementById('all-users-list');
  if (!list) return;
  const q = (query || '').toLowerCase();
  let filtered = allUsersCache.filter(u => u.pseudo.toLowerCase().includes(q));
  // Trie par nombre de films desc, puis pseudo
  filtered = filtered.sort((a, b) => b.count - a.count || a.pseudo.localeCompare(b.pseudo));
  list.innerHTML = filtered.map((u, i) => `
    <div class="all-users-profile${i === 0 ? ' top-contributor' : i === 1 ? ' second-contributor' : i === 2 ? ' third-contributor' : ''}" data-userid="${u.id}">
      <img src="images/avatars/${u.avatar}" class="all-users-avatar" alt="Avatar de ${u.pseudo}" />
      <span class="all-users-pseudo">${u.pseudo}</span>
      <span class="all-users-count">${u.count} film${u.count > 1 ? 's' : ''}</span>
    </div>
  `).join('');
  list.querySelectorAll('.all-users-profile').forEach(el => {
    el.onclick = () => {
      document.getElementById('all-users-modal').style.display = 'none';
      document.body.classList.remove('modal-open');
      showUserFilms(el.getAttribute('data-userid'));
    };
  });
}

// Affiche les films/séries d'un autre utilisateur dans la galerie et la sidebar
async function showUserFilms(userId) {
  // Charge le profil de l'utilisateur consulté
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('pseudo, avatar, id')
    .eq('id', userId)
    .single();
  if (!error && profile) {
    currentProfileId = profile.id;
    // Charge ses films
    let { data, error: filmsError } = await supabase
      .from('film_collection')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (filmsError) return alert(filmsError.message);
    films = data || [];
    showProfileSidebar(profile); // Affiche le profil après avoir chargé les films
    renderGallery();
    // Affiche le bouton HOME
    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) {
      homeBtn.style.display = 'flex';
      homeBtn.classList.add('home-btn-small');
    }
  }
}

// Bouton HOME : revenir à son propre profil et ses films
const homeBtn = document.getElementById('homeBtn');
if (homeBtn) {
  homeBtn.addEventListener('click', async () => {
    if (myProfile) {
      showProfileSidebar(myProfile);
      homeBtn.style.display = 'none';
      homeBtn.classList.remove('home-btn-small');
      currentProfileId = myProfile.id;
      fetchFilms();
    }
  });
}

// Ajout : écoute les changements d'état d'authentification
supabase.auth.onAuthStateChange((event, session) => {
  showMainApp();
});

// Recherche en temps réel dans la galerie
const gallerySearchInput = document.getElementById('gallery-search-input');
if (gallerySearchInput) {
  gallerySearchInput.addEventListener('input', function() {
    searchQuery = this.value.trim().toLowerCase();
    renderGallery();
  });
}

window.addEventListener('unhandledrejection', function(event) {
  if (event.reason && event.reason.status === 406) {
    // Ignore l'erreur 406 Supabase
    event.preventDefault();
  }
});
