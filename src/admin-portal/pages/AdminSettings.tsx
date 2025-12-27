
import { ChangePasswordCard } from "@/shared/components/ChangePasswordCard";
import { SessionsList } from "@/shared/components/SessionsList";

export function AdminSettings() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Settings</h1>
                <p className="text-zinc-400 mt-1">Manage your administrator account.</p>
            </div>

            <div className="grid gap-6">
                <ChangePasswordCard />
                <SessionsList />
            </div>
        </div>
    );
}
