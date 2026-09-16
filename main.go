package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.Handle("/", http.FileServer(http.Dir("./web")))

	fmt.Println("Gubiter server is running at http://localhost:8080")

	http.ListenAndServe(":8080", nil)
}