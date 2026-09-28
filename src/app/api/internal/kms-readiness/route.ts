import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json(
      { status: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const present = (name: string) => {
    const value = process.env[name];
    return typeof value === "string" && value.trim().length > 0;
  };

  return NextResponse.json(
    {
      status: "pass",
      awsRegion: present("AWS_REGION"),
      awsRoleArn: present("AWS_ROLE_ARN"),
      kmsKeyId: present("AI_CREDENTIAL_KMS_KEY_ID"),
      vercelOidcToken: present("VERCEL_OIDC_TOKEN"),
      staticAccessKeyIdPresent: present("AWS_ACCESS_KEY_ID"),
      staticSecretAccessKeyPresent: present("AWS_SECRET_ACCESS_KEY"),
      staticSessionTokenPresent: present("AWS_SESSION_TOKEN"),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
