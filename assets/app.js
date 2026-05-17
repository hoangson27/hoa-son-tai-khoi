const stateKey = "hoa-son-web-reader-v1";
const themes = ["sepia", "light", "dark"];
const fontFamilies = {
  segoe: '"Segoe UI", Arial, sans-serif',
  arial: 'Arial, "Helvetica Neue", sans-serif',
  times: '"Times New Roman", Times, serif',
  georgia: 'Georgia, "Times New Roman", serif',
};

const els = {
  body: document.body,
  countText: document.getElementById("countText"),
  chapterSelect: document.getElementById("chapterSelect"),
  searchInput: document.getElementById("searchInput"),
  fontFamily: document.getElementById("fontFamily"),
  fontDown: document.getElementById("fontDown"),
  fontUp: document.getElementById("fontUp"),
  themeButton: document.getElementById("themeButton"),
  hitList: document.getElementById("hitList"),
  progressBar: document.getElementById("progressBar"),
  chapterSource: document.getElementById("chapterSource"),
  chapterTitle: document.getElementById("chapterTitle"),
  pageText: document.getElementById("pageText"),
  pageMeta: document.getElementById("pageMeta"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
};

let manifest = null;
let chapter = null;
let pages = [];
let state = readState();

boot();

async function boot() {
  applyPrefs();
  bindEvents();

  try {
    const response = await fetch("manifest.json");
    if (!response.ok) throw new Error("manifest");
    manifest = await response.json();
    els.countText.textContent = manifest.count + " chương";
    renderChapterOptions();
    state.chapter = clamp(state.chapter, 0, manifest.chapters.length - 1);
    await loadChapter(state.chapter, state.page);
  } catch (error) {
    els.countText.textContent = "Không tải được";
    els.pageText.textContent = "Không tải được dữ liệu. Khi mở trên máy, hãy chạy qua web server hoặc deploy lên hosting tĩnh.";
    console.error(error);
  }
}

function bindEvents() {
  els.chapterSelect.addEventListener("change", () => loadChapter(Number(els.chapterSelect.value), 0));
  els.searchInput.addEventListener("input", renderSearch);
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      els.searchInput.value = "";
      renderSearch();
      els.searchInput.blur();
    }
  });
  els.fontFamily.addEventListener("change", () => {
    state.fontFamily = fontFamilies[els.fontFamily.value] ? els.fontFamily.value : "segoe";
    applyPrefs();
    saveState();
  });
  els.fontDown.addEventListener("click", () => setFontSize(state.fontSize - 1));
  els.fontUp.addEventListener("click", () => setFontSize(state.fontSize + 1));
  els.themeButton.addEventListener("click", cycleTheme);
  els.prevPage.addEventListener("click", previousPage);
  els.nextPage.addEventListener("click", nextPage);
  document.addEventListener("keydown", handleKeys);
  document.addEventListener("click", (event) => {
    if (!els.hitList.contains(event.target) && event.target !== els.searchInput) {
      els.hitList.classList.remove("is-open");
    }
  });
}

function readState() {
  try {
    return {
      chapter: 0,
      page: 0,
      fontSize: 20,
      fontFamily: "segoe",
      theme: "sepia",
      ...JSON.parse(localStorage.getItem(stateKey) || "{}"),
    };
  } catch {
    return { chapter: 0, page: 0, fontSize: 20, fontFamily: "segoe", theme: "sepia" };
  }
}

function saveState() {
  localStorage.setItem(stateKey, JSON.stringify(state));
}

function applyPrefs() {
  state.theme = themes.includes(state.theme) ? state.theme : "sepia";
  state.fontFamily = fontFamilies[state.fontFamily] ? state.fontFamily : "segoe";
  state.fontSize = clamp(state.fontSize, 16, 30);
  els.body.dataset.theme = state.theme;
  els.fontFamily.value = state.fontFamily;
  document.documentElement.style.setProperty("--reader-font", fontFamilies[state.fontFamily]);
  document.documentElement.style.setProperty("--reader-size", state.fontSize + "px");
}

function renderChapterOptions() {
  els.chapterSelect.innerHTML = manifest.chapters.map((item) => {
    const cleanTitle = item.title.replace(/^chapter\s+\d+\.?\s*/i, "");
    return '<option value="' + item.index + '">' + escapeHtml(String(item.number).padStart(4, "0")) + " - " + escapeHtml(cleanTitle) + "</option>";
  }).join("");
}

async function loadChapter(index, page = 0) {
  if (!manifest) return;
  const meta = manifest.chapters[clamp(index, 0, manifest.chapters.length - 1)];
  state.chapter = meta.index;
  state.page = 0;
  els.chapterSelect.value = String(meta.index);
  els.chapterTitle.textContent = meta.title;
  els.chapterSource.textContent = meta.source;
  els.pageText.textContent = "Đang tải...";
  updateButtons(true);

  const response = await fetch(meta.file);
  if (!response.ok) throw new Error(meta.file);
  chapter = await response.json();
  pages = paginate(chapter.body);
  state.page = clamp(page, 0, pages.length - 1);
  renderPage();
}

function renderPage() {
  if (!chapter) return;
  state.page = clamp(state.page, 0, pages.length - 1);
  els.pageText.textContent = pages[state.page] || "";
  els.pageMeta.textContent = "Chương " + chapter.number + " · " + (state.page + 1) + "/" + pages.length;
  els.progressBar.style.width = getProgress().toFixed(2) + "%";
  updateButtons(false);
  saveState();
  window.scrollTo(0, 0);
}

function paginate(text) {
  const target = window.matchMedia("(max-width: 720px)").matches ? 3900 : 5200;
  const paragraphs = text.split(/\n{2,}/);
  const result = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const block = paragraph.trim();
    if (!block) continue;
    if (current && current.length + block.length + 2 > target) {
      result.push(current);
      current = block;
    } else {
      current = current ? current + "\n\n" + block : block;
    }
  }

  if (current) result.push(current);
  return result.length ? result : [""];
}

function previousPage() {
  if (!chapter) return;
  if (state.page > 0) {
    state.page -= 1;
    renderPage();
    return;
  }
  if (state.chapter > 0) {
    const previous = manifest.chapters[state.chapter - 1];
    const estimatedLastPage = Math.max(0, Math.ceil(previous.chars / 5200) - 1);
    loadChapter(previous.index, estimatedLastPage);
  }
}

function nextPage() {
  if (!chapter) return;
  if (state.page < pages.length - 1) {
    state.page += 1;
    renderPage();
    return;
  }
  if (state.chapter < manifest.chapters.length - 1) {
    loadChapter(state.chapter + 1, 0);
  }
}

function updateButtons(loading) {
  els.prevPage.disabled = loading || (state.chapter === 0 && state.page === 0);
  els.nextPage.disabled = loading || (state.chapter === manifest.chapters.length - 1 && state.page === pages.length - 1);
}

function getProgress() {
  if (!manifest || !chapter) return 0;
  const total = manifest.chapters.reduce((sum, item) => sum + Math.max(1, Math.ceil(item.chars / 5200)), 0);
  const before = manifest.chapters.slice(0, state.chapter).reduce((sum, item) => sum + Math.max(1, Math.ceil(item.chars / 5200)), 0);
  return ((before + state.page + 1) / total) * 100;
}

function renderSearch() {
  if (!manifest) return;
  const query = els.searchInput.value.trim().toLowerCase();
  if (!query) {
    els.hitList.innerHTML = "";
    els.hitList.classList.remove("is-open");
    return;
  }

  const hits = manifest.chapters
    .filter((item) => (item.number + " " + item.title + " " + item.source).toLowerCase().includes(query))
    .slice(0, 45);

  els.hitList.innerHTML = hits.length
    ? hits.map((item) => '<button class="hit" type="button" data-index="' + item.index + '">' + escapeHtml(item.title) + "<small>" + escapeHtml(item.source) + "</small></button>").join("")
    : '<div class="hit">Không thấy chương phù hợp</div>';

  els.hitList.querySelectorAll("[data-index]").forEach((button) => {
    button.addEventListener("click", () => {
      els.searchInput.value = "";
      els.hitList.classList.remove("is-open");
      loadChapter(Number(button.dataset.index), 0);
    });
  });

  els.hitList.classList.add("is-open");
}

function setFontSize(size) {
  state.fontSize = clamp(size, 16, 30);
  applyPrefs();
  saveState();
}

function cycleTheme() {
  state.theme = themes[(themes.indexOf(state.theme) + 1) % themes.length];
  applyPrefs();
  saveState();
}

function handleKeys(event) {
  const tag = event.target.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if (event.key === "ArrowLeft" || event.key === "PageUp") {
    event.preventDefault();
    previousPage();
  }
  if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
    event.preventDefault();
    nextPage();
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}
