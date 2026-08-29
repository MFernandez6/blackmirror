import { InspectionWorkspace } from "@/components/inspection/inspection-workspace";

export default function InspectionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <InspectionWorkspace inspectionId={params.id} />;
}
