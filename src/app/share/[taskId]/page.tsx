import { Metadata } from "next";
import { ShareView } from "@/components/share/share-view";

interface SharePageProps {
  params: Promise<{ taskId: string }>;
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { taskId } = await params;
  return {
    title: "Сравнение AI-моделей — Новая эпоха",
    description: `Результаты сравнения AI-моделей (ID: ${taskId.slice(0, 8)})`,
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { taskId } = await params;
  return <ShareView taskId={taskId} />;
}
