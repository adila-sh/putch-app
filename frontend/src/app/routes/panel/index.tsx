import { Outlet, Link } from "react-router-dom";
import ThemeToggle from "../../components/theme-toggle";

export default function PanelLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">Coffeeholic</h1>
          <p className="text-xs text-gray-400 mt-1">API Client</p>
        </div>
        <nav className="flex-1 p-4">
          <Link
            to="/panel/collections"
            className="block px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors mb-2"
          >
            Collections
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-700">
          <ThemeToggle />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

