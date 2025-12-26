
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, LogOut, Settings as SettingsIcon, Menu } from "lucide-react";
import { TapeLogo } from "@/shared/components/TapeLogo";
import { cn } from "@/shared/components/ui/utils";
import { Button } from "@/shared/components/ui/button";
import { supabase } from "@/shared/utils/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/shared/utils/api";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/shared/components/ui/sheet";

const NAV_ITEMS = [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Settings", href: "/admin/settings", icon: SettingsIcon },
];

export function AdminLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    useEffect(() => {
        checkAdmin();
    }, []);

    async function checkAdmin() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate("/admin/login");
            return;
        }

        // Verify role via API (since we can't trust client-side local storage or similar)
        // Or just check profile table directly
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'super_admin') {
            toast.error("Unauthorized Access");
            navigate("/dashboard"); // Redirect to user dashboard
            return;
        }

        setIsAdmin(true);
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate("/admin/login");
    };

    if (isAdmin === null) return <div className="h-screen w-full flex items-center justify-center bg-black text-white">Loading...</div>;

    const NavContent = () => (
        <>
            <div className="p-6">
                <Link to="/admin" className="block" onClick={() => setIsMobileOpen(false)}>
                    <TapeLogo className="w-24 text-white" />
                    <span className="text-xs text-white/40 mt-1 block uppercase tracking-widest font-mono">Admin Portal</span>
                </Link>
            </div>

            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            onClick={() => setIsMobileOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                                isActive
                                    ? "text-white bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-indigo-400" : "text-zinc-500 group-hover:text-white")} />
                            {item.label}
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full opacity-50 blur-[2px]" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-white/5">
                <Button
                    variant="ghost"
                    className="w-full justify-start text-zinc-400 hover:text-white hover:bg-red-500/10 hover:text-red-400 gap-2"
                    onClick={handleSignOut}
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </Button>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-[#09090b] text-white font-sans overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 border-r border-white/10 bg-[#09090b]/50 backdrop-blur-xl flex-col z-20">
                <NavContent />
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden bg-[#0c0c0e] relative scrollbar-hide">
                {/* Mobile Header */}
                <header className="md:hidden h-16 border-b border-white/10 bg-[#09090b] flex items-center px-4 justify-between z-30">
                    <div className="flex items-center gap-2">
                        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-zinc-400">
                                    <Menu className="w-6 h-6" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-64 flex flex-col bg-[#09090b] text-white border-white/10">
                                <SheetHeader className="sr-only"><SheetTitle>Admin Menu</SheetTitle></SheetHeader>
                                <NavContent />
                            </SheetContent>
                        </Sheet>
                        <span className="font-semibold">Admin</span>
                    </div>
                </header>

                {/* Background Gradients */}
                <div className="fixed inset-0 pointer-events-none">
                    <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen" />
                    <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] mix-blend-screen" />
                </div>

                <div className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto min-h-full w-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
