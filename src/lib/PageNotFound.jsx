import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function PageNotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["404-user"],
    queryFn: async () => {
      try {
        const user = await base44.auth.me();
        return { user, authenticated: true };
      } catch (_) {
        return { user: null, authenticated: false };
      }
    },
    staleTime: 30_000,
  });

  const destination = data?.authenticated ? "/notes" : "/";

  return (
    <div className="page-glow flex min-h-screen items-center justify-center px-5 py-12">
      <div className="glass w-full max-w-[520px] rounded-[28px] p-7 text-center sm:p-10">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-neutral-400">Buddy</p>
        <h1 className="mt-4 font-heading text-[34px] font-semibold tracking-tight text-neutral-950 sm:text-[42px]">
          That page isn’t here.
        </h1>
        <p className="mx-auto mt-3 max-w-[400px] text-[14px] leading-relaxed text-neutral-500">
          Nothing you handed off was changed. Head back to Buddy and pick up where you left off.
        </p>
        <button
          type="button"
          onClick={() => navigate(destination)}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Buddy
        </button>
        {data?.user?.role === "admin" && (
          <p className="mt-6 break-all font-mono text-[10px] text-neutral-300">Missing route: {location.pathname}</p>
        )}
      </div>
    </div>
  );
}
