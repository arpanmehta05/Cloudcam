import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CloudWatcher cloud cost optimization and monitoring platform";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f8fafc",
          color: "#0f172a",
          padding: "70px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "78px",
              height: "78px",
              borderRadius: "18px",
              background: "#1A56DB",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "42px",
              fontWeight: 800,
            }}
          >
            C
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "44px", fontWeight: 800 }}>CloudWatcher</div>
            <div style={{ fontSize: "22px", color: "#475569" }}>also known as Rabbittize</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ fontSize: "72px", fontWeight: 850, lineHeight: 1.02 }}>
            Cloud Cost Optimization and Multicloud Monitoring
          </div>
          <div style={{ fontSize: "30px", color: "#475569", lineHeight: 1.35, maxWidth: "960px" }}>
            Reduce cloud spend, trace AI costs, detect infrastructure waste, and turn FinOps insights into engineering action.
          </div>
        </div>
        <div style={{ display: "flex", gap: "16px", fontSize: "24px", color: "#1A56DB", fontWeight: 700 }}>
          <span>AWS</span>
          <span>|</span>
          <span>Azure</span>
          <span>|</span>
          <span>GCP</span>
          <span>|</span>
          <span>AI observability</span>
        </div>
      </div>
    ),
    size,
  );
}
