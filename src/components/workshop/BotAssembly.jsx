import React from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import TaskBlock, { CAT_COLORS } from "./TaskBlock";
import WorkshopBot from "./WorkshopBot";

// The bot and its three sockets — when it runs, what it does, how it tells
// you. Drag a block into a socket, or tap a placed block to take it back off.
const SOCKETS = [
  { cat: "when", hint: "When it runs — drag a green block here" },
  { cat: "what", hint: "What it does — drag a gold block here" },
  { cat: "tells", hint: "How it tells you — drag a violet block here" },
];

export default function BotAssembly({ sockets, blocksById, powered, onRemove }) {
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <div className="shrink-0 pt-1">
        <WorkshopBot powered={powered} size={132} />
        <p
          className="mt-1 text-center text-[11.5px]"
          style={{ color: powered ? "#6DE5C0" : "rgba(160,160,192,.6)" }}
        >
          {powered ? "ready to wake up" : "waiting for its job"}
        </p>
      </div>
      <div className="w-full space-y-2.5">
        {SOCKETS.map(({ cat, hint }) => {
          const id = sockets[cat];
          const block = id ? blocksById[id] : null;
          const color = CAT_COLORS[cat];
          return (
            <Droppable key={cat} droppableId={"socket-" + cat}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex h-14 items-center rounded-2xl border-2 border-dashed p-1 transition-colors"
                  style={{
                    borderColor: block
                      ? "transparent"
                      : snapshot.isDraggingOver
                      ? color
                      : "rgba(64,64,96,.7)",
                    background: snapshot.isDraggingOver ? color + "14" : "rgba(27,27,46,.6)",
                  }}
                >
                  {block ? (
                    <Draggable draggableId={block.id} index={0}>
                      {(p) => (
                        <div
                          ref={p.innerRef}
                          {...p.draggableProps}
                          {...p.dragHandleProps}
                          style={p.draggableProps.style}
                        >
                          <TaskBlock block={block} onTap={() => onRemove(cat)} />
                        </div>
                      )}
                    </Draggable>
                  ) : (
                    <p
                      className="flex h-12 w-full items-center justify-center px-2 text-center text-[11.5px]"
                      style={{ color: "rgba(160,160,192,.75)" }}
                    >
                      {hint}
                    </p>
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </div>
  );
}