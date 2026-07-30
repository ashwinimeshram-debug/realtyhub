"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import API from "@/lib/api";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const BUILTIN_SECTIONS = [
  { key: "hero", name: "Hero Section", path: "/admin/cms/hero", settingKey: "section_hero_visible" },
  { key: "services", name: "Services", path: "/admin/cms/services", settingKey: "section_services_visible" },
  { key: "advantages", name: "Advantages", path: "/admin/cms/advantages", settingKey: "section_advantages_visible" },
  { key: "testimonials", name: "Testimonials", path: "/admin/cms/testimonials", settingKey: "section_testimonials_visible" },
  { key: "featured", name: "Featured Properties", path: "/admin/cms/featured", settingKey: "section_featured_visible" },
  { key: "faq", name: "FAQ", path: "/admin/cms/faq", settingKey: "section_faq_visible" },
  { key: "locations", name: "Location Tags (Footer)", path: null, settingKey: "section_locations_visible" },
];

function SortableSection({
  section,
  isVisible,
  onToggle,
  children,
}: {
  section: any;
  isVisible: boolean;
  onToggle: (key: string) => void;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white shadow rounded-xl p-4 transition ${
        isVisible ? "" : "opacity-60"
      } ${isDragging ? "ring-2 ring-blue-400" : ""}`}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 shrink-0"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
        </button>

        {/* Visibility Toggle */}
        <button
          onClick={() => onToggle(section.settingKey)}
          className={`w-10 h-5 rounded-full flex items-center p-0.5 transition shrink-0 ${
            isVisible ? "bg-blue-600" : "bg-gray-300"
          }`}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
              isVisible ? "translate-x-5" : ""
            }`}
          />
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm md:text-base">{section.name}</h2>
          <p className="text-xs text-gray-400">
            {isVisible ? "Visible on homepage" : "Hidden"}
          </p>
        </div>

        {section.path && (
          <Link
            href={section.path}
            className="text-[var(--primary)] hover:underline text-sm font-medium shrink-0"
          >
            Edit →
          </Link>
        )}
      </div>

      {children && <div className="mt-3 border-t pt-3">{children}</div>}
    </div>
  );
}

export default function CMSDashboard() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    API.get("/settings").then((res) => setSettings(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const savedOrder = settings["section_order"];
    if (savedOrder) {
      try {
        const saved = JSON.parse(savedOrder);
        setSectionOrder([...saved, ...BUILTIN_SECTIONS.map((s) => s.key).filter((k) => !saved.includes(k))]);
      } catch {
        setSectionOrder(BUILTIN_SECTIONS.map((s) => s.key));
      }
    } else {
      setSectionOrder(BUILTIN_SECTIONS.map((s) => s.key));
    }
  }, [settings]);

  const toggleSection = async (settingKey: string) => {
    const currentValue = settings[settingKey] === "true";
    const newValue = !currentValue;
    const updated = { ...settings, [settingKey]: String(newValue) };
    setSettings(updated);
    try {
      await API.put("/admin/settings", { [settingKey]: String(newValue) });
    } catch {
      setSettings((prev) => ({ ...prev, [settingKey]: String(currentValue) }));
    }
  };

  const handleDragEnd = useCallback(
    async (event: any) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sectionOrder.indexOf(active.id);
      const newIndex = sectionOrder.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(sectionOrder, oldIndex, newIndex);
      setSectionOrder(newOrder);
      try {
        await API.put("/admin/settings", {
          section_order: JSON.stringify(newOrder),
        });
      } catch {
        setSectionOrder(sectionOrder);
      }
    },
    [sectionOrder]
  );

  const allSections = BUILTIN_SECTIONS;

  const orderedSections = sectionOrder
    .map((key) => allSections.find((s) => s.key === key))
    .filter(Boolean)
    .concat(allSections.filter((s) => !sectionOrder.includes(s.key)));

  return (
    <div className="p-3 md:p-6">
      <h1 className="text-2xl font-bold text-gray-800">CMS</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4 md:mb-6">Reorder homepage sections and manage their content</p>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
        <p className="text-xs text-gray-400 self-center hidden sm:block">Drag to reorder sections</p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedSections.map((s) => s!.key)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {orderedSections.map((section) => {
              if (!section) return null;
              const isVisible = settings[section.settingKey] === "true";

              return (
                <SortableSection
                  key={section.key}
                  section={section}
                  isVisible={isVisible}
                  onToggle={toggleSection}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
