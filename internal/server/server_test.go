package server

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestRoutes(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "static"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("Gubiter"), 0600); err != nil {
		t.Fatal(err)
	}
	handler := New(root)
	for _, tc := range []struct {
		method, path string
		status       int
	}{
		{"GET", "/", 200}, {"GET", "/healthz", 200}, {"GET", "/readyz", 503},
		{"POST", "/api/login", 503}, {"GET", "/missing", 404},
		{"GET", "/static/", 404}, {"GET", "/main.go", 404}, {"POST", "/", 405},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(tc.method, tc.path, nil))
			if response.Code != tc.status {
				t.Fatalf("got %d, want %d", response.Code, tc.status)
			}
			if response.Header().Get("X-Content-Type-Options") != "nosniff" {
				t.Fatal("security header missing")
			}
		})
	}
}
