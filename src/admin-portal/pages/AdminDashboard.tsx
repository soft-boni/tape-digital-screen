
import { useEffect, useState } from "react";
import { apiFetch } from "@/shared/utils/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Users, Monitor, HardDrive, Activity, TrendingUp, Shield } from "lucide-react";
import { format } from "date-fns";

export function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const data = await apiFetch("/admin/stats");
            setStats(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    function formatBytes(bytes: number) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    if (loading) return <div className="text-white">Loading stats...</div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                    System Overview
                </h1>
                <p className="text-zinc-400 mt-2">Monitor platform usage and performance.</p>
            </div>

            {/* Primary Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Total Users"
                    value={stats?.userCount || 0}
                    icon={Users}
                    trend="+12%" // Mock trend
                    color="indigo"
                />
                <StatsCard
                    title="Active Devices"
                    value={stats?.deviceCount || 0}
                    icon={Monitor}
                    trend="+5%"
                    color="emerald"
                />
                <StatsCard
                    title="Storage Used"
                    value={formatBytes(stats?.totalStorage || 0)}
                    icon={HardDrive}
                    trend="+8%"
                    color="blue"
                />
                <StatsCard
                    title="System Status"
                    value="Healthy"
                    icon={Activity}
                    trend="99.9%"
                    color="purple"
                />
            </div>

            {/* Secondary Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Plan Distribution */}
                <Card className="bg-zinc-900/50 border-white/5 shadow-xl lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
                            <Shield className="w-4 h-4 text-purple-400" />
                            Subscription Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {Object.entries(stats?.byPlan || {}).map(([plan, count]: [string, any]) => {
                                const total = stats?.userCount || 1;
                                const percentage = Math.round((count / total) * 100);

                                return (
                                    <div key={plan} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-zinc-300 font-medium">{plan} Plan</span>
                                            <span className="text-zinc-500">{count} users ({percentage}%)</span>
                                        </div>
                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${plan === 'Business' ? 'bg-purple-500' :
                                                        plan === 'Starter' ? 'bg-indigo-500' : 'bg-zinc-600'
                                                    }`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Actions / Recent Activity Placeholder */}
                <Card className="bg-zinc-900/50 border-white/5 shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            Growth
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
                            Chart placeholder
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, trend, color }: any) {
    const colors: any = {
        indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
        emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    };

    return (
        <Card className="bg-zinc-900/50 border-white/5 hover:border-white/10 transition-colors shadow-lg">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-zinc-400">{title}</p>
                        <h3 className="text-2xl font-bold text-white mt-2">{value}</h3>
                    </div>
                    <div className={`p-2.5 rounded-xl ${colors[color]}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
                <div className="mt-4 flex items-center text-xs">
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {trend}
                    </span>
                    <span className="text-zinc-600 ml-2">from last month</span>
                </div>
            </CardContent>
        </Card>
    );
}
