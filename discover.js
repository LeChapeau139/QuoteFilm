// discover.js

const TMDB_API_KEY = 'fd846ff36eb8355715e4264b7eb28912';

let discoverGenres = [];
let discoverData = {};
let discoverPages = {};

// Ajout : fonction pour charger le profil utilisateur (pseudo)
async function loadMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('pseudo')
      .eq('id', user.id)
      .single();
    if (!error && profile) {
      window.myProfile = profile;
    } else {
      window.myProfile = null;
    }
  } else {
    window.myProfile = null;
  }
}

async function startDiscover() {
  const container = document.getElementById('discover-container');
  const filterBar = document.getElementById('discover-filter-bar');
  container.innerHTML = '<div style="color:#fff;text-align:center;">Chargement des genres...</div>';
  // 1. Récupère les genres dynamiquement
  const genresRes = await fetch(`https://api.themoviedb.org/3/genre/movie/list?language=fr-FR&api_key=${TMDB_API_KEY}`);
  const genresData = await genresRes.json();
  if (!genresData.genres) {
    container.innerHTML = '<div style="color:red;text-align:center;">Erreur lors du chargement des genres.</div>';
    return;
  }
  discoverGenres = genresData.genres;
  container.innerHTML = '';
  filterBar.innerHTML = '';
  // Ajoute le bouton "Tous"
  const allBtn = document.createElement('button');
  allBtn.className = 'discover-filter-btn active';
  allBtn.textContent = 'Tous';
  allBtn.onclick = () => showDiscoverGenres('all');
  filterBar.appendChild(allBtn);
  // Ajoute un bouton par genre
  for (const genre of discoverGenres) {
    const btn = document.createElement('button');
    btn.className = 'discover-filter-btn';
    btn.textContent = genre.name;
    btn.onclick = () => showDiscoverGenres(genre.id);
    filterBar.appendChild(btn);
  }
  // Initialise la pagination pour chaque genre/type
  for (const genre of discoverGenres) {
    discoverPages[`${genre.id}_movie`] = 1;
    discoverPages[`${genre.id}_tv`] = 1;
  }
  // Charge les 10 films et 10 séries pour chaque genre
  discoverData = {};
  for (const genre of discoverGenres) {
    const [moviesRes, seriesRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/discover/movie?with_genres=${genre.id}&sort_by=vote_average.desc&vote_count.gte=500&language=fr-FR&page=1&api_key=${TMDB_API_KEY}`),
      fetch(`https://api.themoviedb.org/3/discover/tv?with_genres=${genre.id}&sort_by=vote_average.desc&vote_count.gte=500&language=fr-FR&page=1&api_key=${TMDB_API_KEY}`)
    ]);
    const moviesData = await moviesRes.json();
    const seriesData = await seriesRes.json();
    discoverData[genre.id] = {
      movies: (moviesData.results || []).map(m => ({...m, _type: 'movie'})).slice(0, 10),
      series: (seriesData.results || []).map(m => ({...m, _type: 'tv'})).slice(0, 10)
    };
  }
  showDiscoverGenres('all');
}

async function loadMoreDiscover(genreId, type) {
  // Incrémente la page et recharge 10 nouveaux films/séries
  discoverPages[`${genreId}_${type}`]++;
  const page = discoverPages[`${genreId}_${type}`];
  const url = type === 'movie'
    ? `https://api.themoviedb.org/3/discover/movie?with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=500&language=fr-FR&page=${page}&api_key=${TMDB_API_KEY}`
    : `https://api.themoviedb.org/3/discover/tv?with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=500&language=fr-FR&page=${page}&api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!discoverData[genreId]) discoverData[genreId] = { movies: [], series: [] };
  if (type === 'movie') {
    discoverData[genreId].movies = [
      ...(discoverData[genreId].movies || []),
      ...(data.results || []).map(m => ({...m, _type: 'movie'}))
    ];
  } else {
    discoverData[genreId].series = [
      ...(discoverData[genreId].series || []),
      ...(data.results || []).map(m => ({...m, _type: 'tv'}))
    ];
  }
  showDiscoverGenres(document.querySelector('.discover-filter-btn.active').textContent === 'Tous' ? 'all' : genreId);
}

function showDiscoverGenres(genreId) {
  const container = document.getElementById('discover-container');
  const filterBar = document.getElementById('discover-filter-bar');
  // Sauvegarde la position de scroll de chaque carrousel-row avec une clé unique
  const scrollPositions = {};
  document.querySelectorAll('.discover-carousel-row').forEach(row => {
    const parent = row.closest('.discover-carousel');
    if (parent) {
      const genre = parent.getAttribute('data-genre');
      const type = parent.getAttribute('data-type');
      if (genre && type) {
        scrollPositions[`${genre}_${type}`] = row.scrollLeft;
      }
    }
  });
  // Active le bon bouton
  filterBar.querySelectorAll('.discover-filter-btn').forEach(btn => {
    if (genreId === 'all' && btn.textContent === 'Tous') btn.classList.add('active');
    else if (genreId !== 'all' && btn.textContent === (discoverGenres.find(g => g.id === genreId)?.name)) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  container.innerHTML = '';
  for (const genre of discoverGenres) {
    if (genreId !== 'all' && genre.id !== genreId) continue;
    const data = discoverData[genre.id] || { movies: [], series: [] };
    if (data.movies.length === 0 && data.series.length === 0) continue;
    // Section genre
    const genreSection = document.createElement('section');
    genreSection.className = 'discover-genre-section';
    genreSection.innerHTML = `
      <h2 class=\"discover-genre-title\">${genre.name}</h2>
      <div class=\"discover-carousel-container\">
        <div class=\"discover-carousel\" data-genre=\"${genre.id}\" data-type=\"movie\"></div>
      </div>
      <div class=\"discover-carousel-container\">
        <div class=\"discover-carousel\" data-genre=\"${genre.id}\" data-type=\"tv\"></div>
      </div>
    `;
    // Remplit les carrousels
    ['movies','series'].forEach(typeKey => {
      const type = typeKey === 'movies' ? 'movie' : 'tv';
      const carousel = genreSection.querySelector(`.discover-carousel[data-type=\"${type}\"]`);
      const rowDiv = document.createElement('div');
      rowDiv.className = 'discover-carousel-row';
      (data[typeKey] || []).forEach(movie => {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        const typeLogo = movie._type === 'movie' ? '🎬' : '📺';
        const realNote = (movie.vote_average / 2).toFixed(1);
        const whitelistBtn = `<button class=\"whitelist-btn\" data-tmdbid=\"${movie.id}\" data-type=\"${movie._type}\" data-title=\"${(movie.title || movie.name).replace(/\"/g, '&quot;')}\" data-poster=\"${movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : ''}\">+ WhiteList</button>`;
        card.innerHTML = `
          <span class=\"type-logo\">${typeLogo}</span>
          <img class=\"gallery-card-img\" src=\"https://image.tmdb.org/t/p/w342${movie.poster_path}\" alt=\"${movie.title || movie.name}\" />
          <div class=\"gallery-card-content\">
            <div class=\"gallery-card-title\">${movie.title || movie.name}</div>
            <div class=\"gallery-card-genres\">${movie.genre_ids.map(id => discoverGenres.find(g => g.id === id)?.name).filter(Boolean).join(', ')}</div>
            <div class=\"gallery-card-rating stars\">
              ${'★'.repeat(Math.floor(movie.vote_average/2))}${(movie.vote_average%2>=1 ? '½' : '')}${'☆'.repeat(5-Math.ceil(movie.vote_average/2))}
              <span class=\"real-rating\">${realNote}</span>
            </div>
            ${whitelistBtn}
          </div>
        `;
        card.onclick = (e) => {
          if (!e.target.classList.contains('whitelist-btn')) {
            showMovieDetail(movie);
          }
        };
        rowDiv.appendChild(card);
      });
      // Ajoute la fiche "Voir +"
      const moreCard = document.createElement('div');
      moreCard.className = 'gallery-card';
      moreCard.style.display = 'flex';
      moreCard.style.alignItems = 'center';
      moreCard.style.justifyContent = 'center';
      moreCard.style.fontWeight = 'bold';
      moreCard.style.fontSize = '1.2em';
      moreCard.style.cursor = 'pointer';
      moreCard.innerHTML = '<span>Voir +</span>';
      moreCard.onclick = () => loadMoreDiscover(genre.id, type);
      rowDiv.appendChild(moreCard);
      carousel.appendChild(rowDiv);
      // Restaure la position de scroll si elle existe pour ce carrousel
      const key = `${genre.id}_${type}`;
      if (scrollPositions[key] !== undefined) {
        requestAnimationFrame(() => {
          rowDiv.scrollLeft = scrollPositions[key];
        });
      }
    });
    container.appendChild(genreSection);
  }
  // Gestion du bouton whitelist
  setTimeout(() => {
    document.querySelectorAll('.whitelist-btn').forEach(btn => {
      btn.onclick = async function() {
        const tmdb_id = btn.getAttribute('data-tmdbid');
        const type = btn.getAttribute('data-type');
        const title = btn.getAttribute('data-title');
        const poster = btn.getAttribute('data-poster');
        // Récupère l'utilisateur connecté
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return alert('Connecte-toi !');
        // Ajoute à la whitelist
        const { error } = await supabase.from('whitelist').insert([
          { user_id: user.id, tmdb_id: tmdb_id, title, poster, type }
        ]);
        if (!error) {
          btn.textContent = '✓ WhiteList';
          btn.classList.add('added');
          btn.disabled = true;
        } else {
          alert(error.message);
        }
      };
    });
  }, 100);
}

// Fonction pour afficher le popup de détail
async function showMovieDetail(movie) {
  // Récupère les détails complets du film/série
  const detailUrl = movie._type === 'movie' 
    ? `https://api.themoviedb.org/3/movie/${movie.id}?language=fr-FR&append_to_response=credits&api_key=${TMDB_API_KEY}`
    : `https://api.themoviedb.org/3/tv/${movie.id}?language=fr-FR&append_to_response=credits&api_key=${TMDB_API_KEY}`;
  
  const detailRes = await fetch(detailUrl);
  const detailData = await detailRes.json();
  
  // Récupère le casting (premiers 10 acteurs)
  const cast = (detailData.credits?.cast || []).slice(0, 10);

  // Ajout : vérifie si déjà dans la collection
  let dejaDansCollection = false;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: existing } = await supabase
      .from('film_collection')
      .select('id')
      .eq('user_id', user.id)
      .eq('tmdb_id', movie.id)
      .single();
    dejaDansCollection = !!existing;
  }
  
  // Crée le popup
  const popup = document.createElement('div');
  popup.className = 'movie-detail-popup';
  popup.innerHTML = `
    <div class="movie-detail-content">
      <button class="movie-detail-close">&times;</button>
      <div class="movie-detail-header" style="background-image: url('https://image.tmdb.org/t/p/original${detailData.backdrop_path || movie.poster_path}')">
        <div class="movie-detail-header-content">
          <h1 class="movie-detail-title">${detailData.title || detailData.name}</h1>
          <div class="movie-detail-meta">
            <span>${movie._type === 'movie' ? '🎬 Film' : '📺 Série'}</span>
            <span>•</span>
            <span>${detailData.release_date ? new Date(detailData.release_date).getFullYear() : detailData.first_air_date ? new Date(detailData.first_air_date).getFullYear() : 'N/A'}</span>
            <span>•</span>
            <span>${detailData.runtime ? Math.floor(detailData.runtime/60) + 'h' + (detailData.runtime%60) + 'm' : detailData.episode_run_time?.[0] ? detailData.episode_run_time[0] + 'min' : 'N/A'}</span>
            <span>•</span>
            <span>★ ${(detailData.vote_average/2).toFixed(1)}/5</span>
          </div>
        </div>
      </div>
      <div class="movie-detail-actions">
        <button class="movie-detail-btn secondary" onclick="addToWhitelist('${movie.id}', '${movie._type}', ${JSON.stringify(detailData.title || detailData.name)}, '${detailData.backdrop_path || movie.poster_path}')">+ WhiteList</button>
        ${dejaDansCollection
          ? `<button class='movie-detail-btn' disabled>Déjà dans ma collection</button>`
          : `<button class='movie-detail-btn' onclick="addToMyViews('${movie.id}', '${movie._type}', ${JSON.stringify(detailData.title || detailData.name)}, '${detailData.backdrop_path || movie.poster_path}')">+ Ma Collection</button>`
        }
      </div>
      <div class="movie-detail-body">
        <p class="movie-detail-overview">${detailData.overview || 'Aucun résumé disponible.'}</p>
        ${cast.length > 0 ? `
          <div class="movie-detail-cast">
            <h3>Distribution</h3>
            <div class="cast-grid">
              ${cast.map(actor => `
                <div class="cast-item">
                  <img class="cast-photo" src="${actor.profile_path ? 'https://image.tmdb.org/t/p/w185' + actor.profile_path : 'images/avatar.jpg'}" alt="${actor.name}" />
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
  // Bloque le scroll du body
  document.body.style.overflow = 'hidden';
  // Fermeture du popup
  const closeBtn = popup.querySelector('.movie-detail-close');
  closeBtn.onclick = () => { popup.remove(); document.body.style.overflow = ''; };
  popup.onclick = (e) => {
    if (e.target === popup) { popup.remove(); document.body.style.overflow = ''; }
  };
  // Fermeture avec Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      popup.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

// Fonction pour ajouter à la whitelist depuis le popup
async function addToWhitelist(tmdb_id, type, title, poster) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return alert('Connecte-toi !');
  
  const { error } = await supabase.from('whitelist').insert([
    { user_id: user.id, tmdb_id: tmdb_id, title, poster, type }
  ]);
  
  if (!error) {
    alert('Ajouté à la whitelist !');
  } else {
    alert(error.message);
  }
}

// Fonction pour ajouter à "Mes Vues" avec note depuis Discover
async function addToMyViews(tmdb_id, type, title, poster) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return alert('Connecte-toi !');

  // Vérifie si le film/série est déjà dans "Mes Vues"
  const { data: existing } = await supabase
    .from('film_collection')
    .select('id')
    .eq('user_id', user.id)
    .eq('tmdb_id', tmdb_id)
    .single();
  if (existing) {
    alert('Ce film/série est déjà dans "Mes Vues" !');
    return;
  }

  // Ouvre la popup de note
  showRatingPopup(tmdb_id, type, title, poster);
}

// Fonction pour afficher la popup de note
function showRatingPopup(tmdb_id, type, title, poster) {
  const popup = document.createElement('div');
  popup.className = 'rating-popup';
  popup.innerHTML = `
    <div class="rating-content">
      <h2 class="rating-title">Notez "${title}"</h2>
      <div class="rating-stars" id="rating-stars">
        <span class="star" data-rating="1">★</span>
        <span class="star" data-rating="2">★</span>
        <span class="star" data-rating="3">★</span>
        <span class="star" data-rating="4">★</span>
        <span class="star" data-rating="5">★</span>
      </div>
      <div class="rating-buttons">
        <button class="rating-btn cancel" onclick="closeRatingPopup()">Annuler</button>
        <button class="rating-btn" onclick="saveRating('${tmdb_id}', '${type}', '${title}', '${poster}')">Sauvegarder</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  // Gestion des étoiles
  const stars = popup.querySelectorAll('.star');
  let selectedRating = 0;
  
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const rating = parseInt(star.dataset.rating);
      selectedRating = rating;
      
      stars.forEach((s, index) => {
        if (index < rating) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    });
    
    star.addEventListener('mouseenter', () => {
      const rating = parseInt(star.dataset.rating);
      stars.forEach((s, index) => {
        if (index < rating) {
          s.style.color = '#ffd600';
        } else {
          s.style.color = '#666';
        }
      });
    });
    
    star.addEventListener('mouseleave', () => {
      stars.forEach((s, index) => {
        if (index < selectedRating) {
          s.style.color = '#ffd600';
        } else {
          s.style.color = '#666';
        }
      });
    });
  });
  
  // Fermeture avec Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeRatingPopup();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

// Fonction pour fermer la popup de note
function closeRatingPopup() {
  const popup = document.querySelector('.rating-popup');
  if (popup) popup.remove();
}

// Fonction pour sauvegarder la note
async function saveRating(tmdb_id, type, title, poster) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return alert('Connecte-toi !');
  
  const stars = document.querySelectorAll('.star.active');
  const rating = stars.length;
  
  if (rating === 0) {
    alert('Veuillez donner une note !');
    return;
  }

  // Récupère toutes les infos détaillées depuis TMDb
  let details, translations;
  if (type === 'movie') {
    [details, translations] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/${tmdb_id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`).then(res => res.json()),
      fetch(`https://api.themoviedb.org/3/movie/${tmdb_id}/translations?api_key=${TMDB_API_KEY}`).then(res => res.json())
    ]);
  } else {
    [details, translations] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/tv/${tmdb_id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`).then(res => res.json()),
      fetch(`https://api.themoviedb.org/3/tv/${tmdb_id}/translations?api_key=${TMDB_API_KEY}`).then(res => res.json())
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
  const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '';
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

  // Ajoute à la table film_collection
  const newFilm = {
    user_id: user.id,
    pseudo: window.myProfile ? window.myProfile.pseudo : null,
    tmdb_id: tmdb_id,
    type,
    title: titleFr,
    original_title,
    poster: posterUrl,
    genre: genres,
    overview,
    casting,
    runtime,
    release_date,
    rating: rating,
    created_at: new Date().toISOString()
  };
  
  const { error } = await supabase.from('film_collection').insert([newFilm]);
  
  if (!error) {
    showToastDiscover();
    closeRatingPopup();
  } else {
    alert(error.message);
  }
}

// Rendre les fonctions globales pour qu'elles soient accessibles depuis onclick
window.addToWhitelist = addToWhitelist;
window.addToMyViews = addToMyViews;
window.showRatingPopup = showRatingPopup;
window.closeRatingPopup = closeRatingPopup;
window.saveRating = saveRating;
window.loadMoreDiscover = loadMoreDiscover;

// Synchronisation stricte de l'avatar du header Discover avec le compte connecté
async function setupHeaderAvatarMenuDiscover() {
  const headerAvatarMenu = document.getElementById('header-avatar-menu');
  const headerAvatarImg = document.getElementById('header-avatar-img');
  const headerUserPopup = document.getElementById('header-user-popup');
  const headerUserPopupClose = document.getElementById('header-user-popup-close');
  if (!headerAvatarMenu || !headerAvatarImg || !headerUserPopup || !headerUserPopupClose) return;
  // Affiche le menu
  headerAvatarMenu.style.display = 'flex';
  // Récupère l'avatar du compte connecté via Supabase
  if (window.supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('avatar')
        .eq('id', user.id)
        .single();
      if (!error && profile) {
        let avatarSrc;
        if (profile.avatar && /\.(svg|jpg|jpeg|png|gif)$/i.test(profile.avatar)) {
          avatarSrc = `images/avatars/${profile.avatar}`;
        } else {
          avatarSrc = 'images/avatar.jpg';
        }
        headerAvatarImg.src = avatarSrc;
        headerAvatarImg.onerror = function() {
          console.error('Erreur: L\'avatar choisi n\'existe pas ou est inaccessible:', avatarSrc);
          headerAvatarImg.src = 'images/avatar.jpg';
        };
        headerAvatarImg.style.display = '';
        console.log('Avatar Discover utilisé:', avatarSrc);
      }
    }
  }
  headerAvatarImg.onclick = (e) => {
    headerUserPopup.style.display = 'flex';
    document.body.classList.add('modal-open');
  };
  headerAvatarImg.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      headerAvatarImg.click();
    }
  };
  function closePopup() {
    headerUserPopup.style.display = 'none';
    document.body.classList.remove('modal-open');
  }
  headerUserPopupClose.onclick = closePopup;
  headerUserPopup.onclick = (e) => {
    if (e.target === headerUserPopup) closePopup();
  };
  headerUserPopup.querySelectorAll('.header-user-popup-item').forEach(item => {
    item.onclick = async () => {
      const section = item.getAttribute('data-section');
      if (section === 'logout') {
        window.location.href = 'index.html';
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

// Toast custom Discover
function showToastDiscover() {
  let toast = document.getElementById('toast-discover');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-discover';
    toast.style.position = 'fixed';
    toast.style.bottom = '-100px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(30,30,30,0.97)';
    toast.style.color = '#fff';
    toast.style.padding = '1em 2em';
    toast.style.borderRadius = '999px';
    toast.style.fontSize = '1.2em';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '0.7em';
    toast.style.boxShadow = '0 2px 16px rgba(0,0,0,0.18)';
    toast.style.zIndex = 9999;
    toast.style.transition = 'bottom 0.5s cubic-bezier(.4,2,.6,1), opacity 0.4s';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span style='font-weight:bold;'>Fait</span> <span style='font-size:1.3em;color:#4caf50;'>✔️</span>`;
  toast.style.opacity = '1';
  toast.style.pointerEvents = 'auto';
  // Slide up
  setTimeout(() => { toast.style.bottom = '2em'; }, 10);
  // Slide down and hide after 3s
  setTimeout(() => {
    toast.style.bottom = '-100px';
    toast.style.opacity = '0';
    toast.style.pointerEvents = 'none';
  }, 3000);
}

window.addEventListener('DOMContentLoaded', async () => {
  const logo = document.querySelector('.discover-logo');
  if (logo) {
    logo.onclick = () => {
      window.location.href = 'index.html';
    };
  }
  await loadMyProfile();
  setupHeaderAvatarMenuDiscover();
  startDiscover();
}); 