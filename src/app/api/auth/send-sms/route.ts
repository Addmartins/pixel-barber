import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";

const signatureToleranceSeconds = 300;
const textbeeUrl = "https://api.textbee.dev/api/v1/gateway/send-sms";

function validSignature(headers: Headers, body: string, secret: Buffer) {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > signatureToleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${id}.${timestamp}.${body}`).digest();
  return signatures.split(/\s+/).some((signature) => {
    if (!/^v1,[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
    return timingSafeEqual(expected, Buffer.from(signature.slice(3), "base64"));
  });
}

function hookError(status: number, message: string) {
  return NextResponse.json({ error: { http_code: status, message } }, { status });
}

export async function POST(request: Request) {
  const secret = process.env.SEND_SMS_HOOK_SECRET?.match(/^v1,whsec_([A-Za-z0-9+/]+={0,2})$/)?.[1];
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;
  if (!secret || !apiKey || !deviceId) return hookError(500, "O serviço de SMS está indisponível.");

  const body = await request.text();
  if (!validSignature(request.headers, body, Buffer.from(secret, "base64"))) {
    return hookError(403, "Assinatura do webhook inválida.");
  }

  let payload: { user?: { phone?: unknown }; sms?: { phone?: unknown; otp?: unknown } } | null;
  try {
    payload = JSON.parse(body);
  } catch {
    return hookError(400, "Dados do SMS inválidos.");
  }

  const phone = payload?.sms?.phone ?? payload?.user?.phone;
  const otp = payload?.sms?.otp;
  const recipient = typeof phone === "string" ? normalizePhone(`+${phone.replace(/^\+/, "")}`) : null;
  if (!recipient || typeof otp !== "string" || !/^\d{6,10}$/.test(otp)) {
    return hookError(400, "Dados do SMS inválidos.");
  }

  try {
    const response = await fetch(textbeeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        deviceId,
        recipients: [recipient],
        message: `Pixel Barber: seu código de verificação é ${otp}. Não compartilhe.`,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(3500),
    });

    if (response.ok && (await response.json())?.data?.success === true) return NextResponse.json({});
    console.error("TextBee recusou o envio do SMS.", { status: response.status });
  } catch {
    console.error("Falha na comunicação com o TextBee.");
  }
  return hookError(502, "O serviço de SMS não conseguiu enviar o código.");
}
