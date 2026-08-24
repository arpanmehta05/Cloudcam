"use client";

import {
  useResizeMigration,
  MigrationListPanel,
  MigrationDetailPanel,
} from "@/modules/resize-migration";

type ResizeMigrationPageProps = {
  initialJobId?: string | null;
};

export function ResizeMigrationPageContent({
  initialJobId = null,
}: ResizeMigrationPageProps) {
  const state = useResizeMigration(initialJobId);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f6f7f9] dark:bg-[#07111F] p-4 lg:p-6 text-[#24272d] dark:text-slate-100">
      {state.activeJobId ? (
        <MigrationDetailPanel {...state} />
      ) : (
        <MigrationListPanel {...state} />
      )}
    </main>
  );
}

export default function ResizeMigrationPage() {
  return <ResizeMigrationPageContent />;
}
