/**
 * LineageGraph — pure-SVG layered lineage diagram.
 *
 * Bronze → Silver → Engine/Models → Gold. Hover a node to highlight its incoming
 * + outgoing edges; click to open the underlying object. Pillar colours tie the
 * layers to the platform's visual language.
 *
 * Built with inline SVG (no external dep) for demo reliability.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

interface Source { name: string; layer: string; described: string }
interface LineageProps {
  sources: Source[];
  models: string[];           // model_ids that contributed (will be auto-laid-out)
  qrtTable: string;
  summaryTable: string;
}

// Layer ordering left → right
const LAYER_ORDER = ['bronze', 'silver', 'engine', 'reference', 'gold'] as const;

const LAYER_STYLE: Record<string, { fill: string; border: string; text: string; label: string }> = {
  bronze:    { fill: '#fff7ed', border: '#fb923c', text: '#9a3412', label: 'Bronze' },
  silver:    { fill: '#f1f5f9', border: '#94a3b8', text: '#334155', label: 'Silver' },
  engine:    { fill: '#faf5ff', border: '#a855f7', text: '#6b21a8', label: 'Engine' },
  reference: { fill: '#eff6ff', border: '#60a5fa', text: '#1e40af', label: 'Ref' },
  gold:      { fill: '#fffbeb', border: '#f59e0b', text: '#92400e', label: 'Gold' },
};

const MODELS_STYLE = { fill: '#f5f3ff', border: '#7c3aed', text: '#5b21b6', label: 'Models' };

export default function LineageGraph({ sources, models, qrtTable, summaryTable }: LineageProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const layout = useMemo(() => {
    const layered: Record<string, Source[]> = {};
    for (const s of sources) (layered[s.layer] ??= []).push(s);

    // Column 0..2 sources, col 3 models, col 4 gold
    const COLS = {
      bronze: 0, silver: 1, engine: 2, reference: 1, gold: 4, models: 3,
    } as const;

    const NODE_W = 168;
    const NODE_H = 36;
    const COL_GAP = 56;
    const ROW_GAP = 12;
    const TOP_PAD = 28;
    const COL_X = (col: number) => col * (NODE_W + COL_GAP) + 12;

    type Node = {
      id: string; col: number; row: number; label: string; layer: string;
      kind: 'source' | 'model' | 'gold';
      x: number; y: number;
    };
    const nodes: Node[] = [];
    const cursorByCol: Record<number, number> = {};

    for (const layer of LAYER_ORDER) {
      const items = layered[layer] ?? [];
      const col = (COLS as Record<string, number>)[layer] ?? 0;
      cursorByCol[col] = cursorByCol[col] ?? 0;
      for (const s of items) {
        const row = cursorByCol[col]++;
        nodes.push({
          id: s.name, col, row, label: s.name, layer,
          kind: 'source',
          x: COL_X(col), y: TOP_PAD + row * (NODE_H + ROW_GAP),
        });
      }
    }
    // Models column
    const modelCol = COLS.models;
    cursorByCol[modelCol] = cursorByCol[modelCol] ?? 0;
    for (const m of models) {
      const row = cursorByCol[modelCol]++;
      nodes.push({
        id: m, col: modelCol, row, label: m, layer: 'models', kind: 'model',
        x: COL_X(modelCol), y: TOP_PAD + row * (NODE_H + ROW_GAP),
      });
    }
    // Gold column — qrt + summary stacked
    const goldCol = COLS.gold;
    cursorByCol[goldCol] = cursorByCol[goldCol] ?? 0;
    nodes.push({ id: qrtTable, col: goldCol, row: cursorByCol[goldCol]++, label: qrtTable, layer: 'gold', kind: 'gold', x: COL_X(goldCol), y: TOP_PAD });
    nodes.push({ id: summaryTable, col: goldCol, row: cursorByCol[goldCol]++, label: summaryTable, layer: 'gold', kind: 'gold', x: COL_X(goldCol), y: TOP_PAD + (NODE_H + ROW_GAP) });

    // Edges — bronze/silver/engine/ref → models or gold; models → gold; ref → gold
    type Edge = { from: string; to: string };
    const edges: Edge[] = [];
    const sourceIds = sources.map((s) => s.name);
    const goldIds = [qrtTable, summaryTable];

    for (const src of sourceIds) {
      // sources whose layer is engine or reference go directly to gold
      const srcLayer = sources.find((s) => s.name === src)?.layer;
      if (models.length > 0 && (srcLayer === 'bronze' || srcLayer === 'silver')) {
        for (const m of models) edges.push({ from: src, to: m });
      } else {
        for (const g of goldIds) edges.push({ from: src, to: g });
      }
    }
    for (const m of models) for (const g of goldIds) edges.push({ from: m, to: g });

    const totalRows = Math.max(...Object.values(cursorByCol), 1);
    const height = TOP_PAD + totalRows * (NODE_H + ROW_GAP) + TOP_PAD;
    const width = COL_X(4) + NODE_W + 16;

    return { nodes, edges, width, height, NODE_W, NODE_H };
  }, [sources, models, qrtTable, summaryTable]);

  const isHighlighted = (id: string) => {
    if (!hovered) return false;
    if (hovered === id) return true;
    return layout.edges.some((e) => (e.from === hovered && e.to === id) || (e.to === hovered && e.from === id));
  };
  const edgeHighlighted = (from: string, to: string) =>
    hovered != null && (hovered === from || hovered === to);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 overflow-x-auto">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-3 flex items-center gap-3 flex-wrap">
        {LAYER_ORDER.map((l) => (
          <span key={l} className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm border" style={{ background: LAYER_STYLE[l].fill, borderColor: LAYER_STYLE[l].border }} />
            {LAYER_STYLE[l].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm border" style={{ background: MODELS_STYLE.fill, borderColor: MODELS_STYLE.border }} />
          Models
        </span>
        <span className="ml-auto text-[10px] text-gray-400 italic normal-case tracking-normal">Hover a node to highlight its dependencies</span>
      </div>
      <svg width={layout.width} height={layout.height} className="text-xs">
        {/* Edges first so nodes paint on top */}
        {layout.edges.map((e, i) => {
          const a = layout.nodes.find((n) => n.id === e.from);
          const b = layout.nodes.find((n) => n.id === e.to);
          if (!a || !b) return null;
          const x1 = a.x + layout.NODE_W;
          const y1 = a.y + layout.NODE_H / 2;
          const x2 = b.x;
          const y2 = b.y + layout.NODE_H / 2;
          const cx = (x1 + x2) / 2;
          const path = `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
          const hi = edgeHighlighted(e.from, e.to);
          return (
            <path key={i} d={path}
              stroke={hi ? '#7c3aed' : '#cbd5e1'}
              strokeWidth={hi ? 2 : 1.25}
              fill="none"
              opacity={hovered && !hi ? 0.2 : 1}
            />
          );
        })}

        {/* Nodes */}
        {layout.nodes.map((n) => {
          const style = n.kind === 'model' ? MODELS_STYLE : LAYER_STYLE[n.layer] ?? LAYER_STYLE.bronze;
          const hi = isHighlighted(n.id);
          const dim = hovered != null && !hi;
          return (
            <g key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              className="cursor-pointer"
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              opacity={dim ? 0.35 : 1}>
              {n.kind === 'model' ? (
                <Link to={`/lab/${n.id}`}>
                  <rect width={layout.NODE_W} height={layout.NODE_H} rx={8}
                    fill={style.fill} stroke={style.border} strokeWidth={hi ? 2 : 1.25} />
                  <text x={10} y={layout.NODE_H / 2} dominantBaseline="middle"
                    fontFamily="ui-monospace, monospace" fontSize={11} fontWeight={600} fill={style.text}>
                    {n.label}
                  </text>
                  <ExternalLinkIcon x={layout.NODE_W - 18} y={layout.NODE_H / 2 - 6} fill={style.text} />
                </Link>
              ) : (
                <>
                  <rect width={layout.NODE_W} height={layout.NODE_H} rx={6}
                    fill={style.fill} stroke={style.border} strokeWidth={hi ? 2 : 1.25} />
                  <text x={10} y={layout.NODE_H / 2} dominantBaseline="middle"
                    fontFamily="ui-monospace, monospace" fontSize={10.5} fill={style.text}>
                    {n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ExternalLinkIcon({ x, y, fill }: { x: number; y: number; fill: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ExternalLink width={12} height={12} stroke={fill} strokeWidth={1.5} />
    </g>
  );
}
