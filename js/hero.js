// The photo on the home page, after the elves: whoever has got them home
// (rickbot's dungeon, chat/chat.js, leaves a flag) sees it dreamed. The
// graphics card draws the photo through a Julia set: each pixel's point is
// squared and shifted a few times, z -> z^2 + c, and the photo is sampled
// again at each stop, mirrored and tiled, so the face comes back doubled,
// quartered, folded into itself, the way a network's daydream of a face
// does. c drifts, so it breathes; hovering leans in. The plain photo stays
// underneath for everyone else, and for a visitor who asked for less motion
// the dream holds one frame.
(function () {
    "use strict";
    var fig = document.querySelector(".blurb .hero");
    if (!fig) return;
    var img = fig.querySelector("img"), frame = fig.querySelector(".frame");
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var started = false;

    function start() {
        if (started) return;
        started = true;
        if (!img.complete || !img.naturalWidth) { img.addEventListener("load", start2); return; }
        start2();
    }
    function start2() {
        var canvas = document.createElement("canvas");
        canvas.className = "dream";
        canvas.setAttribute("aria-hidden", "true");
        var gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false });
        if (!gl) { fig.classList.add("dreaming-css"); return; }
        frame.appendChild(canvas);
        fig.classList.add("dreaming");

        var vert = "attribute vec2 p; varying vec2 vUv; void main() { vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }";
        var frag = [
            "precision highp float;",
            "uniform sampler2D uTex;",
            "uniform vec2 uC;",
            "uniform float uMix, uHue, uAspect;",
            "varying vec2 vUv;",
            "vec2 sq(vec2 z) { return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y); }",
            "vec2 mirror(vec2 q) { return abs(fract(q * 0.5) * 2.0 - 1.0); }",
            "vec3 hue(vec3 c, float a) { float s = sin(a), k = cos(a); vec3 g = vec3(0.57735); return c * k + cross(g, c) * s + g * dot(g, c) * (1.0 - k); }",
            "void main() {",
            "  vec3 base = texture2D(uTex, vUv).rgb;",
            "  vec2 z = (vUv - 0.5) * vec2(1.0, uAspect) * 1.1;",
            "  vec3 d = base; float w = 0.55;",
            "  for (int i = 0; i < 3; i++) {",
            "    z = sq(z) + uC;",
            "    vec2 q = mirror(0.5 + 0.5 * z / vec2(1.0, uAspect));",
            "    vec3 s = (texture2D(uTex, q).rgb - 0.5) * 1.5 + 0.5;",
            "    d = mix(d, s, w); w *= 0.6;",
            "  }",
            "  d = hue(d, uHue + 2.2 * (vUv.x - vUv.y));",
            "  float l = dot(d, vec3(0.3, 0.59, 0.11));",
            "  d = clamp(mix(vec3(l), d, 1.9), 0.0, 1.0);",
            "  gl_FragColor = vec4(mix(base, d, uMix), 1.0);",
            "}"
        ].join("\n");
        function shader(type, src) {
            var s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
            return s;
        }
        var prog = gl.createProgram();
        gl.attachShader(prog, shader(gl.VERTEX_SHADER, vert));
        gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, frag));
        gl.linkProgram(prog);
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var p = gl.getAttribLocation(prog, "p");
        gl.enableVertexAttribArray(p);
        gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        var U = {};
        ["uTex", "uC", "uMix", "uHue", "uAspect"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
        gl.uniform1i(U.uTex, 0);
        gl.uniform1f(U.uAspect, img.naturalHeight / img.naturalWidth);

        var mix = 0, want = 0.75, hover = false;
        fig.addEventListener("pointerenter", function () { hover = true; });
        fig.addEventListener("pointerleave", function () { hover = false; });
        var t0 = performance.now(), last = t0, raf = 0, seen = true;
        function fit() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
        }
        function draw(now) {
            var t = (now - t0) / 1000, dt = Math.min((now - last) / 1000, 0.1);
            last = now;
            want = hover ? 0.92 : 0.7;
            mix += (Math.min(want, t / 3) - mix) * (still ? 1 : Math.min(1, dt * 2));
            fit();
            gl.uniform2f(U.uC, -0.05 + 0.16 * Math.cos(t * 0.11), 0.03 + 0.16 * Math.sin(t * 0.07));
            gl.uniform1f(U.uMix, still ? 0.8 : mix);
            gl.uniform1f(U.uHue, still ? 0.6 : t * 0.08);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        function frame_(now) {
            raf = 0;
            if (!seen) return;
            draw(now);
            if (!still) raf = requestAnimationFrame(frame_);
        }
        if ("IntersectionObserver" in window) {
            new IntersectionObserver(function (entries) {
                seen = entries[0].isIntersecting;
                if (seen && !raf && !still) raf = requestAnimationFrame(frame_);
            }).observe(canvas);
        }
        raf = requestAnimationFrame(frame_);
    }

    var on = false;
    try { on = !!localStorage.getItem("elf"); } catch (e) { /* no storage */ }
    if (on) start();
    window.addEventListener("elves", start);
})();
