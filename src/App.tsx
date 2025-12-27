
import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { motion, AnimatePresence } from "motion/react";

import { supabase } from "@/shared/utils/supabase/client";
import { DashboardLayout } from "@/shared/components/layout/DashboardLayout";
import { LoginPage } from "@/user-portal/pages/Auth";
import { Dashboard } from "@/user-portal/pages/Dashboard";
import { Screens } from "@/user-portal/pages/Prgrams";
import { ScreenEditor } from "@/user-portal/pages/ProgramEditor";
import { Devices } from "@/user-portal/pages/Devices";
import { Content } from "@/user-portal/pages/Content";
import { Player } from "@/user-portal/pages/Player";
import { EditProfile } from "@/user-portal/pages/EditProfile";
import { Settings } from "@/user-portal/pages/Settings";
import { AdminLayout } from "@/admin-portal/layout/AdminLayout";
import { AdminAuth } from "@/admin-portal/pages/AdminAuth";
import { AdminDashboard } from "@/admin-portal/pages/AdminDashboard";
import { AdminUsers } from "@/admin-portal/pages/AdminUsers";
import { AdminSettings } from "@/admin-portal/pages/AdminSettings";

const SESSION_ID_KEY = "tape_client_id";

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = "Unknown Browser";
  if (ua.indexOf("Chrome") > -1) browser = "Chrome";
  else if (ua.indexOf("Safari") > -1) browser = "Safari";
  else if (ua.indexOf("Firefox") > -1) browser = "Firefox";
  else if (ua.indexOf("Edge") > -1) browser = "Edge";

  const os = ua.indexOf("Win") > -1 ? "Windows" : ua.indexOf("Mac") > -1 ? "MacOS" : ua.indexOf("Linux") > -1 ? "Linux" : "Unknown OS";

  return `${os} - ${browser}`;
}

function ProtectedRoute() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) trackSession(session.user.id);
    }).catch(err => {
      console.error("Session check failed", err);
      setLoading(false);
    });

    // 2. Auth State Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) trackSession(session.user.id);
    });

    // 3. Track Session Function
    const trackSession = async (userId: string) => {
      let sessionId = localStorage.getItem(SESSION_ID_KEY);
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem(SESSION_ID_KEY, sessionId);
      }

      // Upsert Session
      await supabase.from("user_sessions").upsert({
        id: sessionId,
        user_id: userId,
        device_info: getDeviceInfo(),
        last_active: new Date().toISOString(),
      }, { onConflict: "id" });

      // Subscribe to Force Logout (if this session is deleted)
      const channel = supabase
        .channel(`session_${sessionId}`)
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "user_sessions", filter: `id=eq.${sessionId}` },
          async (payload: any) => {
            const currentStoredId = localStorage.getItem(SESSION_ID_KEY);
            // Double check that the deleted ID matches our current session ID
            if (payload.old && payload.old.id === currentStoredId) {
              console.log("❌ Revocation Event Confirmed. Logging out...");
              await supabase.auth.signOut();
              window.location.href = "/login";
            } else {
              console.warn("Ignored revocation event for non-matching ID:", payload.old?.id);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

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

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminAuth />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  );
}
