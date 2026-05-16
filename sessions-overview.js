{
  "rewrites": [
    { "source": "/", "destination": "/admin.html" },
    { "source": "/s/:id", "destination": "/s/index.html" },
    { "source": "/api/session/:id", "destination": "/api/session/[id]" }
  ]
}
