import { ResizeMigrationPageContent } from "../page";

type ResizeMigrationDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ResizeMigrationDetailPage({
  params,
}: ResizeMigrationDetailPageProps) {
  const { id } = await params;

  return <ResizeMigrationPageContent initialJobId={id} />;
}
