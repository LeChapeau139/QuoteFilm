const API_KEY = "fd846ff36eb8355715e4264b7eb28912";
let films = [];
let currentRating = 0;
let galleryFilter = 'all';
let carouselInterval;
let currentProfileId = null;
let myProfile = null;
let ratingFilter = null;
let searchQuery = '';

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
  // Empêche la suppression si on n'est pas sur son propre profil
  if (currentProfileId && myProfile && currentProfileId !== myProfile.id) {
    return;
  }
  await supabase.from('films').delete().eq('id', id);
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
    if (ratingFilter && film.rating !== ratingFilter) return;
    if (searchQuery && !(
      (film.title && film.title.toLowerCase().includes(searchQuery)) ||
      (film.genre && film.genre.toLowerCase().includes(searchQuery))
    )) return;
    const item = document.createElement("div");
    item.className = "gallery-item";
    item.innerHTML = `
      <button class="delete-film-btn" title="Supprimer" onclick="deleteFilm('${film.id}')">×</button>
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
  const avatar = document.getElementById('selected-avatar').value;
  if (!pseudo) {
    document.getElementById('signup-error').textContent = "Le pseudo est requis.";
    return;
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

async function showMainApp() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
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
      // Met à jour l'avatar du bouton HOME
      const homeBtnAvatar = document.getElementById('homeBtnAvatar');
      if (homeBtnAvatar) homeBtnAvatar.src = `images/avatars/${profile.avatar}`;
    }
    // Affiche le bouton HOME seulement si on consulte un autre profil
    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) homeBtn.style.display = 'none';
    loadUserCarousel(user.id);
    fetchFilms();
  } else {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.style.display = 'none';
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
  if (aboutMe) aboutMe.innerHTML = `<span class="profile-pseudo">${profile.pseudo}</span>`;
  updateEditAvatarBtnVisibility();
  setupEditAvatarBtn();
}

// Charge et affiche le carousel des autres utilisateurs
async function loadUserCarousel(currentUserId) {
  // Récupère tous les profils sauf le tien
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, pseudo, avatar')
    .neq('id', currentUserId)
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
      .from('films')
      .select('user_id');
    if (filmsData) {
      filmsData.forEach(row => {
        if (userIds.includes(row.user_id)) {
          filmCounts[row.user_id] = (filmCounts[row.user_id] || 0) + 1;
        }
      });
    }
  }
  carousel.innerHTML = users.map(user => `
    <div class="user-carousel-profile" data-userid="${user.id}">
      <img src="images/avatars/${user.avatar}" class="user-carousel-avatar" alt="Avatar de ${user.pseudo}" />
      <span class="user-carousel-pseudo">${user.pseudo}</span>
      <span class="user-carousel-count">${filmCounts[user.id] || 0} film${(filmCounts[user.id]||0) > 1 ? 's' : ''}</span>
    </div>
  `).join('');
  // Ajoute le gestionnaire de clic pour chaque profil
  carousel.querySelectorAll('.user-carousel-profile').forEach(el => {
    el.addEventListener('click', () => {
      showUserFilms(el.getAttribute('data-userid'));
    });
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
    showProfileSidebar(profile);
    // Affiche le bouton HOME
    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) homeBtn.style.display = 'flex';
  }
  // Charge ses films
  let { data, error: filmsError } = await supabase
    .from('films')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (filmsError) return alert(filmsError.message);
  films = data || [];
  renderGallery();
}

// Bouton HOME : revenir à son propre profil et ses films
const homeBtn = document.getElementById('homeBtn');
if (homeBtn) {
  homeBtn.addEventListener('click', async () => {
    if (myProfile) {
      showProfileSidebar(myProfile);
      homeBtn.style.display = 'none';
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
