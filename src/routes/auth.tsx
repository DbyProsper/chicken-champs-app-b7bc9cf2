import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Lock, User as UserIcon, Phone } from "lucide-react";
import { getAccessRole } from "@/lib/roles";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Champs Chicken" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Auth,
});

function Auth() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const role = await getAccessRole(data.user.id);
        const isStaff = role === "admin" || role === "staff";
        nav({ to: isStaff ? "/admin" : "/account" });
        return;
      }
      setChecking(false);
    })();
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/account`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        toast.success("Account created — welcome to Champs!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const role = await getAccessRole(u.user.id);
        const isStaff = role === "admin" || role === "staff";
        nav({ to: isStaff ? "/admin" : "/account" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <div className="p-8 text-sm text-muted-foreground">…</div>;

  return (
    <div className="min-h-screen">
      <Header subtitle="Account" />
      <div className="mx-auto max-w-sm px-4 py-8">
        <h1 className="font-display text-4xl text-brand">{mode === "signin" ? "Welcome back" : "Join Champs"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to see your orders & For You picks." : "Save your details, track orders and get weekly specials."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <>
              <Field icon={UserIcon}>
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  className="w-full bg-transparent focus:outline-none"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>
              <Field icon={Phone}>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="Phone number (optional)"
                  className="w-full bg-transparent focus:outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            </>
          )}
          <Field icon={Mail}>
            <input
              type="email"
              required
              placeholder="Email"
              className="w-full bg-transparent focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field icon={Lock}>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password (min 6 chars)"
              className="w-full bg-transparent focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button disabled={busy} className="w-full rounded-full bg-brand py-3 text-sm font-bold text-brand-foreground hover:bg-brand-dark disabled:opacity-60">
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-sm text-muted-foreground"
        >
          {mode === "signin" ? (
            <>New to Champs? <span className="text-brand font-bold underline">Create account</span></>
          ) : (
            <>Already have an account? <span className="text-brand font-bold underline">Sign in</span></>
          )}
        </button>

        <div className="mt-8 text-center text-[11px] text-muted-foreground">
          <Link to="/" className="underline">Continue as guest</Link>
          <div className="mt-1">Staff members: sign in above and an admin will assign your role.</div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-4 py-3 text-sm focus-within:ring-2 focus-within:ring-brand">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      {children}
    </div>
  );
}
