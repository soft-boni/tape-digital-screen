
import { useEffect, useState } from "react";
import { apiFetch } from "@/shared/utils/api";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { MoreHorizontal, Trash2, Shield, HardDrive, Search, Plus, Key } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { toast } from "sonner";

export function AdminUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [changePasswordId, setChangePasswordId] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        try {
            const data = await apiFetch("/admin/users");
            setUsers(data);
        } catch (error) {
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    }

    const handleDeleteUser = async (id: string) => {
        if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

        try {
            await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
            setUsers(users.filter(u => u.id !== id));
            toast.success("User deleted successfully");
        } catch (error) {
            toast.error("Failed to delete user");
        }
    };

    const handleUpdateRole = async (userId: string, newRole: string) => {
        try {
            const updated = await apiFetch(`/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ role: newRole })
            });
            setUsers(users.map(u => u.id === userId ? { ...u, role: updated.role } : u));
            toast.success("Role updated");
        } catch (error) {
            toast.error("Failed to update role");
        }
    };

    const handleUpdatePlan = async (userId: string, newPlan: string) => {
        try {
            const updated = await apiFetch(`/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ plan: newPlan })
            });
            setUsers(users.map(u => u.id === userId ? { ...u, plan: updated.plan } : u));
            toast.success("Plan updated");
        } catch (error) {
            toast.error("Failed to update plan");
        }
    };

    const filteredUsers = users.filter(user =>
        user.email?.toLowerCase().includes(search.toLowerCase()) ||
        user.name?.toLowerCase().includes(search.toLowerCase())
    );

    function formatBytes(bytes: number) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Users</h1>
                    <p className="text-zinc-400 mt-1">Manage platform users and subscriptions.</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-zinc-900 border-white/10"
                        />
                    </div>
                    <Button onClick={() => setIsAddUserOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                        <Plus className="w-4 h-4" />
                        Add User
                    </Button>
                </div>
            </div>

            <Card className="bg-zinc-900/50 border-white/5 shadow-xl">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/5 hover:bg-white/5">
                                <TableHead className="text-zinc-400">User</TableHead>
                                <TableHead className="text-zinc-400">Role</TableHead>
                                <TableHead className="text-zinc-400">Plan</TableHead>
                                <TableHead className="text-zinc-400">Storage Used</TableHead>
                                <TableHead className="text-zinc-400">Status</TableHead>
                                <TableHead className="text-right text-zinc-400">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-zinc-500">Loading...</TableCell>
                                </TableRow>
                            ) : filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-zinc-500">No users found.</TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => (
                                    <TableRow key={user.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9 border border-white/10">
                                                    <AvatarImage src={user.avatar_url} />
                                                    <AvatarFallback className="bg-zinc-800 text-zinc-400">
                                                        {user.name?.[0] || user.email?.[0]?.toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-white">{user.name || 'Unknown'}</span>
                                                    <span className="text-xs text-zinc-500">{user.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {user.role === 'super_admin' ? (
                                                <Badge variant="default" className="bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20">
                                                    Super Admin
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-white/5">User</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <select
                                                className="bg-transparent text-sm text-zinc-300 border border-white/10 rounded px-2 py-1 outline-none focus:border-indigo-500"
                                                value={user.plan}
                                                onChange={(e) => handleUpdatePlan(user.id, e.target.value)}
                                            >
                                                <option value="Free" className="bg-zinc-900">Free</option>
                                                <option value="Starter" className="bg-zinc-900">Starter</option>
                                                <option value="Business" className="bg-zinc-900">Business</option>
                                            </select>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm text-zinc-400">
                                                <HardDrive className="w-4 h-4 text-zinc-600" />
                                                {formatBytes(user.storage_used)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${user.is_suspended ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                <span className="text-sm text-zinc-400">{user.is_suspended ? 'Suspended' : 'Active'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-[#09090b] border-white/10">
                                                    <DropdownMenuLabel className="text-zinc-400">Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem
                                                        className="text-zinc-200 focus:text-white focus:bg-white/10 cursor-pointer"
                                                        onClick={() => handleUpdateRole(user.id, user.role === 'user' ? 'super_admin' : 'user')}
                                                    >
                                                        <Shield className="w-4 h-4 mr-2" />
                                                        {user.role === 'user' ? 'Promote to Admin' : 'Demote to User'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-zinc-200 focus:text-white focus:bg-white/10 cursor-pointer"
                                                        onClick={() => setChangePasswordId(user.id)}
                                                    >
                                                        <Key className="w-4 h-4 mr-2" />
                                                        Change Password
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-white/10" />
                                                    <DropdownMenuItem
                                                        className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                                                        onClick={() => handleDeleteUser(user.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Delete Account
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AddUserDialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen} onUserAdded={fetchUsers} />
            <ChangePasswordDialog
                userId={changePasswordId}
                open={!!changePasswordId}
                onOpenChange={(open) => !open && setChangePasswordId(null)}
            />
        </div>
    );
}

function ChangePasswordDialog({ userId, open, onOpenChange }: { userId: string | null, open: boolean, onOpenChange: (open: boolean) => void }) {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;
        setLoading(true);
        try {
            await apiFetch(`/admin/users/${userId}/password`, {
                method: 'PUT',
                body: JSON.stringify({ password })
            });
            toast.success("Password updated successfully");
            onOpenChange(false);
            setPassword("");
        } catch (error: any) {
            toast.error(error.message || "Failed to update password");
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-lg p-6 shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4">Change Password</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm text-zinc-400">New Password</label>
                        <Input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" required minLength={6} className="bg-black/20 border-white/10" />
                        <p className="text-xs text-zinc-500 mt-1">Must be at least 6 characters</p>
                    </div>
                    <div className="flex gap-3 justify-end mt-6">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white">
                            {loading ? "Updating..." : "Update Password"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AddUserDialog({ open, onOpenChange, onUserAdded }: { open: boolean, onOpenChange: (open: boolean) => void, onUserAdded: () => void }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await apiFetch('/admin/users', {
                method: 'POST',
                body: JSON.stringify({ email, password, name })
            });
            toast.success("User created successfully");
            onOpenChange(false);
            onUserAdded();
            setEmail("");
            setPassword("");
            setName("");
        } catch (error: any) {
            toast.error(error.message || "Failed to create user");
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-lg p-6 shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4">Add New User</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm text-zinc-400">Full Name</label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" className="bg-black/20 border-white/10" />
                    </div>
                    <div>
                        <label className="text-sm text-zinc-400">Email Address</label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" required className="bg-black/20 border-white/10" />
                    </div>
                    <div>
                        <label className="text-sm text-zinc-400">Password</label>
                        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="bg-black/20 border-white/10" />
                    </div>
                    <div className="flex gap-3 justify-end mt-6">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {loading ? "Creating..." : "Create User"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
