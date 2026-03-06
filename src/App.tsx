import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import MobileOnlyGuard from "@/components/MobileOnlyGuard";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import Download from "./pages/Download";
import Support from "./pages/Support";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Hide native splash screen once React is mounted
    import("@capacitor/splash-screen").then(({ SplashScreen }) => {
      SplashScreen.hide();
    }).catch(() => {});

    // Hide HTML loader
    const loader = document.getElementById("app-loader");
    if (loader) {
      loader.classList.add("fade-out");
      setTimeout(() => loader.remove(), 400);
    }
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Register en dehors de AuthProvider — aucun re-render auth ne peut le perturber */}
          <Route path="/register" element={<Register />} />
          <Route path="/dl-app-x7k9" element={<Download />} />
          <Route path="/support" element={<Support />} />
          {/* Tout le reste passe par AuthProvider */}
          <Route path="*" element={
            <AuthProvider>
              <MobileOnlyGuard>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </MobileOnlyGuard>
            </AuthProvider>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
