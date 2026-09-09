package main

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestSystemStats(t *testing.T) {
	for i := 0; i < 2; i++ {
		response := httptest.NewRecorder()
		systemStatsHandler(response, httptest.NewRequest("GET", "/api/system-stats", nil))
		var stats map[string]float64
		if err := json.Unmarshal(response.Body.Bytes(), &stats); err != nil {
			t.Fatal(err)
		}
		for key, value := range stats {
			if value < 0 || value > 1 {
				t.Fatalf("invalid %s: %f", key, value)
			}
		}
	}
	response := httptest.NewRecorder()
	systemStatsHandler(response, httptest.NewRequest("POST", "/api/system-stats", nil))
	if response.Code != 405 {
		t.Fatal(response.Code)
	}
}
