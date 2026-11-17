import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/roster/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuth, login } from "@/lib/roster.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zakereen — Sign in with your ITS ID" },
      {
        name: "description",
        content: "Enter your ITS ID to see your group, members and mohalla locations with timings.",
      },
      { property: "og:title", content: "Zakereen — Sign in with your ITS ID" },
      {
        property: "og:description",
        content: "Enter your ITS ID to see your group, members and mohalla locations with timings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const auth = await getAuth();
    if (auth?.role === "admin") throw redirect({ to: "/admin" });
    if (auth?.role === "member") throw redirect({ to: "/me" });
  },
  component: LoginPage,
});

function LoginPage() {
  const loginFn = useServerFn(login);
  const navigate = useNavigate();
  const router = useRouter();
  const [itsId, setItsId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{8}$/.test(itsId)) {
      setError("ITS ID must be 8 digits.");
      return;
    }
    setBusy(true);
    try {
      const res = await loginFn({ data: { itsId } });
      await router.invalidate();
      navigate({ to: res.role === "admin" ? "/admin" : "/me", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-3 p-3 sm:p-6 md:grid md:grid-cols-2 md:items-stretch md:gap-4">
      {/* Colour-block composition */}
      <section className="grid grid-cols-3 grid-rows-[auto_auto] gap-3 md:grid-rows-3 md:gap-4">
        <div className="tone-tangerine relative col-span-3 overflow-hidden rounded-3xl p-6 md:row-span-2 md:p-8">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-10" />
          </div>
          <h1 className="mt-10 text-5xl font-extrabold leading-[0.95] sm:text-6xl">Zakereen</h1>
          <p className="mt-3 max-w-xs text-base font-medium">
            Your group, your mohalla, your timings — all in one place.
          </p>
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-blush" aria-hidden />
        </div>
        <div className="tone-lime grid aspect-square place-items-center rounded-3xl md:aspect-auto">
          <span className="size-1/2 rounded-full bg-ink" aria-hidden />
        </div>
        <div className="tone-mint relative overflow-hidden rounded-3xl md:aspect-auto">
          <span className="absolute bottom-0 left-0 size-3/4 rounded-tr-full bg-paper" aria-hidden />
        </div>
        <div className="tone-ink grid place-items-center rounded-3xl p-3 text-center">
          <span className="font-display text-sm font-bold leading-tight sm:text-base">
            7:30
            <br />
            <span className="text-lime">8:00</span>
            <br />
            8:30
          </span>
        </div>
      </section>

      {/* Sign in */}
      <section className="flex flex-col justify-center rounded-3xl bg-card p-6 sm:p-10 md:flex-1">
        <h2 className="text-3xl font-bold">Sign in</h2>
        <p className="mt-2 text-muted-foreground">Enter your ITS ID to continue.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">ITS ID</span>
            <Input
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              placeholder="8-digit ITS ID"
              value={itsId}
              onChange={(e) => setItsId(e.target.value.replace(/\D/g, ""))}
              className="h-14 text-center font-display text-2xl font-bold tracking-[0.3em] placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal"
              aria-invalid={!!error}
              autoFocus
            />
          </label>
          {error ? (
            <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" variant="ink" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Continue
            {!busy ? <ArrowRight /> : null}
          </Button>
        </form>
      </section>
    </main>
  );
}
