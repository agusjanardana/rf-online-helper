"use client";
import { useRouter } from "next/navigation";
import { api } from "@/src/lib/guild-api";
import { ActionForm, useWords } from "./ui";
export function InviteAccept({
  token,
  username,
}: {
  token: string;
  username: string;
}) {
  const w = useWords();
  const router = useRouter();
  return (
    <section className="guild-shell panel">
      <h1>{w("Undangan pengurus", "Officer invitation")}</h1>
      <p>{username}</p>
      <p>
        {w(
          "Undangan ini memberi akses pengurus. Masuk dengan username tujuan yang sesuai. Member tidak memerlukan undangan.",
          "This invitation grants officer access. Sign in with the invited username. Members do not need invitations.",
        )}
      </p>
      <ActionForm
        submit={w("Terima undangan", "Accept invitation")}
        onSubmit={async () => {
          const data = await api<{ id: string }>("/api/guild", {
            action: "accept_invite",
            payload: { token },
          });
          router.push(`/guilds/${data.id}`);
          router.refresh();
        }}
      >
        {null}
      </ActionForm>
    </section>
  );
}
