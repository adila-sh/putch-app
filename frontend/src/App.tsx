import AppRoutes from "./app/routes";
import { ThemeProvider } from "./app/contexts/theme.context";
import { SelectedEnvironmentProvider } from "./app/contexts/selected-environment.context";
import "./globals.css";

function App() {
  return (
    <ThemeProvider>
      <SelectedEnvironmentProvider>
        <AppRoutes />
      </SelectedEnvironmentProvider>
    </ThemeProvider>
  );
}

export default App;
