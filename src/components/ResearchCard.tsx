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
import type { ResearchProject } from "@/lib/tools";

interface ResearchCardProps {
  project: ResearchProject;
}

export function ResearchCard({ project }: ResearchCardProps) {
  return (
    <a
      href={project.repoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`View ${project.title} on GitHub`}
    >
      <Card className="group relative h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-lg leading-snug">{project.title}</CardTitle>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
          <CardDescription className="leading-relaxed">{project.blurb}</CardDescription>
        </CardHeader>
        {project.tags.length > 0 ? (
          <CardContent className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="font-normal">
                {tag}
              </Badge>
            ))}
          </CardContent>
        ) : null}
      </Card>
    </a>
  );
}
