import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ChangePasswordCard } from "@/shared/components/ChangePasswordCard";
import { SessionsList } from "@/shared/components/SessionsList";

export function Settings() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 text-slate-900" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
      </div>

      <div className="grid gap-6">
        <ChangePasswordCard theme="light" />
        <SessionsList />
      </div>
    </div>
  );
}



