import React from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import TaskBlock from "./TaskBlock";

// The shelf of blocks — drag one out, or tap it to drop it into its socket.
// Blocks currently placed on the bot are simply not on the shelf.
export default function BlockTray({ blocks, onPick }) {
  return (
    <div>
      <p
        className="text-[10.5px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "rgba(160,160,192,.7)" }}
      >
        Grab a block
      </p>
      <Droppable droppableId="tray">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="mt-2 space-y-2">
            {blocks.map((b, i) => (
              <Draggable key={b.id} draggableId={b.id} index={i}>
                {(p, snapshot) => (
                  <div
                    ref={p.innerRef}
                    {...p.draggableProps}
                    {...p.dragHandleProps}
                    style={p.draggableProps.style}
                  >
                    <TaskBlock block={b} isDragging={snapshot.isDragging} onTap={() => onPick(b)} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}