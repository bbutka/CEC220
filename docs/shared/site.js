const yearTargets = document.querySelectorAll("[data-current-year]");
for (const target of yearTargets) {
  target.textContent = new Date().getFullYear();
}

