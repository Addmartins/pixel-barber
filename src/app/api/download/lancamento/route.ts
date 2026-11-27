import release from "@/lib/device/release.json";

export const dynamic = "force-dynamic";

export function GET() {
  console.info(JSON.stringify({
    event: "android_download_redirect",
    campaign: "panfleto-lancamento",
  }));

  return new Response(null, {
    status: 307,
    headers: { Location: release.androidDownload, "Cache-Control": "no-store" },
  });
}
