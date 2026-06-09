import { forwardRef, useState, type ReactNode } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { checkInjection, type InjectionResult } from "@/utils/injectionGuard";

interface GuardedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Icon rendered absolute-positioned ด้านซ้าย เช่น <Search className="absolute left-3 ..." /> */
  leadingIcon?: ReactNode;
  /** className สำหรับ outer wrapper div (grid-col, width ฯลฯ) */
  wrapperClassName?: string;
}

/**
 * Input ที่มีการตรวจจับ injection pattern อัตโนมัติ
 * แสดง warning inline แต่ไม่บล็อก typing
 *
 * ห้ามใช้กับ type="password", "email", "date", "number", "url", "file"
 */
const GuardedInput = forwardRef<HTMLInputElement, GuardedInputProps>(
  ({ onChange, className, leadingIcon, wrapperClassName, type, ...props }, ref) => {
    const [result, setResult] = useState<InjectionResult>({ safe: true, message: null });

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setResult(checkInjection(event.target.value));
      onChange?.(event);
    };

    const isWarn = !result.safe && result.severity === "warn";
    const isBlock = !result.safe && result.severity === "block";

    const borderClass = isBlock
      ? "!border-red-400 focus:!ring-red-400"
      : isWarn
        ? "!border-amber-400 focus:!ring-amber-400"
        : "";

    return (
      <div className={wrapperClassName}>
        {/* inner div เป็น relative context สำหรับ leadingIcon เท่านั้น
            ไม่รวม error message เพื่อไม่ให้ top-1/2 ของ icon เลื่อน */}
        <div className="relative">
          {leadingIcon}
          <input
            ref={ref}
            type={type}
            {...props}
            className={`${className ?? ""} ${borderClass}`.trim()}
            onChange={handleChange}
          />
        </div>
        {result.message && (
          <p className={`mt-1 flex items-center gap-1 text-xs ${isBlock ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
            {isBlock
              ? <AlertCircle className="h-3 w-3 shrink-0" />
              : <AlertTriangle className="h-3 w-3 shrink-0" />}
            {result.message}
          </p>
        )}
      </div>
    );
  },
);

GuardedInput.displayName = "GuardedInput";

export default GuardedInput;
