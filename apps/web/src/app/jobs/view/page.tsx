// web/src/app/jobs/view/page.tsx

import { Suspense } from "react";
import ViewJobClient from "./ViewJobClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading job details...</div>}>
      <ViewJobClient />
    </Suspense>
  );
}