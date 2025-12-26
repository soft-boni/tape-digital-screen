
import { useEffect, useState } from "react";
import { apiFetch } from "@/shared/utils/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Monitor, Smartphone, Activity, Library } from "lucide-react";

export function Dashboard() {
  const [stats, setStats] = useState({
    screensCount: 0,
    programsCount: 0,
    devicesCount: 0,
    onlineDevicesCount: 0,
    contentCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await apiFetch("/dashboard/stats");
      setStats(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Programs",
      value: stats.programsCount || stats.screensCount || 0,
      icon: Monitor,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      title: "Online Devices",
      value: `${stats.onlineDevicesCount} / ${stats.devicesCount}`,
      icon: Activity,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      title: "Total Devices",
      value: stats.devicesCount,
      icon: Smartphone,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
    {
      title: "Content Items",
      value: stats.contentCount,
      icon: Library,
      color: "text-orange-600",
      bg: "bg-orange-100",
    },
  ];

  if (loading) return <div>Loading stats...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan & Usage Section */}
      <PlanUsageSection stats={stats} />
    </div>
  );
}

function PlanUsageSection({ stats }: { stats: any }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    apiFetch("/profile").then(setProfile).catch(() => { });
  }, []);

  const plan = profile?.plan || "Free";
  const storageUsed = profile?.storage_used || 0;

  // Plan Limits
  const limits = {
    Free: { storage: 512 * 1024 * 1024, devices: 1 },
    Starter: { storage: 1 * 1024 * 1024 * 1024, devices: 3 },
    Business: { storage: 5 * 1024 * 1024 * 1024, devices: 10 },
    Enterprise: { storage: 100 * 1024 * 1024 * 1024, devices: 1000 },
  } as const;

  const currentLimit = limits[plan as keyof typeof limits] || limits.Free;

  const storagePercent = Math.min(100, (storageUsed / currentLimit.storage) * 100);
  const devicesPercent = Math.min(100, (stats.devicesCount / currentLimit.devices) * 100);

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan & Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Current Plan: <span className="text-indigo-600">{plan}</span></h3>
            <p className="text-sm text-muted-foreground">Manage your subscription and usage limits.</p>
          </div>
          <Button asChild variant="outline">
            <a href={`mailto:boniaminyt@gmail.com?subject=Upgrade Request for ${profile?.email}&body=I would like to upgrade my plan to...`}>
              Request Upgrade
            </a>
          </Button>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Storage Usage */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Storage</span>
              <span>{formatBytes(storageUsed)} / {formatBytes(currentLimit.storage)}</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-500"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Upload images and videos to your library.
            </p>
          </div>

          {/* Device Usage */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Devices</span>
              <span>{stats.devicesCount} / {currentLimit.devices}</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-600 transition-all duration-500"
                style={{ width: `${devicesPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Connect screens to your account.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
