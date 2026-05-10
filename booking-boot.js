;(function () {
  window.global = window
  window.process = window.process || { browser: true, env: { NODE_ENV: "production" } }
})()
