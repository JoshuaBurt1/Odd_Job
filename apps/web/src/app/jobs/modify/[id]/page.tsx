//web/src/app/jobs/modify/[id]/page.tsx
import ModifyJobClient from "./ModifyJobClient";

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return <ModifyJobClient />;
}