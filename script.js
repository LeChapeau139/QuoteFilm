const TMDB_API_KEY = "TA_CLÉ_API"; // 🔁 remplace ici par ta vraie clé API
const form = document.getElementById("addForm");
const filmList = document.getElementById("filmList");
const searchInput = document.getElementById("search");
const titleInput = document.getElementById("title");
const statsDiv = document.getElementById("stats");

let autoFetchedImage = null;

// 🔍 Recherche d’affiche automatique
titleInput.addEventListener("blur", async () => {
  const title = titleInput.value.trim();
  const type = document.getElementById("type").value;

  if (title === "") return;

  const url = `https://api.themoviedb.org/3/search/${type === "serie" ? "tv" : "movie"}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results && data.results[0] && data.results[0].poster_path) {
      autoFetchedImage = `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}`;
      console.log("Affiche trouvée via TMDb !");
    } else {
      autoFetchedImage = null;
    }
  } catch (error) {
    console.error("Erreur TMDb :", error);
    autoFetchedImage = null;
  }
});

function getFilms() {
  return JSON.parse(localStorage.getItem("films")) || [];
}

function saveFilms(films) {
  localStorage.setItem("films", JSON.stringify(films));
}

function renderStars(note) {
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += i <= note ? "★" : "☆";
  }
  return stars;
}

function renderFilms(filter = "") {
  filmList.innerHTML = "";
  let films = getFilms();
  films = films.sort((a, b) => b.timestamp - a.timestamp);

  if (filter) {
    films = films.filter(
      (f) =>
        f.title.toLowerCase().includes(filter.toLowerCase()) ||
        f.genres.toLowerCase().includes(filter.toLowerCase())
    );
  }

  films.forEach((film, index) => {
    const div = document.createElement("div");
    div.className = "film";
    div.innerHTML = `
      <button class="delete-btn" onclick="deleteFilm(${index})">×</button>
      <h3>${film.title}</h3>
      <p><strong>${film.type === "serie" ? "Série" : "Film"}</strong> • ${film.date || "Date inconnue"}</p>
      <p class="stars">${renderStars(film.note)}</p>
      <p>${film.comment}</p>
      <p><em>${film.genres}</em></p>
      ${film.image ? `<img src="${film.image}" alt="Affiche">` : ""}
    `;
    filmList.appendChild(div);
  });

  renderStats();
}

form.addEventListener("submit", function (e) {
  e.preventDefault();

  const title = document.getElementById("title").value;
  const type = document.getElementById("type").value;
  const genres = document.getElementById("genres").value;
  const date = document.getElementById("date").value;
  const note = parseFloat(document.getElementById("note").value);
  const comment = document.getElementById("comment").value;
  const imageInput = document.getElementById("image");
  const file = imageInput.files[0];

  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      addFilm(title, type, genres, date, note, comment, reader.result);
    };
    reader.readAsDataURL(file);
  } else {
    addFilm(title, type, genres, date, note, comment, autoFetchedImage);
  }
});

function addFilm(title, type, genres, date, note, comment, image) {
  const films = getFilms();
  films.push({
    title,
    type,
    genres,
    date,
    note,
    comment,
    image,
    timestamp: Date.now(),
  });
  saveFilms(films);
  renderFilms();
  form.reset();
  autoFetchedImage = null;
}

function deleteFilm(index) {
  const films = getFilms();
  films.splice(index, 1);
  saveFilms(films);
  renderFilms(searchInput.value);
}

function renderStats() {
  const films = getFilms();
  const total = films.length;
  const moyenne =
    total > 0
      ? (
          films.reduce((sum, f) => sum + parseFloat(f.note), 0) / total
        ).toFixed(2)
      : 0;

  const filmsCount = films.filter((f) => f.type === "film").length;
  const seriesCount = total - filmsCount;

  statsDiv.innerHTML = `
    <strong>Total :</strong> ${total} éléments |
    🎬 Films : ${filmsCount} |
    📺 Séries : ${seriesCount} |
    ⭐ Note moyenne : ${moyenne}/5
  `;
}

function exportData() {
  const films = getFilms();
  const blob = new Blob([JSON.stringify(films, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ma_collection.json";
  a.click();
  URL.revokeObjectURL(url);
}

searchInput.addEventListener("input", () => {
  renderFilms(searchInput.value);
});

renderFilms();
