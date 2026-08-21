import React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import {
  formatarCpfCnpj,
  formatarCPF,
  formatarCNPJ,
  getDocumentValidation,
} from "../../lib/documentValidators";

export interface DocumentInputProps {
  label?: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  documentType?: "CPF" | "CNPJ" | "AUTO";
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showFeedbackBadge?: boolean;
  helpText?: string;
  id?: string;
}

export const DocumentInput: React.FC<DocumentInputProps> = ({
  label = "CPF / CNPJ",
  name = "documento",
  value = "",
  onChange,
  documentType = "AUTO",
  required = false,
  disabled = false,
  placeholder,
  className = "",
  showFeedbackBadge = true,
  helpText,
  id,
}) => {
  const inputId = id || name;

  const defaultPlaceholder =
    documentType === "CPF"
      ? "000.000.000-00"
      : documentType === "CNPJ"
      ? "00.000.000/0000-00"
      : "000.000.000-00 ou 00.000.000/0000-00";

  const validation = React.useMemo(() => {
    return getDocumentValidation(value, (documentType || "AUTO") as "CPF" | "CNPJ" | "AUTO");
  }, [value, documentType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    let formatted = raw;

    if (documentType === "CPF") {
      formatted = formatarCPF(raw);
    } else if (documentType === "CNPJ") {
      formatted = formatarCNPJ(raw);
    } else {
      formatted = formatarCpfCnpj(raw);
    }

    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        name,
        value: formatted,
      },
    };

    onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
  };

  const getBorderColor = () => {
    if (!value || validation.status === "empty") {
      return "border-slate-300 focus:ring-brand-dark/30 focus:border-brand-dark";
    }
    if (validation.status === "valid") {
      return "border-emerald-500 text-slate-900 focus:ring-emerald-500/20 focus:border-emerald-600";
    }
    if (validation.status === "typing") {
      return "border-amber-400 focus:ring-amber-400/20 focus:border-amber-500";
    }
    return "border-rose-500 focus:ring-rose-500/20 focus:border-rose-600";
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700"
          >
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {documentType === "AUTO" && value && (
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {validation.type}
            </span>
          )}
        </div>
      )}

      <div className="relative">
        <input
          id={inputId}
          type="text"
          name={name}
          value={value}
          onChange={handleChange}
          required={required}
          disabled={disabled}
          placeholder={placeholder || defaultPlaceholder}
          maxLength={documentType === "CPF" ? 14 : documentType === "CNPJ" ? 18 : 18}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors sm:text-sm ${getBorderColor()} ${
            disabled ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white"
          }`}
        />

        {value && showFeedbackBadge && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
            {validation.status === "valid" && (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            {validation.status === "invalid" && (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            )}
            {validation.status === "typing" && (
              <AlertCircle className="w-4 h-4 text-amber-500 opacity-80" />
            )}
          </div>
        )}
      </div>

      {showFeedbackBadge && value && validation.message && (
        <div className="flex items-center gap-1.5 pt-0.5">
          {validation.status === "valid" ? (
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 size={12} /> {validation.message}
            </p>
          ) : validation.status === "invalid" ? (
            <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
              <AlertTriangle size={12} /> {validation.message}
            </p>
          ) : (
            <p className="text-xs text-amber-600 font-normal flex items-center gap-1">
              <AlertCircle size={12} /> {validation.message}
            </p>
          )}
        </div>
      )}

      {helpText && !value && (
        <p className="text-xs text-slate-500">{helpText}</p>
      )}
    </div>
  );
};
