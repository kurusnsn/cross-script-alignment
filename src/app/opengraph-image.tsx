import { ImageResponse } from "next/og";

export const alt = "TranslitAI";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "72px",
          background: "#262624",
          color: "#FAF9F5",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div
            style={{
              fontSize: 88,
              fontWeight: 700,
              letterSpacing: "-0.04em",
            }}
          >
            TranslitAI
          </div>
          <div
            style={{
              fontSize: 34,
              color: "#9CA3AF",
              maxWidth: 700,
            }}
          >
            Lossless script conversion to English.
          </div>
        </div>

        <div
          style={{
            width: 230,
            height: 230,
            borderRadius: 32,
            border: "4px solid #2DD4BF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #2DD4BF22, #ffffff08)",
            color: "#2DD4BF",
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          A文
        </div>
      </div>
    ),
    size
  );
}
