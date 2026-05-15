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

type Environment struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	CollectionID string            `json:"collection_id"`
	Variables    map[string]string `json:"variables"`
	CreatedAt    string            `json:"created_at"`
}

type EnvironmentsService struct {
	store *db.Store
}

func NewEnvironmentsService(store *db.Store) *EnvironmentsService {
	return &EnvironmentsService{store: store}
}

func scanEnvironment(rows interface {
	Scan(dest ...any) error
}) (Environment, error) {
	var (
		e        Environment
		varsJSON string
	)
	err := rows.Scan(&e.ID, &e.CollectionID, &e.Name, &varsJSON, &e.CreatedAt)
	if err != nil {
		return e, err
	}
	e.Variables = map[string]string{}
	if varsJSON != "" {
		_ = json.Unmarshal([]byte(varsJSON), &e.Variables)
	}
	return e, nil
}

// FindAll returns environments. If collectionID is empty, returns all.
func (s *EnvironmentsService) FindAll(collectionID string) ([]Environment, error) {
	var (
		rows *sql.Rows
		err  error
	)
	if collectionID != "" {
		rows, err = s.store.DB.Query(
			`SELECT id, collection_id, name, variables, created_at FROM environments
			 WHERE collection_id = ? ORDER BY created_at DESC`, collectionID,
		)
	} else {
		rows, err = s.store.DB.Query(
			`SELECT id, collection_id, name, variables, created_at FROM environments
			 ORDER BY created_at DESC`,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Environment{}
	for rows.Next() {
		e, err := scanEnvironment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *EnvironmentsService) FindByID(id string) (*Environment, error) {
	row := s.store.DB.QueryRow(
		`SELECT id, collection_id, name, variables, created_at FROM environments WHERE id = ?`, id,
	)
	e, err := scanEnvironment(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (s *EnvironmentsService) Create(collectionID, name string, variables map[string]string) (Environment, error) {
	if variables == nil {
		variables = map[string]string{}
	}
	varsJSON, err := json.Marshal(variables)
	if err != nil {
		return Environment{}, err
	}
	e := Environment{
		ID:           uuid.NewString(),
		Name:         name,
		CollectionID: collectionID,
		Variables:    variables,
		CreatedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	if e.Name == "" {
		return Environment{}, fmt.Errorf("nome do environment é obrigatório")
	}
	_, err = s.store.DB.Exec(
		`INSERT INTO environments (id, collection_id, name, variables, created_at) VALUES (?, ?, ?, ?, ?)`,
		e.ID, e.CollectionID, e.Name, string(varsJSON), e.CreatedAt,
	)
	if err != nil {
		return Environment{}, err
	}
	return e, nil
}

func (s *EnvironmentsService) Update(id, name string, variables map[string]string) error {
	if variables == nil {
		variables = map[string]string{}
	}
	varsJSON, err := json.Marshal(variables)
	if err != nil {
		return err
	}
	_, err = s.store.DB.Exec(
		`UPDATE environments SET name = ?, variables = ? WHERE id = ?`,
		name, string(varsJSON), id,
	)
	return err
}

func (s *EnvironmentsService) Delete(id string) error {
	_, err := s.store.DB.Exec(`DELETE FROM environments WHERE id = ?`, id)
	return err
}

// Interpolate replaces {{key}} occurrences in text with values from variables.
func (s *EnvironmentsService) Interpolate(text string, variables map[string]string) string {
	for k, v := range variables {
		text = strings.ReplaceAll(text, "{{"+k+"}}", v)
	}
	return text
}
