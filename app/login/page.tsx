import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <LoginForm nextPathParam={params.next} errorMessageParam={params.error} />;
}
