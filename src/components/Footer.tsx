import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto w-full border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
        <p>
          Built by{" "}
          <span className="font-medium text-foreground">Fatih Hekimoglu</span> &middot;{" "}
          <span>{year}</span>
        </p>
        <nav className="flex items-center gap-4">
          <Link href="/" className="transition-colors hover:text-foreground">
            Tools
          </Link>
          <a
            href="https://github.com/FatihHekim0glu"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
