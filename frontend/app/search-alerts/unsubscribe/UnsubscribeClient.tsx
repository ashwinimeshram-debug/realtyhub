"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import API from "@/lib/api";

export default function UnsubscribeClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Missing unsubscribe token.");
      return;
    }
    API.post("/saved-searches/unsubscribe", { token })
      .then(() => {
        setState("ok");
        setMessage("You have been unsubscribed from these property alerts.");
      })
      .catch((e: any) => {
        setState("error");
        setMessage(e?.response?.data?.error || "We could not process this request.");
      });
  }, [token]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4 py-16">
      <div className="bg-white rounded-xl shadow p-6 md:p-8 max-w-md text-center">
        <h1 className="text-xl font-bold mb-3" style={{ color: "var(--primary)" }}>
          Search alerts
        </h1>
        {state === "loading" ? (
          <p className="text-gray-500 text-sm">Processing...</p>
        ) : (
          <>
            <p className={`text-sm mb-5 ${state === "ok" ? "text-gray-700" : "text-red-600"}`}>
              {message}
            </p>
            <Link href="/properties" className="text-sm font-medium" style={{ color: "var(--primary)" }}>
              Browse properties
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
