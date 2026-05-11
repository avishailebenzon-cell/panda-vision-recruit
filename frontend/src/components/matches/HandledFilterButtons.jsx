import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle } from 'lucide-react';

/**
 * Filter buttons for showing handled/unhandled matches
 * Based on is_manually_handled field
 */
export default function HandledFilterButtons({ filter, onFilterChange, agentColor = "blue" }) {
  const colorClasses = {
    orange: {
      active: "bg-orange-600 hover:bg-orange-700",
      outline: "border-orange-300 text-orange-700 hover:bg-orange-50"
    },
    teal: {
      active: "bg-teal-600 hover:bg-teal-700",
      outline: "border-teal-300 text-teal-700 hover:bg-teal-50"
    },
    indigo: {
      active: "bg-indigo-600 hover:bg-indigo-700",
      outline: "border-indigo-300 text-indigo-700 hover:bg-indigo-50"
    },
    amber: {
      active: "bg-amber-600 hover:bg-amber-700",
      outline: "border-amber-300 text-amber-700 hover:bg-amber-50"
    },
    emerald: {
      active: "bg-emerald-600 hover:bg-emerald-700",
      outline: "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
    },
    violet: {
      active: "bg-violet-600 hover:bg-violet-700",
      outline: "border-violet-300 text-violet-700 hover:bg-violet-50"
    },
    gray: {
      active: "bg-gray-600 hover:bg-gray-700",
      outline: "border-gray-300 text-gray-700 hover:bg-gray-50"
    },
    red: {
      active: "bg-red-600 hover:bg-red-700",
      outline: "border-red-300 text-red-700 hover:bg-red-50"
    }
  };

  const colors = colorClasses[agentColor] || colorClasses.blue;

  return (
    <div className="flex gap-2 flex-wrap">
      <Button
        variant={filter === "all" ? "default" : "outline"}
        size="sm"
        onClick={() => onFilterChange("all")}
        className={`text-xs md:text-sm flex items-center gap-1 ${filter === "all" ? colors.active : colors.outline}`}
      >
        <Circle className="w-3 h-3" />
        הכל
      </Button>
      <Button
        variant={filter === "unhandled" ? "default" : "outline"}
        size="sm"
        onClick={() => onFilterChange("unhandled")}
        className={`text-xs md:text-sm flex items-center gap-1 ${filter === "unhandled" ? colors.active : colors.outline}`}
      >
        <Circle className="w-3 h-3" />
        לא טופלו
      </Button>
      <Button
        variant={filter === "handled" ? "default" : "outline"}
        size="sm"
        onClick={() => onFilterChange("handled")}
        className={`text-xs md:text-sm flex items-center gap-1 ${filter === "handled" ? "bg-green-600 hover:bg-green-700" : "border-green-300 text-green-700 hover:bg-green-50"}`}
      >
        <CheckCircle className="w-3 h-3" />
        טופלו
      </Button>
    </div>
  );
}