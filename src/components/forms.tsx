"use client";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, Plus, X } from "lucide-react";
export type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
  min?: number;
  max?: number;
};
export async function api(action: string, data: unknown) {
  const response = await fetch(`/api/actions/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong.");
  return result;
}
export function ActionForm({
  title,
  trigger,
  action,
  fields,
  defaults = {},
  description,
  secondary = false,
}: {
  title: string;
  trigger?: string;
  action: string;
  fields: Field[];
  defaults?: Record<string, unknown>;
  description?: string;
  secondary?: boolean;
}) {
  const dialogId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [choiceSearch, setChoiceSearch] = useState<Record<string, string>>({});
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { isSubmitting },
  } = useForm<Record<string, unknown>>({ defaultValues: defaults });
  const submit = async (values: Record<string, unknown>) => {
    setError("");
    try {
      const data: Record<string, unknown> = { ...defaults, ...values };
      fields.forEach((f) => {
        if (f.type === "datetime-local" && data[f.name]) {
          data[f.name] = new Date(String(data[f.name])).toISOString();
        }
        if (f.type === "number" && data[f.name] !== "")
          data[f.name] = Number(data[f.name]);
        if (
          data[f.name] === "" &&
          (f.name === "password" ||
            f.name === "year" ||
            f.name === "requestId" ||
            f.name === "returnedAt")
        )
          delete data[f.name];
      });
      await api(action, data);
      toast.success(`${title} completed`);
      dialog.current?.close();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <button
        className={`button ${secondary ? "secondary" : ""}`}
        onClick={() => {
          reset(defaults);
          setError("");
          setChoiceSearch({});
          dialog.current?.showModal();
        }}
      >
        {!secondary && <Plus size={16} />} {trigger || title}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={dialogId}
        className="dialog"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">FOLIO · BOOK BANK</p>
            <h2 id={dialogId}>{title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p className="muted mb-5 text-sm">
          {description || "Review the details below before saving."}
        </p>
        <form
          onSubmit={(event) => {
            void handleSubmit(submit)(event);
          }}
          className="form-grid"
        >
          {fields.map((f) => (
            <div key={f.name} className={f.type === "textarea" ? "full" : ""}>
              {f.type === "select" && (f.options?.length ?? 0) > 10 && (
                <input
                  type="search"
                  className="mb-2"
                  aria-label={`Search ${f.label.toLowerCase()}`}
                  placeholder={`Search ${f.label.toLowerCase()}…`}
                  value={choiceSearch[f.name] ?? ""}
                  onChange={(event) =>
                    setChoiceSearch((current) => ({
                      ...current,
                      [f.name]: event.target.value,
                    }))
                  }
                />
              )}
              <label>
                <span>
                  {f.label}
                  {f.required ? " *" : ""}
                </span>
                {f.type === "select" ? (
                  <select
                    aria-label={f.label}
                    {...register(f.name)}
                    required={f.required}
                  >
                    <option value="">Select…</option>
                    {f.options
                      ?.filter(
                        (o) =>
                          o.value === getValues(f.name) ||
                          o.label
                            .toLowerCase()
                            .includes(
                              (choiceSearch[f.name] ?? "").toLowerCase(),
                            ),
                      )
                      .map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    aria-label={f.label}
                    {...register(f.name)}
                    rows={3}
                    required={f.required}
                  />
                ) : f.type === "checkbox" ? (
                  <input
                    aria-label={f.label}
                    type="checkbox"
                    {...register(f.name)}
                  />
                ) : (
                  <input
                    aria-label={f.label}
                    {...register(f.name)}
                    type={f.type || "text"}
                    required={f.required}
                    min={f.min}
                    max={f.max}
                    minLength={f.type === "password" ? 12 : undefined}
                    autoComplete={
                      f.type === "password" ? "new-password" : undefined
                    }
                  />
                )}{" "}
                {f.help && <small>{f.help}</small>}
              </label>
            </div>
          ))}
          {error && (
            <p role="alert" className="form-error full">
              {error}
            </p>
          )}
          <div className="dialog-footer full">
            <button
              type="button"
              className="button secondary"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button disabled={isSubmitting} className="button">
              {isSubmitting && (
                <LoaderCircle size={16} className="animate-spin" />
              )}
              Confirm & save
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
export function ActionButton({
  action,
  data,
  label,
  confirm,
  danger = false,
}: {
  action: string;
  data: unknown;
  label: string;
  confirm?: string;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      disabled={busy}
      className={`button secondary compact ${danger ? "danger-text" : ""}`}
      onClick={async () => {
        if (confirm && !window.confirm(confirm)) return;
        setBusy(true);
        try {
          await api(action, data);
          toast.success("Saved successfully");
          router.refresh();
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <LoaderCircle size={14} className="animate-spin" /> : label}
    </button>
  );
}
export function PrintButton() {
  return (
    <button className="button secondary" onClick={() => window.print()}>
      Print report
    </button>
  );
}
export function ImportStudents() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    errors: string[];
  } | null>(null);
  const router = useRouter();
  return (
    <div className="import-box">
      <label className="button secondary">
        {busy ? "Importing…" : "Import CSV"}
        <input
          aria-label="Import students CSV"
          type="file"
          accept=".csv"
          hidden
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              const response = await fetch("/api/students/import", {
                method: "POST",
                headers: { "Content-Type": "text/csv" },
                body: await file.text(),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error);
              setResult(data);
              router.refresh();
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {result && (
        <div role="status" className="import-result">
          <strong>{result.imported} students imported</strong>
          {result.errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
          <button className="text-link" onClick={() => setResult(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
