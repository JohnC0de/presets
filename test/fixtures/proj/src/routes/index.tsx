import { notFound, redirect } from "@tanstack/router-core"
export function Local() {
  return <div>x</div>
}
export const Route = { component: Local }
export function guard(flag: boolean): never {
  if (flag) throw redirect({ to: "/" })
  throw notFound()
}
export function bad(): never {
  throw "nope"
}
