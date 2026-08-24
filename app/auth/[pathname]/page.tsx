interface PageProps {
  params: Promise<{pathname: string}>
}

/**
 * The starter intentionally excludes a branded sign-in UI. A deployment can
 * provide its own provider-specific experience while the server-side route and
 * operator boundaries remain deny-by-default.
 */
export default async function AuthPage({
  params
}: PageProps): Promise<React.JSX.Element> {
  await params
  return (
    <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-xl items-center p-6">
      <section className="w-full rounded-xl border border-border bg-background p-6">
        <h1 className="text-xl font-semibold text-foreground">
          Authentication unavailable
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure an authentication experience for this deployment before
          granting operator access.
        </p>
      </section>
    </main>
  )
}
