;(function () {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

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
        rootMargin: narrow ? "0px 0px -4% 0px" : "0px 0px -8% 0px",
        threshold: narrow ? 0.04 : 0.08,
      }
    )
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el))
  } else {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("reveal--visible"))
  }

})()
