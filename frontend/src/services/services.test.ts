import {
  CollectionInput,
  EnvironmentInput,
  RequestConfig,
  TestInput,
  WorkspaceInput,
} from "@bindings/services";
import { setTransport, type RuntimeTransport } from "@wailsio/runtime";
import { expect, test } from "vitest";
import { CollectionsService } from "./collections.service";
import { EnvironmentService } from "./environments.service";
import { FolderService } from "./folders.service";
import { PredictionService } from "./prediction.service";
import { PullRequestsService } from "./pull-requests.service";
import { RequestService } from "./request.service";
import { SyncService } from "./sync.service";
import { TestService } from "./tests.service";
import { WorkspaceService } from "./workspace.service";
import { WorkspacesService } from "./workspaces.service";

interface Call {
  methodID: number;
  args: unknown[];
}

const ARRAY_METHODS = new Set([
  4243907705, 3781922170, 1268793018, 2286483754, 4214591943, 3265784047, 3693325638, 1007635802,
  1348474293, 2327635289, 3592563856, 1836861674, 3245035211, 2245991334, 3193575795, 1849240722,
  957369605, 2684998398,
]);

const STRING_METHODS = new Set([1178100379, 3710691179, 545074776, 3479207848, 1497618514]);

function installTransport(): Call[] {
  const calls: Call[] = [];
  const transport: RuntimeTransport = {
    async call(_objectID, _method, _windowName, payload) {
      const methodID = payload.methodID as number;
      const args = Array.isArray(payload.args) ? payload.args : [];
      calls.push({ methodID, args });

      if (ARRAY_METHODS.has(methodID)) return [];
      if (STRING_METHODS.has(methodID)) return "resultado";
      if (methodID === 3659070707) return [{ text: "https://api.example.com", score: 1 }];
      if (methodID === 2226501538) return {};

      // Os conversores gerados completam objetos vazios com os zero-values de
      // cada DTO. Isso mantém o teste focado no contrato facade → binding.
      return {};
    },
  };
  setTransport(transport);
  return calls;
}

test("mapeia todas as operações de collections, environments e folders para o Wails", async () => {
  const calls = installTransport();
  const collection = new CollectionInput({ name: "Core" });
  const environment = new EnvironmentInput({ name: "Dev" });

  await CollectionsService.findAll();
  await CollectionsService.create(collection);
  await CollectionsService.delete("collection-1");
  await CollectionsService.update("collection-1", collection);
  await CollectionsService.findById("collection-1");
  await CollectionsService.findByQuery("core");
  await CollectionsService.export("collection-1");
  await CollectionsService.import("name: Core");

  await EnvironmentService.findAll();
  await EnvironmentService.create(environment);
  await EnvironmentService.delete("environment-1");
  await EnvironmentService.update("environment-1", environment);
  await EnvironmentService.findById("environment-1");
  await EnvironmentService.interpolate("{{HOST}}", { HOST: "localhost" });

  await FolderService.findByCollectionId("collection-1");
  await FolderService.findById("folder-1");
  await FolderService.create("collection-1", "", "Auth");
  await FolderService.update("folder-1", "Login");
  await FolderService.move("folder-1", "parent-1");
  await FolderService.delete("folder-1");
  await FolderService.getOrders("collection-1");
  await FolderService.setOrder("collection-1", "", ["request-1"]);

  expect(calls.map((call) => call.methodID)).toEqual([
    4243907705, 2084708613, 1449465442, 3600698108, 2654200150, 3100551337, 1178100379, 1384922124,
    3781922170, 2447251272, 3757396183, 2358908509, 929997607, 3710691179, 1268793018, 4268409754,
    3274651585, 3625735888, 44970992, 1206454630, 2226501538, 3256693961,
  ]);
});

test("mapeia todas as operações de requests, predição e suítes de teste", async () => {
  const calls = installTransport();

  await PredictionService.suggest({ field: "url", prefix: "https" });
  await RequestService.findAll();
  await RequestService.findByCollectionId("collection-1");
  await RequestService.findByFolderId("folder-1");
  await RequestService.findById("request-1");
  await RequestService.findByQuery("login");
  await RequestService.create({
    name: "Login",
    collection_id: "collection-1",
    url: "https://api.example.com/login",
    method: "POST",
  });
  await RequestService.update("request-1", { name: "Login v2" });
  await RequestService.delete("request-1");
  await RequestService.setFavorite("request-1", true);
  await RequestService.move("request-1", "folder-1");
  await RequestService.duplicate("request-1");
  await RequestService.send(
    new RequestConfig({ method: "GET", url: "https://api.example.com/health" }),
  );

  const suite = new TestInput({ name: "Smoke" });
  await TestService.findAll();
  await TestService.findById("test-1");
  await TestService.create(suite);
  await TestService.update("test-1", suite);
  await TestService.delete("test-1");
  await TestService.run("test-1");

  expect(calls.map((call) => call.methodID)).toEqual([
    3659070707, 2286483754, 4214591943, 3265784047, 3096112919, 3693325638, 1873506200, 1641569613,
    3596378695, 832708952, 285077625, 3096112919, 1873506200, 1632454770, 957369605, 4157400386,
    2930607881, 605581464, 2884612158, 1192741990,
  ]);
});

test("mapeia todas as operações de workspace e sincronização git", async () => {
  const calls = installTransport();
  const workspace = new WorkspaceInput({ name: "Core" });

  await WorkspaceService.getPath();
  await WorkspaceService.choose();
  await WorkspaceService.resetToDefault();
  await WorkspacesService.findAll();
  await WorkspacesService.getActive();
  await WorkspacesService.create(workspace);
  await WorkspacesService.update("workspace-1", workspace);
  await WorkspacesService.delete("workspace-1");
  await WorkspacesService.setActive("workspace-1");

  await SyncService.status();
  await SyncService.github();
  await SyncService.startLogin();
  await SyncService.cancelLogin();
  await SyncService.logout();
  await SyncService.listRepos();
  await SyncService.commit("feat: teste");
  await SyncService.push();
  await SyncService.pull();
  await SyncService.resolveConflict("ours");
  await SyncService.connectRemote("https://github.com/acme/api.git");
  await SyncService.cloneWorkspace("https://github.com/acme/api.git");
  await SyncService.log(50);
  await SyncService.branches();
  await SyncService.checkout("main");
  await SyncService.createBranch("feature/test");
  await SyncService.fileDiff("collection.yml", false);
  await SyncService.commitDiff("abc123");
  await SyncService.discardFile("collection.yml", false);

  expect(calls.map((call) => call.methodID)).toEqual([
    545074776, 3479207848, 1497618514, 2684998398, 788593358, 168728580, 1425478529, 3537076603,
    78360474, 1506582571, 3916722846, 2914810573, 140514889, 3294379608, 1007635802, 1201753328,
    3325498153, 3355949082, 2454141925, 1055202155, 239914799, 1348474293, 2327635289, 781575277,
    3089458785, 3444167876, 1248101175, 723132731,
  ]);
});

test("mapeia leitura, colaboração e merge de pull requests", async () => {
  const calls = installTransport();

  await PullRequestsService.list("open");
  await PullRequestsService.get(42);
  await PullRequestsService.files(42);
  await PullRequestsService.commits(42);
  await PullRequestsService.reviews(42);
  await PullRequestsService.reviewComments(42);
  await PullRequestsService.issueComments(42);
  await PullRequestsService.create("main", "feature", "Novo recurso", "Descrição");
  await PullRequestsService.comment(42, "Comentário");
  await PullRequestsService.review(42, "APPROVE", "Aprovado");
  await PullRequestsService.reviewComment(42, "abc", "app.ts", 10, "RIGHT", "Ajustar");
  await PullRequestsService.replyToReviewComment(42, 7, "Resolvido");
  await PullRequestsService.merge(42, "squash");

  expect(calls.map((call) => call.methodID)).toEqual([
    3592563856, 1523842093, 1836861674, 3245035211, 2245991334, 3193575795, 1849240722, 3777235463,
    453466681, 1015796837, 1036465118, 1226987979, 1142982069,
  ]);
});
