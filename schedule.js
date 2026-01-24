const ARTISTS = [
  {
    date: "2026-01-18",
    time: "20:00–23:00",
    name: "Bahçe Live Band"
  },
  {
    date: "2026-01-19",
    time: "20:00–23:00",
    name: "DJ Night — Turkish Classics"
  },
  {
    date: "2026-01-20",
    time: "20:00–23:00",
    name: "Acoustic Session"
  }
];

function formatDate(d){
  try{
    const lang = document.documentElement.lang || "az";
    const dt = new Date(d + "T00:00:00");
    return new Intl.DateTimeFormat(lang, { year: "numeric", month: "long", day: "2-digit" }).format(dt);
  }catch{
    return d;
  }
}

function renderArtists(){
  const grid = document.getElementById("artistGrid");
  if(!grid) return;

  grid.innerHTML = "";

  ARTISTS.forEach((a)=>{
    const card = document.createElement("article");
    card.className = "card";

    const media = document.createElement("div");
    media.className = "artist-media";
    media.style.background =
      "linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,.35)), radial-gradient(650px 320px at 25% 20%, rgba(201,162,77,.18), transparent 55%)";

    const body = document.createElement("div");
    body.className = "artist-body";

    const top = document.createElement("div");
    top.className = "artist-top";

    const pill1 = document.createElement("div");
    pill1.className = "pill";
    pill1.textContent = formatDate(a.date);

    const pill2 = document.createElement("div");
    pill2.className = "pill";
    pill2.textContent = a.time;

    top.appendChild(pill1);
    top.appendChild(pill2);

    const name = document.createElement("h3");
    name.style.margin = "10px 0 0";
    name.textContent = a.name;

    body.appendChild(top);
    body.appendChild(name);

    card.appendChild(media);
    card.appendChild(body);
    grid.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", renderArtists);
window.addEventListener("storage", (e)=>{
  if(e.key === "lang") renderArtists();
});
