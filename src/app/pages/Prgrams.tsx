
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Plus, Monitor, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function Screens() {
  const [screens, setScreens] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  // Wizard State
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    resolution: "1920x1080",
    selectedContent: [] as string[],
    selectedDeviceId: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sData, dData, cData] = await Promise.all([
        apiFetch("/programs"),
        apiFetch("/devices"),
        apiFetch("/content"),
      ]);
      setScreens(sData);
      setDevices(dData);
      setContent(cData);
    } catch (error) {
      toast.error("Failed to load screens");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      // 1. Create Screen
      const newScreen = await apiFetch("/programs", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          resolution: formData.resolution,
          content: formData.selectedContent.map(id => ({
            contentId: id,
            duration: 10, // Default duration
            order: 0 // Will need to be sorted
          })),
        }),
      });

      // 2. Assign Device if selected
      if (formData.selectedDeviceId) {
        await apiFetch(`/devices/${formData.selectedDeviceId}`, {
          method: "PUT",
          body: JSON.stringify({ screenId: newScreen.id })
        });
      }

      toast.success("Program created successfully!");
      setIsModalOpen(false);
      // Reset
      setStep(1);
      setFormData({
        name: "",
        description: "",
        resolution: "1920x1080",
        selectedContent: [],
        selectedDeviceId: "",
      });
      loadData();
      navigate(`/programs/${newScreen.id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create screen");
    }
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Program
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Program (Step {step}/3)</DialogTitle>
              <DialogDescription>
                {step === 1 && "Basic Details"}
                {step === 2 && "Add Content"}
                {step === 3 && "Assign Device"}
              </DialogDescription>
            </DialogHeader>

            {/* Step 1: Details */}
            {step === 1 && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Lobby Display"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Main entrance screen"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Resolution</Label>
                  <Select
                    value={formData.resolution}
                    onValueChange={(val) => setFormData({ ...formData, resolution: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1920x1080">1920x1080 (16:9)</SelectItem>
                      <SelectItem value="1080x1920">1080x1920 (9:16)</SelectItem>
                      <SelectItem value="3840x2160">4K (16:9)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Content */}
            {step === 2 && (
              <div className="space-y-4 py-4 max-h-[300px] overflow-y-auto">
                <div className="grid grid-cols-3 gap-2">
                  {content.map(item => (
                    <div key={item.id} className="relative aspect-square border rounded cursor-pointer overflow-hidden"
                      onClick={() => {
                        const selected = formData.selectedContent.includes(item.id);
                        setFormData({
                          ...formData,
                          selectedContent: selected
                            ? formData.selectedContent.filter(id => id !== item.id)
                            : [...formData.selectedContent, item.id]
                        });
                      }}>
                      <img src={item.readUrl} className={`w-full h-full object-cover ${formData.selectedContent.includes(item.id) ? 'opacity-50' : ''}`} />
                      {formData.selectedContent.includes(item.id) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/20">
                          <div className="w-4 h-4 bg-indigo-600 rounded-full" />
                        </div>
                      )}
                    </div>
                  ))}
                  {content.length === 0 && <div className="col-span-3 text-center text-muted-foreground">No content available.</div>}
                </div>
              </div>
            )}

            {/* Step 3: Device */}
            {step === 3 && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Assign to Device (Optional)</Label>
                  <Select
                    value={formData.selectedDeviceId}
                    onValueChange={(val) => setFormData({ ...formData, selectedDeviceId: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a device..." />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name} ({d.status})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter className="flex justify-between sm:justify-between">
              {step > 1 ? (
                <Button variant="outline" onClick={prevStep}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
              ) : <div />}

              {step < 3 ? (
                <Button onClick={nextStep} disabled={!formData.name}>Next <ArrowRight className="w-4 h-4 ml-2" /></Button>
              ) : (
                <Button onClick={handleCreate}>Create Program</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {screens.map((screen) => (
          <Card key={screen.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle>{screen.name}</CardTitle>
              <CardDescription>{screen.resolution} • {screen.content?.length || 0} items</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{screen.description || "No description"}</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" asChild>
                <Link to={`/programs/${screen.id}`}>Manage Content</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
        {screens.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No screens created yet.
          </div>
        )}
      </div>
    </div>
  );
}
