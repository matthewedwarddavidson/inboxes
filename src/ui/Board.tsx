import { useCallback, useRef, useState } from 'react';
import {
  cluesInside,
  evaluateBox,
  rectContains,
  type Puzzle,
  type Rect,
} from '../engine';
import { colorForValue } from './colors';

const CELL = 40;
const STROKE = 2;

interface BoardProps {
  puzzle: Puzzle;
  boxes: Rect[];
  onAddBox: (rect: Rect) => void;
  onRemoveBox: (index: number) => void;
  interactive: boolean;
}

interface DragState {
  startRow: number;
  startCol: number;
  curRow: number;
  curCol: number;
}

function normalizeRect(d: DragState): Rect {
  return {
    row0: Math.min(d.startRow, d.curRow),
    col0: Math.min(d.startCol, d.curCol),
    row1: Math.max(d.startRow, d.curRow),
    col1: Math.max(d.startCol, d.curCol),
  };
}

export function Board({ puzzle, boxes, onAddBox, onRemoveBox, interactive }: BoardProps) {
  const { width, height, clues } = puzzle;
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const cellFromEvent = useCallback(
    (clientX: number, clientY: number): { row: number; col: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * (width * CELL);
      const y = ((clientY - rect.top) / rect.height) * (height * CELL);
      const col = Math.max(0, Math.min(width - 1, Math.floor(x / CELL)));
      const row = Math.max(0, Math.min(height - 1, Math.floor(y / CELL)));
      return { row, col };
    },
    [width, height],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    const cell = cellFromEvent(e.clientX, e.clientY);
    if (!cell) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag({ startRow: cell.row, startCol: cell.col, curRow: cell.row, curCol: cell.col });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const cell = cellFromEvent(e.clientX, e.clientY);
    if (!cell) return;
    if (cell.row !== drag.curRow || cell.col !== drag.curCol) {
      setDrag({ ...drag, curRow: cell.row, curCol: cell.col });
    }
  };

  const onPointerUp = () => {
    if (!drag) return;
    const rect = normalizeRect(drag);
    setDrag(null);

    const isSingleCell = rect.row0 === rect.row1 && rect.col0 === rect.col1;

    // Single-cell tap on an existing box removes it.
    if (isSingleCell) {
      const idx = boxes.findIndex((b) => rectContains(b, rect.row0, rect.col0));
      if (idx >= 0) {
        onRemoveBox(idx);
        return;
      }
      // Only commit a 1x1 if a value-1 clue lives there; otherwise ignore.
      const hasUnitClue = clues.some(
        (c) => c.row === rect.row0 && c.col === rect.col0 && c.value === 1,
      );
      if (!hasUnitClue) return;
    }

    onAddBox(rect);
  };

  const boardW = width * CELL;
  const boardH = height * CELL;
  const preview = drag ? normalizeRect(drag) : null;

  return (
    <svg
      ref={svgRef}
      className="board"
      viewBox={`${-STROKE} ${-STROKE} ${boardW + STROKE * 2} ${boardH + STROKE * 2}`}
      role="img"
      aria-label="Inboxes puzzle board"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
    >
      {/* Board background */}
      <rect x={0} y={0} width={boardW} height={boardH} className="board__bg" />

      {/* Grid lines */}
      {Array.from({ length: width + 1 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={i * CELL}
          y1={0}
          x2={i * CELL}
          y2={boardH}
          className="board__grid"
        />
      ))}
      {Array.from({ length: height + 1 }, (_, i) => (
        <line
          key={`h${i}`}
          x1={0}
          y1={i * CELL}
          x2={boardW}
          y2={i * CELL}
          className="board__grid"
        />
      ))}

      {/* Committed boxes */}
      {boxes.map((box, i) => {
        const evalResult = evaluateBox(box, clues, boxes);
        const area = (box.row1 - box.row0 + 1) * (box.col1 - box.col0 + 1);
        const clue = evalResult.clue;
        const invalid = evalResult.overlaps || !clue || area > clue.value;
        const complete = !invalid && !!clue && area === clue.value;
        const color = clue ? colorForValue(clue.value) : null;
        const style =
          !invalid && color
            ? {
                fill: color.fill,
                stroke: color.stroke,
                fillOpacity: complete ? 0.92 : 0.5,
              }
            : undefined;
        const status = invalid ? 'invalid' : complete ? 'complete' : 'partial';
        return (
          <rect
            key={i}
            x={box.col0 * CELL + STROKE}
            y={box.row0 * CELL + STROKE}
            width={(box.col1 - box.col0 + 1) * CELL - STROKE * 2}
            height={(box.row1 - box.row0 + 1) * CELL - STROKE * 2}
            rx={5}
            className={`board__box board__box--${status}`}
            style={style}
          />
        );
      })}

      {/* Drag preview */}
      {preview && (
        <rect
          x={preview.col0 * CELL + STROKE}
          y={preview.row0 * CELL + STROKE}
          width={(preview.col1 - preview.col0 + 1) * CELL - STROKE * 2}
          height={(preview.row1 - preview.row0 + 1) * CELL - STROKE * 2}
          rx={4}
          className="board__preview"
        />
      )}

      {/* Clues */}
      {clues.map((clue, i) => {
        const cx = clue.col * CELL + CELL / 2;
        const cy = clue.row * CELL + CELL / 2;
        // A clue is "satisfied" if some box exactly matches its area & contains it.
        const box = boxes.find((b) => cluesInside(b, [clue]).length === 1);
        const satisfied =
          box !== undefined &&
          (box.row1 - box.row0 + 1) * (box.col1 - box.col0 + 1) === clue.value;
        const color = colorForValue(clue.value);
        return (
          <g key={`clue${i}`} className={`board__clue ${satisfied ? 'board__clue--done' : ''}`}>
            <circle
              cx={cx}
              cy={cy}
              r={CELL * 0.38}
              className="board__clue-bg"
              style={{ fill: satisfied ? color.stroke : undefined, stroke: color.stroke }}
            />
            <text x={cx} y={cy} className="board__clue-text" dominantBaseline="central" textAnchor="middle">
              {clue.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
