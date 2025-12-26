
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/App";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { TapeLogo } from "@/shared/components/TapeLogo";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AdminAuth() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user }, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (user) {
                // Check role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (profile?.role !== 'super_admin') {
                    await supabase.auth.signOut();
                    toast.error("Access Denied: You are not an administrator.");
                } else {
                    toast.success("Welcome back, Admin");
                    navigate("/admin");
                }
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to login");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-full flex items-center justify-center bg-[#09090b] relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-md p-8 relative z-10">
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    <div className="flex flex-col items-center mb-8">
                        <TapeLogo className="w-32 text-white mb-6" />
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
                            <ShieldCheck className="w-3 h-3" />
                            <span className="text-xs font-medium uppercase tracking-wider">Restricted Access</span>
                        </div>
                        <h1 className="text-xl font-medium text-white">Admin Portal</h1>
                        <p className="text-zinc-400 text-sm mt-1">Sign in with your administrative credentials</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 ml-1">Email Address</label>
                            <Input
                                type="email"
                                placeholder="admin@tape.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-black/40 border-white/10 text-white placeholder:text-zinc-600 focus:border-indigo-500/50 h-10"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 ml-1">Password</label>
                            <Input
                                type="password"
                                placeholder="••••••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-black/40 border-white/10 text-white placeholder:text-zinc-600 focus:border-indigo-500/50 h-10"
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white mt-4 h-10"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Access Portal
                        </Button>
                    </form>
                </div>

                <p className="text-center text-zinc-600 text-xs mt-6">
                    Authorized personnel only. All access is logged and monitored.
                </p>
            </div>
        </div>
    );
}
