import type { Metadata } from "next";
import { PartnerScreen } from "@/components/partner/PartnerScreen";

export const metadata: Metadata = {
  title: "Minha Barbearia | Pixel Barber",
  robots: { index: false, follow: false },
};

export default function PartnerPage() {
  return <PartnerScreen />;
}
