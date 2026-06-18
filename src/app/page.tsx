import type { Metadata } from "next";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ResearchCard } from "@/components/ResearchCard";
import { ToolCard } from "@/components/ToolCard";
import { RESEARCH, TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Fatih Hekimoglu - Quantitative Tools",
  description:
    "Quantitative tools, hand-rolled and verified against the literature. Stock dashboards, options analytics, and more.",
  openGraph: {
    title: "Fatih Hekimoglu - Quantitative Tools",
    description:
      "Quantitative tools, hand-rolled and verified against the literature.",
    url: "https://fatihhekimoglu.com",
    siteName: "fatihhekimoglu.com",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fatih Hekimoglu - Quantitative Tools",
    description:
      "Quantitative tools, hand-rolled and verified against the literature.",
  },
};

export default function HomePage() {
  const visibleTools = TOOLS.filter((tool) => tool.status !== "archived");

  return (
    <>
      <Header />

      <main className="flex flex-1 flex-col">
        <section
          aria-labelledby="hero-heading"
          className="border-b border-border"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
            <div className="flex max-w-3xl flex-col gap-5">
              <span className="inline-flex w-fit items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                fatihhekimoglu.com
              </span>
              <h1
                id="hero-heading"
                className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
              >
                Fatih Hekimoglu
              </h1>
              <h2 className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Quantitative tools, hand-rolled and verified against the
                literature.
              </h2>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="tools-heading"
          className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
        >
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2
                id="tools-heading"
                className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
              >
                Tools
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Small, focused instruments. Each one solves a single problem
                well.
              </p>
            </div>
          </div>

          {visibleTools.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tools published yet - check back soon.
            </p>
          ) : (
            <ul
              role="list"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {visibleTools.map((tool) => (
                <li key={tool.slug} className="h-full">
                  <ToolCard tool={tool} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="research-heading"
          className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
        >
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2
                id="research-heading"
                className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
              >
                Research
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open-source quantitative research. Each repo is honest about what
                does and does not beat its baseline.
              </p>
            </div>
          </div>

          <ul
            role="list"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {RESEARCH.map((project) => (
              <li key={project.slug} className="h-full">
                <ResearchCard project={project} />
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Footer />
    </>
  );
}
