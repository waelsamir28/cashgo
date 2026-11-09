"use client";

import { useMemo } from "react";
import { barcodeFrom } from "@/lib/barcode";

type Props = {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
  color?: string;
  fontSize?: number;
};

export default function Barcode({ value, width = 200, height = 40, showText = true, color = "#000000", fontSize = 11 }: Props) {
  const { bits, digits } = useMemo(() => barcodeFrom(value), [value]);

  const unit = width / bits.length;
  const rects = useMemo(() => {
    const result: number[] = [];
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === "1") result.push(i);
    }
    return result;
  }, [bits]);

  return (
    <div style={{ direction: "ltr", textAlign: "center", lineHeight: 1 }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", margin: "0 auto", shapeRendering: "crispEdges" }}>
        <rect x={0} y={0} width={width} height={height} fill="#fff" />
        {rects.map((index) => (
          <rect key={index} x={index * unit} y={0} width={unit + 0.02} height={height} fill={color} />
        ))}
      </svg>
      {showText && (
        <div style={{ fontFamily: '"Courier New", monospace', fontSize, letterSpacing: 2, color, marginTop: 2 }}>{digits}</div>
      )}
    </div>
  );
}
