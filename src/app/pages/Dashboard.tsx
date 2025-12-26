
import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
    </div>
  );
}
