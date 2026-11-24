import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth";
import { Landing } from "@/components/landing";
import { accountSessionUrl, enrollUrl, oidcConfig } from "@/lib/oidc";
import { Tool } from "@/components/tool/tool";

/**
 * The front door, decided on the server: a stranger gets the landing page,
 * somebody signed in gets the tool. When linked with `?sso=1` from the hub
 * with OIDC active, bounce straight into sign-in (or clean the URL if signed in)
 * so there is no landing flash.
 */
export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sso?: string }>;
}) {
  const account = await currentAccount();
  const { sso } = await searchParams;
  if (sso === "1") {
    if (account) redirect("/");
    if (oidcConfig()) redirect("/api/auth/login");
  }
  if (!account) {
    return (
      <Landing
        enrollUrl={enrollUrl()}
        accountSessionUrl={oidcConfig() ? accountSessionUrl() : null}
      />
    );
  }
  return <Tool />;
}
