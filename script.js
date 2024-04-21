const navItems = document.querySelectorAll(".nav-item");
const navItemsContainer = document.querySelector(".nav-items-container");

// navItemsContainer.addEventListener("click", function (e) {
//   const element = e.target;
//   if (!element.classList.contains("nav-item")) return;

//   navItems.forEach((item) => {
//     item.classList.remove("active-nav-item");
//   });
//   element.classList.add("active-nav-item");
// });

const sections = document.querySelectorAll(".section");

const highlightSection = function (entries, observer) {
  const [entry] = entries;
  if (entry.isIntersecting) {
    const navItemArray = Array.from(navItems);
    const matchedNav = navItemArray.find((item) =>
      item.href.includes(entry.target.id)
    );

    navItems.forEach((item) => {
      item.classList.remove("active-nav-item");
    });

    matchedNav.classList.add("active-nav-item");
  }
};

const sectionObserver = new IntersectionObserver(highlightSection, {
  root: null,
  threshold: 0.55,
});

sections.forEach((section) => {
  sectionObserver.observe(section);
});
