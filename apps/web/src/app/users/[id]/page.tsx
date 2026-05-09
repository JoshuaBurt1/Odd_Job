//web/src/app/users/[id]/page.tsx 
import UserClient from "./UserClient";

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return <UserClient />;
}