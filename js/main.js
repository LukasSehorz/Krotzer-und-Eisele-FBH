/* Krotzer & Eisele – Interaktionen */
(function () {
  "use strict";

  /* sticky header shadow */
  var header = document.querySelector(".header");
  var onScroll = function () {
    if (header) header.classList.toggle("is-stuck", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* mobile menu */
  var burger = document.querySelector(".burger");
  var mobileNav = document.querySelector(".mobile-nav");
  if (burger && mobileNav) {
    var toggle = function () {
      var open = burger.classList.toggle("is-open");
      mobileNav.classList.toggle("is-open", open);
      document.body.style.overflow = open ? "hidden" : "";
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    };
    burger.addEventListener("click", toggle);
    mobileNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        burger.classList.remove("is-open");
        mobileNav.classList.remove("is-open");
        document.body.style.overflow = "";
      });
    });
  }

  /* active nav link by current path */
  var path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a, .mobile-nav a").forEach(function (a) {
    var href = (a.getAttribute("href") || "").split("/").pop();
    if (href === path) a.classList.add("active");
  });

  /* FAQ accordion */
  document.querySelectorAll(".faq__q").forEach(function (q) {
    q.addEventListener("click", function () {
      var item = q.closest(".faq__item");
      var ans = item.querySelector(".faq__a");
      var open = item.classList.contains("is-open");
      item.classList.toggle("is-open", !open);
      ans.style.maxHeight = open ? null : ans.scrollHeight + "px";
      q.setAttribute("aria-expanded", open ? "false" : "true");
    });
  });

  /* scroll reveal */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* animated counters */
  var counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window && counters.length) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, target = parseFloat(el.dataset.count),
            suffix = el.dataset.suffix || "", dur = 1600, t0 = null;
        var step = function (ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / dur, 1);
          var val = Math.floor((1 - Math.pow(1 - p, 3)) * target);
          el.textContent = val.toLocaleString("de-DE") + suffix;
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = target.toLocaleString("de-DE") + suffix;
        };
        requestAnimationFrame(step);
        co.unobserve(el);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* Bild-Komprimierung: verkleinert große (Handy-)Fotos vor dem Upload,
     damit die Einsendung sicher unter Netlifys ~10-MB-Limit bleibt. */
  function compressImage(file, maxDim, quality) {
    return new Promise(function (resolve) {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) { resolve(file); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var cw = Math.max(1, Math.round(img.width * scale));
        var ch = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement("canvas");
        canvas.width = cw; canvas.height = ch;
        canvas.getContext("2d").drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          resolve(blob && blob.size < file.size ? blob : file);
        }, "image/jpeg", quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  /* Blob/Datei -> base64 (ohne data:-Präfix) für den Mail-Anhang */
  function fileToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        var s = String(r.result), c = s.indexOf(",");
        resolve(c >= 0 ? s.slice(c + 1) : s);
      };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  /* contact form -> Netlify Function -> Resend */
  var form = document.querySelector("#anfrage-form");
  if (form) {
    var missingBox = form.querySelector(".form__missing");

    /* lesbare Beschriftung eines Felds ermitteln */
    function fieldLabel(el) {
      if (el.name === "datenschutz") return "Datenschutz-Einwilligung";
      var lab = el.id ? form.querySelector('label[for="' + el.id + '"]') : null;
      if (!lab) { var f = el.closest(".field"); if (f) lab = f.querySelector("label"); }
      var t = lab ? lab.textContent.replace(/\*/g, "").trim() : (el.name || "Feld");
      return t.length > 55 ? t.slice(0, 52).trim() + "…" : t;
    }

    /* Markierungen + Hinweisbox zurücksetzen */
    function clearMissing() {
      form.querySelectorAll(".is-invalid").forEach(function (el) { el.classList.remove("is-invalid"); });
      if (missingBox) { missingBox.classList.remove("show"); missingBox.innerHTML = ""; }
    }

    /* alle fehlenden Pflichtfelder sammeln und formatiert anzeigen */
    function showMissing() {
      var invalids = form.querySelectorAll(":invalid");
      var seen = {}, items = "";
      invalids.forEach(function (el) {
        el.classList.add("is-invalid");
        var lbl = fieldLabel(el);
        if (!seen[lbl]) { seen[lbl] = 1; items += "<li>" + lbl + "</li>"; }
      });
      if (missingBox) {
        missingBox.innerHTML =
          "<strong>Bitte füllen Sie noch folgende Pflichtfelder aus:</strong><ul>" + items + "</ul>";
        missingBox.classList.add("show");
        missingBox.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      var first = invalids[0];
      if (first && first.focus) { try { first.focus({ preventScroll: true }); } catch (e) {} }
    }

    /* Markierung entfernen, sobald ein Feld korrigiert wurde */
    var recheck = function (ev) {
      var t = ev.target;
      if (t && t.classList && t.classList.contains("is-invalid") && t.checkValidity && t.checkValidity()) {
        t.classList.remove("is-invalid");
      }
    };
    form.addEventListener("input", recheck);
    form.addEventListener("change", recheck);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      clearMissing();
      if (!form.checkValidity()) { showMissing(); return; }

      var ok = form.querySelector(".form__ok");
      var err = form.querySelector(".form__err");
      var btn = form.querySelector("button[type=submit]");
      var showErr = function (msg) {
        if (!err) return;
        if (msg) err.textContent = msg;
        err.classList.add("show");
        err.scrollIntoView({ behavior: "smooth", block: "center" });
      };
      if (err) err.classList.remove("show");
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "Wird gesendet …"; }

      /* Textfelder sammeln (Mehrfach-Checkboxen zusammenführen) */
      var fields = {}, multi = {};
      new FormData(form).forEach(function (v, k) {
        if (typeof v !== "string") return;            // Dateien separat behandeln
        if (k === "bot-field") return;                // Honeypot separat
        if (fields[k] !== undefined) {
          if (!multi[k]) multi[k] = [fields[k]];
          multi[k].push(v);
        } else {
          fields[k] = v;
        }
      });
      Object.keys(multi).forEach(function (k) { fields[k] = multi[k].join(", "); });
      var dsg = form.querySelector("[name=datenschutz]");
      if (dsg && dsg.checked) fields.datenschutz = "Ja";
      var botField = (form.querySelector("[name=bot-field]") || {}).value || "";

      /* Fotos/Grundriss komprimieren -> base64-Anhänge */
      var jobs = [];
      form.querySelectorAll("input[type=file]").forEach(function (input) {
        Array.prototype.forEach.call(input.files, function (file) {
          jobs.push(compressImage(file, 1600, 0.82).then(function (out) {
            return fileToBase64(out).then(function (b64) {
              var name = /^image\//.test(file.type) ? file.name.replace(/\.[^.]+$/, "") + ".jpg" : file.name;
              return { filename: name, content: b64 };
            });
          }));
        });
      });

      Promise.all(jobs).then(function (attachments) {
        var payloadSize = attachments.reduce(function (s, a) { return s + (a.content ? a.content.length : 0); }, 0);
        if (payloadSize > 4.5 * 1024 * 1024) throw new Error("too-large");
        return fetch("/.netlify/functions/anfrage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: fields, attachments: attachments, botField: botField })
        });
      }).then(function (res) {
        if (!res || !res.ok) throw new Error("submit-failed");
        if (ok) { ok.classList.add("show"); ok.scrollIntoView({ behavior: "smooth", block: "center" }); }
        if (err) err.classList.remove("show");
        form.reset();
      }).catch(function (e) {
        showErr(e && e.message === "too-large"
          ? "Die angehängten Dateien sind zu groß. Bitte laden Sie weniger oder kleinere Fotos hoch – oder senden Sie diese separat per E-Mail an ke.fraestechnik@gmail.com."
          : "Es gab ein Problem beim Übermitteln. Bitte versuchen Sie es erneut oder kontaktieren Sie uns direkt telefonisch.");
      }).finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || "Anfrage absenden"; }
      });
    });
  }

  /* footer year */
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();

  /* cookie banner */
  var cb = document.getElementById("cookieBanner");
  if (cb) {
    var stored = null;
    try { stored = localStorage.getItem("cookieConsent"); } catch (e) {}
    if (!stored) setTimeout(function () { cb.classList.add("show"); }, 700);
    cb.querySelectorAll("[data-cookie]").forEach(function (b) {
      b.addEventListener("click", function () {
        try { localStorage.setItem("cookieConsent", b.getAttribute("data-cookie")); } catch (e) {}
        cb.classList.remove("show");
      });
    });
  }
})();
