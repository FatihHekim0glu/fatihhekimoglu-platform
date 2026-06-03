import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Tool } from "@/lib/tools";

interface ToolCardProps {
  tool: Tool;
}

export function ToolCard({ tool }: ToolCardProps) {
  if (tool.status === "archived") {
    return null;
  }

  const isLive = tool.status === "live";

  const cardInner = (
    <Card
      className={cn(
        "group relative h-full transition-all duration-200",
        isLive
          ? "hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
          : "opacity-70"
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg leading-snug">{tool.title}</CardTitle>
          {isLive ? (
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
          ) : (
            <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wide">
              Coming soon
            </Badge>
          )}
        </div>
        <CardDescription className="leading-relaxed">{tool.blurb}</CardDescription>
      </CardHeader>
      {tool.tags && tool.tags.length > 0 ? (
        <CardContent className="flex flex-wrap gap-1.5">
          {tool.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="font-normal">
              {tag}
            </Badge>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );

  if (isLive) {
    return (
      <Link
        href={`/tools/${tool.slug}`}
        className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Open ${tool.title}`}
      >
        {cardInner}
      </Link>
    );
  }

  return <article aria-disabled className="h-full">{cardInner}</article>;
}
