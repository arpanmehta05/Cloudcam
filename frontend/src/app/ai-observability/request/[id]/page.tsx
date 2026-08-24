"use client";

import { useParams } from "next/navigation";
import RequestDetailPage from "@/modules/ai-observability/request-detail/RequestDetailPage";

export default function Page() {
    const params = useParams();
    const id = params?.id as string;

    return <RequestDetailPage id={id} />;
}
