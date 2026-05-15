package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	_ "modernc.org/sqlite"
)

type Store struct {
	mu sync.Mutex
	DB *sql.DB
}

func Open() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("user config dir: %w", err)
	}
	appDir := filepath.Join(dir, "coffeeholic")
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		return nil, fmt.Errorf("create app dir: %w", err)
	}

	dbPath := filepath.Join(appDir, "coffeeholic.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return nil, err
	}

	store := &Store{DB: db}
	if err := store.migrate(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *Store) Lock()   { s.mu.Lock() }
func (s *Store) Unlock() { s.mu.Unlock() }

func (s *Store) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS collections (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS folders (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			collection_id TEXT NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
			UNIQUE(name, collection_id)
		)`,
		`CREATE TABLE IF NOT EXISTS requests (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			collection_id TEXT NOT NULL,
			folder_id TEXT,
			url TEXT NOT NULL,
			method TEXT NOT NULL,
			headers TEXT NOT NULL,
			body TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			is_favorite INTEGER NOT NULL DEFAULT 0,
			is_active INTEGER NOT NULL DEFAULT 1,
			FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
			FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
		)`,
		`CREATE TABLE IF NOT EXISTS environments (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			collection_id TEXT NOT NULL,
			variables TEXT NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY (collection_id) REFERENCES collections(id),
			UNIQUE(name, collection_id)
		)`,
	}
	for _, q := range stmts {
		if _, err := s.DB.Exec(q); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	return nil
}
