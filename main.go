package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/joaov/coffeeholic/internal/db"
	"github.com/joaov/coffeeholic/internal/services"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	store, err := db.Open()
	if err != nil {
		log.Fatalf("falha ao abrir banco: %v", err)
	}

	app := application.New(application.Options{
		Name:        "coffeeholic",
		Description: "API client desktop",
		Services: []application.Service{
			application.NewService(services.NewCollectionsService(store)),
			application.NewService(services.NewFoldersService(store)),
			application.NewService(services.NewRequestsService(store)),
			application.NewService(services.NewEnvironmentsService(store)),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "coffeeholic",
		Width:            800,
		Height:           600,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
