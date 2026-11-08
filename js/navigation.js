"use strict";
// Property Location Check – finding your way in the report: the section bar, Open problems / Close all, the phone tab bar and back to top.
// Loaded by index.html as a plain script (no build step); files share one global scope, in the order listed there.

/* ---------- section bar, open/close all, back to top ---------- */

let sectionObserver = null;
function watchSections() {
  if (sectionObserver) sectionObserver.disconnect();
  if (!("IntersectionObserver" in window)) return;
  sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      document.querySelectorAll("#reportNav a").forEach(a => a.classList.toggle("active", a.dataset.nav === id));
      document.querySelectorAll("#tabBar [data-tab]").forEach(a =>
        a.classList.toggle("active", a.dataset.tab === id || (!!a.dataset.tabPrefix && id.startsWith(a.dataset.tabPrefix))));
      const active = document.querySelector(`#reportNav a[data-nav="${id}"]`);
      if (active) {
        const box = $("navLinks"), l = active.offsetLeft - box.offsetLeft;
        if (l < box.scrollLeft || l + active.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollTo({ left: l - 24, behavior: "smooth" });
        updateNavFade();
      }
    });
  }, { rootMargin: "-20% 0px -70% 0px" });
  ["reportTop", "group-flood", "group-ground", "group-living", "group-planning", "nextSteps"].forEach(id => {
    const el = $(id);
    if (el) sectionObserver.observe(el);
  });
}

// One button: "Close all" while any topic is open; otherwise "Open problems", which opens only the topics rated
// Look into this or Worth checking (opening every topic made a phone report about 28 screens long).
function allTopics() { return [...document.querySelectorAll("#report details.check, #report details.clear-fold")]; }
function problemTopics() { return [...document.querySelectorAll("#report details.check.high, #report details.check.medium")]; }
// Phone tab bar: "Problems (2)" opens the topics rated Look into this or Worth checking and goes to the first one.
function updateTabBar() {
  const n = problemTopics().length;
  $("tabProblemsText").textContent = `Problems (${n})`;
  $("tabProblems").disabled = !n;
}
$("tabProblems").addEventListener("click", () => {
  const list = problemTopics();
  if (!list.length) return;
  list.forEach(d => { d.open = true; });          // each change of "open" refreshes the buttons (toggle listener)
  const first = list.find(d => d.classList.contains("high")) || list[0];
  openTopic(first);
  first.scrollIntoView({ behavior: "smooth", block: "start" });
});

function updateToggleAll() {
  updateTabBar();
  const anyOpen = allTopics().some(d => d.open);
  $("toggleAll").textContent = anyOpen ? "Close all" : "Open problems";
  $("toggleAll").disabled = !anyOpen && !problemTopics().length;
}
$("toggleAll").addEventListener("click", () => {
  if ($("toggleAll").textContent === "Close all") allTopics().forEach(d => { d.open = false; });
  else problemTopics().forEach(d => { d.open = true; });
  updateToggleAll();
});
document.addEventListener("toggle", e => { if (e.target.matches && e.target.matches("#report details.check, #report details.clear-fold")) updateToggleAll(); }, true);

// Fade the edge of the section links where more of them are hidden to the side.
function updateNavFade() {
  const el = $("navLinks");
  el.classList.toggle("more-left", el.scrollLeft > 2);
  el.classList.toggle("more-right", el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
}
$("navLinks").addEventListener("scroll", updateNavFade, { passive: true });
window.addEventListener("resize", updateNavFade);

// Links within the report (section bar, topic icons, "Key findings") scroll to their
// section without adding steps to the browser history, and open the topic they point to.
document.addEventListener("click", e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || !a.closest("#report, #reportNav, #tabBar")) return;
  const target = document.getElementById(a.getAttribute("href").slice(1));
  if (!target) return;
  e.preventDefault();
  if (target.tagName === "DETAILS") target.open = true;
  if (a.dataset.open && $(a.dataset.open)) openTopic($(a.dataset.open));
  target.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Open a topic card (and its "no issue found" fold, if it sits in one) and focus its heading.
function openTopic(d) {
  const fold = d.closest(".clear-fold");
  if (fold) fold.open = true;
  d.open = true;
  const s = d.querySelector("summary"); if (s) s.focus({ preventScroll: true });
}

window.addEventListener("scroll", () => {
  $("toTop").classList.toggle("hidden", window.scrollY < 700);
}, { passive: true });
$("toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
