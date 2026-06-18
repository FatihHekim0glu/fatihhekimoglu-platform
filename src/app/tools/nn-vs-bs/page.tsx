import type { Metadata } from "next"

import NnVsBsTool from "./NnVsBsTool"

export const metadata: Metadata = {
  title: "Options: NN vs Black-Scholes — fatihhekimoglu.com",
  description:
    "Price European options two ways — a from-scratch Black-Scholes closed form vs a small neural net — and compare them honestly. On synthetic BS data the NN can only RECOVER the BS surface (a convergence check, not an edge); on real chains, constant-vol BS misprices the smile. Reprice error only — no tradable P&L is claimed.",
}

export default function NnVsBsPage() {
  return <NnVsBsTool />
}
