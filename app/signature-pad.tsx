"use client";

import { useEffect, useRef } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignaturePad({
  value,
  onChange,
  disabled = false,
  ariaLabel = "Zone de signature tactile du livreur",
  clearLabel = "Effacer la signature",
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  ariaLabel?: string;
  clearLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    drawing = useRef(false),
    empty = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 700;
    canvas.height = 250;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#32151d";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    empty.current = true;
    if (value) {
      const image = new Image();
      image.onload = () => {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        empty.current = false;
      };
      image.src = value;
    }
  }, [value]);

  const position = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (event.currentTarget.width / rect.width),
      y:
        (event.clientY - rect.top) * (event.currentTarget.height / rect.height),
    };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const context = event.currentTarget.getContext("2d"),
      point = position(event);
    context?.beginPath();
    context?.moveTo(point.x, point.y);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const context = event.currentTarget.getContext("2d"),
      point = position(event);
    context?.lineTo(point.x, point.y);
    context?.stroke();
    empty.current = false;
  };
  const finish = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    event.currentTarget.getContext("2d")?.closePath();
    onChange(empty.current ? null : event.currentTarget.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current,
      context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    empty.current = true;
    onChange(null);
  };
  return (
    <div className="signature-field">
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        aria-label={ariaLabel}
      />
      <Button
        type="button"
        variant="outline"
        className="button"
        onClick={clear}
        disabled={disabled || !value}
      >
        <Eraser size={16} />
        {clearLabel}
      </Button>
    </div>
  );
}
