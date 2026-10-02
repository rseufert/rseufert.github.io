// Each film on the home page and the project pages starts as its final frame, a PNG that tells
// the story on its own, and plays its GIF on demand. Without this script the
// still links to the GIF, which opens by itself.
//
// With a mouse, a click plays the film and a second click goes back to the
// still. On a touch screen there is no hover to say the still is a film, so
// the film most in view plays by itself and goes back to its still when it
// scrolls away; only one plays at a time, and a tap still plays or stops it.
// A visitor who asked for less motion, or to save data, gets no autoplay.
(function () {
    var links = Array.prototype.slice.call(document.querySelectorAll("figure.film a.play"));
    if (!links.length) return;

    function playing(link) {
        return link.getAttribute("aria-pressed") === "true";
    }

    function show(link, play) {
        if (playing(link) === play) return;
        var img = link.querySelector("img");
        img.src = play ? link.getAttribute("href") : link.dataset.still;
        link.setAttribute("aria-pressed", String(play));
        link.title = play ? "back to the still" : "play the film";
    }

    function playOnly(link) {
        links.forEach(function (other) { show(other, other === link); });
    }

    function toggle(event) {
        event.preventDefault();
        var link = event.currentTarget;
        if (playing(link)) {
            show(link, false);
            // Stopped by hand: autoplay leaves it be until it has left the view.
            link.dataset.stopped = "1";
        } else {
            delete link.dataset.stopped;
            playOnly(link);
        }
    }

    links.forEach(function (link) {
        link.dataset.still = link.querySelector("img").getAttribute("src");
        link.setAttribute("role", "button");
        link.setAttribute("aria-pressed", "false");
        link.addEventListener("click", toggle);
        // A link answers Enter; a button answers Space too.
        link.addEventListener("keydown", function (event) {
            if (event.key === " ") toggle(event);
        });
    });

    var autoplay = window.matchMedia("(hover: none)").matches
        && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        && !(navigator.connection && navigator.connection.saveData)
        && "IntersectionObserver" in window;
    if (!autoplay) return;

    var seen = new Map();   // link -> how much of it is in view, 0 to 1
    var ENOUGH = 0.6;

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            var link = entry.target;
            seen.set(link, entry.intersectionRatio);
            if (entry.intersectionRatio === 0) delete link.dataset.stopped;
        });
        var best = null;
        seen.forEach(function (ratio, link) {
            if (ratio >= ENOUGH && !link.dataset.stopped
                    && (!best || ratio > seen.get(best))) best = link;
        });
        if (best) {
            playOnly(best);
        } else {
            // Nothing well in view: a film that has scrolled away goes still.
            links.forEach(function (link) {
                if ((seen.get(link) || 0) < ENOUGH) show(link, false);
            });
        }
    }, { threshold: [0, 0.25, 0.5, ENOUGH, 0.8, 1] });
    links.forEach(function (link) { observer.observe(link); });
})();
