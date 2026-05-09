// web/src/app/jobs/view/[id]/page.tsx
import ViewJobClient from "./ViewJobClient";

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return <ViewJobClient />;
}