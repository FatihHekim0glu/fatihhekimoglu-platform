import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ToolShell } from "@/components/ToolShell";
import StockDashboardTool from "@/app/tools/stock-dashboard/StockDashboardTool";
import { getTool } from "@/lib/tools";

interface ToolPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);

  if (!tool || tool.status === "archived") {
    return {
      title: "Tool not found — Fatih Hekimoglu",
    };
  }

  const title = `${tool.title} — Fatih Hekimoglu`;

  return {
    title,
    description: tool.blurb,
    openGraph: {
      title,
      description: tool.blurb,
      url: `https://fatihhekimoglu.com/tools/${tool.slug}`,
      siteName: "fatihhekimoglu.com",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: tool.blurb,
    },
  };
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        In development
      </div>
      <h3 className="text-xl font-semibold text-foreground">
        {title} is on the way
      </h3>
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
        This tool is currently being built and verified against reference
        implementations. It will go live once the numerics and the test suite
        agree.
      </p>
    </div>
  );
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = getTool(slug);

  if (!tool || tool.status === "archived") {
    notFound();
  }

  return (
    <>
      <Header />
      <ToolShell
        title={tool.title}
        blurb={tool.blurb}
        tags={tool.tags}
        backHref="/"
      >
        {tool.status === "live" && tool.slug === "stock-dashboard" ? (
          <StockDashboardTool />
        ) : (
          <ComingSoon title={tool.title} />
        )}
      </ToolShell>
      <Footer />
    </>
  );
}
