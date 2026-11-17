import * as React from "react"
import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field"

import { cn } from "@/lib/utils"

const FORMAT: Intl.NumberFormatOptions = { useGrouping: false }

type NumberFieldProps = Pick<
  NumberFieldPrimitive.Root.Props,
  "id" | "value" | "onValueChange" | "min" | "max" | "disabled" | "required" | "name"
> &
  Pick<React.ComponentProps<"input">, "className" | "ref" | "aria-label" | "aria-invalid">

/**
 * 数だけを受ける欄（増減のボタンは置かない）。全角の数字も数として読む。
 * 範囲の外の値は丸めずにそのまま渡すので、範囲の判定は使う側で持つ。
 */
function NumberField({
  id,
  value,
  onValueChange,
  min,
  max,
  disabled,
  required,
  name,
  className,
  ref,
  ...inputProps
}: NumberFieldProps) {
  return (
    <NumberFieldPrimitive.Root
      id={id}
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      disabled={disabled}
      required={required}
      name={name}
      format={FORMAT}
      locale="ja-JP"
      allowOutOfRange
      className="contents"
    >
      <NumberFieldPrimitive.Input
        ref={ref}
        data-slot="input"
        inputMode="numeric"
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...inputProps}
      />
    </NumberFieldPrimitive.Root>
  )
}

export { NumberField }
