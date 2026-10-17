import { ImageResponse } from "next/og";

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size) === 192 ? 192 : 512;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3182f6",
          color: "#fff",
          fontSize: size * 0.55,
          fontWeight: 700,
        }}
      >
        ₩
      </div>
    ),
    { width: size, height: size }
  );
}
