package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os/exec"
	"strings"
	"time"
)

const (
	address = "127.0.0.1:8090"
	origin  = "http://127.0.0.1:8090"
)

var volumeSteps = map[string]string{"up": "5%+", "down": "5%-"}
var mediaActions = map[string]string{"next": "next", "previous": "previous"}

type commandRequest struct {
	Direction string `json:"direction"`
	Action    string `json:"action"`
}

func writeJSON(response http.ResponseWriter, status int, payload any) {
	response.Header().Set("Content-Type", "application/json")
	response.Header().Set("Cache-Control", "no-store")
	response.WriteHeader(status)
	if err := json.NewEncoder(response).Encode(payload); err != nil {
		log.Printf("write response: %v", err)
	}
}

func validateRequest(response http.ResponseWriter, request *http.Request) bool {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "POST required"})
		return false
	}
	if requestOrigin := request.Header.Get("Origin"); requestOrigin != "" && requestOrigin != origin {
		writeJSON(response, http.StatusForbidden, map[string]string{"error": "Cross-origin request denied"})
		return false
	}
	if !strings.HasPrefix(request.Header.Get("Content-Type"), "application/json") {
		writeJSON(response, http.StatusUnsupportedMediaType, map[string]string{"error": "JSON required"})
		return false
	}
	request.Body = http.MaxBytesReader(response, request.Body, 256)
	return true
}

func volumeHandler(response http.ResponseWriter, request *http.Request) {
	if !validateRequest(response, request) {
		return
	}
	var payload commandRequest
	if json.NewDecoder(request.Body).Decode(&payload) != nil || volumeSteps[payload.Direction] == "" {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": "Unsupported audio-control command"})
		return
	}
	if err := exec.Command("wpctl", "set-volume", "-l", "1.0", "@DEFAULT_AUDIO_SINK@", volumeSteps[payload.Direction]).Run(); err != nil {
		log.Printf("volume command: %v", err)
		writeJSON(response, http.StatusServiceUnavailable, map[string]string{"error": "Audio control unavailable"})
		return
	}
	output, err := exec.Command("wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@").Output()
	if err != nil {
		log.Printf("read volume: %v", err)
		writeJSON(response, http.StatusServiceUnavailable, map[string]string{"error": "Audio control unavailable"})
		return
	}
	writeJSON(response, http.StatusOK, map[string]string{"direction": payload.Direction, "volume": strings.TrimSpace(string(output))})
}

func mediaHandler(response http.ResponseWriter, request *http.Request) {
	if !validateRequest(response, request) {
		return
	}
	var payload commandRequest
	if json.NewDecoder(request.Body).Decode(&payload) != nil || mediaActions[payload.Action] == "" {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": "Unsupported audio-control command"})
		return
	}
	if err := exec.Command("playerctl", mediaActions[payload.Action]).Run(); err != nil {
		log.Printf("media command: %v", err)
		writeJSON(response, http.StatusServiceUnavailable, map[string]string{"error": "Audio control unavailable"})
		return
	}
	writeJSON(response, http.StatusOK, map[string]string{"action": payload.Action})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/volume", volumeHandler)
	mux.HandleFunc("/api/media", mediaHandler)
	mux.Handle("/", http.FileServer(http.Dir(".")))
	server := &http.Server{Addr: address, Handler: mux, ReadHeaderTimeout: 2 * time.Second}
	log.Printf("Serving Human Interface on %s", origin+"/")
	log.Fatal(server.ListenAndServe())
}
