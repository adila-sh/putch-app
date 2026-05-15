import { CollectionsService as Wails } from "@bindings/services";

export type { Collection } from "@bindings/services";

export const CollectionsService = {
  findAll(page = 1, limit = 10) {
    return Wails.FindAll(page, limit);
  },

  create(name: string) {
    return Wails.Create(name);
  },

  delete(id: string) {
    return Wails.Delete(id);
  },

  update(id: string, name: string) {
    return Wails.Update(id, name);
  },

  findById(id: string) {
    return Wails.FindByID(id);
  },

  findByQuery(query: string, page = 1, limit = 10) {
    return Wails.FindByQuery(query, page, limit);
  },

  export(id: string) {
    return Wails.Export(id);
  },
};
