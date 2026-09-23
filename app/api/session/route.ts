export const runtime = "edge";

// A cheap probe that only answers when the request got past Cloudflare
// Access. The app polls it to tell an expired session from a live one, and
// opens it in a pop-up so Access can sign the user in again.
export function GET() {
  return new Response(null, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
