
import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Plus, Trash2, Edit2, MonitorOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Device {
  id: string;
  name: string;
  status: "online" | "offline" | "pending";
  lastSeen: string;
  screenId: string | null;
  pin: string | null;
}

interface Screen {
  id: string;
  name: string;
}

export function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]); // To show screen names
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add Device Form
  const [pin, setPin] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [devicesData, screensData] = await Promise.all([
        apiFetch("/devices"),
        apiFetch("/screens"),
      ]);
      // Filter out pending/non-activated devices - only show devices that have been claimed by admin
      const activatedDevices = devicesData.filter((d: Device) => d.status !== 'pending' || d.name !== 'Unnamed Device');
      setDevices(activatedDevices);
      setScreens(screensData);
    } catch (error) {
      toast.error("Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await apiFetch("/devices/activate", {
        method: "POST",
        body: JSON.stringify({ pin, name: deviceName }),
      });
      toast.success("Device activated successfully!");
      setIsAddModalOpen(false);
      setPin("");
      setDeviceName("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to activate device");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this device?")) return;
    try {
      await apiFetch(`/devices/${id}`, { method: "DELETE" });
      toast.success("Device removed");
      loadData();
    } catch (error) {
      toast.error("Failed to remove device");
    }
  };

  const getScreenName = (id: string | null) => {
    if (!id) return "Unassigned";
    const screen = screens.find((s) => s.id === id);
    return screen ? screen.name : "Unknown Screen";
  };

  const isOnline = (lastSeen: string) => {
    const diff = new Date().getTime() - new Date(lastSeen).getTime();
    return diff < 60000 * 2; // 2 minutes
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Devices</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={loadData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Device
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Device</DialogTitle>
                <DialogDescription>
                  Enter the PIN displayed on the device screen (visit /player on the device).
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddDevice} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pin">Device PIN</Label>
                  <Input
                    id="pin"
                    value={pin}
                    onChange={(e) => {
                      // Format as XXXX-XXXX (uppercase, alphanumeric)
                      let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                      // Auto-insert dash after 4 characters
                      if (value.length > 4 && value[4] !== '-') {
                        value = value.slice(0, 4) + '-' + value.slice(4);
                      }
                      // Limit to 9 characters (XXXX-XXXX)
                      value = value.slice(0, 9);
                      setPin(value);
                    }}
                    placeholder="BB8A-SDE7"
                    maxLength={9}
                    required
                    className="text-center text-2xl tracking-widest font-mono"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Enter the 8-character PIN shown on the device screen
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Device Name</Label>
                  <Input
                    id="name"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="Lobby TV"
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={adding}>
                    {adding ? "Adding..." : "Add Device"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Assigned Screen</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => {
              const online = isOnline(device.lastSeen);
              return (
                <TableRow key={device.id}>
                  <TableCell>
                    <Badge variant={online ? "default" : "secondary"} className={online ? "bg-green-600 hover:bg-green-700" : ""}>
                      {online ? "Online" : "Offline"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{device.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {(device as any).ipAddress || 'N/A'}
                  </TableCell>
                  <TableCell>{getScreenName(device.screenId)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(device.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {devices.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No devices found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
