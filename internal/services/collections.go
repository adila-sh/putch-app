package services

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/joaov/coffeeholic/internal/db"
)

type Collection struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
}

type CollectionsService struct {
	store *db.Store
}

func NewCollectionsService(store *db.Store) *CollectionsService {
	return &CollectionsService{store: store}
}

func (s *CollectionsService) FindAll(page, limit int) ([]Collection, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit
	rows, err := s.store.DB.Query(
		`SELECT id, name, created_at FROM collections ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Collection{}
	for rows.Next() {
		var c Collection
		if err := rows.Scan(&c.ID, &c.Name, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *CollectionsService) FindByQuery(query string, page, limit int) ([]Collection, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit
	like := "%" + query + "%"
	rows, err := s.store.DB.Query(
		`SELECT id, name, created_at FROM collections
		 WHERE name LIKE ?
		 ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		like, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Collection{}
	for rows.Next() {
		var c Collection
		if err := rows.Scan(&c.ID, &c.Name, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *CollectionsService) FindByID(id string) (Collection, error) {
	var c Collection
	err := s.store.DB.QueryRow(
		`SELECT id, name, created_at FROM collections WHERE id = ?`, id,
	).Scan(&c.ID, &c.Name, &c.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Collection{}, fmt.Errorf("coleção não encontrada")
	}
	return c, err
}

func (s *CollectionsService) Create(name string) (Collection, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Collection{}, fmt.Errorf("nome da coleção não pode ser vazio")
	}
	c := Collection{
		ID:        uuid.NewString(),
		Name:      name,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	_, err := s.store.DB.Exec(
		`INSERT INTO collections (id, name, created_at) VALUES (?, ?, ?)`,
		c.ID, c.Name, c.CreatedAt,
	)
	if err != nil {
		return Collection{}, err
	}
	return c, nil
}

func (s *CollectionsService) Update(id, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("nome da coleção não pode ser vazio")
	}
	_, err := s.store.DB.Exec(`UPDATE collections SET name = ? WHERE id = ?`, name, id)
	return err
}

func (s *CollectionsService) Delete(id string) error {
	_, err := s.store.DB.Exec(`DELETE FROM collections WHERE id = ?`, id)
	return err
}

func (s *CollectionsService) Export(id string) (string, error) {
	c, err := s.FindByID(id)
	if err != nil {
		return "", err
	}
	payload := map[string]any{"collection": c}
	bytes, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func (s *CollectionsService) Import(fileContent string) (Collection, error) {
	var payload struct {
		Collection struct {
			Name string `json:"name"`
		} `json:"collection"`
	}
	if err := json.Unmarshal([]byte(fileContent), &payload); err != nil {
		return Collection{}, err
	}
	name := payload.Collection.Name
	if name == "" {
		name = "Sem nome"
	}
	return s.Create(name)
}
