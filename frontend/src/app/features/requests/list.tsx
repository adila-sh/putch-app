import { Request } from "../../services/request.service";

interface RequestsListProps {
  requests: Request[];
  selectedId?: string;
  onSelect: (request: Request) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const methodColors: Record<string, string> = {
  GET: "bg-green-100 text-green-700",
  POST: "bg-blue-100 text-blue-700",
  PUT: "bg-yellow-100 text-yellow-700",
  PATCH: "bg-orange-100 text-orange-700",
  DELETE: "bg-red-100 text-red-700",
};

export default function RequestsList({ requests, selectedId, onSelect, onEdit, onDelete }: RequestsListProps) {
  if (requests.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        <p>No requests yet. Create your first request!</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {requests.map((request) => (
        <div
          key={request.id}
          onClick={() => onSelect(request)}
          className={`p-3 rounded-lg cursor-pointer transition-colors ${
            selectedId === request.id
              ? "bg-blue-100 border border-blue-300"
              : "bg-white hover:bg-gray-100 border border-transparent"
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-medium text-gray-800 text-sm flex-1 truncate">
              {request.name}
            </h3>
            <span
              className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                methodColors[request.method.toUpperCase()] || "bg-gray-100 text-gray-700"
              }`}
            >
              {request.method}
            </span>
          </div>
          <p className="text-xs text-gray-500 truncate mb-2">{request.url}</p>
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(request.id);
              }}
              className="flex-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(request.id);
              }}
              className="flex-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

