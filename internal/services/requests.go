package services

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/joaov/coffeeholic/internal/db"
)

type Request struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	CollectionID string            `json:"collection_id"`
	FolderID     string            `json:"folder_id"`
	URL          string            `json:"url"`
	Method       string            `json:"method"`
	Headers      map[string]string `json:"headers"`
	Body         string            `json:"body"`
	CreatedAt    string            `json:"created_at"`
	UpdatedAt    string            `json:"updated_at"`
	IsFavorite   bool              `json:"is_favorite"`
	IsActive     bool              `json:"is_active"`
}

type RequestInput struct {
	Name         string            `json:"name"`
	CollectionID string            `json:"collection_id"`
	FolderID     string            `json:"folder_id"`
	URL          string            `json:"url"`
	Method       string            `json:"method"`
	Headers      map[string]string `json:"headers"`
	Body         string            `json:"body"`
}

type RequestUpdate struct {
	Name     string            `json:"name"`
	FolderID string            `json:"folder_id"`
	URL      string            `json:"url"`
	Method   string            `json:"method"`
	Headers  map[string]string `json:"headers"`
	Body     string            `json:"body"`
}

type RequestConfig struct {
	URL     string            `json:"url"`
	Method  string            `json:"method"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

type ResponseData struct {
	Status     int               `json:"status"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	DurationMS float64           `json:"duration_ms"`
}

type RequestsService struct {
	store  *db.Store
	client *http.Client
}

func NewRequestsService(store *db.Store) *RequestsService {
	return &RequestsService{
		store:  store,
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

func scanRequest(rows interface {
	Scan(dest ...any) error
}) (Request, error) {
	var (
		r           Request
		folderID    sql.NullString
		headersJSON string
		isFav       int
		isActive    int
	)
	err := rows.Scan(
		&r.ID, &r.Name, &r.CollectionID, &folderID, &r.URL, &r.Method,
		&headersJSON, &r.Body, &r.CreatedAt, &r.UpdatedAt,
		&isFav, &isActive,
	)
	if err != nil {
		return r, err
	}
	if folderID.Valid {
		r.FolderID = folderID.String
	}
	r.Headers = map[string]string{}
	if headersJSON != "" {
		_ = json.Unmarshal([]byte(headersJSON), &r.Headers)
	}
	r.IsFavorite = isFav != 0
	r.IsActive = isActive != 0
	return r, nil
}

const requestSelectCols = `id, name, collection_id, folder_id, url, method, headers, body, created_at, updated_at, is_favorite, is_active`

func nullableID(id string) any {
	if strings.TrimSpace(id) == "" {
		return nil
	}
	return id
}

func (s *RequestsService) FindAll(page, limit int) ([]Request, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit
	rows, err := s.store.DB.Query(
		`SELECT `+requestSelectCols+` FROM requests ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Request{}
	for rows.Next() {
		r, err := scanRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *RequestsService) FindByCollectionID(collectionID string, page, limit int) ([]Request, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit
	rows, err := s.store.DB.Query(
		`SELECT `+requestSelectCols+` FROM requests
		 WHERE collection_id = ?
		 ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		collectionID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Request{}
	for rows.Next() {
		r, err := scanRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *RequestsService) FindByFolderID(folderID string, page, limit int) ([]Request, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit
	rows, err := s.store.DB.Query(
		`SELECT `+requestSelectCols+` FROM requests
		 WHERE folder_id = ?
		 ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		folderID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Request{}
	for rows.Next() {
		r, err := scanRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *RequestsService) FindByQuery(query string, page, limit int) ([]Request, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit
	like := "%" + query + "%"
	rows, err := s.store.DB.Query(
		`SELECT `+requestSelectCols+` FROM requests
		 WHERE name LIKE ? OR url LIKE ?
		 ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		like, like, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Request{}
	for rows.Next() {
		r, err := scanRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *RequestsService) FindByID(id string) (Request, error) {
	row := s.store.DB.QueryRow(
		`SELECT `+requestSelectCols+` FROM requests WHERE id = ?`, id,
	)
	r, err := scanRequest(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Request{}, fmt.Errorf("request não encontrado")
	}
	return r, err
}

func (s *RequestsService) Create(input RequestInput) (Request, error) {
	if input.Headers == nil {
		input.Headers = map[string]string{}
	}
	headersJSON, err := json.Marshal(input.Headers)
	if err != nil {
		return Request{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	r := Request{
		ID:           uuid.NewString(),
		Name:         input.Name,
		CollectionID: input.CollectionID,
		FolderID:     strings.TrimSpace(input.FolderID),
		URL:          input.URL,
		Method:       input.Method,
		Headers:      input.Headers,
		Body:         input.Body,
		CreatedAt:    now,
		UpdatedAt:    now,
		IsFavorite:   false,
		IsActive:     true,
	}
	_, err = s.store.DB.Exec(
		`INSERT INTO requests (id, name, collection_id, folder_id, url, method, headers, body, created_at, updated_at, is_favorite, is_active)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
		r.ID, r.Name, r.CollectionID, nullableID(r.FolderID), r.URL, r.Method, string(headersJSON), r.Body, r.CreatedAt, r.UpdatedAt,
	)
	if err != nil {
		return Request{}, err
	}
	return r, nil
}

func (s *RequestsService) Update(id string, input RequestUpdate) error {
	if input.Headers == nil {
		input.Headers = map[string]string{}
	}
	headersJSON, err := json.Marshal(input.Headers)
	if err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = s.store.DB.Exec(
		`UPDATE requests SET name = ?, folder_id = ?, url = ?, method = ?, headers = ?, body = ?, updated_at = ? WHERE id = ?`,
		input.Name, nullableID(input.FolderID), input.URL, input.Method, string(headersJSON), input.Body, now, id,
	)
	return err
}

func (s *RequestsService) Delete(id string) error {
	_, err := s.store.DB.Exec(`DELETE FROM requests WHERE id = ?`, id)
	return err
}

func (s *RequestsService) Send(config RequestConfig) (ResponseData, error) {
	method := strings.ToUpper(strings.TrimSpace(config.Method))
	if method == "" {
		method = "GET"
	}

	var body io.Reader
	if method != "GET" && config.Body != "" {
		body = bytes.NewBufferString(config.Body)
	}

	req, err := http.NewRequest(method, config.URL, body)
	if err != nil {
		return ResponseData{}, err
	}
	for k, v := range config.Headers {
		req.Header.Set(k, v)
	}

	start := time.Now()
	resp, err := s.client.Do(req)
	if err != nil {
		return ResponseData{}, err
	}
	defer resp.Body.Close()
	duration := float64(time.Since(start).Microseconds()) / 1000.0

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return ResponseData{}, err
	}

	headers := map[string]string{}
	for k, v := range resp.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	return ResponseData{
		Status:     resp.StatusCode,
		Headers:    headers,
		Body:       string(respBody),
		DurationMS: duration,
	}, nil
}
