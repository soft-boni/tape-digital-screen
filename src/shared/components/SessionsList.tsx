import { useEffect, useState } from "react";
import { supabase } from "@/shared/utils/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Laptop, Smartphone, Trash2, Globe, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";

interface Session {
    id: string;
    device_info: string;
    ip_address?: string;
    last_active: string;
    created_at: string;
    is_current?: boolean;
}

export function SessionsList() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const currentSessionId = localStorage.getItem("tape_client_id");

    const fetchSessions = async () => {
        try {
            const { data, error } = await supabase
                .from("user_sessions")
                .select("*")
                .order("last_active", { ascending: false });

            if (error) throw error;

            setSessions(
                (data || []).map((s: any) => ({
                    ...s,
                    is_current: s.id === currentSessionId,
                }))
            );
        } catch (err) {
            console.error("Failed to load sessions", err);
        } finally {
            setLoading(false);
        }
    };

    const revokeSession = async (sessionId: string) => {
        try {
            const { error } = await supabase
                .from("user_sessions")
                .delete()
                .eq("id", sessionId);

            if (error) throw error;

            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
            toast.success("Session revoked");
        } catch (err) {
            toast.error("Failed to revoke session");
        }
    };

    const revokeAllOthers = async () => {
        if (!currentSessionId) {
            console.error("No current session ID found");
            return;
        }

        try {
            console.log("Revoking all sessions except:", currentSessionId);

            const { error } = await supabase.rpc('revoke_other_sessions', {
                current_session_id: currentSessionId
            });

            if (error) throw error;

            // Optimistic update
            setSessions((prev) => prev.filter((s) => s.id === currentSessionId));
            toast.success("All other sessions revoked");
        } catch (err) {
            console.error("Revoke error:", err);
            toast.error("Failed to revoke sessions");
        }
    };

    useEffect(() => {
        fetchSessions();

        // Subscribe to changes (e.g. if another device logs in)
        const channel = supabase
            .channel("sessions_list_updates")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "user_sessions" },
                () => {
                    fetchSessions();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const getDeviceIcon = (info: string) => {
        const lower = info.toLowerCase();
        if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
            return <Smartphone className="w-5 h-5 text-slate-500" />;
        }
        return <Laptop className="w-5 h-5 text-slate-500" />;
    };

    if (loading) return <div className="text-sm text-muted-foreground">Loading active sessions...</div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Active Sessions</CardTitle>
                <CardDescription>
                    Manage devices that are currently logged into your account.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            className={`flex items-start justify-between p-4 rounded-lg border ${session.is_current ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200"
                                }`}
                        >
                            <div className="flex gap-4">
                                <div className={`p-2 rounded-full ${session.is_current ? "bg-indigo-100" : "bg-slate-100"}`}>
                                    {getDeviceIcon(session.device_info || "")}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-slate-900">
                                            {session.device_info || "Unknown Device"}
                                        </p>
                                        {session.is_current && (
                                            <span className="text-[10px] bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">
                                                CURRENT
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                        <span className="flex items-center gap-1" title="Last Active">
                                            <ClockIcon className="w-3 h-3" />
                                            {formatDistanceToNow(new Date(session.last_active), { addSuffix: true })}
                                        </span>
                                        {session.ip_address && (
                                            <span className="flex items-center gap-1" title="IP Address">
                                                <Globe className="w-3 h-3" />
                                                {session.ip_address}
                                            </span>
                                        )}
                                    </div>

                                    {!session.is_current && (
                                        <p className="text-xs text-slate-400 mt-1">
                                            Assigned: {new Date(session.created_at).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {!session.is_current && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Revoke
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Revoke Session?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will log out the device "{session.device_info}". This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => revokeSession(session.id)} className="bg-red-600 hover:bg-red-700">
                                                Revoke
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    ))}
                </div>

                {sessions.length === 0 && (
                    <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-lg">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p>No active sessions found.</p>
                    </div>
                )}

                {sessions.length > 1 && (
                    <div className="pt-4 border-t flex justify-end">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                                    Sign out from all other devices
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Sign out all other devices?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        You will remain logged in on this device, but all other active sessions will be terminated immediately.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={revokeAllOthers} className="bg-red-600 hover:bg-red-700">
                                        Sign Out All
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ClockIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}
