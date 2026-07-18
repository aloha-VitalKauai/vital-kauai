import { LoginLanding } from "@/components/login-landing";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <LoginLanding nextPathParam={params.next} errorMessageParam={params.error} />;
}
