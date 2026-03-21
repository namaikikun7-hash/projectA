"use client";

import { SourcingGate } from "@/components/sourcing/sourcing-gate";

export default function SourcingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SourcingGate>{children}</SourcingGate>;
}
