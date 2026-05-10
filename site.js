;(function () {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual"
  }

  function scrollTopHard() {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }

  scrollTopHard()
  document.addEventListener("DOMContentLoaded", scrollTopHard)
  window.addEventListener("load", scrollTopHard)
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) scrollTopHard()
  })

  const mqNarrow = window.matchMedia("(max-width: 768px)")
  let freeIntro = function () {}

  if (!prefersReduced && mqNarrow.matches) {
    document.body.classList.add("mobile-intro-locked")
    const bio = document.getElementById("bio")
    const cv = document.getElementById("cv")
    const showreel = document.getElementById("showreel")
    if (bio) bio.setAttribute("aria-hidden", "true")
    if (cv) cv.setAttribute("aria-hidden", "true")
    if (showreel) showreel.setAttribute("aria-hidden", "true")

    let freed = false
    freeIntro = function () {
      if (freed) return
      freed = true
      document.body.classList.remove("mobile-intro-locked")
      document.body.classList.add("mobile-intro-free")
      if (bio) bio.removeAttribute("aria-hidden")
      if (cv) cv.removeAttribute("aria-hidden")
      if (showreel) showreel.removeAttribute("aria-hidden")
      window.removeEventListener("scroll", onFirstScroll, { passive: true })
      window.removeEventListener("touchmove", freeIntro, { passive: true })
      window.removeEventListener("wheel", freeIntro, { passive: true })
    }

    function onFirstScroll() {
      if ((window.scrollY || 0) > 8) freeIntro()
    }

    window.addEventListener("scroll", onFirstScroll, { passive: true })
    window.addEventListener("touchmove", freeIntro, { passive: true })
    window.addEventListener("wheel", freeIntro, { passive: true })

    document.querySelectorAll('.site-header__nav a[href^="#"]').forEach((a) => {
      a.addEventListener("click", () => freeIntro())
    })
  }

  const siteBg = document.querySelector(".site-bg")
  if (siteBg && !prefersReduced) {
    let ticking = false
    const parallax = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY || 0
        siteBg.style.setProperty("--bg-parallax", `${y * 0.1}px`)
        ticking = false
      })
    }
    window.addEventListener("scroll", parallax, { passive: true })
    parallax()
  }

  const loader = document.getElementById("site-loader")
  if (loader && !prefersReduced) {
    const done = () => {
      loader.classList.add("site-loader--done")
      loader.setAttribute("aria-hidden", "true")
      window.setTimeout(() => loader.remove(), 700)
    }
    window.addEventListener("load", () => window.setTimeout(done, 480))
    window.setTimeout(done, 3200)
  } else if (loader) {
    loader.remove()
  }

  const nav = document.querySelector(".site-header__nav")
  const toggle = document.querySelector(".site-header__menu-btn")

  function closeNav() {
    if (!nav || !toggle) return
    nav.classList.remove("site-header__nav--open")
    toggle.setAttribute("aria-expanded", "false")
    document.body.classList.remove("site-nav-open")
  }

  if (toggle && nav) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation()
      const open = nav.classList.toggle("site-header__nav--open")
      toggle.setAttribute("aria-expanded", open ? "true" : "false")
      document.body.classList.toggle("site-nav-open", open)
    })
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", closeNav)
    })
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav()
    })
    document.addEventListener("click", (e) => {
      if (!nav.classList.contains("site-header__nav--open")) return
      const t = e.target
      if (t instanceof Node && !nav.contains(t) && !toggle.contains(t)) closeNav()
    })
  }

  if (!prefersReduced) {
    let lastY = window.scrollY || 0
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY || 0
        const delta = y - lastY
        if (Math.abs(delta) > 2) {
          document.body.classList.toggle("scroll-down", delta > 0)
          document.body.classList.toggle("scroll-up", delta < 0)
        }
        lastY = y
        ticking = false
      })
    }
    document.body.classList.add("scroll-down")
    window.addEventListener("scroll", onScroll, { passive: true })
  }

  if (!prefersReduced && "IntersectionObserver" in window) {
    const narrow = window.matchMedia("(max-width: 768px)").matches
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("reveal--visible")
        })
      },
      {
        rootMargin: narrow ? "0px 0px -2% 0px" : "0px 0px -6% 0px",
        threshold: narrow ? 0.02 : 0.06,
      }
    )
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el))
  } else {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("reveal--visible"))
  }
})()
