package services

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/joaov/coffeeholic/internal/db"
)

type Folder struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	CollectionID string `json:"collection_id"`
	CreatedAt    string `json:"created_at"`
}

type FoldersService struct {
	store *db.Store
}

func NewFoldersService(store *db.Store) *FoldersService {
	return &FoldersService{store: store}
}

func (s *FoldersService) FindByCollectionID(collectionID string) ([]Folder, error) {
	rows, err := s.store.DB.Query(
		`SELECT id, name, collection_id, created_at FROM folders
		 WHERE collection_id = ?
		 ORDER BY name ASC`,
		collectionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Folder{}
	for rows.Next() {
		var f Folder
		if err := rows.Scan(&f.ID, &f.Name, &f.CollectionID, &f.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (s *FoldersService) FindByID(id string) (Folder, error) {
	var f Folder
	err := s.store.DB.QueryRow(
		`SELECT id, name, collection_id, created_at FROM folders WHERE id = ?`, id,
	).Scan(&f.ID, &f.Name, &f.CollectionID, &f.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Folder{}, fmt.Errorf("pasta não encontrada")
	}
	return f, err
}

func (s *FoldersService) Create(collectionID, name string) (Folder, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Folder{}, fmt.Errorf("nome da pasta não pode ser vazio")
	}
	if strings.TrimSpace(collectionID) == "" {
		return Folder{}, fmt.Errorf("collection_id é obrigatório")
	}
	f := Folder{
		ID:           uuid.NewString(),
		Name:         name,
		CollectionID: collectionID,
		CreatedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	_, err := s.store.DB.Exec(
		`INSERT INTO folders (id, name, collection_id, created_at) VALUES (?, ?, ?, ?)`,
		f.ID, f.Name, f.CollectionID, f.CreatedAt,
	)
	if err != nil {
		return Folder{}, err
	}
	return f, nil
}

func (s *FoldersService) Update(id, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("nome da pasta não pode ser vazio")
	}
	_, err := s.store.DB.Exec(`UPDATE folders SET name = ? WHERE id = ?`, name, id)
	return err
}

func (s *FoldersService) Delete(id string) error {
	_, err := s.store.DB.Exec(`DELETE FROM folders WHERE id = ?`, id)
	return err
}
