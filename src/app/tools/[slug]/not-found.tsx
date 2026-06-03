import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export default function ToolNotFound() {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center px-4 py-24 sm:px-6 lg:px-8">
        <span className="mb-3 inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          404
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Tool not found
        </h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-muted-foreground">
          The tool you&apos;re looking for either does not exist or has been
          retired. Have a look at the current lineup on the home page.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all tools
        </Link>
      </main>
      <Footer />
    </>
  );
}
