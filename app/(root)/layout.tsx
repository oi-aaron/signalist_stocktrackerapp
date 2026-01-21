import { getAuth } from "@/lib/better-auth/auth"; // Change 'auth' to 'getAuth'
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Header from "@/components/Header";

const layout = async ({ children }: { children: React.ReactNode }) => {
  // 1. Get the actual auth instance first
  const auth = await getAuth(); 
  
  // 2. Now you can safely call .api
  const session = await auth.api.getSession({ 
    headers: await headers() 
  });

  if (!session) {
    redirect('/sign-in');
  }

  const user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  };

  return (
    <main className="min-h-screen text-gray-400">
      <Header user={user} />
      <div className="container py-10">{children}</div>
    </main>
  );
};

export default layout;