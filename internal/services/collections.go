package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/joaov/putch/internal/store"
)

type Collection struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Pinned        bool   `json:"pinned"`
	Deprecated    bool   `json:"deprecated"`
	Bg            int    `json:"bg"`
	RequestCount  int    `json:"request_count"`
	CreatedAt     string `json:"created_at"`
	CreatedAuthor string `json:"created_author"`
	UpdatedAt     string `json:"updated_at"`
	UpdatedAuthor string `json:"updated_author"`
}

// CollectionInput são os campos que o frontend envia ao criar/editar uma
// collection. Espelha store.CollectionInput; metadados (datas, autores) ficam
// a cargo do store.
type CollectionInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Pinned      bool   `json:"pinned"`
	Deprecated  bool   `json:"deprecated"`
	Bg          int    `json:"bg"`
}

type CollectionsService struct {
	store *store.Store
}

func NewCollectionsService(s *store.Store) *CollectionsService {
	return &CollectionsService{store: s}
}

func toCollection(c store.Collection) Collection {
	return Collection{
		ID:            c.ID,
		Name:          c.Name,
		Description:   c.Description,
		Pinned:        c.Pinned,
		Deprecated:    c.Deprecated,
		Bg:            c.Bg,
		CreatedAt:     c.CreatedAt,
		CreatedAuthor: c.CreatedAuthor,
		UpdatedAt:     c.UpdatedAt,
		UpdatedAuthor: c.UpdatedAuthor,
	}
}

// pinnedFirst reordena mantendo a ordem relativa de cada grupo (estável):
// fixadas primeiro, demais depois. Aplicado após byCreatedDesc, dá
// "fixadas no topo, e dentro de cada grupo as mais recentes primeiro".
func pinnedFirst(cols []store.Collection) []store.Collection {
	out := make([]store.Collection, 0, len(cols))
	for _, c := range cols {
		if c.Pinned {
			out = append(out, c)
		}
	}
	for _, c := range cols {
		if !c.Pinned {
			out = append(out, c)
		}
	}
	return out
}

func (s *CollectionsService) FindAll(page, limit int) ([]Collection, error) {
	cols, err := s.store.ListCollections()
	if err != nil {
		return nil, err
	}
	counts, err := s.store.CollectionRequestCounts()
	if err != nil {
		return nil, err
	}
	byCreatedDesc(cols, func(c store.Collection) string { return c.CreatedAt })
	cols = pinnedFirst(cols)
	out := []Collection{}
	for _, c := range paginate(cols, page, limit) {
		dto := toCollection(c)
		dto.RequestCount = counts[c.ID]
		out = append(out, dto)
	}
	return out, nil
}

func (s *CollectionsService) FindByQuery(query string, page, limit int) ([]Collection, error) {
	cols, err := s.store.ListCollections()
	if err != nil {
		return nil, err
	}
	q := strings.ToLower(query)
	filtered := cols[:0]
	for _, c := range cols {
		if strings.Contains(strings.ToLower(c.Name), q) {
			filtered = append(filtered, c)
		}
	}
	counts, err := s.store.CollectionRequestCounts()
	if err != nil {
		return nil, err
	}
	byCreatedDesc(filtered, func(c store.Collection) string { return c.CreatedAt })
	filtered = pinnedFirst(filtered)
	out := []Collection{}
	for _, c := range paginate(filtered, page, limit) {
		dto := toCollection(c)
		dto.RequestCount = counts[c.ID]
		out = append(out, dto)
	}
	return out, nil
}

func (s *CollectionsService) FindByID(id string) (Collection, error) {
	c, err := s.store.GetCollection(id)
	if errors.Is(err, store.ErrNotFound) {
		return Collection{}, fmt.Errorf("coleção não encontrada")
	}
	if err != nil {
		return Collection{}, err
	}
	dto := toCollection(c)
	if counts, err := s.store.CollectionRequestCounts(); err == nil {
		dto.RequestCount = counts[c.ID]
	}
	return dto, nil
}

func (s *CollectionsService) Create(in CollectionInput) (Collection, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return Collection{}, fmt.Errorf("nome da coleção não pode ser vazio")
	}
	c, err := s.store.CreateCollection(store.CollectionInput{
		Name:        in.Name,
		Description: strings.TrimSpace(in.Description),
		Pinned:      in.Pinned,
		Deprecated:  in.Deprecated,
		Bg:          in.Bg,
	})
	if err != nil {
		return Collection{}, err
	}
	return toCollection(c), nil
}

func (s *CollectionsService) Update(id string, in CollectionInput) error {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return fmt.Errorf("nome da coleção não pode ser vazio")
	}
	return s.store.UpdateCollection(id, store.CollectionInput{
		Name:        in.Name,
		Description: strings.TrimSpace(in.Description),
		Pinned:      in.Pinned,
		Deprecated:  in.Deprecated,
		Bg:          in.Bg,
	})
}

func (s *CollectionsService) Delete(id string) error {
	return s.store.DeleteCollection(id)
}

// collectionExportVersion versiona o formato de export. Bump ao mudar o schema
// de forma incompatível. O Import aceita esta versão e o formato legado (só
// metadados da coleção, sem folders/requests) — o envelope é um superconjunto
// do antigo, então JSON velho ainda desserializa (folders/requests vazios).
const collectionExportVersion = 1

// collectionExport é o envelope de export: a coleção + a árvore completa
// (folders com hierarquia via ParentID + requests com todos os campos) + a
// ordem manual dos containers. Environments NÃO entram: são escopados no
// workspace, não na coleção — um export de environments seria outra feature.
type collectionExport struct {
	Version    int                 `json:"version"`
	Collection Collection          `json:"collection"`
	Folders    []exportFolder      `json:"folders"`
	Requests   []exportRequest     `json:"requests"`
	Orders     map[string][]string `json:"orders,omitempty"`
}

// exportFolder é um folder no arquivo. ParentID referencia o ID (do arquivo) do
// folder pai; "" = folder direto na raiz da coleção. Os IDs são regenerados no
// import — servem só para religar a hierarquia dentro do próprio arquivo.
type exportFolder struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ParentID string `json:"parentId"`
}

// exportRequest é uma request no arquivo, com todos os campos que definem seu
// comportamento (body/auth/scripts/params/etc). FolderID referencia o folder
// dono ("" = raiz da coleção).
type exportRequest struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	FolderID   string            `json:"folderId"`
	URL        string            `json:"url"`
	Method     string            `json:"method"`
	Headers    map[string]string `json:"headers,omitempty"`
	Params     map[string]string `json:"params,omitempty"`
	Body       string            `json:"body,omitempty"`
	BodyType   string            `json:"bodyType,omitempty"`
	Form       map[string]string `json:"form,omitempty"`
	Files      map[string]string `json:"files,omitempty"`
	AuthType   string            `json:"authType,omitempty"`
	AuthValue  string            `json:"authValue,omitempty"`
	TimeoutMS  int               `json:"timeoutMs,omitempty"`
	PreScript  string            `json:"preScript,omitempty"`
	PostScript string            `json:"postScript,omitempty"`
	IsFavorite bool              `json:"isFavorite,omitempty"`
}

func (s *CollectionsService) Export(id string) (string, error) {
	c, err := s.FindByID(id)
	if err != nil {
		return "", err
	}
	folders, err := s.store.ListFolders(id)
	if err != nil {
		return "", err
	}
	requests, err := s.store.ListRequestsByCollection(id)
	if err != nil {
		return "", err
	}
	orders, err := s.store.GetOrders(id)
	if err != nil {
		return "", err
	}
	payload := collectionExport{
		Version:    collectionExportVersion,
		Collection: c,
		Folders:    make([]exportFolder, 0, len(folders)),
		Requests:   make([]exportRequest, 0, len(requests)),
		Orders:     orders,
	}
	for _, f := range folders {
		payload.Folders = append(payload.Folders, exportFolder{
			ID: f.ID, Name: f.Name, ParentID: f.ParentID,
		})
	}
	for _, r := range requests {
		payload.Requests = append(payload.Requests, exportRequest{
			ID: r.ID, Name: r.Name, FolderID: r.FolderID, URL: r.URL, Method: r.Method,
			Headers: r.Headers, Params: r.Params, Body: r.Body, BodyType: r.BodyType,
			Form: r.Form, Files: r.Files, AuthType: r.AuthType, AuthValue: r.AuthValue,
			TimeoutMS: r.TimeoutMS, PreScript: r.PreScript, PostScript: r.PostScript,
			IsFavorite: r.IsFavorite,
		})
	}
	bytes, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func (s *CollectionsService) Import(fileContent string) (Collection, error) {
	var payload collectionExport
	if err := json.Unmarshal([]byte(fileContent), &payload); err != nil {
		return Collection{}, err
	}
	name := strings.TrimSpace(payload.Collection.Name)
	if name == "" {
		name = "Sem nome"
	}
	created, err := s.Create(CollectionInput{
		Name:        name,
		Description: payload.Collection.Description,
		Pinned:      payload.Collection.Pinned,
		Deprecated:  payload.Collection.Deprecated,
		Bg:          payload.Collection.Bg,
	})
	if err != nil {
		return Collection{}, err
	}
	// Sem transações no store: se a recriação da árvore falhar, apaga a coleção
	// pela metade para não deixar lixo — import é tudo-ou-nada do ponto de vista
	// do usuário.
	if err := s.importTree(created.ID, payload); err != nil {
		_ = s.store.DeleteCollection(created.ID)
		return Collection{}, err
	}
	return s.FindByID(created.ID)
}

// importTree recria folders → requests → ordem numa coleção recém-criada,
// regenerando todos os IDs. idMap traduz id-do-arquivo → id-novo e cobre folders
// E requests, porque os manifestos de ordem referenciam ambos.
func (s *CollectionsService) importTree(colID string, payload collectionExport) error {
	idMap := map[string]string{}
	if err := s.importFolders(colID, payload.Folders, idMap); err != nil {
		return err
	}
	if err := s.importRequests(colID, payload.Requests, idMap); err != nil {
		return err
	}
	s.importOrders(colID, payload.Orders, idMap)
	return nil
}

// importFolders cria os folders em ordem de dependência: um filho só nasce
// depois do pai (para o CreateFolder resolver o diretório pai). Repete enquanto
// houver progresso; sobras com pai ausente/cíclico caem na raiz da coleção para
// não serem perdidas.
func (s *CollectionsService) importFolders(colID string, folders []exportFolder, idMap map[string]string) error {
	pending := append([]exportFolder(nil), folders...)
	for len(pending) > 0 {
		progress := false
		rest := pending[:0]
		for _, f := range pending {
			parentNew := ""
			if parentOld := strings.TrimSpace(f.ParentID); parentOld != "" {
				mapped, ok := idMap[parentOld]
				if !ok {
					rest = append(rest, f) // pai ainda não criado — tenta na próxima passada
					continue
				}
				parentNew = mapped
			}
			created, err := s.store.CreateFolder(colID, parentNew, f.Name)
			if err != nil {
				return err
			}
			idMap[f.ID] = created.ID
			progress = true
		}
		pending = rest
		if !progress {
			for _, f := range pending { // pai inexistente/ciclo → raiz da coleção
				created, err := s.store.CreateFolder(colID, "", f.Name)
				if err != nil {
					return err
				}
				idMap[f.ID] = created.ID
			}
			break
		}
	}
	return nil
}

// importRequests recria cada request no folder mapeado (pasta ausente → raiz) e
// restaura o "fixado" via SetRequestFavorite (CreateRequest sempre nasce não
// fixada).
func (s *CollectionsService) importRequests(colID string, requests []exportRequest, idMap map[string]string) error {
	for _, r := range requests {
		folderNew := ""
		if fid := strings.TrimSpace(r.FolderID); fid != "" {
			if mapped, ok := idMap[fid]; ok {
				folderNew = mapped
			}
		}
		created, err := s.store.CreateRequest(store.Request{
			Name: r.Name, CollectionID: colID, FolderID: folderNew,
			URL: r.URL, Method: r.Method, Headers: r.Headers, Params: r.Params,
			Body: r.Body, BodyType: r.BodyType, Form: r.Form, Files: r.Files,
			AuthType: r.AuthType, AuthValue: r.AuthValue, TimeoutMS: r.TimeoutMS,
			PreScript: r.PreScript, PostScript: r.PostScript,
		})
		if err != nil {
			return err
		}
		idMap[r.ID] = created.ID
		if r.IsFavorite {
			if err := s.store.SetRequestFavorite(created.ID, true); err != nil {
				return err
			}
		}
	}
	return nil
}

// importOrders restaura a ordem manual dos containers, remapeando o ID do
// container (folder) e cada ID filho. Best-effort: ordem é conveniência, então
// containers/filhos que não sobreviveram ao import são silenciosamente pulados.
func (s *CollectionsService) importOrders(colID string, orders map[string][]string, idMap map[string]string) {
	for containerOld, ids := range orders {
		containerNew := ""
		if containerOld != "" {
			mapped, ok := idMap[containerOld]
			if !ok {
				continue
			}
			containerNew = mapped
		}
		remapped := make([]string, 0, len(ids))
		for _, oldID := range ids {
			if newID, ok := idMap[oldID]; ok {
				remapped = append(remapped, newID)
			}
		}
		if len(remapped) == 0 {
			continue
		}
		_ = s.store.SetOrder(colID, containerNew, remapped)
	}
}
