import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Pencil } from "lucide-react";

const CAT_META = {
  when: { label: "WHEN", color: "#10B981" },
  what: { label: "WHAT", color: "#F59E0B" },
  tells: { label: "HOW IT TELLS YOU", color: "#8B5CF6" },
};

// The drag-and-drop view of what you typed: your sentence, split into
// when / what / tells cards. Drag to arrange, tap the pencil to reword.
export default function PlanBoard({ order, lines, editing, onReorder, onEdit, onChange, onCommit }) {
  return (
    <DragDropContext
      onDragEnd={(r) => {
        if (!r.destination) return;
        onReorder(r.source.index, r.destination.index);
      }}
    >
      <Droppable droppableId="plan">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2.5">
            {order.map((cat, i) => {
              const meta = CAT_META[cat];
              return (
                <Draggable key={cat} draggableId={cat} index={i}>
                  {(p, snapshot) => (
                    <div
                      ref={p.innerRef}
                      {...p.draggableProps}
                      style={{
                        ...p.draggableProps.style,
                        boxShadow: snapshot.isDragging
                          ? "0 14px 32px -14px rgba(0,0,0,.22)"
                          : undefined,
                      }}
                      className={`flex items-start gap-3 rounded-2xl border bg-white p-4 ${
                        snapshot.isDragging ? "border-neutral-300" : "border-neutral-200"
                      }`}
                    >
                      <span {...p.dragHandleProps} className="mt-0.5 cursor-grab text-neutral-300 hover:text-neutral-400">
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <span
                        className="mt-2 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: meta.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </p>
                        {editing === cat ? (
                          <input
                            autoFocus
                            value={lines[cat]}
                            onChange={(e) => onChange(cat, e.target.value)}
                            onBlur={onCommit}
                            onKeyDown={(e) => e.key === "Enter" && onCommit()}
                            className="mt-1 w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[15px] text-neutral-900 outline-none"
                          />
                        ) : (
                          <p className="mt-0.5 text-[15px] leading-snug text-neutral-900">
                            {lines[cat]}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onEdit(cat)}
                        className="mt-0.5 shrink-0 text-neutral-400 hover:text-neutral-700"
                        aria-label={`Reword the ${meta.label.toLowerCase()} line`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}