"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import API from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function FooterCMS() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: "",
    description: "",
    email: "",
  });
  const { toast } = useToast();

  const handleSubmit = async () => {
    await API.post("/admin/footer", form);
    toast("Saved!", "success");
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold">Footer Settings</h1>
          <p className="text-sm text-gray-500">Manage footer company information and links</p>
        </div>
        <button onClick={() => router.push("/admin/cms")} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg shadow-sm transition shrink-0 text-sm">
          ← Back
        </button>
      </div>

      <div className="grid gap-3">
        <input placeholder="Company Name" onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
        <textarea placeholder="Description" onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input placeholder="Email" onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <button onClick={handleSubmit} className="bg-blue-600 text-white py-2 rounded">
          Save Footer
        </button>
      </div>
    </div>
  );
}