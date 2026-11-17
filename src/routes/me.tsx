import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Brand } from "@/components/roster/brand";
import { EmptyNote, GroupView } from "@/components/roster/group-view";
import { Button } from "@/components/ui/button";
import { myGroupQuery } from "@/lib/queries";
import { getAuth } from "@/lib/roster.functions";
import { useSignOut } from "@/lib/use-sign-out";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "My group — Zakereen" },
      { name: "description", content: "Your group members, contact numbers and mohalla locations with timings." },
      { property: "og:title", content: "My group — Zakereen" },
      { property: "og:description", content: "Your group members, contact numbers and mohalla locations with timings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const auth = await getAuth();
    if (auth?.role === "admin") throw redirect({ to: "/admin" });
    if (auth?.role !== "member") throw redirect({ to: "/" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(myGroupQuery),
  component: MyGroupPage,
});

function MyGroupPage() {
  const { data } = useSuspenseQuery(myGroupQuery);
  const signOut = useSignOut();
  const firstName = data.me.name.split(" ")[0];
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <Brand />
        <Button variant="soft" size="sm" onClick={signOut}>
          <LogOut /> Sign out
        </Button>
      </header>
      <p className="mb-4 mt-2 text-lg text-muted-foreground">
        Salaam, <span className="font-semibold text-foreground">{firstName}</span>
      </p>
      {data.group ? (
        <GroupView
          group={data.group}
          members={data.members}
          locations={data.locations}
          youId={data.me.id}
          eyebrow="Your group"
        />
      ) : (
        <EmptyNote>You haven't been added to a group yet. The admin will add you soon.</EmptyNote>
      )}
    </div>
  );
}
