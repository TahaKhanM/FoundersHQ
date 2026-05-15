/**
 * Phase 1.B: minimal onboarding shell.
 *
 * No top bar, no side rail — just a centered card on the surface palette so
 * the wizard feels like a focused, single-purpose flow rather than a page
 * inside the app shell. Auth and shell layouts both wrap children in
 * `<Providers>` via the root layout; we add no further chrome here.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.4]"
        style={{
          backgroundImage:
            "radial-gradient(60rem 40rem at 80% -10%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%), radial-gradient(50rem 30rem at -10% 80%, color-mix(in oklch, var(--info) 14%, transparent), transparent 60%)",
        }}
      />
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-stretch justify-center px-6 py-12">
        {children}
      </main>
    </div>
  )
}
