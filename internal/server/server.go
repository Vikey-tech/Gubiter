package server

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

// New serves only explicitly public files. Readiness stays false until a real
// database repository is connected; liveness must not imply database readiness.
func New(webRoot string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		respond(w, 200, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		respond(w, 503, map[string]string{"status": "not_ready", "reason": "Application database integration pending; Supabase Auth is accessed by the browser"})
	})
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		respond(w, 503, map[string]string{"error": "Backend integration is in progress. This feature is unavailable."})
	})
	assets := http.FileServer(http.Dir(filepath.Join(webRoot, "static")))
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		if !filepath.IsLocal(name) {
			http.NotFound(w, r)
			return
		}
		info, err := os.Stat(filepath.Join(webRoot, "static", name))
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		assets.ServeHTTP(w, r)
	})))
	pages := map[string]string{"/": "index.html", "/login.html": "login.html", "/register.html": "register.html", "/profile.html": "profile.html"}
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		page, ok := pages[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(webRoot, page))
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; connect-src 'self' https://eosedilylahuqogqzdjf.supabase.co; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
		mux.ServeHTTP(w, r)
	})
}
