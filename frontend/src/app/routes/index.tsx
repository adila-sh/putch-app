import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PanelLayout from "./panel";
import CollectionsRoute from "./panel/collections";
import CollectionRequestsRoute from "./panel/collections/requests";
import EnvironmentsRoute from "./panel/environments";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/panel/collections" replace />} />
        <Route path="/panel" element={<PanelLayout />}>
          <Route path="collections" element={<CollectionsRoute />} />
          <Route path="collections/:collectionId/requests" element={<CollectionRequestsRoute />} />
          <Route path="collections/:collectionId/environments" element={<EnvironmentsRoute />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
