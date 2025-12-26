
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/shared/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Loader2 } from "lucide-react";


interface ChangePasswordCardProps {
    theme?: 'light' | 'dark';
}

export function ChangePasswordCard({ theme = 'dark' }: ChangePasswordCardProps) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const isLight = theme === 'light';

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error("New passwords do not match");
            return;
        }

        if (password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) throw new Error("User not found");

            // 1. Verify Old Password
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            });

            if (signInError) {
                toast.error("Incorrect current password");
                return;
            }

            // 2. Update Password
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            toast.success("Password updated successfully");
            setCurrentPassword("");
            setPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            toast.error(error.message || "Failed to update password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className={isLight ? "bg-white border-slate-200 shadow-sm" : "bg-zinc-900/50 border-white/5 shadow-xl"}>
            <CardHeader>
                <CardTitle className={isLight ? "text-slate-900" : "text-white"}>Change Password</CardTitle>
                <CardDescription className={isLight ? "text-slate-500" : "text-zinc-400"}>
                    Update your password to keep your account secure.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                    <div className="space-y-2">
                        <label className={isLight ? "text-sm font-medium text-slate-700" : "text-sm font-medium text-zinc-300"}>Current Password</label>
                        <Input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="••••••••"
                            className={isLight ? "bg-white border-slate-200 text-slate-900" : "bg-black/20 border-white/10 text-white"}
                            required
                        />
                        <p className={isLight ? "text-xs text-slate-500" : "text-xs text-zinc-500"}>
                            Forgot your password? <a href="mailto:boniaminyt@gmail.com" className="text-indigo-600 hover:underline">Contact admin</a>
                        </p>
                    </div>
                    <div className="space-y-2">
                        <label className={isLight ? "text-sm font-medium text-slate-700" : "text-sm font-medium text-zinc-300"}>New Password</label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className={isLight ? "bg-white border-slate-200 text-slate-900" : "bg-black/20 border-white/10 text-white"}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className={isLight ? "text-sm font-medium text-slate-700" : "text-sm font-medium text-zinc-300"}>Confirm New Password</label>
                        <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className={isLight ? "bg-white border-slate-200 text-slate-900" : "bg-black/20 border-white/10 text-white"}
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Password
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
