import release from "@/lib/device/release.json";

export const dynamic = "force-static";

export function GET() {
  return Response.json({
    ...release,
    webBuild: process.env.NEXT_PUBLIC_PIXEL_BARBER_BUILD,
  }, { headers: { "Cache-Control": "no-store" } });
}
