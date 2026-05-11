import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function CopyOnHover({ value, children, className = "" }) {
  const [copied, setCopied] = useState(false);

  if (!value) return <span className={className}>{children || value}</span>;

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`הועתק: ${value}`, { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("שגיאה בהעתקה");
    }
  };

  return (
    <span
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 cursor-pointer group hover:text-blue-600 transition-colors ${className}`}
      title={`לחץ להעתקה: ${value}`}
    >
      {children || value}
      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3 text-gray-400" />
        )}
      </span>
    </span>
  );
}