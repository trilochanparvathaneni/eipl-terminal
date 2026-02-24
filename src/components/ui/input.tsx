import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 min-h-[44px] w-full min-w-0 items-center rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm leading-6 text-slate-900 ring-offset-transparent file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 transition-[border-color,box-shadow,background-color,color] motion-standard focus-visible:outline-none focus-visible:ring-0 focus-visible:border-sky-400/70 focus-visible:shadow-[0_0_8px_rgba(59,130,246,0.5)] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
