package main

import (
	"fmt"
	"net/http"
)

func homeHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "Welcome to Gubiter!")
}

func main() {
	http.HandleFunc("/", homeHandler)

	fmt.Println("Gubiter server is running at http://localhost:8080")

	http.ListenAndServe(":8080", nil)
}