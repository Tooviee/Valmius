import { Path, Rect, Svg } from "@react-pdf/renderer";

/** The V mark from src/app/icon.svg, for the brand row at the top of every PDF. */
export function PdfMark({ size = 11 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" style={{ marginRight: 4 }}>
      <Rect x={0} y={0} width={64} height={64} rx={14} ry={14} fill="#1c3b8f" />
      <Path
        d="M17 19 L32 47 L47 19"
        stroke="#f7f6f2"
        strokeWidth={7}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
