package main

import (
	"fmt"
	"net/http"
)

func main() {

	// Serve files from the web folder.
	http.Handle("/", http.FileServer(http.Dir("./web")))

	// Serve CSS, JavaScript and other static files.
	http.Handle(
		"/static/",
		http.StripPrefix(
			"/static/",
			http.FileServer(http.Dir("./web/static")),
		),
	)

	fmt.Println("Gubiter server is running at http://localhost:8080")

	err := http.ListenAndServe(":8080", nil)

	if err != nil {
		fmt.Println("Server error:", err)
	}
}