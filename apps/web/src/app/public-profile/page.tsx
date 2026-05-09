//web/src/app/public-profile/page.tsx 

import { Suspense } from "react";
import UserClient from "./UserClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading profile...</div>}>
      <UserClient />
    </Suspense>
  );
}