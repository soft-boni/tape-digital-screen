
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { LoginPage } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { Screens } from "./pages/Prgrams";
import { ScreenEditor } from "./pages/ProgramEditor";
import { Devices } from "./pages/Devices";
import { Content } from "./pages/Content";
import { Player } from "./pages/Player";
import { EditProfile } from "./pages/EditProfile";
import { Settings } from "./pages/Settings";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

// Supabase Client
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

function ProtectedRoute() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading Tape...</div>;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/player" element={<Player />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/programs" element={<Screens />} />
            <Route path="/programs/:id" element={<ScreenEditor />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/content" element={<Content />} />
            <Route path="/profile/edit" element={<EditProfile />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  );
}
