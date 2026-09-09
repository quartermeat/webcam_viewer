package main

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestHabitatReproducible(t *testing.T) {
	read := func() string {
		w := httptest.NewRecorder()
		habitatHandler(w, httptest.NewRequest("GET", "/api/habitat", nil))
		if w.Code != 200 {
			t.Fatal(w.Code)
		}
		return w.Body.String()
	}
	first := read()
	if first != read() {
		t.Fatal("habitat seed is not reproducible")
	}
	var data struct {
		Version   int
		Creatures []map[string]float64
	}
	if err := json.Unmarshal([]byte(first), &data); err != nil {
		t.Fatal(err)
	}
	if data.Version != 1 || len(data.Creatures) != 28 {
		t.Fatal("unexpected population")
	}
	for _, c := range data.Creatures {
		if c["x"] < 0 || c["x"] > 1 || c["y"] < 0 || c["y"] > 1 || c["speed"] <= 0 {
			t.Fatal("invalid creature", c)
		}
	}
	w := httptest.NewRecorder()
	habitatHandler(w, httptest.NewRequest("POST", "/api/habitat", nil))
	if w.Code != 405 {
		t.Fatal(w.Code)
	}
}
