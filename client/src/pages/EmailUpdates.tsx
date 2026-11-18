import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function EmailUpdates() {
  const [email, setEmail] = useState("");
  const signup = trpc.registration.requestUpdates.useMutation();
  return <main className="container max-w-xl py-24 text-ink">
    <h1 className="font-display text-4xl font-bold">Email updates from Tabitha Rector</h1>
    <p className="my-5 font-serif">Receive business tips, workshop announcements, and offers from Kingdom Solutions Business &amp; AI™. Check your inbox to confirm your subscription.</p>
    {signup.data?.requested ? <p role="status">Check your inbox for your confirmation link.</p> :
      <form className="grid gap-4" onSubmit={event => { event.preventDefault(); signup.mutate({ email }); }}>
        <label className="grid gap-2">Email address<input className="border p-3" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
        <button className="bg-ink px-5 py-3 text-white" disabled={signup.isPending}>Send my confirmation email</button>
        {(signup.isError || signup.data?.requested === false) && <p role="alert">We could not send your confirmation. Please try again later.</p>}
      </form>}
  </main>;
}
