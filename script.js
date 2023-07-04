const navItems = document.querySelectorAll(".nav-item");
const navItemsContainer = document.querySelector(".nav-items-container");

navItemsContainer.addEventListener("click", function (e) {
  const clicked = e.target;
  navItems.forEach((item) => {
    item.classList.remove("selected-nav-item");
  });
  clicked.classList.add("selected-nav-item");
});
