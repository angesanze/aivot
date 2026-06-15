import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useT } from "../i18n.jsx";

/* Bottone di supporto Ko-fi, flottante in basso a destra.
   Compare SOLO se in /admin/ è stato impostato un handle Ko-fi
   (SiteConfig.kofi_handle): l'handle vive nel database dell'istanza, quindi
   il bottone è attivo solo sul deploy del creatore, non sui fork (DB vuoto).
   Togliere il bottone = svuotare il campo nel backoffice. */
export default function KofiButton() {
  const t = useT();
  const [handle, setHandle] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .authConfig()
      .then((c) => alive && setHandle((c.kofi_handle || "").trim()))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!handle) return null;

  return (
    <a
      href={`https://ko-fi.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      title={t("kofi.support")}
      aria-label={t("kofi.support")}
      className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2
                 rounded-full px-4 py-2.5 text-sm font-semibold text-white
                 shadow-lg shadow-black/20 transition hover:-translate-y-0.5
                 hover:brightness-110"
      style={{ backgroundColor: "#ff5e5b" }}
    >
      <span aria-hidden="true" className="text-base leading-none">
        ☕
      </span>
      <span className="hidden sm:inline">{t("kofi.support")}</span>
    </a>
  );
}
