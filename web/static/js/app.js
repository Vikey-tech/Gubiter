const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");


// SEARCH

searchButton.addEventListener("click", function () {

    const searchTerm = searchInput.value.trim();

    if (searchTerm === "") {
        alert("Please enter something to search.");
        return;
    }

    alert("Search for: " + searchTerm);
});


searchInput.addEventListener("keydown", function (event) {

    if (event.key === "Enter") {
        searchButton.click();
    }

});


// THEME SYSTEM

const themeButton = document.getElementById("themeButton");
const themeMenu = document.getElementById("themeMenu");
const themeOptions = document.querySelectorAll(".theme-option");


// Open and close theme menu

themeButton.addEventListener("click", function () {

    themeMenu.classList.toggle("open");

});


// Change theme

themeOptions.forEach(function (option) {

    option.addEventListener("click", function () {

        const selectedTheme = option.dataset.theme;

        document.documentElement.setAttribute(
            "data-theme",
            selectedTheme
        );

        localStorage.setItem(
            "gubiter-theme",
            selectedTheme
        );

        themeMenu.classList.remove("open");

    });

});


// Close menu when clicking outside

document.addEventListener("click", function (event) {

    if (
        !themeButton.contains(event.target) &&
        !themeMenu.contains(event.target)
    ) {
        themeMenu.classList.remove("open");
    }

});


// Load saved theme

const savedTheme = localStorage.getItem("gubiter-theme");

if (savedTheme) {

    document.documentElement.setAttribute(
        "data-theme",
        savedTheme
    );

} else {

    document.documentElement.setAttribute(
        "data-theme",
        "dark"
    );

}