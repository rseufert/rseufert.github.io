// Each film on the projects page starts as its final frame, a PNG that tells
// the story on its own. A click plays the GIF and a second click goes back to
// the still, so nothing moves unless the visitor asked it to. Without this
// script the link still works: it opens the GIF by itself.
document.querySelectorAll("figure.film a.play").forEach(function (link) {
    var img = link.querySelector("img");
    var still = img.getAttribute("src");

    function toggle(event) {
        event.preventDefault();
        var playing = link.getAttribute("aria-pressed") === "true";
        img.src = playing ? still : link.getAttribute("href");
        link.setAttribute("aria-pressed", String(!playing));
        link.title = playing ? "play the film" : "back to the still";
    }

    link.setAttribute("role", "button");
    link.setAttribute("aria-pressed", "false");
    link.addEventListener("click", toggle);
    // A link answers Enter; a button answers Space too.
    link.addEventListener("keydown", function (event) {
        if (event.key === " ") toggle(event);
    });
});
