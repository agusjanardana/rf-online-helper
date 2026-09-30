import { AuthForm } from "@/src/components/guild/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthForm
      mode="register"
      nextPath={
        next && /^\/invites\/[a-f0-9]{64}$/.test(next) ? next : undefined
      }
    />
  );
}
