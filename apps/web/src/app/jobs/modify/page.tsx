//web/src/app/jobs/modify/page.tsx

import { Suspense } from "react";
import ModifyJobClient from "./ModifyJobClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-zinc-500">Loading editor...</div>}>
      <ModifyJobClient />
    </Suspense>
  );
}